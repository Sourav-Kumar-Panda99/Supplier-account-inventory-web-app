"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireRole } from "@/lib/auth";
import {
  assignAccounts,
  createAccount,
  deleteAccounts,
  setStatusAsAdmin,
  setStatusAsBuyer,
  updateAccount,
} from "@/lib/data/accounts";
import { listProfiles } from "@/lib/data/profiles";
import { setSecret } from "@/lib/data/secrets";
import { isValidEmail, optionalString, requiredString, ValidationError } from "@/lib/validation";
import { ACCOUNT_STATUSES, SECRET_TYPES } from "@/lib/types";
import type { AccountStatus, ActionResult, BuyerDecision, SecretType } from "@/lib/types";

const MAX_NOTE_LENGTH = 500;

function revalidateAdmin(accountId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/accounts");
  revalidatePath("/admin/users");
  if (accountId) revalidatePath(`/admin/accounts/${accountId}`);
}

function readNote(formData: FormData | undefined): string {
  return formData instanceof FormData ? optionalString(formData, "note").slice(0, MAX_NOTE_LENGTH) : "";
}

/**
 * Server Action arguments arrive from the browser, so their runtime shape is
 * not guaranteed by the TypeScript signature. Anything that isn't a
 * non-empty list of strings is treated as "nothing selected".
 */
function cleanIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return ids.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 100).slice(0, 500);
}

// ---------------------------------------------------------------------------
// Supplier
// ---------------------------------------------------------------------------

/**
 * A signed-in supplier submits one ID. Who the ID belongs to comes from the
 * session, not the form — there is no supplier name / UPI field to tamper with.
 */
export async function createAccountAction(formData: FormData): Promise<ActionResult> {
  const supplier = await requireRole("supplier");

  try {
    const loginIdentifier = requiredString(formData, "loginIdentifier", "Facebook login email");
    const linkedEmail = optionalString(formData, "linkedEmail");
    if (linkedEmail && !isValidEmail(linkedEmail)) throw new ValidationError("Outlook mail must be a valid email address.");

    const secrets: Partial<Record<SecretType, string>> = {};
    for (const type of SECRET_TYPES) {
      const value = String(formData.get(`secret_${type}`) ?? "");
      if (value) secrets[type] = value;
    }

    const account = await createAccount({ loginIdentifier, linkedEmail, secrets }, supplier);

    revalidatePath("/supplier");
    revalidateAdmin();
    return { ok: true, accountId: account.id };
  } catch (err) {
    if (!(err instanceof ValidationError)) console.error("createAccountAction failed", err);
    return { ok: false, error: err instanceof ValidationError ? err.message : "Failed to submit the ID. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function updateAccountAction(accountId: string, formData: FormData): Promise<ActionResult> {
  // Editing an existing account is admin-only. Enforced here, not just by
  // omitting the page from everyone else's navigation.
  const user = await requireAdmin();

  try {
    const linkedEmail = optionalString(formData, "linkedEmail");
    const recoveryEmail = optionalString(formData, "recoveryEmail");

    if (linkedEmail && !isValidEmail(linkedEmail)) throw new ValidationError("Outlook mail must be a valid email address.");
    if (recoveryEmail && !isValidEmail(recoveryEmail)) throw new ValidationError("Recovery email must be a valid email address.");

    await updateAccount(
      accountId,
      {
        supplierName: requiredString(formData, "supplierName", "Supplier name"),
        upiId: optionalString(formData, "upiId") || null,
        loginIdentifier: requiredString(formData, "loginIdentifier", "Facebook login email"),
        linkedEmail: linkedEmail || null,
        recoveryEmail: recoveryEmail || null,
        profileAge: optionalString(formData, "profileAge") || null,
      },
      user.id,
      user.email
    );

    for (const type of SECRET_TYPES) {
      const value = String(formData.get(`secret_${type}`) ?? "");
      if (value) await setSecret(accountId, type, value, user.id);
    }

    revalidateAdmin(accountId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof ValidationError ? err.message : "Failed to update account." };
  }
}

/**
 * Admin sets the status of one ID (detail page). When rejecting, an optional
 * reason can be sent in the form's "note" field.
 */
export async function setAccountStatusAction(
  accountId: string,
  status: AccountStatus,
  formData?: FormData
): Promise<ActionResult> {
  return setAccountsStatusAction([accountId], status, readNote(formData));
}

/** Admin sets the status of several IDs at once (the list page's Accept / Reject buttons). */
export async function setAccountsStatusAction(ids: string[], status: AccountStatus, note?: string): Promise<ActionResult> {
  const user = await requireAdmin();
  ids = cleanIds(ids);
  if (!ACCOUNT_STATUSES.includes(status)) return { ok: false, error: "Invalid status." };
  if (ids.length === 0) return { ok: false, error: "No IDs selected." };

  const cleanNote = typeof note === "string" ? note.trim().slice(0, MAX_NOTE_LENGTH) : "";
  const result = await setStatusAsAdmin(ids, status, cleanNote || null, user);

  revalidateAdmin(ids.length === 1 ? ids[0] : undefined);
  revalidatePath("/buyer");
  revalidatePath("/supplier");
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/**
 * Admin assigns IDs to a media buyer, or unassigns them with an empty
 * buyerId. The buyer id comes from the client, so it is checked against the
 * real list of media buyers before anything is written — an ID must never end
 * up "assigned" to a supplier or to an id that doesn't exist.
 */
export async function assignAccountsAction(ids: string[], buyerId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  ids = cleanIds(ids);
  if (ids.length === 0) return { ok: false, error: "No IDs selected." };

  let target: string | null = null;
  if (typeof buyerId === "string" && buyerId) {
    const buyers = await listProfiles("media_buyer");
    if (!buyers.some((b) => b.id === buyerId)) return { ok: false, error: "That media buyer no longer exists." };
    target = buyerId;
  }

  const result = await assignAccounts(ids, target, user);

  revalidateAdmin(ids.length === 1 ? ids[0] : undefined);
  revalidatePath("/buyer");
  revalidatePath("/supplier");
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function deleteAccountsAction(ids: string[]): Promise<ActionResult> {
  // Deleting is permanent and admin-only — re-checked here even though the
  // UI only ever offers this to an admin, per the same "RLS/server is the
  // boundary, not the button" rule the rest of this app follows.
  const user = await requireAdmin();
  ids = cleanIds(ids);
  if (ids.length === 0) {
    return { ok: false, error: "No accounts selected." };
  }

  const result = await deleteAccounts(ids, user.id, user.email);

  revalidateAdmin();
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

// ---------------------------------------------------------------------------
// Media buyer
// ---------------------------------------------------------------------------

/**
 * A media buyer records the result of checking an ID: active, or rejected
 * with a reason. He can only do this for IDs assigned to him — that check is
 * part of the write itself in setStatusAsBuyer, not something the page decides.
 */
export async function buyerReviewAction(accountId: string, decision: BuyerDecision, formData?: FormData): Promise<ActionResult> {
  const buyer = await requireRole("media_buyer");
  if (typeof accountId !== "string" || !accountId) return { ok: false, error: "Unknown ID." };
  if (decision !== "active" && decision !== "rejected") return { ok: false, error: "Invalid choice." };

  const note = readNote(formData);
  if (decision === "rejected" && !note) {
    return { ok: false, error: "Add a note saying why you are rejecting this ID." };
  }

  const result = await setStatusAsBuyer(accountId, decision, note || null, buyer);

  revalidatePath("/buyer");
  revalidatePath(`/buyer/accounts/${accountId}`);
  revalidatePath("/supplier");
  revalidateAdmin(accountId);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

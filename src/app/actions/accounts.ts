"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth";
import { createAccount, updateAccount, updateAccountStatus } from "@/lib/data/accounts";
import { setSecret } from "@/lib/data/secrets";
import { ACCOUNT_STATUSES, SECRET_TYPES, type AccountStatus, type SecretType } from "@/lib/types";

export interface ActionResult {
  ok: boolean;
  error?: string;
  accountId?: string;
}

function requiredString(formData: FormData, field: string): string {
  const value = String(formData.get(field) ?? "").trim();
  if (!value) throw new ValidationError(`${field} is required.`);
  return value;
}

class ValidationError extends Error {}

export async function createAccountAction(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  try {
    const supplierName = requiredString(formData, "supplierName");
    const upiId = String(formData.get("upiId") ?? "").trim();
    const loginIdentifier = requiredString(formData, "loginIdentifier");
    const linkedEmail = String(formData.get("linkedEmail") ?? "").trim();
    const recoveryEmail = String(formData.get("recoveryEmail") ?? "").trim();
    const profileAge = String(formData.get("profileAge") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();

    if (linkedEmail && !isValidEmail(linkedEmail)) throw new ValidationError("Linked email must be a valid email address.");
    if (recoveryEmail && !isValidEmail(recoveryEmail)) throw new ValidationError("Recovery email must be a valid email address.");

    const secrets: Partial<Record<SecretType, string>> = {};
    for (const type of SECRET_TYPES) {
      const value = String(formData.get(`secret_${type}`) ?? "");
      if (value) secrets[type] = value;
    }

    const account = await createAccount(
      { supplierName, upiId, loginIdentifier, linkedEmail, recoveryEmail, profileAge, notes, secrets },
      user.id,
      user.email
    );

    revalidatePath("/team/accounts/new");
    revalidatePath("/admin/accounts");
    revalidatePath("/admin");
    return { ok: true, accountId: account.id };
  } catch (err) {
    return { ok: false, error: err instanceof ValidationError ? err.message : "Failed to submit account." };
  }
}

export async function updateAccountAction(accountId: string, formData: FormData): Promise<ActionResult> {
  // Editing an existing account is an admin-only capability now that team
  // members can only submit new accounts (no list/detail access of their
  // own). Enforced here, not just by omitting the page from team nav.
  const user = await requireAdmin();

  try {
    const linkedEmail = String(formData.get("linkedEmail") ?? "").trim();
    const recoveryEmail = String(formData.get("recoveryEmail") ?? "").trim();

    if (linkedEmail && !isValidEmail(linkedEmail)) throw new ValidationError("Linked email must be a valid email address.");
    if (recoveryEmail && !isValidEmail(recoveryEmail)) throw new ValidationError("Recovery email must be a valid email address.");

    await updateAccount(
      accountId,
      {
        supplierName: requiredString(formData, "supplierName"),
        upiId: String(formData.get("upiId") ?? "").trim() || null,
        loginIdentifier: requiredString(formData, "loginIdentifier"),
        linkedEmail: linkedEmail || null,
        recoveryEmail: recoveryEmail || null,
        profileAge: String(formData.get("profileAge") ?? "").trim() || null,
        notes: String(formData.get("notes") ?? "").trim() || null,
      },
      user.id,
      user.email
    );

    for (const type of SECRET_TYPES) {
      const value = String(formData.get(`secret_${type}`) ?? "");
      if (value) await setSecret(accountId, type, value, user.id);
    }

    revalidatePath("/admin/accounts");
    revalidatePath(`/admin/accounts/${accountId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof ValidationError ? err.message : "Failed to update account." };
  }
}

export async function setAccountStatusAction(accountId: string, status: AccountStatus): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!ACCOUNT_STATUSES.includes(status)) {
    return { ok: false, error: "Invalid status." };
  }
  const result = await updateAccountStatus(accountId, status, user.id, user.email, user.role);
  revalidatePath("/admin");
  revalidatePath("/admin/accounts");
  revalidatePath(`/admin/accounts/${accountId}`);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

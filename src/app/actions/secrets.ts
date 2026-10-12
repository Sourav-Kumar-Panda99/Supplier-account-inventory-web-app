"use server";

import { revalidatePath } from "next/cache";
import { changeSecret, copySecretForClipboard, revealSecret } from "@/lib/data/secrets";
import { SECRET_TYPES } from "@/lib/types";
import type { ActionResult, SecretType } from "@/lib/types";

const MAX_SECRET_LENGTH = 500;

export interface RevealActionResult {
  ok: boolean;
  value?: string;
  expiresInSeconds?: number;
  error?: string;
}

/**
 * Called only from the admin detail view's explicit "Reveal" button — never
 * pre-fetched, never included in the normal account list/detail payload.
 * revealSecret() performs its own fresh authentication + role check and
 * audit-logs every outcome; this action adds no additional trust of its
 * own, by design, so there is exactly one place that decision is made.
 */
export async function revealSecretAction(accountId: string, secretType: SecretType): Promise<RevealActionResult> {
  const result = await revealSecret(accountId, secretType);
  if (!result.ok) {
    return { ok: false, error: reasonToMessage(result.reason) };
  }
  return { ok: true, value: result.value, expiresInSeconds: result.expiresInSeconds };
}

export async function copySecretAction(accountId: string, secretType: SecretType): Promise<RevealActionResult> {
  const result = await copySecretForClipboard(accountId, secretType);
  if (!result.ok) {
    return { ok: false, error: reasonToMessage(result.reason) };
  }
  return { ok: true, value: result.value, expiresInSeconds: result.expiresInSeconds };
}

function reasonToMessage(reason: "unauthenticated" | "forbidden" | "not_found"): string {
  switch (reason) {
    case "unauthenticated":
      return "Your session has expired. Please sign in again.";
    case "forbidden":
      return "You are not authorized to reveal this secret.";
    case "not_found":
      return "No value is stored for this field.";
  }
}

/**
 * Admin (any ID) or the assigned media buyer changes one stored credential of
 * an ID from its page. The permission check lives in changeSecret(), which
 * re-reads the caller's role and the assignment itself.
 */
export async function changeSecretAction(accountId: string, secretType: SecretType, formData: FormData): Promise<ActionResult> {
  if (typeof accountId !== "string" || !accountId || accountId.length > 100) return { ok: false, error: "Unknown ID." };
  if (!SECRET_TYPES.includes(secretType)) return { ok: false, error: "Unknown field." };

  // Not trimmed: a password can legitimately start or end with a space. Only an all-blank value is refused.
  const value = formData instanceof FormData ? String(formData.get("value") ?? "") : "";
  if (!value.trim()) return { ok: false, error: "Enter the new value." };
  if (value.length > MAX_SECRET_LENGTH) return { ok: false, error: `That is too long (max ${MAX_SECRET_LENGTH} characters).` };

  const result = await changeSecret(accountId, secretType, value);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "unauthenticated"
          ? "Your session has expired. Please sign in again."
          : result.reason === "forbidden"
            ? "You can't change this ID — it isn't assigned to you."
            : "This ID no longer exists.",
    };
  }

  revalidatePath(`/admin/accounts/${accountId}`);
  revalidatePath(`/buyer/accounts/${accountId}`);
  return { ok: true };
}

"use server";

import { copySecretForClipboard, revealSecret } from "@/lib/data/secrets";
import type { SecretType } from "@/lib/types";

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

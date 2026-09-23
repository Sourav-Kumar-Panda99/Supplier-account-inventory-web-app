import "server-only";
import { isDemoMode } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDemoStore } from "@/lib/demo/store";
import { getCurrentUser } from "@/lib/auth";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { writeAuditLog } from "@/lib/data/audit";
import type { SecretType } from "@/lib/types";

export type RevealResult =
  | { ok: true; value: string; expiresInSeconds: number }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "not_found" };

/**
 * The ONLY path in the codebase that decrypts and returns a secret value.
 * Re-checks the caller's session and role from scratch on every call —
 * never trust a role or "isAdmin" flag passed in from the client or an
 * earlier request. Every outcome (including denials) is audit-logged;
 * the audit entry itself never contains the secret value.
 */
export async function revealSecret(accountId: string, secretType: SecretType): Promise<RevealResult> {
  return revealSecretInternal(accountId, secretType, "secret.reveal");
}

/** Same authorization + audit shape as revealSecret, logged under a distinct action for the copy-to-clipboard control. */
export async function copySecretForClipboard(accountId: string, secretType: SecretType): Promise<RevealResult> {
  return revealSecretInternal(accountId, secretType, "secret.copy");
}

async function revealSecretInternal(accountId: string, secretType: SecretType, action: "secret.reveal" | "secret.copy"): Promise<RevealResult> {
  const user = await getCurrentUser();

  if (!user) {
    await writeAuditLog({
      actorId: null,
      actorEmail: null,
      action,
      entityType: "account",
      entityId: accountId,
      secretType,
      outcome: "denied",
      metadata: { reason: "unauthenticated" },
    });
    return { ok: false, reason: "unauthenticated" };
  }

  if (user.role !== "admin") {
    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action,
      entityType: "account",
      entityId: accountId,
      secretType,
      outcome: "denied",
      metadata: { reason: "not_admin" },
    });
    return { ok: false, reason: "forbidden" };
  }

  const encrypted = await fetchEncryptedSecret(accountId, secretType);

  if (!encrypted) {
    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action,
      entityType: "account",
      entityId: accountId,
      secretType,
      outcome: "error",
      metadata: { reason: "not_found" },
    });
    return { ok: false, reason: "not_found" };
  }

  let value: string;
  try {
    value = decryptSecret(encrypted);
  } catch (err) {
    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action,
      entityType: "account",
      entityId: accountId,
      secretType,
      outcome: "error",
      metadata: { reason: "decrypt_failed" },
    });
    throw err;
  }

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action,
    entityType: "account",
    entityId: accountId,
    secretType,
    outcome: "success",
    metadata: {},
  });

  return { ok: true, value, expiresInSeconds: 20 };
}

async function fetchEncryptedSecret(accountId: string, secretType: SecretType) {
  if (isDemoMode) {
    const store = getDemoStore();
    const account = store.accounts.find((a) => a.id === accountId);
    const record = account?.secrets[secretType];
    if (!record) return null;
    return {
      ciphertext: record.ciphertext,
      iv: record.iv,
      authTag: record.authTag,
      keyVersion: record.keyVersion,
    };
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("account_secrets")
    .select("ciphertext, iv, auth_tag, key_version")
    .eq("account_id", accountId)
    .eq("secret_type", secretType)
    .maybeSingle();

  if (error) throw new Error(`Failed to read secret: ${error.message}`);
  if (!data) return null;

  return {
    ciphertext: data.ciphertext,
    iv: data.iv,
    authTag: data.auth_tag,
    keyVersion: data.key_version,
  };
}

/**
 * Encrypts and upserts a secret value. Callers (server actions) are
 * responsible for verifying the caller is allowed to write to the target
 * account before calling this. actorId is nullable because submitting a new
 * account requires no login (see createAccountAction) — an anonymous
 * submission still gets its secrets encrypted and stored the same way, just
 * with no attributable identity.
 */
export async function setSecret(
  accountId: string,
  secretType: SecretType,
  plaintext: string,
  actorId: string | null
): Promise<void> {
  const encrypted = encryptSecret(plaintext);

  if (isDemoMode) {
    const store = getDemoStore();
    const account = store.accounts.find((a) => a.id === accountId);
    if (!account) throw new Error("Account not found");
    account.secrets[secretType] = {
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      keyVersion: encrypted.keyVersion,
      updatedAt: new Date().toISOString(),
      updatedBy: actorId,
    };
    return;
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("account_secrets").upsert(
    {
      account_id: accountId,
      secret_type: secretType,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      auth_tag: encrypted.authTag,
      key_version: encrypted.keyVersion,
      updated_by: actorId,
      created_by: actorId,
    },
    { onConflict: "account_id,secret_type" }
  );

  if (error) throw new Error(`Failed to store secret: ${error.message}`);
}

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
 * The ONLY path in the codebase that decrypts and returns a single secret
 * value. Re-checks the caller's session and role from scratch on every call —
 * never trust a role or "isAdmin" flag passed in from the client or an
 * earlier request. Every outcome (including denials) is audit-logged;
 * the audit entry itself never contains the secret value.
 *
 * Who may reveal:
 *   - an admin: any ID
 *   - a media buyer: only an ID currently assigned to him (he needs the
 *     credentials to check it) — re-read from the database on every call, so
 *     unassigning an ID cuts off access immediately
 *   - a supplier: never, not even for IDs he submitted himself
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

  const allowed =
    user.role === "admin" || (user.role === "media_buyer" && (await isAssignedTo(accountId, user.id)));

  if (!allowed) {
    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action,
      entityType: "account",
      // The id is caller-supplied; only log it as the entity when it can be one.
      entityId: isDemoMode || UUID_RE.test(accountId) ? accountId : null,
      secretType,
      outcome: "denied",
      metadata: { reason: user.role === "media_buyer" ? "not_assigned" : "role_not_allowed", role: user.role },
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True only if this ID is currently assigned to this user. */
async function isAssignedTo(accountId: string, userId: string): Promise<boolean> {
  if (isDemoMode) {
    return getDemoStore().accounts.some((a) => a.id === accountId && a.assignedTo === userId);
  }

  if (!UUID_RE.test(accountId)) return false;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("accounts")
    .select("id")
    .eq("id", accountId)
    .eq("assigned_to", userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to check assignment: ${error.message}`);
  return !!data;
}

/**
 * Which secrets exist for these accounts and when each was last set — never
 * the ciphertext. Service-role read for the media-buyer screens (live mode
 * only); callers MUST already have restricted `accountIds` to IDs assigned to
 * the signed-in buyer. Admin screens use the account_secret_presence RPC on
 * the RLS-bound client instead.
 */
export async function fetchSecretPresence(
  accountIds: string[]
): Promise<{ account_id: string; secret_type: string; updated_at: string }[]> {
  if (accountIds.length === 0) return [];

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("account_secrets")
    .select("account_id, secret_type, updated_at")
    .in("account_id", accountIds);

  if (error) throw new Error(`Failed to read secret presence: ${error.message}`);
  return data ?? [];
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
 * account before calling this: a supplier for an ID he is submitting right
 * now, or an admin editing one.
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

/**
 * Bulk-decrypts every stored secret for the given accounts, for the admin
 * Excel export. Callers MUST have verified the caller is an admin first —
 * this does no auth check of its own. Values that fail to decrypt (e.g. a
 * rotated-out key) come back as null rather than failing the whole export.
 */
export async function decryptSecretsForAccounts(
  accountIds: string[]
): Promise<Map<string, Partial<Record<SecretType, string | null>>>> {
  const result = new Map<string, Partial<Record<SecretType, string | null>>>();

  const tryDecrypt = (payload: { ciphertext: string; iv: string; authTag: string; keyVersion: number }) => {
    try {
      return decryptSecret(payload);
    } catch {
      return null;
    }
  };

  if (isDemoMode) {
    const store = getDemoStore();
    for (const id of accountIds) {
      const account = store.accounts.find((a) => a.id === id);
      if (!account) continue;
      const values: Partial<Record<SecretType, string | null>> = {};
      for (const [type, record] of Object.entries(account.secrets)) {
        if (record) values[type as SecretType] = tryDecrypt(record);
      }
      result.set(id, values);
    }
    return result;
  }

  const admin = createSupabaseAdminClient();
  // Chunked so the `in (...)` filter stays well under URL length limits.
  for (let i = 0; i < accountIds.length; i += 200) {
    const chunk = accountIds.slice(i, i + 200);
    const { data, error } = await admin
      .from("account_secrets")
      .select("account_id, secret_type, ciphertext, iv, auth_tag, key_version")
      .in("account_id", chunk);

    if (error) throw new Error(`Failed to read secrets: ${error.message}`);

    for (const row of data ?? []) {
      const values = result.get(row.account_id) ?? {};
      values[row.secret_type as SecretType] = tryDecrypt({
        ciphertext: row.ciphertext,
        iv: row.iv,
        authTag: row.auth_tag,
        keyVersion: row.key_version,
      });
      result.set(row.account_id, values);
    }
  }

  return result;
}

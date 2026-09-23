import "server-only";
import crypto from "node:crypto";
import { encryptionKeysRaw, encryptionKeyVersion, isDemoMode } from "./env";

/**
 * Authenticated encryption (AES-256-GCM) for account secrets.
 *
 * Ciphertext, IV, and auth tag are returned/stored separately so a reader of
 * account_secrets alone (e.g. a DB backup, a support person with read
 * access) never sees anything resembling the original value without also
 * having the server's encryption key.
 *
 * Key material comes ONLY from the server environment (ENCRYPTION_KEYS, a
 * JSON map of key-version -> base64 32-byte key). This module is marked
 * server-only and must never be imported from a Client Component.
 *
 * Losing every version listed in ENCRYPTION_KEYS makes every stored secret
 * permanently unrecoverable — there is no recovery path by design. See the
 * README "Encryption key setup, rotation, and backups" section.
 */

export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string; // base64
  authTag: string; // base64
  keyVersion: number;
}

let cachedKeys: Map<number, Buffer> | null = null;
let demoKey: Buffer | null = null;

function loadKeys(): Map<number, Buffer> {
  if (cachedKeys) return cachedKeys;
  if (!encryptionKeysRaw) {
    throw new Error("ENCRYPTION_KEYS is not set. See README for key generation instructions.");
  }

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(encryptionKeysRaw);
  } catch {
    throw new Error("ENCRYPTION_KEYS must be a JSON object mapping key version to a base64-encoded 32-byte key.");
  }

  const map = new Map<number, Buffer>();
  for (const [versionStr, base64Key] of Object.entries(parsed)) {
    const version = Number(versionStr);
    if (!Number.isInteger(version) || version < 1) {
      throw new Error(`ENCRYPTION_KEYS has an invalid key version: "${versionStr}"`);
    }
    const key = Buffer.from(base64Key, "base64");
    if (key.length !== 32) {
      throw new Error(`Encryption key version ${version} must decode to exactly 32 bytes (got ${key.length}).`);
    }
    map.set(version, key);
  }

  if (map.size === 0) {
    throw new Error("ENCRYPTION_KEYS is empty — at least one key version is required.");
  }

  cachedKeys = map;
  return map;
}

function currentKeyVersion(keys: Map<number, Buffer>): number {
  if (encryptionKeyVersion) {
    const version = Number(encryptionKeyVersion);
    if (keys.has(version)) return version;
    throw new Error(`ENCRYPTION_KEY_VERSION=${encryptionKeyVersion} has no matching entry in ENCRYPTION_KEYS.`);
  }
  // Default to the highest version present.
  return Math.max(...keys.keys());
}

/**
 * Demo mode has no persisted key material — a random key is generated once
 * per server process so the reveal code path is still exercised with real
 * AES-256-GCM. It is never written to disk and disappears on restart, which
 * is intentional: demo data must never be mistaken for durable storage.
 */
function getDemoKey(): Buffer {
  if (!demoKey) {
    demoKey = crypto.randomBytes(32);
  }
  return demoKey;
}

export function encryptSecret(plaintext: string): EncryptedPayload {
  const iv = crypto.randomBytes(12);
  let key: Buffer;
  let keyVersion: number;

  if (isDemoMode) {
    key = getDemoKey();
    keyVersion = 0; // 0 is reserved to mean "ephemeral demo-mode key"
  } else {
    const keys = loadKeys();
    keyVersion = currentKeyVersion(keys);
    key = keys.get(keyVersion)!;
  }

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    keyVersion,
  };
}

export function decryptSecret(payload: EncryptedPayload): string {
  let key: Buffer;

  if (payload.keyVersion === 0 || isDemoMode) {
    key = getDemoKey();
  } else {
    const keys = loadKeys();
    const found = keys.get(payload.keyVersion);
    if (!found) {
      throw new Error(`No encryption key available for key version ${payload.keyVersion}. It may have been rotated out — see README key rotation guidance.`);
    }
    key = found;
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/** Utility for generating a new base64 32-byte key, used by the CLI helper script and documented in the README. */
export function generateKeyBase64(): string {
  return crypto.randomBytes(32).toString("base64");
}

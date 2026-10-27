import "server-only";
import crypto from "node:crypto";
import { encryptionKeysRaw, isDemoMode } from "./env";

/**
 * Storage format for account secrets.
 *
 * New values are stored as PLAIN TEXT: the value goes in `ciphertext` as-is,
 * `iv` and `authTag` are empty, and `keyVersion` is PLAIN_KEY_VERSION. No
 * encryption key is needed to write or read them — but anyone who can read
 * account_secrets (a DB backup, the Supabase dashboard, the service-role key)
 * can read every credential.
 *
 * Rows written before that change are AES-256-GCM encrypted (keyVersion >= 1,
 * or 0 for the in-memory demo key). They can still be read only while their
 * key is listed in ENCRYPTION_KEYS (a JSON map of key-version -> base64
 * 32-byte key, or a bare key); without it they come back as "could not
 * decrypt". Saving such a value again through the app re-stores it as plain
 * text, and `npm run decrypt-secrets` converts them all at once.
 *
 * This module is marked server-only and must never be imported from a Client
 * Component.
 */

export interface EncryptedPayload {
  ciphertext: string; // base64, or the value itself when keyVersion is PLAIN_KEY_VERSION
  iv: string; // base64, empty for plain text
  authTag: string; // base64, empty for plain text
  keyVersion: number;
}

/** keyVersion marking a value stored as plain text (not encrypted). */
export const PLAIN_KEY_VERSION = -1;

let cachedKeys: Map<number, Buffer> | null = null;

declare global {
  var __demoEncryptionKey: Buffer | undefined;
}

function loadKeys(): Map<number, Buffer> {
  if (cachedKeys) return cachedKeys;
  if (!encryptionKeysRaw) {
    throw new Error("ENCRYPTION_KEYS is not set. See README for key generation instructions.");
  }

  const formatError = "ENCRYPTION_KEYS must be a JSON object mapping key version to a base64-encoded 32-byte key.";
  // Tolerate surrounding quotes/spaces that hosting dashboards sometimes keep.
  const raw = encryptionKeysRaw.trim().replace(/^'([\s\S]*)'$/, "$1").trim();
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    decoded = raw;
  }
  if (typeof decoded === "string") {
    // JSON that was saved as a quoted string
    try {
      const again: unknown = JSON.parse(decoded);
      if (again && typeof again === "object") decoded = again;
    } catch {
      // not JSON: a bare key
    }
  }
  let parsed: Record<string, string>;
  if (typeof decoded === "string") {
    // A bare key, exactly as `npm run generate-key` prints it, counts as version 1.
    const bare = decoded.trim();
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(bare) || Buffer.from(bare, "base64").length !== 32) throw new Error(formatError);
    parsed = { "1": bare };
  } else if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) {
    parsed = decoded as Record<string, string>;
  } else {
    throw new Error(formatError);
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

/**
 * Demo mode has no persisted key material — a random key is generated once
 * per server process so the reveal code path is still exercised with real
 * AES-256-GCM. It is never written to disk and disappears on restart, which
 * is intentional: demo data must never be mistaken for durable storage.
 */
function getDemoKey(): Buffer {
  // Kept on globalThis next to the demo store (lib/demo/store.ts) rather than
  // in a module variable: in development a hot reload re-creates this module
  // but not the store, and a fresh key here would make every secret already
  // in the store undecryptable.
  if (!globalThis.__demoEncryptionKey) {
    globalThis.__demoEncryptionKey = crypto.randomBytes(32);
  }
  return globalThis.__demoEncryptionKey;
}

/** Prepares a value for account_secrets. Stored as plain text — see the note at the top of this file. */
export function encodeSecret(plaintext: string): EncryptedPayload {
  return { ciphertext: plaintext, iv: "", authTag: "", keyVersion: PLAIN_KEY_VERSION };
}

/** Reads a stored value back: plain text as-is, older encrypted rows with their key. Throws if that key is missing. */
export function decodeSecret(payload: EncryptedPayload): string {
  if (payload.keyVersion === PLAIN_KEY_VERSION) return payload.ciphertext;

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

  const open = (k: Buffer) => {
    const decipher = crypto.createDecipheriv("aes-256-gcm", k, Buffer.from(payload.iv, "base64"));
    decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, "base64")), decipher.final()]).toString("utf8");
  };
  try {
    return open(key);
  } catch (err) {
    // Some rows can carry the right version number but a different key (e.g. a key that
    // was replaced after moving hosts, later added back as another version). AES-GCM
    // authenticates, so trying the other configured keys can never return a wrong value.
    if (payload.keyVersion !== 0 && !isDemoMode) {
      for (const [version, other] of loadKeys()) {
        if (version === payload.keyVersion) continue;
        try {
          return open(other);
        } catch {
          // not this one either
        }
      }
    }
    throw err;
  }
}

/**
 * Why stored secrets cannot be decrypted because of the key SETTING itself (missing,
 * malformed, wrong length), or null when the configured keys load fine. Never
 * contains key material — safe to show to an admin.
 */
export function encryptionKeyProblem(): string | null {
  if (isDemoMode) return null;
  try {
    loadKeys();
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/** Utility for generating a new base64 32-byte key, used by the CLI helper script and documented in the README. */
export function generateKeyBase64(): string {
  return crypto.randomBytes(32).toString("base64");
}

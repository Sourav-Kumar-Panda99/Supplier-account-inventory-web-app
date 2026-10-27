// One-time conversion of every encrypted credential in account_secrets to
// plain text, so ENCRYPTION_KEYS can be removed afterwards.
//
// Usage:
//   npm run decrypt-secrets               dry run: checks every row decrypts, changes nothing
//   npm run decrypt-secrets -- --apply    converts the rows
//
// Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and ENCRYPTION_KEYS
// from the environment (.env.local is loaded if present). Never prints a
// credential value. Safe to run more than once: rows already in plain text
// (key_version = -1) are skipped, and a row that fails to decrypt is left as
// it is. Writes one audit_log entry per --apply run.
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

/** Must match PLAIN_KEY_VERSION in src/lib/crypto.ts. */
const PLAIN_KEY_VERSION = -1;
const BATCH_SIZE = 1000;

const apply = process.argv.includes("--apply");

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const keysRaw = process.env.ENCRYPTION_KEYS;
if (!url || !serviceRoleKey) fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
if (!keysRaw) fail("ENCRYPTION_KEYS must be set — it is needed to read the encrypted rows one last time.");

// Same formats as loadKeys() in src/lib/crypto.ts: {"1":"<key>"}, the same JSON
// saved as a quoted string, or a bare key (counts as version 1).
const formatError = "ENCRYPTION_KEYS must be a base64 32-byte key or a JSON object mapping key version to one.";
let decoded = keysRaw.trim().replace(/^'([\s\S]*)'$/, "$1").trim();
try {
  decoded = JSON.parse(decoded);
} catch {
  // not JSON: a bare key
}
if (typeof decoded === "string") {
  try {
    const again = JSON.parse(decoded);
    if (again && typeof again === "object") decoded = again;
  } catch {
    // not JSON either
  }
}
const entries = typeof decoded === "string" ? [["1", decoded.trim()]] : decoded && typeof decoded === "object" && !Array.isArray(decoded) ? Object.entries(decoded) : fail(formatError);
const keys = new Map();
for (const [version, base64Key] of entries) {
  const key = Buffer.from(String(base64Key), "base64");
  if (key.length !== 32) fail(`Key version ${version} must decode to exactly 32 bytes (got ${key.length}).`);
  keys.set(Number(version), key);
}

function open(key, row) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(row.iv, "base64"));
  decipher.setAuthTag(Buffer.from(row.auth_tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(row.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

// Like decodeSecret(): the row's own key version first, then every other
// configured key. AES-GCM authenticates, so a wrong key can never return a value.
function decrypt(row) {
  const own = keys.get(row.key_version);
  for (const key of [own, ...[...keys].filter(([v]) => v !== row.key_version).map(([, k]) => k)].filter(Boolean)) {
    try {
      return open(key, row);
    } catch {
      // try the next key
    }
  }
  throw new Error(own ? "decryption failed (wrong key?)" : `no key for version ${row.key_version}`);
}

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

// Every encrypted row, fetched in batches below Supabase's default max-rows.
const rows = [];
for (let start = 0; ; start += BATCH_SIZE) {
  const { data, error } = await admin
    .from("account_secrets")
    .select("id, account_id, secret_type, ciphertext, iv, auth_tag, key_version")
    .neq("key_version", PLAIN_KEY_VERSION)
    .order("id", { ascending: true })
    .range(start, start + BATCH_SIZE - 1);
  if (error) fail(`Could not read account_secrets: ${error.message}`);
  rows.push(...data);
  if (data.length < BATCH_SIZE) break;
}

const decrypted = [];
const failed = [];
for (const row of rows) {
  try {
    decrypted.push({ row, plaintext: decrypt(row) });
  } catch (err) {
    failed.push({ row, reason: err.message });
  }
}

const byVersion = {};
for (const row of rows) byVersion[row.key_version] = (byVersion[row.key_version] ?? 0) + 1;
console.log(`Encrypted rows found: ${rows.length}${rows.length ? ` (by key version: ${JSON.stringify(byVersion)})` : ""}`);
console.log(`  can be converted:   ${decrypted.length}`);
console.log(`  cannot be read:     ${failed.length}`);
for (const { row, reason } of failed) {
  console.log(`    - row ${row.id} (account ${row.account_id}, ${row.secret_type}): ${reason}`);
}

if (!apply) {
  console.log(rows.length ? "\nDry run — nothing changed. Run again with --apply to convert." : "\nNothing to convert.");
  process.exit(0);
}

let converted = 0;
let skipped = 0;
for (const { row, plaintext } of decrypted) {
  // Matched on the old ciphertext too, so a value changed in the app since it
  // was read above is not overwritten with the stale one.
  const { data, error } = await admin
    .from("account_secrets")
    .update({ ciphertext: plaintext, iv: "", auth_tag: "", key_version: PLAIN_KEY_VERSION })
    .eq("id", row.id)
    .eq("key_version", row.key_version)
    .eq("ciphertext", row.ciphertext)
    .select("id");
  if (error) fail(`Stopped after ${converted} rows — could not update row ${row.id}: ${error.message}`);
  if (data.length) converted++;
  else skipped++;
}

const { count: remaining, error: countError } = await admin
  .from("account_secrets")
  .select("id", { count: "exact", head: true })
  .neq("key_version", PLAIN_KEY_VERSION);
if (countError) fail(`Could not count remaining rows: ${countError.message}`);

const { error: auditError } = await admin.from("audit_log").insert({
  actor_id: null,
  actor_email: null,
  action: "secret.bulk_convert_plaintext",
  entity_type: "account",
  entity_id: null,
  secret_type: null,
  outcome: failed.length ? "error" : "success",
  metadata: { converted, skippedChangedMeanwhile: skipped, unreadable: failed.length, remainingEncrypted: remaining },
});
if (auditError) console.error(`Warning: could not write audit log entry: ${auditError.message}`);

console.log(`\nConverted to plain text: ${converted}`);
if (skipped) console.log(`Skipped (changed in the app while this ran — run again): ${skipped}`);
console.log(`Still encrypted: ${remaining}`);
console.log(
  remaining === 0
    ? "Done. ENCRYPTION_KEYS is no longer needed and can be removed."
    : "Keep ENCRYPTION_KEYS until the rows above are fixed (re-enter them in the app) or converted."
);

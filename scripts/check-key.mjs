// Checks whether an encryption key can open the passwords already saved in Supabase.
// It never prints a password - only how many could be opened.
//
//   node scripts/check-key.mjs              tests ENCRYPTION_KEYS from .env.local
//   node scripts/check-key.mjs "<key>"      tests another key (bare key or {"1":"..."})
//   node scripts/check-key.mjs --scan "C:\\Users\\you\\Downloads"
//                                           searches every file in that folder (or one file) for
//                                           key-shaped values and tests each one
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
import fs from "node:fs";
import crypto from "node:crypto";

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^"([\s\S]*)"$/, "$1").replace(/^'([\s\S]*)'$/, "$1");
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) {
  console.error("Put NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}

function readKeys(setting) {
  let v = (setting ?? "").trim();
  let decoded;
  try {
    decoded = JSON.parse(v);
  } catch {
    decoded = v;
  }
  if (typeof decoded === "string") {
    try {
      const again = JSON.parse(decoded);
      if (again && typeof again === "object") decoded = again;
    } catch {}
  }
  const map = new Map();
  const entries = typeof decoded === "string" ? [["1", decoded.trim()]] : Object.entries(decoded ?? {});
  for (const [ver, b64] of entries) {
    const key = Buffer.from(String(b64), "base64");
    if (key.length === 32) map.set(Number(ver), key);
  }
  return map;
}

const scanTarget = process.argv[2] === "--scan" ? process.argv[3] : null;
const keys = scanTarget ? new Map() : readKeys(process.argv[2] ?? env.ENCRYPTION_KEYS);
if (!scanTarget && !keys.size) {
  console.error("That is not a valid key (it must be 44 characters ending in '=', or {\"1\":\"...\"}).");
  process.exit(1);
}

/** Every key-shaped value (base64 of 32 bytes) in the text files under `target`, with where it was seen. */
function scanForKeys(target) {
  const found = new Map();
  const skip = new Set(["node_modules", ".git", ".next", "$Recycle.Bin", "AppData", "Windows", "Program Files", "Program Files (x86)"]);
  const re = /(?<![A-Za-z0-9+/])[A-Za-z0-9+/]{43}=(?![A-Za-z0-9+/=])/g;
  let files = 0;
  const visit = (p, depth) => {
    let st;
    try {
      st = fs.statSync(p);
    } catch {
      return;
    }
    if (st.isDirectory()) {
      if (depth > 8) return;
      let names = [];
      try {
        names = fs.readdirSync(p);
      } catch {
        return;
      }
      for (const n of names) if (!skip.has(n)) visit(`${p}/${n}`, depth + 1);
      return;
    }
    if (!st.isFile() || st.size > 2_000_000 || st.size === 0) return;
    let buf;
    try {
      buf = fs.readFileSync(p);
    } catch {
      return;
    }
    if (buf.subarray(0, 4000).includes(0)) return; // binary file
    files++;
    for (const k of new Set(buf.toString("utf8").match(re) ?? [])) {
      if (Buffer.from(k, "base64").length !== 32) continue;
      if (!found.has(k)) found.set(k, []);
      found.get(k).push(p);
    }
  };
  visit(target, 0);
  return { found, files };
}

const rows = [];
for (let from = 0; ; from += 1000) {
  const res = await fetch(`${url}/rest/v1/account_secrets?select=ciphertext,iv,auth_tag,key_version,created_at&order=created_at.asc`, {
    headers: { apikey: service, Authorization: `Bearer ${service}`, Range: `${from}-${from + 999}` },
  });
  if (!res.ok) {
    console.error(`Supabase answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
    process.exit(1);
  }
  const page = await res.json();
  rows.push(...page);
  if (page.length < 1000) break;
}
if (!rows.length) {
  console.log("No saved passwords in the database yet - any key will work for new ones.");
  process.exit(0);
}

function opens(key, r) {
  try {
    const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(r.iv, "base64"));
    d.setAuthTag(Buffer.from(r.auth_tag, "base64"));
    Buffer.concat([d.update(Buffer.from(r.ciphertext, "base64")), d.final()]);
    return true;
  } catch {
    return false;
  }
}

if (scanTarget) {
  console.log(`Searching ${scanTarget} ...`);
  const { found, files } = scanForKeys(scanTarget);
  console.log(`Looked at ${files} files, found ${found.size} key-shaped value(s). Testing each against ${rows.length} saved passwords:`);
  let hits = 0;
  for (const [k, where] of found) {
    const key = Buffer.from(k, "base64");
    const n = rows.filter((r) => opens(key, r)).length;
    const label = `${k.slice(0, 4)}...${k.slice(-3)}`;
    if (n > 0) {
      hits++;
      console.log(`  FOUND  ${label} opens ${n} of ${rows.length}  <- in ${where[0]}`);
    } else console.log(`  no     ${label}  (${where[0]})`);
  }
  console.log(hits ? "Open the file shown next to FOUND and copy that key (the whole 44 characters)." : "None of them is the key the passwords were saved with.");
  process.exit(0);
}

let opened = 0;
let firstOpened = null;
let lastOpened = null;
const versions = new Set();
for (const r of rows) {
  versions.add(r.key_version);
  const before = opened;
  for (const key of [keys.get(r.key_version), ...keys.values()].filter(Boolean)) {
    try {
      const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(r.iv, "base64"));
      d.setAuthTag(Buffer.from(r.auth_tag, "base64"));
      Buffer.concat([d.update(Buffer.from(r.ciphertext, "base64")), d.final()]);
      opened++;
      break;
    } catch {}
  }
  if (opened > before) {
    firstOpened ??= r.created_at;
    lastOpened = r.created_at;
  }
}
console.log(`Tested all ${rows.length} saved passwords (key version ${[...versions].join(", ")}).`);
if (opened === rows.length) console.log("YES - this is the right key. Put it in Vercel as ENCRYPTION_KEYS and redeploy.");
else if (opened > 0)
  console.log(`PARTLY - this key opens ${opened} of ${rows.length} (saved between ${firstOpened?.slice(0, 10)} and ${lastOpened?.slice(0, 10)}). The others were saved with another key.`);
else console.log("NO - this is not the key the passwords were saved with.");

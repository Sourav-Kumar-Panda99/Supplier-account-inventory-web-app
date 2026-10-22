// Generates a new base64-encoded 32-byte AES-256 key for ENCRYPTION_KEYS.
// Usage: node scripts/generate-key.mjs
import crypto from "node:crypto";

console.log(crypto.randomBytes(32).toString("base64"));

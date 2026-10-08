import "server-only";
import crypto from "node:crypto";
import { encryptSecret } from "@/lib/crypto";
import { FIXED_PLATFORM, SECRET_TYPES } from "@/lib/types";
import type { AccountStatus, AuditLogEntry, Profile, SecretType } from "@/lib/types";

/**
 * In-memory data store used ONLY when isDemoMode is true (no Supabase
 * credentials configured). Nothing here is persisted to disk: it lives for
 * the lifetime of the Node process and resets on every restart or
 * redeploy. It exists so the app is fully click-through-able without a
 * database, not as a stand-in for real storage — do not point real
 * suppliers' credentials at demo mode.
 *
 * Kept on globalThis so Next.js's dev-mode fast refresh (which re-evaluates
 * modules but not the process) doesn't wipe state on every save.
 */

export interface DemoSecretRecord {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
  updatedAt: string;
  updatedBy: string | null;
}

export interface DemoAccount {
  id: string;
  supplierId: string | null;
  supplierName: string;
  upiId: string | null;
  platform: string;
  loginIdentifier: string;
  linkedEmail: string | null;
  recoveryEmail: string | null;
  profileAge: string | null;
  status: AccountStatus;
  rejectionNote: string | null;
  statusChangedBy: string | null;
  statusChangedAt: string | null;
  assignedTo: string | null;
  assignedAt: string | null;
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  secrets: Partial<Record<SecretType, DemoSecretRecord>>;
}

interface DemoState {
  profiles: Profile[];
  accounts: DemoAccount[];
  auditLog: AuditLogEntry[];
}

const ADMIN = "demo-admin-1";
const BUYER_1 = "demo-buyer-1";
const BUYER_2 = "demo-buyer-2";
const SUPPLIER_1 = "demo-supplier-1";
const SUPPLIER_2 = "demo-supplier-2";

function seed(): DemoState {
  const createdAt = new Date().toISOString();

  const profiles: Profile[] = [
    { id: ADMIN, email: "morgan.blake@example.test", fullName: "Morgan Blake", role: "admin", upiId: null, createdAt },
    { id: BUYER_1, email: "riya.kapoor@example.test", fullName: "Riya Kapoor", role: "media_buyer", upiId: null, createdAt },
    { id: BUYER_2, email: "arjun.mehta@example.test", fullName: "Arjun Mehta", role: "media_buyer", upiId: null, createdAt },
    {
      id: SUPPLIER_1,
      email: "imran.sheikh@example.test",
      fullName: "Imran Sheikh",
      role: "supplier",
      upiId: "imran.fictional@fictionalbank",
      createdAt,
    },
    {
      id: SUPPLIER_2,
      email: "deepak.verma@example.test",
      fullName: "Deepak Verma",
      role: "supplier",
      upiId: "deepak.fictional@fictionalbank",
      createdAt,
    },
  ];

  const profileById = new Map(profiles.map((p) => [p.id, p]));

  /**
   * A timestamp `days` days ago, so the per-day views have something to
   * group. Never later than "a few minutes ago": seeded records must not
   * look newer than something a person submits right after the app starts.
   */
  const startedAt = Date.now();
  const daysAgo = (days: number, hour: number) => {
    const d = new Date(startedAt);
    d.setDate(d.getDate() - days);
    d.setHours(hour, 15, 0, 0);
    return new Date(Math.min(d.getTime(), startedAt - 5 * 60_000)).toISOString();
  };

  const raw: Array<{
    supplier: string;
    login: string;
    outlook: string;
    daysAgo: number;
    status: AccountStatus;
    assignedTo?: string;
    rejectedBy?: string;
    rejectionNote?: string;
    twoFactor?: boolean;
  }> = [
    { supplier: SUPPLIER_1, login: "fb.one.fictional@example.test", outlook: "one.fictional@outlook.example.test", daysAgo: 2, status: "active", assignedTo: BUYER_1, twoFactor: true },
    { supplier: SUPPLIER_1, login: "fb.two.fictional@example.test", outlook: "two.fictional@outlook.example.test", daysAgo: 2, status: "rejected", assignedTo: BUYER_1, rejectedBy: BUYER_1, rejectionNote: "Password is wrong — could not log in." },
    { supplier: SUPPLIER_1, login: "fb.three.fictional@example.test", outlook: "three.fictional@outlook.example.test", daysAgo: 2, status: "active", assignedTo: BUYER_2, twoFactor: true },
    { supplier: SUPPLIER_1, login: "fb.four.fictional@example.test", outlook: "four.fictional@outlook.example.test", daysAgo: 1, status: "accepted", assignedTo: BUYER_2, twoFactor: true },
    { supplier: SUPPLIER_1, login: "fb.five.fictional@example.test", outlook: "five.fictional@outlook.example.test", daysAgo: 1, status: "rejected", rejectedBy: ADMIN, rejectionNote: "Duplicate of an ID already submitted." },
    { supplier: SUPPLIER_1, login: "fb.six.fictional@example.test", outlook: "six.fictional@outlook.example.test", daysAgo: 1, status: "accepted", twoFactor: true },
    { supplier: SUPPLIER_1, login: "fb.seven.fictional@example.test", outlook: "seven.fictional@outlook.example.test", daysAgo: 0, status: "pending", twoFactor: true },
    { supplier: SUPPLIER_1, login: "fb.eight.fictional@example.test", outlook: "eight.fictional@outlook.example.test", daysAgo: 0, status: "pending" },
    { supplier: SUPPLIER_2, login: "fb.nine.fictional@example.test", outlook: "nine.fictional@outlook.example.test", daysAgo: 1, status: "accepted", assignedTo: BUYER_1, twoFactor: true },
    { supplier: SUPPLIER_2, login: "fb.ten.fictional@example.test", outlook: "ten.fictional@outlook.example.test", daysAgo: 1, status: "active", assignedTo: BUYER_1, twoFactor: true },
    { supplier: SUPPLIER_2, login: "fb.eleven.fictional@example.test", outlook: "eleven.fictional@outlook.example.test", daysAgo: 0, status: "pending", twoFactor: true },
  ];

  const accounts: DemoAccount[] = raw.map((r, index) => {
    const submittedAt = daysAgo(r.daysAgo, 9 + (index % 8));
    const reviewedAt = r.status === "pending" ? null : daysAgo(r.daysAgo, 18);
    const supplier = profileById.get(r.supplier)!;

    const plain: Partial<Record<SecretType, string>> = {
      password: `Fict!onalPass_${index + 1}aB`,
      email_password: `OutlookFict_${index + 1}xY`,
      ...(r.twoFactor ? { two_factor: `FICT IONA LKEY ${String(index + 1).padStart(4, "0")}` } : {}),
    };

    const secrets: Partial<Record<SecretType, DemoSecretRecord>> = {};
    for (const type of SECRET_TYPES) {
      const value = plain[type];
      if (!value) continue;
      const enc = encryptSecret(value);
      secrets[type] = {
        ciphertext: enc.ciphertext,
        iv: enc.iv,
        authTag: enc.authTag,
        keyVersion: enc.keyVersion,
        updatedAt: submittedAt,
        updatedBy: r.supplier,
      };
    }

    return {
      id: `acc-${index + 1}`,
      supplierId: r.supplier,
      supplierName: supplier.fullName ?? supplier.email,
      upiId: supplier.upiId,
      platform: FIXED_PLATFORM,
      loginIdentifier: r.login,
      linkedEmail: r.outlook,
      recoveryEmail: null,
      profileAge: null,
      status: r.status,
      rejectionNote: r.rejectionNote ?? null,
      statusChangedBy: reviewedAt ? r.rejectedBy ?? (r.status === "active" ? r.assignedTo ?? ADMIN : ADMIN) : null,
      statusChangedAt: reviewedAt,
      assignedTo: r.assignedTo ?? null,
      assignedAt: r.assignedTo ? reviewedAt : null,
      notes: null,
      createdBy: r.supplier,
      updatedBy: reviewedAt ? ADMIN : r.supplier,
      createdAt: submittedAt,
      updatedAt: reviewedAt ?? submittedAt,
      secrets,
    };
  });

  return { profiles, accounts, auditLog: [] };
}

// The name carries a version: bump it whenever the shape of DemoState
// changes. A dev server that is already running keeps globalThis across hot
// reloads, so without this it would go on serving data seeded in the old
// shape (missing fields, statuses that no longer exist) until restarted.
declare global {
  var __demoStoreV3: DemoState | undefined;
}

export function getDemoStore(): DemoState {
  if (!globalThis.__demoStoreV3) {
    globalThis.__demoStoreV3 = seed();
  }
  return globalThis.__demoStoreV3;
}

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

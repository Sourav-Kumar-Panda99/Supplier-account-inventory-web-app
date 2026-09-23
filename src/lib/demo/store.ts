import "server-only";
import crypto from "node:crypto";
import { encryptSecret } from "@/lib/crypto";
import { FIXED_PLATFORM, SECRET_TYPES } from "@/lib/types";
import type { Account, AccountStatus, AuditLogEntry, Profile, SecretType } from "@/lib/types";

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

interface DemoSecretRecord {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
  updatedAt: string;
  updatedBy: string | null;
}

interface DemoState {
  profiles: Profile[];
  accounts: (Omit<Account, "secrets" | "createdByEmail" | "updatedByEmail"> & {
    secrets: Partial<Record<SecretType, DemoSecretRecord>>;
  })[];
  auditLog: AuditLogEntry[];
}

function seed(): DemoState {
  const profiles: Profile[] = [
    {
      id: "demo-team-1",
      email: "jordan.rivera@example.test",
      fullName: "Jordan Rivera",
      role: "team",
      createdAt: new Date().toISOString(),
    },
    {
      id: "demo-admin-1",
      email: "morgan.blake@example.test",
      fullName: "Morgan Blake",
      role: "admin",
      createdAt: new Date().toISOString(),
    },
  ];

  const now = new Date().toISOString();

  const rawAccounts: Array<{
    id: string;
    supplierName: string;
    upiId: string | null;
    loginIdentifier: string;
    linkedEmail: string | null;
    recoveryEmail: string | null;
    profileAge: string | null;
    status: AccountStatus;
    notes: string | null;
    secrets: Partial<Record<SecretType, string>>;
  }> = [
    {
      id: "acc-1",
      supplierName: "Northwind Trading Co.",
      upiId: "northwind.fictional@fictionalbank",
      loginIdentifier: "nw.orders.fictional@example.test",
      linkedEmail: "nw.linked.fictional@example.test",
      recoveryEmail: "nw.recovery.fictional@example.test",
      profileAge: "8 months",
      status: "active",
      notes: "Fictional demo record — primary ordering account.",
      secrets: {
        password: "Fict!onalPass_8h2Q",
        email_password: "L!nkedMailFict_4rT9",
      },
    },
    {
      id: "acc-2",
      supplierName: "Northwind Trading Co.",
      upiId: "northwind.fictional@fictionalbank",
      loginIdentifier: "nw.returns.fictional@example.test",
      linkedEmail: "nw.linked2.fictional@example.test",
      recoveryEmail: null,
      profileAge: "2 months",
      status: "pending",
      notes: "Fictional demo record — awaiting first review.",
      secrets: { password: "Fict!onalPass_2mZ1" },
    },
    {
      id: "acc-3",
      supplierName: "Blue Harbor Logistics",
      upiId: "blueharbor.fictional@fictionalbank",
      loginIdentifier: "bh.dispatch.fictional@example.test",
      linkedEmail: "bh.linked.fictional@example.test",
      recoveryEmail: "bh.recovery.fictional@example.test",
      profileAge: "1 year 3 months",
      status: "needs_review",
      notes: "Fictional demo record — flagged for unusual login location.",
      secrets: {
        password: "Fict!onalPass_9kL3",
      },
    },
    {
      id: "acc-4",
      supplierName: "Cascade Retail Partners",
      upiId: "cascade.fictional@fictionalbank",
      loginIdentifier: "cr.vendor.fictional@example.test",
      linkedEmail: "cr.linked.fictional@example.test",
      recoveryEmail: null,
      profileAge: "5 months",
      status: "archived",
      notes: "Fictional demo record — supplier relationship ended.",
      secrets: { password: "Fict!onalPass_0aC7" },
    },
    {
      id: "acc-5",
      supplierName: "Cascade Retail Partners",
      upiId: "cascade.billing.fictional@fictionalbank",
      loginIdentifier: "cr.billing.fictional@example.test",
      linkedEmail: "cr.linked2.fictional@example.test",
      recoveryEmail: "cr.recovery2.fictional@example.test",
      profileAge: "3 weeks",
      status: "pending",
      notes: "Fictional demo record — new billing sub-account.",
      secrets: { password: "Fict!onalPass_5vN2", email_password: "L!nkedMailFict_1qW8" },
    },
  ];

  const accounts = rawAccounts.map((raw) => {
    const secrets: Partial<Record<SecretType, DemoSecretRecord>> = {};
    for (const type of SECRET_TYPES) {
      const value = raw.secrets[type];
      if (value) {
        const enc = encryptSecret(value);
        secrets[type] = {
          ciphertext: enc.ciphertext,
          iv: enc.iv,
          authTag: enc.authTag,
          keyVersion: enc.keyVersion,
          updatedAt: now,
          updatedBy: "demo-admin-1",
        };
      }
    }
    return {
      id: raw.id,
      supplierName: raw.supplierName,
      upiId: raw.upiId,
      platform: FIXED_PLATFORM,
      loginIdentifier: raw.loginIdentifier,
      linkedEmail: raw.linkedEmail,
      recoveryEmail: raw.recoveryEmail,
      profileAge: raw.profileAge,
      status: raw.status,
      notes: raw.notes,
      createdBy: "demo-admin-1",
      updatedBy: "demo-admin-1",
      createdAt: now,
      updatedAt: now,
      secrets,
    };
  });

  return { profiles, accounts, auditLog: [] };
}

declare global {
   
  var __demoStore: DemoState | undefined;
}

export function getDemoStore(): DemoState {
  if (!globalThis.__demoStore) {
    globalThis.__demoStore = seed();
  }
  return globalThis.__demoStore;
}

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

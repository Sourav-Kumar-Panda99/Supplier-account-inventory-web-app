/**
 * supplier     — signs up himself, submits IDs, sees only his own dashboard.
 * media_buyer  — created by an admin; sees only the IDs assigned to him and
 *                marks each one active or rejected.
 * admin        — sees everything, accepts/rejects, assigns IDs to media buyers.
 */
export type Role = "supplier" | "media_buyer" | "admin";

export const ROLE_LABELS: Record<Role, string> = {
  supplier: "Supplier",
  media_buyer: "Media buyer",
  admin: "Admin",
};

/** Where each role lands after signing in. */
export const ROLE_HOME: Record<Role, string> = {
  supplier: "/supplier",
  media_buyer: "/buyer",
  admin: "/admin",
};

/** Common shape returned by every mutating Server Action, for ActionForm/AccountForm. */
export interface ActionResult {
  ok: boolean;
  error?: string;
  accountId?: string;
}

/**
 * pending  — just submitted, nobody has looked at it yet.
 * accepted — an admin took it (or assigned it to a media buyer).
 * active   — a media buyer (or admin) checked it and it works.
 * rejected — an admin or the assigned media buyer rejected it; see rejectionNote.
 * archived — admin-only "put away" state.
 */
export type AccountStatus = "pending" | "accepted" | "active" | "rejected" | "archived";

export type SecretType = "password" | "email_password" | "two_factor";

export const SECRET_TYPES: SecretType[] = ["password", "email_password", "two_factor"];

export const SECRET_LABELS: Record<SecretType, string> = {
  password: "Facebook password",
  email_password: "Outlook password",
  two_factor: "Facebook 2FA key",
};

export const ACCOUNT_STATUSES: AccountStatus[] = ["pending", "accepted", "active", "rejected", "archived"];

export const STATUS_LABELS: Record<AccountStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  active: "Active",
  rejected: "Rejected",
  archived: "Archived",
};

/** The only two outcomes a media buyer can record for an ID assigned to him. */
export type BuyerDecision = "active" | "rejected";

/**
 * What a supplier is shown. Internal states are collapsed so a supplier only
 * ever sees whether an ID is still waiting, was taken, or was turned down.
 */
export type SupplierBucket = "pending" | "accepted" | "rejected";

export const SUPPLIER_BUCKETS: SupplierBucket[] = ["pending", "accepted", "rejected"];

export function supplierBucket(status: AccountStatus): SupplierBucket {
  if (status === "pending") return "pending";
  if (status === "rejected") return "rejected";
  return "accepted"; // accepted, active, archived
}

export interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  role: Role;
  /** Supplier payout UPI ID. Null for other roles. */
  upiId: string | null;
  createdAt: string;
}

/** Platform is fixed for now — every account is a Facebook account. */
export const FIXED_PLATFORM = "Facebook";

export interface SecretPresence {
  present: boolean;
  updatedAt: string | null;
}

export interface Account {
  id: string;
  /** The supplier who submitted it. Null for records from before supplier logins existed. */
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
  statusChangedByName: string | null;
  statusChangedAt: string | null;
  /** The media buyer this ID is assigned to, if any. */
  assignedTo: string | null;
  assignedToName: string | null;
  assignedAt: string | null;
  notes: string | null;
  createdBy: string | null;
  createdByEmail: string | null;
  updatedBy: string | null;
  updatedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
  secrets: Record<SecretType, SecretPresence>;
}

/** What a supplier fills in for one ID. His name and UPI ID come from his own profile. */
export interface AccountInput {
  loginIdentifier: string;
  linkedEmail?: string;
  recoveryEmail?: string;
  secrets?: Partial<Record<SecretType, string>>;
}

export interface AccountUpdateInput {
  supplierName?: string;
  upiId?: string | null;
  loginIdentifier?: string;
  linkedEmail?: string | null;
  recoveryEmail?: string | null;
  profileAge?: string | null;
  notes?: string | null;
}

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  secretType: SecretType | null;
  outcome: "success" | "denied" | "error";
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DashboardStats {
  totalAccounts: number;
  pending: number;
  accepted: number;
  active: number;
  rejected: number;
  archived: number;
  /** Pending or accepted IDs that no media buyer has been given yet. */
  waitingToAssign: number;
}

// ---------------------------------------------------------------------------
// Supplier dashboard
// ---------------------------------------------------------------------------

/** One of a supplier's own IDs, as shown back to him. Never includes credentials. */
export interface SupplierAccountRow {
  id: string;
  loginIdentifier: string;
  linkedEmail: string | null;
  bucket: SupplierBucket;
  rejectionNote: string | null;
  /** Calendar day it was submitted, YYYY-MM-DD (see lib/day.ts for the timezone). */
  day: string;
  createdAt: string;
}

export interface BucketCounts {
  given: number;
  pending: number;
  accepted: number;
  rejected: number;
}

export interface SupplierDayStats extends BucketCounts {
  day: string;
}

export interface SupplierDashboard {
  totals: BucketCounts;
  /** Newest day first. */
  days: SupplierDayStats[];
  /** Newest first. */
  rows: SupplierAccountRow[];
}

// ---------------------------------------------------------------------------
// Media buyer
// ---------------------------------------------------------------------------

export interface BuyerCounts {
  assigned: number;
  /** Assigned but not yet marked active or rejected. */
  toCheck: number;
  active: number;
  rejected: number;
}

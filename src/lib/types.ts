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

/** Where an ID came from: a supplier submission, or a media buyer adding his own. */
export type AccountSource = "supplier" | "media_buyer";

export type SecretType = "password" | "email_password" | "two_factor";

export const SECRET_TYPES: SecretType[] = ["password", "email_password", "two_factor"];

export const SECRET_LABELS: Record<SecretType, string> = {
  password: "Facebook password",
  email_password: "Outlook password",
  two_factor: "Facebook 2FA key",
};

// The statuses the admin filters by and can set. "accepted" and "archived"
// still exist in the AccountStatus type (and STATUS_LABELS) for any legacy
// rows, but the admin no longer uses them.
export const ACCOUNT_STATUSES: AccountStatus[] = ["pending", "active", "rejected"];

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
  /** 'supplier' submission, or 'media_buyer' (the assigned buyer added it himself). */
  source: AccountSource;
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
  /** Marked paid by the admin (only accepted IDs are ever paid). Never carries the amount. */
  paid: boolean;
}

export interface BucketCounts {
  given: number;
  pending: number;
  accepted: number;
  rejected: number;
}

export interface SupplierDayStats extends BucketCounts {
  day: string;
  /** How many of that day's IDs are paid for. Only accepted IDs are ever paid. */
  paidIds: number;
  /** Accepted IDs of that day that are not paid yet. */
  acceptedUnpaid: number;
  /** When the most recent of that day's IDs was paid, or null. The amount is never sent to a supplier. */
  paidAt: string | null;
}

export interface SupplierDashboard {
  totals: BucketCounts;
  /** IDs he has been paid for, across all days. */
  paidIds: number;
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
  /** Of the assigned, how many the buyer added himself (source = media_buyer). */
  selfAdded: number;
}

/** One line of the admin "IDs media buyers added themselves, by day" report. */
export interface SelfAddedByDay {
  buyerId: string;
  buyerName: string;
  /** YYYY-MM-DD in the app timezone (see lib/day.ts). */
  day: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Admin: supplier payments by day
// ---------------------------------------------------------------------------

/** An admin marked a supplier's IDs for one day as paid. */
export interface SupplierPayment {
  /** How many IDs the payments for that day have covered (accepted IDs only). */
  accountCount: number;
  /** Total paid for that day, in INR (null only for old records saved without an amount). */
  amount: number | null;
  /** When the day was last marked paid. */
  paidAt: string;
  paidByName: string | null;
}

/** One supplier on one day: how many IDs he gave, what happened to them, and whether the day is paid. */
export interface SupplierDayRow extends BucketCounts {
  /** YYYY-MM-DD in the app timezone (see lib/day.ts). */
  day: string;
  supplierId: string;
  supplierName: string;
  upiId: string | null;
  /** IDs of that day marked paid (only accepted IDs are ever paid). */
  paidIds: number;
  /** Accepted IDs of that day not paid yet — what "Mark paid" would pay for now. */
  acceptedUnpaid: number;
  payment: SupplierPayment | null;
}

/** One month of supplier IDs and what was paid for them (by the day the IDs were given). */
export interface MonthSpending {
  /** "YYYY-MM", app timezone. */
  month: string;
  given: number;
  pending: number;
  accepted: number;
  rejected: number;
  /** Accepted IDs marked paid. */
  paidIds: number;
  /** Total of the amounts entered when marking days paid, in INR. */
  spent: number;
  /** Accepted IDs not paid yet. */
  unpaidIds: number;
  /** Paid supplier-days with no amount entered — their money is missing from `spent`. */
  paidDaysWithoutAmount: number;
}

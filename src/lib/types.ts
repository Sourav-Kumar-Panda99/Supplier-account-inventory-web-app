export type Role = "team" | "admin";

/** Common shape returned by every mutating Server Action, for ActionForm/AccountForm. */
export interface ActionResult {
  ok: boolean;
  error?: string;
  accountId?: string;
}

export type AccountStatus = "pending" | "active" | "needs_review" | "archived";

export type SecretType = "password" | "email_password";

export const SECRET_TYPES: SecretType[] = ["password", "email_password"];

export const SECRET_LABELS: Record<SecretType, string> = {
  password: "Profile password",
  email_password: "Linked email password",
};

export const ACCOUNT_STATUSES: AccountStatus[] = ["pending", "active", "needs_review", "archived"];

export const STATUS_LABELS: Record<AccountStatus, string> = {
  pending: "Pending",
  active: "Active",
  needs_review: "Needs review",
  archived: "Archived",
};

export interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  role: Role;
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
  supplierName: string;
  upiId: string | null;
  platform: string;
  loginIdentifier: string;
  linkedEmail: string | null;
  recoveryEmail: string | null;
  profileAge: string | null;
  status: AccountStatus;
  notes: string | null;
  createdBy: string | null;
  createdByEmail: string | null;
  updatedBy: string | null;
  updatedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
  secrets: Record<SecretType, SecretPresence>;
}

export interface AccountInput {
  supplierName: string;
  upiId?: string;
  loginIdentifier: string;
  linkedEmail?: string;
  recoveryEmail?: string;
  profileAge?: string;
  notes?: string;
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
  needsReview: number;
  active: number;
  archived: number;
}

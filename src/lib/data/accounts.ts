import "server-only";
import { isDemoMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDemoStore, newId, type DemoAccount } from "@/lib/demo/store";
import { writeAuditLog } from "@/lib/data/audit";
import { fetchSecretPresence, setSecret } from "@/lib/data/secrets";
import { dayKey } from "@/lib/day";
import { FIXED_PLATFORM, SECRET_TYPES, supplierBucket } from "@/lib/types";
import type { Database } from "@/lib/supabase/database.types";
import type { SessionUser } from "@/lib/auth";
import type {
  Account,
  AccountInput,
  AccountSource,
  AccountStatus,
  AccountUpdateInput,
  BucketCounts,
  BuyerCounts,
  BuyerDecision,
  DashboardStats,
  SecretType,
  SupplierAccountRow,
  SupplierDashboard,
  SupplierDayStats,
  SelfAddedByDay,
} from "@/lib/types";

type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];
type MutationResult = { ok: true } | { ok: false; error: string };

/** Filter value meaning "not assigned to any media buyer". */
export const UNASSIGNED = "unassigned";

export interface AccountFilters {
  search?: string;
  status?: AccountStatus;
  age?: string;
  /** A media buyer's profile id, or UNASSIGNED. */
  assigned?: string;
  page?: number;
  pageSize?: number;
}

export interface AccountListResult {
  accounts: Account[];
  total: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Live ids are uuids; anything else can't exist, so don't send it to Postgres just to get a cast error back. */
function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function emptySecretPresence(): Account["secrets"] {
  const result = {} as Account["secrets"];
  for (const type of SECRET_TYPES) result[type] = { present: false, updatedAt: null };
  return result;
}

// ---------------------------------------------------------------------------
// Demo-mode helpers
// ---------------------------------------------------------------------------

function demoToAccount(a: DemoAccount): Account {
  const store = getDemoStore();
  const profile = (id: string | null) => (id ? store.profiles.find((p) => p.id === id) : undefined);
  const name = (id: string | null) => {
    const p = profile(id);
    return p ? p.fullName ?? p.email : null;
  };

  const secrets = emptySecretPresence();
  for (const type of SECRET_TYPES) {
    const rec = a.secrets[type];
    if (rec) secrets[type] = { present: true, updatedAt: rec.updatedAt };
  }

  return {
    id: a.id,
    supplierId: a.supplierId,
    supplierName: a.supplierName,
    upiId: a.upiId,
    platform: a.platform,
    loginIdentifier: a.loginIdentifier,
    linkedEmail: a.linkedEmail,
    recoveryEmail: a.recoveryEmail,
    profileAge: a.profileAge,
    status: a.status,
    source: a.source,
    rejectionNote: a.rejectionNote,
    statusChangedByName: name(a.statusChangedBy),
    statusChangedAt: a.statusChangedAt,
    assignedTo: a.assignedTo,
    assignedToName: name(a.assignedTo),
    assignedAt: a.assignedAt,
    notes: a.notes,
    createdBy: a.createdBy,
    createdByEmail: profile(a.createdBy)?.email ?? null,
    updatedBy: a.updatedBy,
    updatedByEmail: profile(a.updatedBy)?.email ?? null,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    secrets,
  };
}

function demoMatchesFilters(a: DemoAccount, filters: AccountFilters): boolean {
  // The admin "All IDs" list is supplier submissions only. IDs a media buyer
  // added for himself are shown in their own section (getSelfAddedByDay).
  if (a.source !== "supplier") return false;
  if (filters.status && a.status !== filters.status) return false;
  if (filters.assigned === UNASSIGNED && a.assignedTo) return false;
  if (filters.assigned && filters.assigned !== UNASSIGNED && a.assignedTo !== filters.assigned) return false;
  if (filters.age && !(a.profileAge ?? "").toLowerCase().includes(filters.age.toLowerCase())) return false;
  if (filters.search) {
    const needle = filters.search.toLowerCase();
    const haystack = `${a.supplierName} ${a.upiId ?? ""} ${a.loginIdentifier} ${a.linkedEmail ?? ""}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Live-mode helpers
// ---------------------------------------------------------------------------

interface PersonLookup {
  email: string;
  name: string;
}

function rowToAccount(
  r: AccountRow,
  people: Map<string, PersonLookup>,
  presence: Map<SecretType, string> | undefined
): Account {
  const secrets = emptySecretPresence();
  for (const type of SECRET_TYPES) {
    const updatedAt = presence?.get(type) ?? null;
    if (updatedAt) secrets[type] = { present: true, updatedAt };
  }
  const person = (id: string | null) => (id ? people.get(id) : undefined);

  return {
    id: r.id,
    supplierId: r.supplier_id ?? null,
    supplierName: r.supplier_name,
    upiId: r.upi_id,
    platform: r.platform,
    loginIdentifier: r.login_identifier,
    linkedEmail: r.linked_email,
    recoveryEmail: r.recovery_email,
    profileAge: r.profile_age,
    status: r.status as AccountStatus,
    source: (r.source as AccountSource) ?? "supplier",
    rejectionNote: r.rejection_note ?? null,
    statusChangedByName: person(r.status_changed_by ?? null)?.name ?? null,
    statusChangedAt: r.status_changed_at ?? null,
    assignedTo: r.assigned_to ?? null,
    assignedToName: person(r.assigned_to ?? null)?.name ?? null,
    assignedAt: r.assigned_at ?? null,
    notes: r.notes,
    createdBy: r.created_by,
    createdByEmail: person(r.created_by)?.email ?? null,
    updatedBy: r.updated_by,
    updatedByEmail: person(r.updated_by)?.email ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    secrets,
  };
}

function groupPresence(
  rows: { account_id: string; secret_type: string; updated_at: string }[]
): Map<string, Map<SecretType, string>> {
  const byAccount = new Map<string, Map<SecretType, string>>();
  for (const p of rows) {
    if (!byAccount.has(p.account_id)) byAccount.set(p.account_id, new Map());
    byAccount.get(p.account_id)!.set(p.secret_type as SecretType, p.updated_at);
  }
  return byAccount;
}

/** Admin path: names and secret presence are read through the RLS-bound client. */
async function hydrateAccountsForAdmin(rows: AccountRow[]): Promise<Account[]> {
  if (rows.length === 0) return [];
  const supabase = await createSupabaseServerClient();

  const profileIds = new Set<string>();
  rows.forEach((r) => {
    for (const id of [r.created_by, r.updated_by, r.assigned_to, r.status_changed_by]) {
      if (id) profileIds.add(id);
    }
  });

  const people = new Map<string, PersonLookup>();
  if (profileIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", Array.from(profileIds));
    (profiles ?? []).forEach((p) => people.set(p.id, { email: p.email, name: p.full_name || p.email }));
  }

  const { data: presenceRows } = await supabase.rpc("account_secret_presence", {
    p_account_ids: rows.map((r) => r.id),
  });
  const presence = groupPresence(presenceRows ?? []);

  return rows.map((r) => rowToAccount(r, people, presence.get(r.id)));
}

/**
 * PostgREST caps how many rows one request returns (1000 by default), so
 * anything that has to count or group across a whole supplier / the whole
 * table reads a page at a time until a page comes back empty.
 */
const FETCH_PAGE_SIZE = 1000;
const FETCH_MAX_ROWS = 200_000;

// ---------------------------------------------------------------------------
// Admin: list / read
// ---------------------------------------------------------------------------

export async function listAccounts(filters: AccountFilters = {}): Promise<AccountListResult> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const start = (page - 1) * pageSize;

  if (isDemoMode) {
    const store = getDemoStore();
    const filtered = store.accounts.filter((a) => demoMatchesFilters(a, filters));
    filtered.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return { accounts: filtered.slice(start, start + pageSize).map(demoToAccount), total: filtered.length };
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("accounts")
    .select("*", { count: "exact" })
    .eq("source", "supplier")
    .order("updated_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.assigned === UNASSIGNED) query = query.is("assigned_to", null);
  else if (filters.assigned) query = query.eq("assigned_to", filters.assigned);
  if (filters.age) query = query.ilike("profile_age", `%${filters.age}%`);
  if (filters.search) {
    const like = `%${filters.search}%`;
    query = query.or(`supplier_name.ilike.${like},upi_id.ilike.${like},login_identifier.ilike.${like},linked_email.ilike.${like}`);
  }

  query = query.range(start, start + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to list accounts: ${error.message}`);

  const accounts = await hydrateAccountsForAdmin((data ?? []) as AccountRow[]);
  return { accounts, total: count ?? 0 };
}

export async function getAccount(id: string): Promise<Account | null> {
  if (isDemoMode) {
    const a = getDemoStore().accounts.find((acc) => acc.id === id);
    return a ? demoToAccount(a) : null;
  }

  if (!isUuid(id)) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("accounts").select("*").eq("id", id).maybeSingle();

  if (error) throw new Error(`Failed to load account: ${error.message}`);
  if (!data) return null;

  const [account] = await hydrateAccountsForAdmin([data as AccountRow]);
  return account ?? null;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  if (isDemoMode) {
    const store = getDemoStore();
    const stats: DashboardStats = {
      totalAccounts: 0,
      pending: 0,
      accepted: 0,
      active: 0,
      rejected: 0,
      archived: 0,
      waitingToAssign: 0,
    };
    for (const a of store.accounts) {
      if (a.source !== "supplier") continue; // buyer-added IDs are reported separately
      stats.totalAccounts++;
      stats[a.status]++;
      if (!a.assignedTo && (a.status === "pending" || a.status === "accepted")) stats.waitingToAssign++;
    }
    return stats;
  }

  const supabase = await createSupabaseServerClient();
  // Supplier submissions only — buyer-added IDs are reported separately.
  const base = () => supabase.from("accounts").select("id", { count: "exact", head: true }).eq("source", "supplier");
  const countWhere = (status: AccountStatus) => base().eq("status", status);

  const [total, pending, accepted, active, rejected, archived, waiting] = await Promise.all([
    base(),
    countWhere("pending"),
    countWhere("accepted"),
    countWhere("active"),
    countWhere("rejected"),
    countWhere("archived"),
    base().is("assigned_to", null).in("status", ["pending", "accepted"]),
  ]);

  return {
    totalAccounts: total.count ?? 0,
    pending: pending.count ?? 0,
    accepted: accepted.count ?? 0,
    active: active.count ?? 0,
    rejected: rejected.count ?? 0,
    archived: archived.count ?? 0,
    waitingToAssign: waiting.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Supplier: submit + own dashboard
// ---------------------------------------------------------------------------

/**
 * A supplier submitting one ID. The supplier's name and UPI ID are copied
 * from his own profile at submit time — never taken from the form — so an ID
 * can't be filed under someone else's name.
 *
 * The caller (createAccountAction) must have checked the supplier role. In
 * live mode the write goes through the service-role client: `accounts` has no
 * INSERT policy for ordinary users at all, so this validated server function
 * is the only way a row gets created.
 */
export async function createAccount(input: AccountInput, supplier: SessionUser): Promise<{ id: string }> {
  const supplierName = supplier.fullName?.trim() || supplier.email;
  const loginIdentifier = input.loginIdentifier.trim();
  const linkedEmail = input.linkedEmail?.trim() || null;
  const recoveryEmail = input.recoveryEmail?.trim() || null;
  let id: string;

  if (isDemoMode) {
    const store = getDemoStore();
    id = newId("acc");
    const now = new Date().toISOString();
    store.accounts.push({
      id,
      supplierId: supplier.id,
      supplierName,
      upiId: supplier.upiId,
      platform: FIXED_PLATFORM,
      loginIdentifier,
      linkedEmail,
      recoveryEmail,
      profileAge: null,
      status: "pending",
      source: "supplier",
      rejectionNote: null,
      statusChangedBy: null,
      statusChangedAt: null,
      assignedTo: null,
      assignedAt: null,
      notes: null,
      createdBy: supplier.id,
      updatedBy: supplier.id,
      createdAt: now,
      updatedAt: now,
      secrets: {},
    });
  } else {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("accounts")
      .insert({
        supplier_id: supplier.id,
        supplier_name: supplierName,
        upi_id: supplier.upiId,
        platform: FIXED_PLATFORM,
        login_identifier: loginIdentifier,
        linked_email: linkedEmail,
        recovery_email: recoveryEmail,
        source: "supplier",
        created_by: supplier.id,
        updated_by: supplier.id,
      })
      .select("id")
      .single();

    if (error || !data) throw new Error(`Failed to create account: ${error?.message ?? "no row returned"}`);
    id = data.id;
  }

  if (input.secrets) {
    for (const [type, value] of Object.entries(input.secrets)) {
      if (value) await setSecret(id, type as SecretType, value, supplier.id);
    }
  }

  await writeAuditLog({
    actorId: supplier.id,
    actorEmail: supplier.email,
    action: "account.create",
    entityType: "account",
    entityId: id,
    outcome: "success",
    metadata: { supplierName },
  });

  return { id };
}

/**
 * A media buyer adds an ID of his own — not from a supplier. It belongs to and
 * is assigned to him (source = "media_buyer", supplier_id null) and starts
 * active. The caller (createOwnAccountAction) must have checked the media_buyer
 * role; the owner is taken from the session, never the form.
 */
export async function createAccountForBuyer(input: AccountInput, buyer: SessionUser): Promise<{ id: string }> {
  const buyerName = buyer.fullName?.trim() || buyer.email;
  const loginIdentifier = input.loginIdentifier.trim();
  const linkedEmail = input.linkedEmail?.trim() || null;
  const recoveryEmail = input.recoveryEmail?.trim() || null;
  const now = new Date().toISOString();
  let id: string;

  if (isDemoMode) {
    const store = getDemoStore();
    id = newId("acc");
    store.accounts.push({
      id,
      supplierId: null,
      supplierName: buyerName,
      upiId: null,
      platform: FIXED_PLATFORM,
      loginIdentifier,
      linkedEmail,
      recoveryEmail,
      profileAge: null,
      status: "active",
      source: "media_buyer",
      rejectionNote: null,
      statusChangedBy: null,
      statusChangedAt: null,
      assignedTo: buyer.id,
      assignedAt: now,
      notes: null,
      createdBy: buyer.id,
      updatedBy: buyer.id,
      createdAt: now,
      updatedAt: now,
      secrets: {},
    });
  } else {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("accounts")
      .insert({
        supplier_id: null,
        supplier_name: buyerName,
        upi_id: null,
        platform: FIXED_PLATFORM,
        login_identifier: loginIdentifier,
        linked_email: linkedEmail,
        recovery_email: recoveryEmail,
        source: "media_buyer",
        status: "active",
        assigned_to: buyer.id,
        assigned_at: now,
        assigned_by: buyer.id,
        created_by: buyer.id,
        updated_by: buyer.id,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`Failed to add ID: ${error?.message ?? "no row returned"}`);
    id = data.id;
  }

  if (input.secrets) {
    for (const [type, value] of Object.entries(input.secrets)) {
      if (value) await setSecret(id, type as SecretType, value, buyer.id);
    }
  }

  await writeAuditLog({
    actorId: buyer.id,
    actorEmail: buyer.email,
    action: "account.create_own",
    entityType: "account",
    entityId: id,
    outcome: "success",
    metadata: { source: "media_buyer" },
  });

  return { id };
}

interface SupplierSourceRow {
  id: string;
  loginIdentifier: string;
  linkedEmail: string | null;
  status: AccountStatus;
  rejectionNote: string | null;
  createdAt: string;
}

/**
 * Everything a supplier sees about his own IDs: totals, a per-day breakdown,
 * and the list itself. `supplierId` must be the signed-in supplier's own id —
 * callers pass `user.id` from requireRole("supplier"), never a value from the
 * URL or a form.
 *
 * A supplier must never learn who handled an ID. So this deliberately does
 * not read or return who it is assigned to, who accepted or rejected it, or
 * when — and the internal statuses are collapsed to pending / accepted /
 * rejected, so an ID sitting with a media buyer looks no different from one
 * that isn't. The only thing passed through is the rejection reason text.
 * Keep it that way when adding fields.
 */
export async function getSupplierDashboard(supplierId: string): Promise<SupplierDashboard> {
  let source: SupplierSourceRow[];

  if (isDemoMode) {
    source = getDemoStore()
      .accounts.filter((a) => a.supplierId === supplierId)
      .map((a) => ({
        id: a.id,
        loginIdentifier: a.loginIdentifier,
        linkedEmail: a.linkedEmail,
        status: a.status,
        rejectionNote: a.rejectionNote,
        createdAt: a.createdAt,
      }));
  } else {
    // Service-role client, always filtered by supplier_id: suppliers have no
    // RLS policy on accounts, and only these non-secret columns are read.
    const admin = createSupabaseAdminClient();
    source = [];
    while (source.length < FETCH_MAX_ROWS) {
      const { data, error } = await admin
        .from("accounts")
        .select("id, login_identifier, linked_email, status, rejection_note, created_at")
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(source.length, source.length + FETCH_PAGE_SIZE - 1);

      if (error) throw new Error(`Failed to load your IDs: ${error.message}`);
      if (!data || data.length === 0) break;

      for (const r of data) {
        source.push({
          id: r.id,
          loginIdentifier: r.login_identifier,
          linkedEmail: r.linked_email,
          status: r.status as AccountStatus,
          rejectionNote: r.rejection_note,
          createdAt: r.created_at,
        });
      }
    }
  }

  source.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));

  const totals: BucketCounts = { given: 0, pending: 0, accepted: 0, rejected: 0 };
  const byDay = new Map<string, SupplierDayStats>();
  const rows: SupplierAccountRow[] = [];

  for (const s of source) {
    const bucket = supplierBucket(s.status);
    const day = dayKey(s.createdAt);

    totals.given++;
    totals[bucket]++;

    if (!byDay.has(day)) byDay.set(day, { day, given: 0, pending: 0, accepted: 0, rejected: 0 });
    const dayStats = byDay.get(day)!;
    dayStats.given++;
    dayStats[bucket]++;

    rows.push({
      id: s.id,
      loginIdentifier: s.loginIdentifier,
      linkedEmail: s.linkedEmail,
      bucket,
      // The reason is only meaningful (and only shown) while the ID is rejected.
      rejectionNote: bucket === "rejected" ? s.rejectionNote : null,
      day,
      createdAt: s.createdAt,
    });
  }

  const days = [...byDay.values()].sort((a, b) => (a.day < b.day ? 1 : -1));
  return { totals, days, rows };
}

// ---------------------------------------------------------------------------
// Admin: edit / status / assign / delete
// ---------------------------------------------------------------------------

export async function updateAccount(id: string, input: AccountUpdateInput, actorId: string, actorEmail: string): Promise<void> {
  if (isDemoMode) {
    const store = getDemoStore();
    const account = store.accounts.find((a) => a.id === id);
    if (!account) throw new Error("Account not found");
    if (input.supplierName !== undefined) account.supplierName = input.supplierName.trim();
    if (input.upiId !== undefined) account.upiId = input.upiId?.trim() || null;
    if (input.loginIdentifier !== undefined) account.loginIdentifier = input.loginIdentifier.trim();
    if (input.linkedEmail !== undefined) account.linkedEmail = input.linkedEmail?.trim() || null;
    if (input.recoveryEmail !== undefined) account.recoveryEmail = input.recoveryEmail?.trim() || null;
    if (input.profileAge !== undefined) account.profileAge = input.profileAge?.trim() || null;
    if (input.notes !== undefined) account.notes = input.notes?.trim() || null;
    account.updatedBy = actorId;
    account.updatedAt = new Date().toISOString();
  } else {
    const supabase = await createSupabaseServerClient();
    const patch: Record<string, unknown> = { updated_by: actorId };
    if (input.supplierName !== undefined) patch.supplier_name = input.supplierName.trim();
    if (input.upiId !== undefined) patch.upi_id = input.upiId?.trim() || null;
    if (input.loginIdentifier !== undefined) patch.login_identifier = input.loginIdentifier.trim();
    if (input.linkedEmail !== undefined) patch.linked_email = input.linkedEmail?.trim() || null;
    if (input.recoveryEmail !== undefined) patch.recovery_email = input.recoveryEmail?.trim() || null;
    if (input.profileAge !== undefined) patch.profile_age = input.profileAge?.trim() || null;
    if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;

    const { error } = await supabase.from("accounts").update(patch).eq("id", id);
    if (error) throw new Error(`Failed to update account: ${error.message}`);
  }

  await writeAuditLog({ actorId, actorEmail, action: "account.update", entityType: "account", entityId: id, outcome: "success", metadata: { fields: Object.keys(input) } });
}

/**
 * Admin sets the status of one or more IDs. The rejection note is kept only
 * while the status is `rejected`; moving to any other status clears it.
 *
 * Callers must have checked the admin role. In live mode the update also runs
 * on the RLS-bound client, where accounts_admin_update is the real boundary.
 */
export async function setStatusAsAdmin(
  ids: string[],
  status: AccountStatus,
  note: string | null,
  actor: SessionUser
): Promise<MutationResult> {
  if (ids.length === 0) return { ok: true };
  const now = new Date().toISOString();
  const rejectionNote = status === "rejected" ? note?.trim() || null : null;

  if (isDemoMode) {
    const store = getDemoStore();
    for (const account of store.accounts) {
      if (!ids.includes(account.id)) continue;
      account.status = status;
      account.rejectionNote = rejectionNote;
      account.statusChangedBy = actor.id;
      account.statusChangedAt = now;
      account.updatedBy = actor.id;
      account.updatedAt = now;
    }
  } else {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("accounts")
      .update({
        status,
        rejection_note: rejectionNote,
        status_changed_by: actor.id,
        status_changed_at: now,
        updated_by: actor.id,
      })
      .in("id", ids);

    if (error) {
      await writeAuditLog({ actorId: actor.id, actorEmail: actor.email, action: "account.status_change", entityType: "account", entityId: null, outcome: "error", metadata: { ids, attemptedStatus: status, dbError: error.message } });
      return { ok: false, error: error.message };
    }
  }

  for (const id of ids) {
    await writeAuditLog({ actorId: actor.id, actorEmail: actor.email, action: "account.status_change", entityType: "account", entityId: id, outcome: "success", metadata: { status, by: "admin", hasNote: !!rejectionNote } });
  }
  return { ok: true };
}

/**
 * Admin assigns one or more IDs to a media buyer (or unassigns with null).
 * Assigning an ID that is still pending also accepts it — handing it to a
 * buyer is the acceptance.
 *
 * Callers must have checked the admin role and that `buyerId` really is a
 * media buyer.
 */
export async function assignAccounts(ids: string[], buyerId: string | null, actor: SessionUser): Promise<MutationResult> {
  if (ids.length === 0) return { ok: true };
  const now = new Date().toISOString();

  if (isDemoMode) {
    const store = getDemoStore();
    for (const account of store.accounts) {
      if (!ids.includes(account.id)) continue;
      account.assignedTo = buyerId;
      account.assignedAt = buyerId ? now : null;
      account.updatedBy = actor.id;
      account.updatedAt = now;
    }
  } else {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("accounts")
      .update({
        assigned_to: buyerId,
        assigned_at: buyerId ? now : null,
        assigned_by: buyerId ? actor.id : null,
        updated_by: actor.id,
      })
      .in("id", ids);

    if (error) {
      await writeAuditLog({ actorId: actor.id, actorEmail: actor.email, action: "account.assign", entityType: "account", entityId: null, outcome: "error", metadata: { ids, assignedTo: buyerId, dbError: error.message } });
      return { ok: false, error: error.message };
    }
  }

  for (const id of ids) {
    await writeAuditLog({ actorId: actor.id, actorEmail: actor.email, action: buyerId ? "account.assign" : "account.unassign", entityType: "account", entityId: id, outcome: "success", metadata: { assignedTo: buyerId } });
  }
  return { ok: true };
}

/**
 * Permanently deletes one or more accounts (and, via the account_secrets
 * on-delete-cascade FK, whatever credentials were stored for them). There is
 * no undo — the caller (deleteAccountsAction) is responsible for requiring a
 * fresh admin check and an explicit confirmation before this is ever called.
 */
export async function deleteAccounts(ids: string[], actorId: string, actorEmail: string): Promise<MutationResult> {
  if (ids.length === 0) return { ok: true };

  if (isDemoMode) {
    const store = getDemoStore();
    store.accounts = store.accounts.filter((a) => !ids.includes(a.id));
  } else {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("accounts").delete().in("id", ids);
    if (error) {
      await writeAuditLog({
        actorId,
        actorEmail,
        action: "account.delete",
        entityType: "account",
        entityId: null,
        outcome: "denied",
        metadata: { ids, dbError: error.message },
      });
      return { ok: false, error: error.message };
    }
  }

  for (const id of ids) {
    await writeAuditLog({ actorId, actorEmail, action: "account.delete", entityType: "account", entityId: id, outcome: "success", metadata: {} });
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Media buyer: only ever the IDs assigned to him
// ---------------------------------------------------------------------------

export type BuyerFilter = "to_check" | "active" | "rejected" | "self_added";

const TO_CHECK_STATUSES: AccountStatus[] = ["pending", "accepted"];

export interface BuyerListResult {
  accounts: Account[];
  total: number;
  counts: BuyerCounts;
}

/**
 * The IDs assigned to one media buyer. `buyerId` must be the signed-in
 * buyer's own id (from requireRole("media_buyer")), never a value from the
 * URL. In live mode this uses the service-role client with an assigned_to
 * filter on every query — media buyers have no RLS policy on accounts.
 */
export async function listAccountsForBuyer(
  buyerId: string,
  options: { filter?: BuyerFilter; page?: number; pageSize?: number } = {}
): Promise<BuyerListResult> {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 25;
  const start = (page - 1) * pageSize;

  if (isDemoMode) {
    const mine = getDemoStore().accounts.filter((a) => a.assignedTo === buyerId);
    const counts: BuyerCounts = {
      assigned: mine.length,
      toCheck: mine.filter((a) => TO_CHECK_STATUSES.includes(a.status)).length,
      active: mine.filter((a) => a.status === "active").length,
      rejected: mine.filter((a) => a.status === "rejected").length,
      selfAdded: mine.filter((a) => a.source === "media_buyer").length,
    };
    const filtered = mine.filter((a) => {
      if (options.filter === "to_check") return TO_CHECK_STATUSES.includes(a.status);
      if (options.filter === "active") return a.status === "active";
      if (options.filter === "rejected") return a.status === "rejected";
      if (options.filter === "self_added") return a.source === "media_buyer";
      return true;
    });
    filtered.sort((a, b) => ((a.assignedAt ?? "") < (b.assignedAt ?? "") ? 1 : -1));
    return { accounts: filtered.slice(start, start + pageSize).map(demoToAccount), total: filtered.length, counts };
  }

  const admin = createSupabaseAdminClient();
  const mine = () => admin.from("accounts").select("id", { count: "exact", head: true }).eq("assigned_to", buyerId);

  let listQuery = admin
    .from("accounts")
    .select("*", { count: "exact" })
    .eq("assigned_to", buyerId)
    .order("assigned_at", { ascending: false })
    .order("id", { ascending: true });
  if (options.filter === "to_check") listQuery = listQuery.in("status", TO_CHECK_STATUSES);
  if (options.filter === "active") listQuery = listQuery.eq("status", "active");
  if (options.filter === "rejected") listQuery = listQuery.eq("status", "rejected");
  if (options.filter === "self_added") listQuery = listQuery.eq("source", "media_buyer");

  const [assigned, toCheck, active, rejected, selfAdded, list] = await Promise.all([
    mine(),
    mine().in("status", TO_CHECK_STATUSES),
    mine().eq("status", "active"),
    mine().eq("status", "rejected"),
    mine().eq("source", "media_buyer"),
    listQuery.range(start, start + pageSize - 1),
  ]);

  if (list.error) throw new Error(`Failed to list your IDs: ${list.error.message}`);

  const rows = list.data ?? [];
  const presence = groupPresence(await fetchSecretPresence(rows.map((r) => r.id)));
  const noPeople = new Map<string, PersonLookup>();

  return {
    accounts: rows.map((r) => rowToAccount(r, noPeople, presence.get(r.id))),
    total: list.count ?? 0,
    counts: {
      assigned: assigned.count ?? 0,
      toCheck: toCheck.count ?? 0,
      active: active.count ?? 0,
      rejected: rejected.count ?? 0,
      selfAdded: selfAdded.count ?? 0,
    },
  };
}

/** One ID, but only if it is assigned to this buyer — otherwise null, exactly as if it didn't exist. */
export async function getAccountForBuyer(id: string, buyerId: string): Promise<Account | null> {
  if (isDemoMode) {
    const a = getDemoStore().accounts.find((acc) => acc.id === id && acc.assignedTo === buyerId);
    return a ? demoToAccount(a) : null;
  }

  if (!isUuid(id)) return null;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("accounts")
    .select("*")
    .eq("id", id)
    .eq("assigned_to", buyerId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load account: ${error.message}`);
  if (!data) return null;

  const presence = groupPresence(await fetchSecretPresence([data.id]));
  return rowToAccount(data, new Map(), presence.get(data.id));
}

/**
 * A media buyer records the result of checking an ID assigned to him.
 * The assigned_to condition is part of the write itself, so an ID that was
 * reassigned a moment ago can't be changed by its previous buyer.
 */
export async function setStatusAsBuyer(
  id: string,
  decision: BuyerDecision,
  note: string | null,
  buyer: SessionUser
): Promise<MutationResult> {
  const now = new Date().toISOString();
  const rejectionNote = decision === "rejected" ? note?.trim() || null : null;
  let updated = false;

  if (isDemoMode) {
    const account = getDemoStore().accounts.find((a) => a.id === id && a.assignedTo === buyer.id);
    if (account) {
      account.status = decision;
      account.rejectionNote = rejectionNote;
      account.statusChangedBy = buyer.id;
      account.statusChangedAt = now;
      account.updatedBy = buyer.id;
      account.updatedAt = now;
      updated = true;
    }
  } else if (isUuid(id)) {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("accounts")
      .update({
        status: decision,
        rejection_note: rejectionNote,
        status_changed_by: buyer.id,
        status_changed_at: now,
        updated_by: buyer.id,
      })
      .eq("id", id)
      .eq("assigned_to", buyer.id)
      .select("id");

    if (error) {
      await writeAuditLog({ actorId: buyer.id, actorEmail: buyer.email, action: "account.status_change", entityType: "account", entityId: id, outcome: "error", metadata: { attemptedStatus: decision, dbError: error.message } });
      return { ok: false, error: "Could not save. Please try again." };
    }
    updated = (data ?? []).length > 0;
  }

  if (!updated) {
    await writeAuditLog({ actorId: buyer.id, actorEmail: buyer.email, action: "account.status_change", entityType: "account", entityId: isDemoMode || isUuid(id) ? id : null, outcome: "denied", metadata: { attemptedStatus: decision, reason: "not_assigned" } });
    return { ok: false, error: "This ID is not assigned to you." };
  }

  await writeAuditLog({ actorId: buyer.id, actorEmail: buyer.email, action: "account.status_change", entityType: "account", entityId: id, outcome: "success", metadata: { status: decision, by: "media_buyer", hasNote: !!rejectionNote } });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Admin: per-person totals for the Users page
// ---------------------------------------------------------------------------

export interface PeopleSummaries {
  suppliers: Map<string, BucketCounts>;
  buyers: Map<string, BuyerCounts>;
}

export async function getPeopleSummaries(): Promise<PeopleSummaries> {
  let rows: { supplierId: string | null; assignedTo: string | null; status: AccountStatus; source: AccountSource }[];

  if (isDemoMode) {
    rows = getDemoStore().accounts.map((a) => ({ supplierId: a.supplierId, assignedTo: a.assignedTo, status: a.status, source: a.source }));
  } else {
    const supabase = await createSupabaseServerClient();
    rows = [];
    while (rows.length < FETCH_MAX_ROWS) {
      const { data, error } = await supabase
        .from("accounts")
        .select("supplier_id, assigned_to, status, source")
        .order("id", { ascending: true })
        .range(rows.length, rows.length + FETCH_PAGE_SIZE - 1);

      if (error) throw new Error(`Failed to load account totals: ${error.message}`);
      if (!data || data.length === 0) break;

      for (const r of data as { supplier_id: string | null; assigned_to: string | null; status: string; source: string }[]) {
        rows.push({ supplierId: r.supplier_id, assignedTo: r.assigned_to, status: r.status as AccountStatus, source: (r.source as AccountSource) ?? "supplier" });
      }
    }
  }

  const suppliers = new Map<string, BucketCounts>();
  const buyers = new Map<string, BuyerCounts>();

  for (const r of rows) {
    if (r.supplierId) {
      if (!suppliers.has(r.supplierId)) suppliers.set(r.supplierId, { given: 0, pending: 0, accepted: 0, rejected: 0 });
      const s = suppliers.get(r.supplierId)!;
      s.given++;
      s[supplierBucket(r.status)]++;
    }
    if (r.assignedTo) {
      if (!buyers.has(r.assignedTo)) buyers.set(r.assignedTo, { assigned: 0, toCheck: 0, active: 0, rejected: 0, selfAdded: 0 });
      const b = buyers.get(r.assignedTo)!;
      b.assigned++;
      if (TO_CHECK_STATUSES.includes(r.status)) b.toCheck++;
      else if (r.status === "active") b.active++;
      else if (r.status === "rejected") b.rejected++;
      if (r.source === "media_buyer") b.selfAdded++;
    }
  }

  return { suppliers, buyers };
}

/**
 * Admin report: how many IDs each media buyer added for himself, by the day he
 * added them. Newest day first, then by buyer name. Only source = "media_buyer".
 */
export async function getSelfAddedByDay(): Promise<SelfAddedByDay[]> {
  const counts = new Map<string, number>(); // key: `${buyerId}|${day}`
  const buyerIds = new Set<string>();
  const names = new Map<string, string>();

  const add = (buyerId: string | null, createdAt: string) => {
    if (!buyerId) return;
    buyerIds.add(buyerId);
    const key = `${buyerId}|${dayKey(createdAt)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };

  if (isDemoMode) {
    const store = getDemoStore();
    for (const a of store.accounts) {
      if (a.source === "media_buyer") add(a.assignedTo, a.createdAt);
    }
    for (const id of buyerIds) {
      const p = store.profiles.find((x) => x.id === id);
      names.set(id, p ? p.fullName ?? p.email : "Unknown");
    }
  } else {
    const admin = createSupabaseAdminClient();
    let fetched = 0;
    while (fetched < FETCH_MAX_ROWS) {
      const { data, error } = await admin
        .from("accounts")
        .select("assigned_to, created_at")
        .eq("source", "media_buyer")
        .order("id", { ascending: true })
        .range(fetched, fetched + FETCH_PAGE_SIZE - 1);
      if (error) throw new Error(`Failed to load self-added IDs: ${error.message}`);
      if (!data || data.length === 0) break;
      for (const r of data as { assigned_to: string | null; created_at: string }[]) add(r.assigned_to, r.created_at);
      fetched += data.length;
      if (data.length < FETCH_PAGE_SIZE) break;
    }
    if (buyerIds.size > 0) {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase.from("profiles").select("id, email, full_name").in("id", [...buyerIds]);
      (data ?? []).forEach((p) => names.set(p.id, p.full_name || p.email));
    }
  }

  const rows: SelfAddedByDay[] = [];
  for (const [key, count] of counts) {
    const [buyerId, day] = key.split("|");
    rows.push({ buyerId, buyerName: names.get(buyerId) ?? "Unknown", day, count });
  }
  rows.sort((a, b) => (a.day !== b.day ? (a.day < b.day ? 1 : -1) : a.buyerName.localeCompare(b.buyerName)));
  return rows;
}

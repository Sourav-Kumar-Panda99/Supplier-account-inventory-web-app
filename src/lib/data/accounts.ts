import "server-only";
import { isDemoMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDemoStore, newId } from "@/lib/demo/store";
import { writeAuditLog } from "@/lib/data/audit";
import { setSecret } from "@/lib/data/secrets";
import { FIXED_PLATFORM, SECRET_TYPES } from "@/lib/types";
import type {
  Account,
  AccountInput,
  AccountStatus,
  AccountUpdateInput,
  DashboardStats,
  SecretType,
} from "@/lib/types";

export interface AccountFilters {
  search?: string;
  status?: AccountStatus;
  age?: string;
  page?: number;
  pageSize?: number;
}

export interface AccountListResult {
  accounts: Account[];
  total: number;
}

function matchesFilters(
  a: { supplierName: string; upiId: string | null; loginIdentifier: string; linkedEmail: string | null; status: AccountStatus; profileAge: string | null },
  filters: AccountFilters
): boolean {
  if (filters.status && a.status !== filters.status) return false;
  if (filters.age) {
    if (!(a.profileAge ?? "").toLowerCase().includes(filters.age.toLowerCase())) return false;
  }
  if (filters.search) {
    const needle = filters.search.toLowerCase();
    const haystack = `${a.supplierName} ${a.upiId ?? ""} ${a.loginIdentifier} ${a.linkedEmail ?? ""}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

export async function listAccounts(filters: AccountFilters = {}): Promise<AccountListResult> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;

  if (isDemoMode) {
    const store = getDemoStore();
    const profileById = new Map(store.profiles.map((p) => [p.id, p]));

    const filtered = store.accounts.filter((a) => matchesFilters(a, filters));
    filtered.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const pageItems = filtered.slice(start, start + pageSize);

    const accounts: Account[] = pageItems.map((a) => ({
      id: a.id,
      supplierName: a.supplierName,
      upiId: a.upiId,
      platform: a.platform,
      loginIdentifier: a.loginIdentifier,
      linkedEmail: a.linkedEmail,
      recoveryEmail: a.recoveryEmail,
      profileAge: a.profileAge,
      status: a.status,
      notes: a.notes,
      createdBy: a.createdBy,
      createdByEmail: a.createdBy ? profileById.get(a.createdBy)?.email ?? null : null,
      updatedBy: a.updatedBy,
      updatedByEmail: a.updatedBy ? profileById.get(a.updatedBy)?.email ?? null : null,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      secrets: secretPresenceFromDemo(a.secrets),
    }));

    return { accounts, total };
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase.from("accounts").select("*", { count: "exact" }).order("updated_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.age) query = query.ilike("profile_age", `%${filters.age}%`);
  if (filters.search) {
    const like = `%${filters.search}%`;
    query = query.or(`supplier_name.ilike.${like},upi_id.ilike.${like},login_identifier.ilike.${like},linked_email.ilike.${like}`);
  }

  const start = (page - 1) * pageSize;
  query = query.range(start, start + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to list accounts: ${error.message}`);

  const rows = data ?? [];
  const accounts = await hydrateAccounts(rows);

  return { accounts, total: count ?? 0 };
}

export async function getAccount(id: string): Promise<Account | null> {
  if (isDemoMode) {
    const store = getDemoStore();
    const a = store.accounts.find((acc) => acc.id === id);
    if (!a) return null;
    const createdByProfile = a.createdBy ? store.profiles.find((p) => p.id === a.createdBy) : undefined;
    const updatedByProfile = a.updatedBy ? store.profiles.find((p) => p.id === a.updatedBy) : undefined;
    return {
      id: a.id,
      supplierName: a.supplierName,
      upiId: a.upiId,
      platform: a.platform,
      loginIdentifier: a.loginIdentifier,
      linkedEmail: a.linkedEmail,
      recoveryEmail: a.recoveryEmail,
      profileAge: a.profileAge,
      status: a.status,
      notes: a.notes,
      createdBy: a.createdBy,
      createdByEmail: createdByProfile?.email ?? null,
      updatedBy: a.updatedBy,
      updatedByEmail: updatedByProfile?.email ?? null,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      secrets: secretPresenceFromDemo(a.secrets),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("accounts").select("*").eq("id", id).maybeSingle();

  if (error) throw new Error(`Failed to load account: ${error.message}`);
  if (!data) return null;

  const [account] = await hydrateAccounts([data]);
  return account ?? null;
}

function secretPresenceFromDemo(secrets: Partial<Record<SecretType, { updatedAt: string }>>) {
  const result: Account["secrets"] = {} as Account["secrets"];
  for (const type of SECRET_TYPES) {
    const rec = secrets[type];
    result[type] = { present: !!rec, updatedAt: rec?.updatedAt ?? null };
  }
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function hydrateAccounts(rows: any[]): Promise<Account[]> {
  if (rows.length === 0) return [];
  const supabase = await createSupabaseServerClient();

  const profileIds = new Set<string>();
  rows.forEach((r) => {
    if (r.created_by) profileIds.add(r.created_by);
    if (r.updated_by) profileIds.add(r.updated_by);
  });

  const profilesById = new Map<string, { email: string }>();
  if (profileIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", Array.from(profileIds));
    (profiles ?? []).forEach((p) => profilesById.set(p.id, { email: p.email }));
  }

  const accountIds = rows.map((r) => r.id);
  const presenceByAccount = new Map<string, Map<SecretType, string>>();
  const { data: presenceRows } = await supabase.rpc("account_secret_presence", { p_account_ids: accountIds });
  (presenceRows ?? []).forEach((p: { account_id: string; secret_type: SecretType; updated_at: string }) => {
    if (!presenceByAccount.has(p.account_id)) presenceByAccount.set(p.account_id, new Map());
    presenceByAccount.get(p.account_id)!.set(p.secret_type, p.updated_at);
  });

  return rows.map((r) => {
    const presenceMap = presenceByAccount.get(r.id);
    const secrets: Account["secrets"] = {} as Account["secrets"];
    for (const type of SECRET_TYPES) {
      const updatedAt = presenceMap?.get(type) ?? null;
      secrets[type] = { present: !!updatedAt, updatedAt };
    }

    return {
      id: r.id,
      supplierName: r.supplier_name,
      upiId: r.upi_id,
      platform: r.platform,
      loginIdentifier: r.login_identifier,
      linkedEmail: r.linked_email,
      recoveryEmail: r.recovery_email,
      profileAge: r.profile_age,
      status: r.status,
      notes: r.notes,
      createdBy: r.created_by,
      createdByEmail: r.created_by ? profilesById.get(r.created_by)?.email ?? null : null,
      updatedBy: r.updated_by,
      updatedByEmail: r.updated_by ? profilesById.get(r.updated_by)?.email ?? null : null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      secrets,
    };
  });
}

/**
 * Submitting a new account requires no login (see createAccountAction), so
 * actorId is nullable — most submissions are anonymous. Because there's no
 * session, the live-mode write goes through the service-role admin client
 * (bypassing RLS) rather than the RLS-bound client, the same pattern this
 * codebase already uses for account_secrets/audit_log: no direct
 * anon/authenticated write policy exists for this path at all, so the only
 * way in is this validated server function.
 */
export async function createAccount(input: AccountInput, actorId: string | null, actorEmail: string): Promise<Account> {
  if (isDemoMode) {
    const store = getDemoStore();
    const id = newId("acc");
    const now = new Date().toISOString();
    store.accounts.push({
      id,
      supplierName: input.supplierName.trim(),
      upiId: input.upiId?.trim() || null,
      platform: FIXED_PLATFORM,
      loginIdentifier: input.loginIdentifier.trim(),
      linkedEmail: input.linkedEmail?.trim() || null,
      recoveryEmail: input.recoveryEmail?.trim() || null,
      profileAge: input.profileAge?.trim() || null,
      status: "pending",
      notes: input.notes?.trim() || null,
      createdBy: actorId,
      updatedBy: actorId,
      createdAt: now,
      updatedAt: now,
      secrets: {},
    });

    if (input.secrets) {
      for (const [type, value] of Object.entries(input.secrets)) {
        if (value) await setSecret(id, type as SecretType, value, actorId);
      }
    }

    await writeAuditLog({ actorId, actorEmail, action: "account.create", entityType: "account", entityId: id, outcome: "success", metadata: { supplierName: input.supplierName } });
    return (await getAccount(id))!;
  }

  // Service-role client: an anonymous submitter has no session for RLS to
  // scope an insert (or a follow-up read) to, so this whole write happens
  // server-side with its own validation instead of relying on a client role.
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("accounts")
    .insert({
      supplier_name: input.supplierName.trim(),
      upi_id: input.upiId?.trim() || null,
      platform: FIXED_PLATFORM,
      login_identifier: input.loginIdentifier.trim(),
      linked_email: input.linkedEmail?.trim() || null,
      recovery_email: input.recoveryEmail?.trim() || null,
      profile_age: input.profileAge?.trim() || null,
      notes: input.notes?.trim() || null,
      created_by: actorId,
      updated_by: actorId,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create account: ${error.message}`);

  const presentSecrets = new Set<SecretType>();
  if (input.secrets) {
    for (const [type, value] of Object.entries(input.secrets)) {
      if (value) {
        await setSecret(data.id, type as SecretType, value, actorId);
        presentSecrets.add(type as SecretType);
      }
    }
  }

  await writeAuditLog({ actorId, actorEmail, action: "account.create", entityType: "account", entityId: data.id, outcome: "success", metadata: { supplierName: input.supplierName } });

  // Built directly from the row we just inserted rather than re-fetched
  // through getAccount()/RLS — an anonymous caller wouldn't be able to read
  // it back that way, and the only thing the caller actually needs is the id.
  const secrets = {} as Account["secrets"];
  for (const type of SECRET_TYPES) {
    secrets[type] = { present: presentSecrets.has(type), updatedAt: presentSecrets.has(type) ? data.updated_at : null };
  }

  return {
    id: data.id,
    supplierName: data.supplier_name,
    upiId: data.upi_id,
    platform: data.platform,
    loginIdentifier: data.login_identifier,
    linkedEmail: data.linked_email,
    recoveryEmail: data.recovery_email,
    profileAge: data.profile_age,
    status: "pending", // every new account starts here — see the column default
    notes: data.notes,
    createdBy: data.created_by,
    createdByEmail: null,
    updatedBy: data.updated_by,
    updatedByEmail: null,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    secrets,
  };
}

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

export async function updateAccountStatus(
  id: string,
  status: AccountStatus,
  actorId: string,
  actorEmail: string,
  actorRole: "team" | "admin"
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Status changes are admin-only — mirrors the accounts_admin_update RLS
  // policy, which is the real enforcement boundary. Team members have no
  // remaining UI path that reaches this function (they can only submit new
  // accounts), but this check stays regardless of which caller reaches it.
  if (actorRole !== "admin") {
    await writeAuditLog({ actorId, actorEmail, action: "account.status_change", entityType: "account", entityId: id, outcome: "denied", metadata: { attemptedStatus: status } });
    return { ok: false, error: "Only an admin can change this status." };
  }

  if (isDemoMode) {
    const store = getDemoStore();
    const account = store.accounts.find((a) => a.id === id);
    if (!account) return { ok: false, error: "Account not found" };
    account.status = status;
    account.updatedBy = actorId;
    account.updatedAt = new Date().toISOString();
  } else {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("accounts").update({ status, updated_by: actorId }).eq("id", id);
    if (error) {
      await writeAuditLog({ actorId, actorEmail, action: "account.status_change", entityType: "account", entityId: id, outcome: "denied", metadata: { attemptedStatus: status, dbError: error.message } });
      return { ok: false, error: error.message };
    }
  }

  await writeAuditLog({ actorId, actorEmail, action: "account.status_change", entityType: "account", entityId: id, outcome: "success", metadata: { status } });
  return { ok: true };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  if (isDemoMode) {
    const store = getDemoStore();
    const counts = { pending: 0, needs_review: 0, active: 0, archived: 0 };
    for (const a of store.accounts) counts[a.status]++;
    return {
      totalAccounts: store.accounts.length,
      pending: counts.pending,
      needsReview: counts.needs_review,
      active: counts.active,
      archived: counts.archived,
    };
  }

  const supabase = await createSupabaseServerClient();
  const [{ count: total }, { count: pending }, { count: needsReview }, { count: active }, { count: archived }] =
    await Promise.all([
      supabase.from("accounts").select("id", { count: "exact", head: true }),
      supabase.from("accounts").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("accounts").select("id", { count: "exact", head: true }).eq("status", "needs_review"),
      supabase.from("accounts").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("accounts").select("id", { count: "exact", head: true }).eq("status", "archived"),
    ]);

  return {
    totalAccounts: total ?? 0,
    pending: pending ?? 0,
    needsReview: needsReview ?? 0,
    active: active ?? 0,
    archived: archived ?? 0,
  };
}

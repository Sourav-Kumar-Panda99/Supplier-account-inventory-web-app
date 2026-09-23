-- Row Level Security policies.
-- These are the real authorization boundary — application code must never be
-- the only thing standing between a user and another user's data.

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.account_secrets enable row level security;
alter table public.audit_log enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin on public.profiles
  for select
  using (id = auth.uid() or public.current_role_is_admin());

-- Nobody updates their own role from the client. Role changes go through
-- the service-role admin action only (see README "Role management").
drop policy if exists profiles_update_self_limited on public.profiles;
create policy profiles_update_self_limited on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles p where p.id = auth.uid()));

drop policy if exists profiles_admin_update_any on public.profiles;
create policy profiles_admin_update_any on public.profiles
  for update
  using (public.current_role_is_admin());

-- ---------------------------------------------------------------------------
-- accounts
-- Team members can only submit new accounts — no list/detail view, no edit,
-- no status changes. They may SELECT only the rows they created (so the
-- submit flow can confirm what it just inserted); everything else about the
-- inventory (browsing, editing, status changes, archiving) is admin-only.
-- ---------------------------------------------------------------------------
drop policy if exists accounts_select_authenticated on public.accounts;
drop policy if exists accounts_select_own_or_admin on public.accounts;
create policy accounts_select_own_or_admin on public.accounts
  for select
  to authenticated
  using (created_by = auth.uid() or public.current_role_is_admin());

drop policy if exists accounts_insert_authenticated on public.accounts;
create policy accounts_insert_authenticated on public.accounts
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists accounts_update_authenticated on public.accounts;
drop policy if exists accounts_admin_update on public.accounts;
create policy accounts_admin_update on public.accounts
  for update
  to authenticated
  using (public.current_role_is_admin())
  with check (updated_by = auth.uid());

drop policy if exists accounts_admin_delete on public.accounts;
create policy accounts_admin_delete on public.accounts
  for delete
  to authenticated
  using (public.current_role_is_admin());

-- Status changes (and every other field) can now only be written by an
-- admin — enforced above by accounts_admin_update — so the transition
-- trigger this project used to ship (letting a team member flag their own
-- record into needs_review) no longer applies. Drop it if it exists from an
-- earlier migration run.
drop trigger if exists accounts_enforce_status_transition on public.accounts;
drop function if exists public.enforce_account_status_transition();

-- ---------------------------------------------------------------------------
-- account_secrets — deny ALL direct client access. The only supported path
-- is the server's service-role client inside the reveal/set server actions,
-- which perform their own fresh role check before touching this table.
-- ---------------------------------------------------------------------------
drop policy if exists account_secrets_no_client_access on public.account_secrets;
-- No policy is created for authenticated/anon on purpose: with RLS enabled
-- and zero matching policies, all client-role access is denied by default.
-- Service-role connections bypass RLS entirely, which is how the server
-- reveal/set code paths reach this table.

-- ---------------------------------------------------------------------------
-- audit_log — admins can read; nothing but the server (service role) writes.
-- ---------------------------------------------------------------------------
drop policy if exists audit_log_admin_select on public.audit_log;
create policy audit_log_admin_select on public.audit_log
  for select
  to authenticated
  using (public.current_role_is_admin());

-- No insert/update/delete policy for authenticated/anon: writes only happen
-- via the service-role client from server code.

-- Suppliers, media buyers, assignment, and accept/reject review.
--
--   * Roles become supplier / media_buyer / admin ("team" is renamed to
--     "supplier"). Anyone who signs up is a supplier — the least privileged
--     role. Media buyers are created by an admin inside the app; admins are
--     still promoted by hand (see README).
--   * Every account can belong to a supplier (supplier_id) and can be
--     assigned to one media buyer (assigned_to).
--   * Statuses become pending / accepted / active / rejected / archived, with
--     an optional rejection note.
--
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists upi_id text;

alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'supplier' where role = 'team';
alter table public.profiles alter column role set default 'supplier';
alter table public.profiles
  add constraint profiles_role_check check (role in ('supplier', 'media_buyer', 'admin'));

comment on column public.profiles.upi_id is 'Supplier payout UPI ID. Only meaningful for role = supplier.';

-- New sign-ups are always suppliers. The role is never read from anything
-- the client can influence (raw_user_meta_data is user-editable, so only the
-- display name and UPI ID are taken from it).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, upi_id, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    nullif(new.raw_user_meta_data ->> 'upi_id', ''),
    'supplier'
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------
alter table public.accounts
  add column if not exists supplier_id uuid references public.profiles (id) on delete set null,
  add column if not exists assigned_to uuid references public.profiles (id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists assigned_by uuid references public.profiles (id) on delete set null,
  add column if not exists rejection_note text,
  add column if not exists status_changed_by uuid references public.profiles (id) on delete set null,
  add column if not exists status_changed_at timestamptz;

comment on column public.accounts.supplier_id is 'The supplier who submitted this account. Null for records created before supplier logins existed.';
comment on column public.accounts.assigned_to is 'The media buyer this account is assigned to, if any.';
comment on column public.accounts.rejection_note is 'Why the account was rejected. Cleared whenever the status moves away from rejected.';

alter table public.accounts drop constraint if exists accounts_status_check;
update public.accounts set status = 'pending' where status = 'needs_review';
alter table public.accounts
  add constraint accounts_status_check
  check (status in ('pending', 'accepted', 'active', 'rejected', 'archived'));

create index if not exists accounts_supplier_id_idx on public.accounts (supplier_id, created_at desc);
create index if not exists accounts_assigned_to_idx on public.accounts (assigned_to, assigned_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
-- No new client-facing policies are added on purpose. Suppliers and media
-- buyers never read or write public.accounts directly: every supplier and
-- media-buyer screen goes through server code that checks the caller's role
-- and then filters by supplier_id / assigned_to itself (the same "deny by
-- default, only the validated server function can reach it" pattern already
-- used for account_secrets and audit_log). So with RLS on:
--   * admin            -> select/update/delete via the existing admin policies
--   * supplier / buyer -> no direct access at all
--
-- Now that anyone can sign up as a supplier, "authenticated" is no longer a
-- trusted group, so the presence lookup is narrowed to admins only.
create or replace function public.account_secret_presence(p_account_ids uuid[])
returns table (account_id uuid, secret_type text, updated_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select s.account_id, s.secret_type, s.updated_at
  from public.account_secrets s
  where s.account_id = any (p_account_ids)
    and public.current_role_is_admin();
$$;

revoke all on function public.account_secret_presence(uuid[]) from public;
grant execute on function public.account_secret_presence(uuid[]) to authenticated;

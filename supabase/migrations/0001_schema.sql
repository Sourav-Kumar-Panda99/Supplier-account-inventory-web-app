-- Supplier Account Inventory — core schema
-- Run via `supabase db push` or the Supabase SQL editor, in order by filename.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Roles & profiles
-- ---------------------------------------------------------------------------
-- One row per auth.users row. Created by the handle_new_user trigger below.
-- role is the single source of truth for authorization — never trust a
-- client-supplied role value.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'team' check (role in ('team', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Application role per authenticated user. role is authoritative for RLS and server checks.';

-- Keep profiles.email in sync and default every new signup to the least
-- privileged role. Promote to admin manually (see README "Creating the
-- first admin").
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', 'team')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper used throughout RLS policies. security definer + fixed search_path
-- so it can read profiles regardless of the calling role's own RLS grants.
create or replace function public.current_role_is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Accounts — non-secret metadata only. Secrets live in account_secrets.
-- supplier_name/upi_id are plain free-text fields entered per account —
-- there is no separate managed supplier lookup table. platform is fixed to
-- 'Facebook' for now (see FIXED_PLATFORM in src/lib/types.ts); it stays a
-- plain column rather than a check constraint so a future platform can be
-- added without a migration.
-- ---------------------------------------------------------------------------
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  supplier_name text not null,
  upi_id text,
  platform text not null default 'Facebook',
  login_identifier text not null,
  linked_email text,
  recovery_email text,
  profile_age text,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'needs_review', 'archived')),
  notes text,
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists accounts_status_idx on public.accounts (status);
create index if not exists accounts_supplier_name_idx on public.accounts (supplier_name);

drop trigger if exists accounts_set_updated_at on public.accounts;
create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

comment on table public.accounts is 'Supplier account metadata. No secret values ever live in this table.';

-- ---------------------------------------------------------------------------
-- Account secrets — encrypted at the application layer before insert.
-- The API layer only ever writes/reads ciphertext here; plaintext never
-- reaches Postgres. RLS denies ALL direct client access (see 0002_rls.sql) —
-- this table is only reachable through the service-role reveal/set code path.
-- ---------------------------------------------------------------------------
create table if not exists public.account_secrets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  secret_type text not null check (secret_type in ('password', 'email_password')),
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  key_version int not null,
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, secret_type)
);

comment on table public.account_secrets is 'Ciphertext/IV/auth-tag/key-version only. Never store or log plaintext here.';

drop trigger if exists account_secrets_set_updated_at on public.account_secrets;
create trigger account_secrets_set_updated_at
  before update on public.account_secrets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Audit log — append-only. Never write secret values into metadata.
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  secret_type text,
  outcome text not null check (outcome in ('success', 'denied', 'error')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);
create index if not exists audit_log_entity_idx on public.audit_log (entity_type, entity_id);
create index if not exists audit_log_actor_idx on public.audit_log (actor_id);

comment on table public.audit_log is 'Append-only. metadata must never contain secret plaintext or ciphertext.';

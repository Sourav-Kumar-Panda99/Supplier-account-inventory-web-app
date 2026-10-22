-- Supplier payments, one row per supplier per calendar day.
--
-- The admin "Supplier payments" page lists, for every date, how many IDs each
-- supplier gave that day. When the admin pays a supplier for that day's IDs he
-- marks it paid, which writes a row here. Deleting the row ("Undo") marks the
-- day unpaid again.
--
--   day           — the calendar day in Asia/Kolkata the IDs were submitted
--                   (the same day the supplier dashboard and Excel export use).
--   account_count — how many IDs the supplier had given that day at the moment
--                   it was marked paid, so IDs submitted later the same day
--                   show up as "not paid yet".
--   amount        — optional, what was paid (INR).
--
-- Safe to run more than once.

create table if not exists public.supplier_payments (
  supplier_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  account_count integer not null default 0 check (account_count >= 0),
  amount numeric(12, 2) check (amount is null or amount >= 0),
  paid_at timestamptz not null default now(),
  paid_by uuid references public.profiles (id) on delete set null,
  primary key (supplier_id, day)
);

comment on table public.supplier_payments is 'Which supplier was paid for which day of submitted IDs. Admin-only.';

create index if not exists supplier_payments_day_idx on public.supplier_payments (day desc);

alter table public.supplier_payments enable row level security;

-- Admins only: read, mark paid (insert/update, always as themselves) and undo
-- (delete). Suppliers and media buyers have no access at all.
drop policy if exists supplier_payments_admin_select on public.supplier_payments;
create policy supplier_payments_admin_select on public.supplier_payments
  for select
  to authenticated
  using (public.current_role_is_admin());

drop policy if exists supplier_payments_admin_insert on public.supplier_payments;
create policy supplier_payments_admin_insert on public.supplier_payments
  for insert
  to authenticated
  with check (public.current_role_is_admin() and paid_by = auth.uid());

drop policy if exists supplier_payments_admin_update on public.supplier_payments;
create policy supplier_payments_admin_update on public.supplier_payments
  for update
  to authenticated
  using (public.current_role_is_admin())
  with check (public.current_role_is_admin() and paid_by = auth.uid());

drop policy if exists supplier_payments_admin_delete on public.supplier_payments;
create policy supplier_payments_admin_delete on public.supplier_payments
  for delete
  to authenticated
  using (public.current_role_is_admin());

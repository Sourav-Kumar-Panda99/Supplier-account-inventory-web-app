-- Pay suppliers for ACCEPTED IDs only, and remember which IDs were paid.
--
-- Until now "Mark paid" on the Supplier payments page covered every ID a
-- supplier gave that day. From now on it pays only that day's accepted IDs
-- (status accepted / active) that are not paid yet, and stamps each of them
-- with paid_at. supplier_payments keeps one row per supplier per day with the
-- total amount paid for that day.
--
-- Run this BEFORE deploying the app version that uses it. Safe to run more
-- than once.

alter table public.accounts
  add column if not exists paid_at timestamptz;

comment on column public.accounts.paid_at is
  'When the admin paid the supplier for this ID (accepted IDs only). Null = not paid.';

create index if not exists accounts_supplier_paid_idx
  on public.accounts (supplier_id, paid_at);

-- Days already marked paid under the old rule: their accepted IDs count as paid.
update public.accounts a
set paid_at = p.paid_at
from public.supplier_payments p
where a.supplier_id = p.supplier_id
  and a.source = 'supplier'
  and a.paid_at is null
  and a.status in ('accepted', 'active')
  and (a.created_at at time zone 'Asia/Kolkata')::date = p.day;

-- Keep each day's ID count in step with what it now covers.
update public.supplier_payments p
set account_count = (
  select count(*)
  from public.accounts a
  where a.supplier_id = p.supplier_id
    and a.source = 'supplier'
    and a.paid_at is not null
    and (a.created_at at time zone 'Asia/Kolkata')::date = p.day
);

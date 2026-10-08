-- Let a media buyer add IDs of his own (not from a supplier), tracked in the
-- same table. `source` separates those from supplier submissions.
--
--   source = 'supplier'    — submitted by a supplier (the default; every
--                            existing row keeps this).
--   source = 'media_buyer' — the assigned media buyer added it himself. Such a
--                            row has supplier_id NULL and assigned_to = that
--                            buyer.
--
-- Safe to run more than once.

alter table public.accounts
  add column if not exists source text not null default 'supplier';

alter table public.accounts drop constraint if exists accounts_source_check;
alter table public.accounts
  add constraint accounts_source_check check (source in ('supplier', 'media_buyer'));

-- Supports the admin report "how many IDs each media buyer added, by day".
create index if not exists accounts_source_assigned_idx
  on public.accounts (source, assigned_to, created_at desc);

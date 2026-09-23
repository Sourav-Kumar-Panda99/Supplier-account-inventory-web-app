-- Fictional seed data for local development only.
-- Every name, supplier, email, and UPI ID below is invented for this
-- template — none of it references any real company, person, or account.
--
-- This seed intentionally does NOT insert into account_secrets: secrets must
-- be created through the app's encrypt-on-write code path (see
-- src/lib/data/secrets.ts) so they exercise real AES-256-GCM, not a
-- hand-written placeholder. After creating your first admin (see README),
-- use "Submit account" / "Replace secret" in the UI to attach fictional
-- secret values to these seeded accounts.

insert into public.accounts
  (id, supplier_name, upi_id, platform, login_identifier, linked_email, recovery_email, profile_age, status, notes)
values
  ('a1111111-aaaa-1111-aaaa-111111111111', 'Northwind Trading Co.', 'northwind.fictional@fictionalbank',
   'Facebook', 'nw.orders.fictional@example.test', 'nw.linked.fictional@example.test',
   'nw.recovery.fictional@example.test', '8 months', 'active',
   'Fictional demo record — primary ordering account.'),

  ('a2222222-aaaa-2222-aaaa-222222222222', 'Northwind Trading Co.', 'northwind.fictional@fictionalbank',
   'Facebook', 'nw.returns.fictional@example.test', 'nw.linked2.fictional@example.test',
   null, '2 months', 'pending',
   'Fictional demo record — awaiting first review.'),

  ('a3333333-aaaa-3333-aaaa-333333333333', 'Blue Harbor Logistics', 'blueharbor.fictional@fictionalbank',
   'Facebook', 'bh.dispatch.fictional@example.test', 'bh.linked.fictional@example.test',
   'bh.recovery.fictional@example.test', '1 year 3 months', 'needs_review',
   'Fictional demo record — flagged for unusual login location.'),

  ('a4444444-aaaa-4444-aaaa-444444444444', 'Cascade Retail Partners', 'cascade.fictional@fictionalbank',
   'Facebook', 'cr.vendor.fictional@example.test', 'cr.linked.fictional@example.test',
   null, '5 months', 'archived',
   'Fictional demo record — supplier relationship ended.'),

  ('a5555555-aaaa-5555-aaaa-555555555555', 'Cascade Retail Partners', 'cascade.billing.fictional@fictionalbank',
   'Facebook', 'cr.billing.fictional@example.test', 'cr.linked2.fictional@example.test',
   'cr.recovery2.fictional@example.test', '3 weeks', 'pending',
   'Fictional demo record — new billing sub-account.')
on conflict (id) do nothing;

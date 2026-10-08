-- Allow storing an encrypted 2FA credential (backup code / authenticator key)
-- alongside the existing password secrets. Replaces the free-text "Internal
-- notes" field on the supplier form, so the value is encrypted at rest.
alter table public.account_secrets
  drop constraint if exists account_secrets_secret_type_check;

alter table public.account_secrets
  add constraint account_secrets_secret_type_check
  check (secret_type in ('password', 'email_password', 'two_factor'));

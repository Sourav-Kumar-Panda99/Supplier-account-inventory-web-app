-- Presence-only lookup for account secrets: tells the UI whether a secret
-- of a given type exists and when it was last set, WITHOUT ever exposing
-- ciphertext/iv/auth_tag. This is intentionally the one sanctioned way for
-- an ordinary authenticated client to learn anything about
-- account_secrets — everything else about that table stays behind the
-- service-role reveal/set code path.
create or replace function public.account_secret_presence(p_account_ids uuid[])
returns table (account_id uuid, secret_type text, updated_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select account_id, secret_type, updated_at
  from public.account_secrets
  where account_id = any (p_account_ids);
$$;

revoke all on function public.account_secret_presence(uuid[]) from public;
grant execute on function public.account_secret_presence(uuid[]) to authenticated;

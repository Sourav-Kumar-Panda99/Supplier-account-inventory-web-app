import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseServiceRoleKey, supabaseUrl } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Service-role client. This BYPASSES row level security entirely — it must
 * never be imported into any file that could end up in a client bundle, and
 * every call site must perform its own fresh authorization check (re-read
 * the caller's role from their session) before using it. It exists only for:
 *   - reading/writing public.account_secrets (RLS denies all client access)
 *   - writing public.audit_log rows
 *
 * Do not use this client as a shortcut around RLS for ordinary account or
 * supplier reads/writes — use the session-bound client in
 * lib/supabase/server.ts for those so RLS stays the enforced boundary.
 */
let cached: ReturnType<typeof createClient<Database>> | null = null;

export function createSupabaseAdminClient() {
  if (cached) return cached;
  cached = createClient<Database>(supabaseUrl!, supabaseServiceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}

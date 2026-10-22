import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

/**
 * RLS-enforced client bound to the current request's session cookies. Use
 * this for every read/write that should respect row level security — i.e.
 * almost everything. Only reach for the service-role admin client
 * (lib/supabase/admin.ts) for the narrow set of operations that must bypass
 * RLS (account_secrets, audit_log writes), and only after checking the
 * caller's role yourself first.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component render — the middleware is
          // responsible for refreshing the session in that case.
        }
      },
    },
  });
}

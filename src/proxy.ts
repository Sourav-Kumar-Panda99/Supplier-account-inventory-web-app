import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isDemoMode, supabaseAnonKey, supabaseUrl } from "@/lib/env";
import { DEMO_SESSION_COOKIE } from "@/lib/demo/constants";

/**
 * Refreshes the Supabase session cookie on every request (live mode) or
 * checks the demo session cookie (demo mode), and redirects unauthenticated
 * requests away from /admin/* to /login. Only /admin/* is gated here —
 * submitting a supplier account (/team/*) and everything else needs no
 * login by design. This is a convenience redirect for UX only — it is NOT
 * the authorization boundary. Every server action/route/RLS policy
 * re-checks the session and role itself; a bug here must never become a
 * privilege escalation.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (isDemoMode) {
    const hasDemoSession = request.cookies.has(DEMO_SESSION_COOKIE);
    if (!hasDemoSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("reason", "signin-required");
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("reason", "signin-required");
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

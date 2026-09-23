import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEMO_SESSION_COOKIE } from "@/lib/demo/constants";
import { getDemoStore } from "@/lib/demo/store";
import type { Profile } from "@/lib/types";

export type SessionUser = Profile;

/**
 * Resolves the current user's identity AND role by querying the database
 * fresh every call (or the demo store) — never from a JWT claim or any
 * value the client could have influenced. Every server action and route
 * handler that gates a sensitive operation must call this itself rather
 * than trusting a role passed in from the client or cached from an earlier
 * request.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  if (isDemoMode) {
    const cookieStore = await cookies();
    const id = cookieStore.get(DEMO_SESSION_COOKIE)?.value;
    if (!id) return null;
    const store = getDemoStore();
    const profile = store.profiles.find((p) => p.id === id);
    return profile ?? null;
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .eq("id", userData.user.id)
    .single();

  if (error || !profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role,
    createdAt: profile.created_at,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?reason=signin-required");
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") {
    redirect("/unauthorized");
  }
  return user;
}

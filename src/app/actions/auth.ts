"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEMO_SESSION_COOKIE } from "@/lib/demo/constants";
import { getDemoStore } from "@/lib/demo/store";
import type { ActionResult } from "@/lib/types";

export async function signInAction(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, error: "Email and password are required." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, error: "Invalid email or password." };
  }

  redirect("/");
}

/**
 * Demo-mode-only "sign in": picks one of the two seeded fictional users by
 * role and sets a plain (unsigned) cookie naming that user. This is
 * explicitly NOT a real authentication mechanism — it only exists so the
 * app is click-through-able without a Supabase project, and it only
 * activates when isDemoMode is true (checked server-side, not by the
 * client).
 */
export async function demoSignInAction(formData: FormData): Promise<ActionResult> {
  if (!isDemoMode) {
    return { ok: false, error: "Demo sign-in is disabled because live authentication is configured." };
  }

  const userId = String(formData.get("userId") ?? "");
  const store = getDemoStore();
  const profile = store.profiles.find((p) => p.id === userId);
  if (!profile) {
    return { ok: false, error: "Unknown demo user." };
  }

  const cookieStore = await cookies();
  cookieStore.set(DEMO_SESSION_COOKIE, profile.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  redirect("/");
}

export async function signOutAction(): Promise<void> {
  if (isDemoMode) {
    const cookieStore = await cookies();
    cookieStore.delete(DEMO_SESSION_COOKIE);
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

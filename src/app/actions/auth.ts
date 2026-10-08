"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEMO_SESSION_COOKIE } from "@/lib/demo/constants";
import { getDemoStore } from "@/lib/demo/store";
import { createUser } from "@/lib/data/profiles";
import { writeAuditLog } from "@/lib/data/audit";
import { isValidEmail, MIN_PASSWORD_LENGTH, optionalString, requiredString, ValidationError } from "@/lib/validation";
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

  // "/" sends each role to its own home (see src/app/page.tsx).
  redirect("/");
}

async function setDemoSession(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(DEMO_SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

/**
 * Supplier self-signup. Anyone can create a supplier account — it is the
 * least privileged role (submit IDs, see only your own). The role is fixed
 * here on the server; nothing in the form can ask for a different one.
 */
export async function signUpSupplierAction(formData: FormData): Promise<ActionResult> {
  let fullName: string;
  let email: string;
  let upiId: string;
  const password = String(formData.get("password") ?? "");

  try {
    fullName = requiredString(formData, "fullName", "Your name");
    upiId = optionalString(formData, "upiId");
    email = requiredString(formData, "email", "Email").toLowerCase();
    if (!isValidEmail(email)) throw new ValidationError("Enter a valid email address.");
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
  } catch (err) {
    return { ok: false, error: err instanceof ValidationError ? err.message : "Could not create the account." };
  }

  const created = await createUser({ email, password, fullName, upiId, role: "supplier" });
  if (!created.ok) return { ok: false, error: created.error };

  await writeAuditLog({
    actorId: created.id,
    actorEmail: email,
    action: "user.signup",
    entityType: "profile",
    entityId: isDemoMode ? null : created.id,
    outcome: "success",
    metadata: { role: "supplier" },
  });

  if (isDemoMode) {
    await setDemoSession(created.id);
    redirect("/supplier");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // The account exists; only the automatic sign-in failed.
    redirect("/login?reason=account-created");
  }

  redirect("/supplier");
}

/**
 * Demo-mode-only "sign in": picks one of the seeded fictional users and sets
 * a plain (unsigned) cookie naming that user. This is explicitly NOT a real
 * authentication mechanism — it only exists so the app is click-through-able
 * without a Supabase project, and it only activates when isDemoMode is true
 * (checked server-side, not by the client).
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

  await setDemoSession(profile.id);
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

import "server-only";
import { isDemoMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDemoStore, newId } from "@/lib/demo/store";
import type { Profile, Role } from "@/lib/types";

export interface NewUserInput {
  email: string;
  password: string;
  fullName: string;
  upiId?: string | null;
  /** Admins are never created from the app — see README "Creating the first admin". */
  role: Exclude<Role, "admin">;
}

export type CreateUserResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Creates a login plus its profile row. Used for supplier self-signup and for
 * an admin adding a media buyer. Callers decide who is allowed to call this
 * and with which role — the role is always passed by server code, never read
 * from a form field.
 *
 * The user is created through the service-role client with the email already
 * confirmed, so signing up does not depend on the Supabase project's email
 * settings and the person can sign in straight away.
 */
export async function createUser(input: NewUserInput): Promise<CreateUserResult> {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const upiId = input.upiId?.trim() || null;

  if (isDemoMode) {
    const store = getDemoStore();
    if (store.profiles.some((p) => p.email.toLowerCase() === email)) {
      return { ok: false, error: "An account with this email already exists." };
    }
    const id = newId(input.role === "supplier" ? "demo-supplier" : "demo-buyer");
    store.profiles.push({ id, email, fullName, role: input.role, upiId, createdAt: new Date().toISOString() });
    return { ok: true, id };
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: fullName, upi_id: upiId ?? "" },
  });

  if (error || !data.user) {
    const code = (error as { code?: string } | null)?.code;
    const message = error?.message ?? "";
    if (code === "email_exists" || /already/i.test(message)) {
      return { ok: false, error: "An account with this email already exists." };
    }
    if (code === "weak_password" || /password/i.test(message)) {
      return { ok: false, error: "That password is too weak. Use at least 8 characters." };
    }
    console.error("Failed to create user", message);
    return { ok: false, error: "Could not create the account. Please try again." };
  }

  // The handle_new_user trigger has already inserted a 'supplier' profile.
  // Write the intended values explicitly rather than relying on the trigger
  // having picked the name / UPI ID out of the metadata.
  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ id: data.user.id, email, full_name: fullName, upi_id: upiId, role: input.role }, { onConflict: "id" });

  if (profileError) {
    console.error("Failed to write profile for new user", profileError.message);
    // Don't leave a login behind that has the wrong role or no profile.
    await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false, error: "Could not create the account. Please try again." };
  }

  return { ok: true, id: data.user.id };
}

/**
 * Lists profiles, optionally by role. Admin-only: in live mode this runs on
 * the RLS-bound client, where only an admin can see other people's profiles.
 */
export async function listProfiles(role?: Role): Promise<Profile[]> {
  if (isDemoMode) {
    const store = getDemoStore();
    return store.profiles.filter((p) => !role || p.role === role).sort(byName);
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase.from("profiles").select("id, email, full_name, role, upi_id, created_at");
  if (role) query = query.eq("role", role);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list users: ${error.message}`);

  const profiles: Profile[] = (data ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    fullName: p.full_name,
    role: p.role,
    upiId: p.upi_id ?? null,
    createdAt: p.created_at,
  }));
  return profiles.sort(byName);
}

export function displayName(profile: Pick<Profile, "fullName" | "email">): string {
  return profile.fullName?.trim() || profile.email;
}

function byName(a: Profile, b: Profile): number {
  return displayName(a).localeCompare(displayName(b));
}

/** A supplier changing his own payout UPI ID. Only affects IDs he submits from now on. */
export async function updateOwnUpiId(userId: string, upiId: string | null): Promise<void> {
  if (isDemoMode) {
    const profile = getDemoStore().profiles.find((p) => p.id === userId);
    if (profile) profile.upiId = upiId;
    return;
  }

  // RLS-bound client: the profiles_update_self_limited policy lets a user
  // update his own row only, and never his role.
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("profiles").update({ upi_id: upiId }).eq("id", userId);
  if (error) throw new Error(`Failed to update UPI ID: ${error.message}`);
}

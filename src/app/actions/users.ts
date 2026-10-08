"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireRole } from "@/lib/auth";
import { isDemoMode } from "@/lib/env";
import { createUser, updateOwnUpiId } from "@/lib/data/profiles";
import { writeAuditLog } from "@/lib/data/audit";
import { isValidEmail, MIN_PASSWORD_LENGTH, optionalString, requiredString, ValidationError } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

/**
 * Admin adds a media buyer login. Media buyers can see the credentials of
 * every ID assigned to them, so they are never self-service: only an admin
 * creates one, and the role is fixed here rather than read from the form.
 */
export async function createMediaBuyerAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  let fullName: string;
  let email: string;
  const password = String(formData.get("password") ?? "");

  try {
    fullName = requiredString(formData, "fullName", "Name");
    email = requiredString(formData, "email", "Email").toLowerCase();
    if (!isValidEmail(email)) throw new ValidationError("Enter a valid email address.");
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
  } catch (err) {
    return { ok: false, error: err instanceof ValidationError ? err.message : "Could not add the media buyer." };
  }

  const created = await createUser({ email, password, fullName, role: "media_buyer" });
  if (!created.ok) return { ok: false, error: created.error };

  await writeAuditLog({
    actorId: admin.id,
    actorEmail: admin.email,
    action: "user.create",
    entityType: "profile",
    entityId: isDemoMode ? null : created.id,
    outcome: "success",
    metadata: { role: "media_buyer", email },
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/accounts");
  return { ok: true };
}

/** A supplier changes the UPI ID he gets paid on. Applies to IDs he submits from now on. */
export async function updateMyUpiAction(formData: FormData): Promise<ActionResult> {
  const user = await requireRole("supplier");
  const upiId = optionalString(formData, "upiId");

  if (upiId.length > 100) return { ok: false, error: "That UPI ID is too long." };

  await updateOwnUpiId(user.id, upiId || null);
  revalidatePath("/supplier");
  return { ok: true };
}

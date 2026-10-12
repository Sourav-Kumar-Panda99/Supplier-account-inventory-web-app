"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { listProfiles } from "@/lib/data/profiles";
import { markSupplierDayPaid, markSupplierDayUnpaid } from "@/lib/data/payments";
import { isDayKey } from "@/lib/day";
import { optionalString } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

/** Both arguments come from the browser: only a real supplier and a well-formed day get through. */
async function checkTarget(supplierId: unknown, day: unknown): Promise<string | null> {
  if (typeof supplierId !== "string" || !supplierId || typeof day !== "string" || !isDayKey(day)) {
    return "Unknown supplier or date.";
  }
  const suppliers = await listProfiles("supplier");
  if (!suppliers.some((s) => s.id === supplierId)) return "That supplier no longer exists.";
  return null;
}

/**
 * Admin marks every ID a supplier gave on one day as paid. The amount is
 * optional; the number of IDs is counted on the server, not taken from the form.
 */
export async function markSupplierDayPaidAction(supplierId: string, day: string, formData?: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const problem = await checkTarget(supplierId, day);
  if (problem) return { ok: false, error: problem };

  const raw = formData instanceof FormData ? optionalString(formData, "amount").replace(/[₹,\s]/g, "") : "";
  let amount: number | null = null;
  if (raw) {
    if (!/^\d{1,9}(\.\d{1,2})?$/.test(raw)) return { ok: false, error: "Enter the amount as a number, e.g. 1500." };
    amount = Number(raw);
  }

  const result = await markSupplierDayPaid(supplierId, day, amount, admin);
  revalidatePath("/admin/payments");
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/** Admin undoes a payment mark — the day shows as not paid again. */
export async function markSupplierDayUnpaidAction(supplierId: string, day: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const problem = await checkTarget(supplierId, day);
  if (problem) return { ok: false, error: problem };

  const result = await markSupplierDayUnpaid(supplierId, day, admin);
  revalidatePath("/admin/payments");
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

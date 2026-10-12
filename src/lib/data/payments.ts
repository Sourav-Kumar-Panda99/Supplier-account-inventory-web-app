import "server-only";
import { isDemoMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDemoStore } from "@/lib/demo/store";
import { writeAuditLog } from "@/lib/data/audit";
import { dayKey, dayRangeUtc } from "@/lib/day";
import { supplierBucket } from "@/lib/types";
import type { SessionUser } from "@/lib/auth";
import { monthOf } from "@/lib/day";
import type { AccountStatus, MonthSpending, SupplierDayRow } from "@/lib/types";

/**
 * Admin-only: how many IDs each supplier gave on each day, and whether that
 * day has been paid. Every function here assumes the caller already checked
 * the admin role (the actions and the page do). In live mode everything runs
 * on the RLS-bound client, where only an admin can read accounts or touch
 * supplier_payments (see supabase/migrations/0007_supplier_payments.sql).
 */

type MutationResult = { ok: true } | { ok: false; error: string };

const FETCH_PAGE_SIZE = 1000;
const FETCH_MAX_ROWS = 200_000;

interface SourceAccount {
  supplierId: string;
  supplierName: string;
  upiId: string | null;
  status: AccountStatus;
  createdAt: string;
}

interface PaymentRecord {
  supplierId: string;
  day: string;
  accountCount: number;
  amount: number | null;
  paidAt: string;
  paidBy: string | null;
}

interface Person {
  name: string;
  upiId: string | null;
}

/** Newest day first, then supplier name. Days with no IDs are not listed. */
export async function getSupplierDayReport(): Promise<SupplierDayRow[]> {
  const { accounts, payments, people } = await loadReportData();

  const rows = new Map<string, SupplierDayRow>(); // key: `${supplierId}|${day}`
  const key = (supplierId: string, day: string) => `${supplierId}|${day}`;

  for (const a of accounts) {
    const day = dayKey(a.createdAt);
    const k = key(a.supplierId, day);
    let row = rows.get(k);
    if (!row) {
      const person = people.get(a.supplierId);
      row = {
        day,
        supplierId: a.supplierId,
        supplierName: person?.name ?? a.supplierName,
        // Pay to the UPI ID the supplier has saved now; fall back to the one on his IDs.
        upiId: person?.upiId ?? a.upiId,
        given: 0,
        pending: 0,
        accepted: 0,
        rejected: 0,
        payment: null,
      };
      rows.set(k, row);
    }
    row.given++;
    row[supplierBucket(a.status)]++;
  }

  for (const p of payments) {
    let row = rows.get(key(p.supplierId, p.day));
    if (!row) {
      // Every ID of that day was deleted after it was paid. Keep the row so the
      // money still counts in the monthly spending.
      const person = people.get(p.supplierId);
      row = {
        day: p.day,
        supplierId: p.supplierId,
        supplierName: person?.name ?? "Former supplier",
        upiId: person?.upiId ?? null,
        given: 0,
        pending: 0,
        accepted: 0,
        rejected: 0,
        payment: null,
      };
      rows.set(key(p.supplierId, p.day), row);
    }
    row.payment = {
      accountCount: p.accountCount,
      amount: p.amount,
      paidAt: p.paidAt,
      paidByName: p.paidBy ? people.get(p.paidBy)?.name ?? null : null,
    };
  }

  return [...rows.values()].sort((a, b) =>
    a.day !== b.day ? (a.day < b.day ? 1 : -1) : a.supplierName.localeCompare(b.supplierName)
  );
}

/** IDs given that day which no payment covers yet (all of them if the day isn't paid). */
export function unpaidIdCount(row: SupplierDayRow): number {
  return Math.max(0, row.given - (row.payment?.accountCount ?? 0));
}

export function isDayPaid(row: SupplierDayRow): boolean {
  return !!row.payment && unpaidIdCount(row) === 0;
}

/**
 * Totals per month, newest first, from the rows of getSupplierDayReport().
 * A payment counts in the month of the day whose IDs it paid for (not the
 * date the money was sent), so a month's IDs and their cost line up.
 */
export function summarizeByMonth(rows: SupplierDayRow[]): MonthSpending[] {
  const months = new Map<string, MonthSpending>();
  for (const r of rows) {
    const month = monthOf(r.day);
    let m = months.get(month);
    if (!m) {
      m = { month, given: 0, accepted: 0, paidIds: 0, spent: 0, unpaidIds: 0, paidDaysWithoutAmount: 0 };
      months.set(month, m);
    }
    m.given += r.given;
    m.accepted += r.accepted;
    m.unpaidIds += unpaidIdCount(r);
    if (r.payment) {
      m.paidIds += r.payment.accountCount;
      if (r.payment.amount === null) m.paidDaysWithoutAmount++;
      else m.spent += r.payment.amount;
    }
  }
  for (const m of months.values()) m.spent = Math.round(m.spent * 100) / 100;
  return [...months.values()].sort((a, b) => (a.month < b.month ? 1 : -1));
}

async function loadReportData(): Promise<{ accounts: SourceAccount[]; payments: PaymentRecord[]; people: Map<string, Person> }> {
  if (isDemoMode) {
    const store = getDemoStore();
    const people = new Map<string, Person>();
    for (const p of store.profiles) people.set(p.id, { name: p.fullName || p.email, upiId: p.upiId });
    return {
      accounts: store.accounts
        .filter((a) => a.source === "supplier" && a.supplierId)
        .map((a) => ({ supplierId: a.supplierId!, supplierName: a.supplierName, upiId: a.upiId, status: a.status, createdAt: a.createdAt })),
      payments: store.supplierPayments.map((p) => ({ ...p })),
      people,
    };
  }

  const supabase = await createSupabaseServerClient();

  const accounts: SourceAccount[] = [];
  while (accounts.length < FETCH_MAX_ROWS) {
    const { data, error } = await supabase
      .from("accounts")
      .select("supplier_id, supplier_name, upi_id, status, created_at")
      .eq("source", "supplier")
      .not("supplier_id", "is", null)
      .order("id", { ascending: true })
      .range(accounts.length, accounts.length + FETCH_PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to load supplier IDs: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data as { supplier_id: string; supplier_name: string; upi_id: string | null; status: string; created_at: string }[]) {
      accounts.push({ supplierId: r.supplier_id, supplierName: r.supplier_name, upiId: r.upi_id, status: r.status as AccountStatus, createdAt: r.created_at });
    }
    if (data.length < FETCH_PAGE_SIZE) break;
  }

  const payments: PaymentRecord[] = [];
  while (payments.length < FETCH_MAX_ROWS) {
    const { data, error } = await supabase
      .from("supplier_payments")
      .select("supplier_id, day, account_count, amount, paid_at, paid_by")
      .order("day", { ascending: false })
      .order("supplier_id", { ascending: true })
      .range(payments.length, payments.length + FETCH_PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to load supplier payments: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data as { supplier_id: string; day: string; account_count: number; amount: number | string | null; paid_at: string; paid_by: string | null }[]) {
      payments.push({
        supplierId: r.supplier_id,
        day: r.day,
        accountCount: r.account_count,
        // numeric comes back from PostgREST as a number or a string depending on size
        amount: r.amount === null ? null : Number(r.amount),
        paidAt: r.paid_at,
        paidBy: r.paid_by,
      });
    }
    if (data.length < FETCH_PAGE_SIZE) break;
  }

  const ids = new Set<string>();
  accounts.forEach((a) => ids.add(a.supplierId));
  payments.forEach((p) => {
    ids.add(p.supplierId);
    if (p.paidBy) ids.add(p.paidBy);
  });

  const people = new Map<string, Person>();
  const idList = [...ids];
  for (let i = 0; i < idList.length; i += 200) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, upi_id")
      .in("id", idList.slice(i, i + 200));
    if (error) throw new Error(`Failed to load supplier names: ${error.message}`);
    for (const p of (data ?? []) as { id: string; email: string; full_name: string | null; upi_id: string | null }[]) {
      people.set(p.id, { name: p.full_name || p.email, upiId: p.upi_id });
    }
  }

  return { accounts, payments, people };
}

/** How many IDs this supplier gave on this day, counted now on the server. */
async function countGiven(supplierId: string, day: string): Promise<number> {
  if (isDemoMode) {
    return getDemoStore().accounts.filter(
      (a) => a.source === "supplier" && a.supplierId === supplierId && dayKey(a.createdAt) === day
    ).length;
  }

  const { startISO, endISO } = dayRangeUtc(day);
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("accounts")
    .select("id", { count: "exact", head: true })
    .eq("source", "supplier")
    .eq("supplier_id", supplierId)
    .gte("created_at", startISO)
    .lt("created_at", endISO);
  if (error) throw new Error(`Failed to count IDs: ${error.message}`);
  return count ?? 0;
}

/**
 * Marks every ID a supplier gave on `day` as paid. Marking a day that is
 * already paid again (e.g. after more IDs came in) replaces the record with
 * the new count and amount.
 */
export async function markSupplierDayPaid(
  supplierId: string,
  day: string,
  amount: number | null,
  actor: SessionUser
): Promise<MutationResult> {
  const accountCount = await countGiven(supplierId, day);
  if (accountCount === 0) return { ok: false, error: "This supplier gave no IDs on that day." };

  const paidAt = new Date().toISOString();

  if (isDemoMode) {
    const store = getDemoStore();
    store.supplierPayments = store.supplierPayments.filter((p) => !(p.supplierId === supplierId && p.day === day));
    store.supplierPayments.push({ supplierId, day, accountCount, amount, paidAt, paidBy: actor.id });
  } else {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("supplier_payments")
      .upsert(
        { supplier_id: supplierId, day, account_count: accountCount, amount, paid_at: paidAt, paid_by: actor.id },
        { onConflict: "supplier_id,day" }
      );
    if (error) {
      await writeAuditLog({ actorId: actor.id, actorEmail: actor.email, action: "supplier.payment", entityType: "profile", entityId: supplierId, outcome: "error", metadata: { day, dbError: error.message } });
      return { ok: false, error: "Could not save the payment. Please try again." };
    }
  }

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "supplier.payment",
    entityType: "profile",
    entityId: isDemoMode ? null : supplierId,
    outcome: "success",
    metadata: { supplierId, day, accountCount, amount },
  });
  return { ok: true };
}

/** Undo: the day shows as not paid again. */
export async function markSupplierDayUnpaid(supplierId: string, day: string, actor: SessionUser): Promise<MutationResult> {
  if (isDemoMode) {
    const store = getDemoStore();
    store.supplierPayments = store.supplierPayments.filter((p) => !(p.supplierId === supplierId && p.day === day));
  } else {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("supplier_payments").delete().eq("supplier_id", supplierId).eq("day", day);
    if (error) {
      await writeAuditLog({ actorId: actor.id, actorEmail: actor.email, action: "supplier.payment_undo", entityType: "profile", entityId: supplierId, outcome: "error", metadata: { day, dbError: error.message } });
      return { ok: false, error: "Could not undo the payment. Please try again." };
    }
  }

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "supplier.payment_undo",
    entityType: "profile",
    entityId: isDemoMode ? null : supplierId,
    outcome: "success",
    metadata: { supplierId, day },
  });
  return { ok: true };
}

import "server-only";
import { isDemoMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDemoStore } from "@/lib/demo/store";
import { writeAuditLog } from "@/lib/data/audit";
import { dayKey, dayRangeUtc, monthOf } from "@/lib/day";
import { supplierBucket } from "@/lib/types";
import type { SessionUser } from "@/lib/auth";
import type { AccountStatus, MonthSpending, SupplierDayRow } from "@/lib/types";

/**
 * Admin-only: how many IDs each supplier gave on each day, and what has been
 * paid. Every function here assumes the caller already checked the admin role
 * (the actions and the page do). In live mode everything runs on the
 * RLS-bound client, where only an admin can read or update accounts or touch
 * supplier_payments.
 *
 * Only ACCEPTED IDs are paid for. Each paid ID carries its own `paid_at`
 * (migration 0008); `supplier_payments` keeps one row per supplier per day
 * with the total amount paid for that day.
 */

type MutationResult = { ok: true } | { ok: false; error: string };

const FETCH_PAGE_SIZE = 1000;
const FETCH_MAX_ROWS = 200_000;

/** Statuses that count as accepted, and so can be paid for. */
const PAYABLE_STATUSES: AccountStatus[] = ["accepted", "active"];

function isPayable(status: AccountStatus): boolean {
  return PAYABLE_STATUSES.includes(status);
}

interface SourceAccount {
  supplierId: string;
  supplierName: string;
  upiId: string | null;
  status: AccountStatus;
  createdAt: string;
  paidAt: string | null;
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

function emptyRow(day: string, supplierId: string, supplierName: string, upiId: string | null): SupplierDayRow {
  return { day, supplierId, supplierName, upiId, given: 0, pending: 0, accepted: 0, rejected: 0, paidIds: 0, acceptedUnpaid: 0, payment: null };
}

/** Newest day first, then supplier name. */
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
      // Pay to the UPI ID the supplier has saved now; fall back to the one on his IDs.
      row = emptyRow(day, a.supplierId, person?.name ?? a.supplierName, person?.upiId ?? a.upiId);
      rows.set(k, row);
    }
    row.given++;
    row[supplierBucket(a.status)]++;
    if (a.paidAt) row.paidIds++;
    else if (isPayable(a.status)) row.acceptedUnpaid++;
  }

  for (const p of payments) {
    let row = rows.get(key(p.supplierId, p.day));
    if (!row) {
      // Every ID of that day was deleted after it was paid. Keep the row so the
      // money still counts in the monthly spending.
      const person = people.get(p.supplierId);
      row = emptyRow(p.day, p.supplierId, person?.name ?? "Former supplier", person?.upiId ?? null);
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

/** Accepted IDs of that day that still need paying. */
export function unpaidIdCount(row: SupplierDayRow): number {
  return row.acceptedUnpaid;
}

/** Something was paid and every accepted ID of the day is paid. */
export function isDayPaid(row: SupplierDayRow): boolean {
  return (row.paidIds > 0 || !!row.payment) && row.acceptedUnpaid === 0;
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
      m = { month, given: 0, pending: 0, accepted: 0, rejected: 0, paidIds: 0, spent: 0, unpaidIds: 0, paidDaysWithoutAmount: 0 };
      months.set(month, m);
    }
    m.given += r.given;
    m.pending += r.pending;
    m.accepted += r.accepted;
    m.rejected += r.rejected;
    m.paidIds += r.paidIds;
    m.unpaidIds += r.acceptedUnpaid;
    if (r.payment) {
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
        .map((a) => ({
          supplierId: a.supplierId!,
          supplierName: a.supplierName,
          upiId: a.upiId,
          status: a.status,
          createdAt: a.createdAt,
          paidAt: a.paidAt,
        })),
      payments: store.supplierPayments.map((p) => ({ ...p })),
      people,
    };
  }

  const supabase = await createSupabaseServerClient();

  const accounts: SourceAccount[] = [];
  while (accounts.length < FETCH_MAX_ROWS) {
    const { data, error } = await supabase
      .from("accounts")
      .select("supplier_id, supplier_name, upi_id, status, created_at, paid_at")
      .eq("source", "supplier")
      .not("supplier_id", "is", null)
      .order("id", { ascending: true })
      .range(accounts.length, accounts.length + FETCH_PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to load supplier IDs: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data as { supplier_id: string; supplier_name: string; upi_id: string | null; status: string; created_at: string; paid_at: string | null }[]) {
      accounts.push({
        supplierId: r.supplier_id,
        supplierName: r.supplier_name,
        upiId: r.upi_id,
        status: r.status as AccountStatus,
        createdAt: r.created_at,
        paidAt: r.paid_at,
      });
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

/** The supplier's existing payment record for that day, if any. */
async function loadPayment(supplierId: string, day: string): Promise<{ accountCount: number; amount: number | null } | null> {
  if (isDemoMode) {
    const p = getDemoStore().supplierPayments.find((x) => x.supplierId === supplierId && x.day === day);
    return p ? { accountCount: p.accountCount, amount: p.amount } : null;
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("supplier_payments")
    .select("account_count, amount")
    .eq("supplier_id", supplierId)
    .eq("day", day)
    .maybeSingle();
  if (error) throw new Error(`Failed to load the payment: ${error.message}`);
  if (!data) return null;
  const row = data as { account_count: number; amount: number | string | null };
  return { accountCount: row.account_count, amount: row.amount === null ? null : Number(row.amount) };
}

/**
 * Pays a supplier for his accepted IDs of `day` that are not paid yet: each
 * of them gets a paid date, and `amount` is added to what that day has been
 * paid so far. Pending and rejected IDs are never paid. If more of that day's
 * IDs are accepted later, marking the day paid again pays for just those.
 */
export async function markSupplierDayPaid(
  supplierId: string,
  day: string,
  amount: number,
  actor: SessionUser
): Promise<MutationResult> {
  const paidAt = new Date().toISOString();
  let newlyPaid: number;

  if (isDemoMode) {
    const toPay = getDemoStore().accounts.filter(
      (a) => a.source === "supplier" && a.supplierId === supplierId && dayKey(a.createdAt) === day && !a.paidAt && isPayable(a.status)
    );
    if (toPay.length === 0) return { ok: false, error: "There are no accepted IDs left to pay for on that day." };
    toPay.forEach((a) => (a.paidAt = paidAt));
    newlyPaid = toPay.length;
  } else {
    const { startISO, endISO } = dayRangeUtc(day);
    const supabase = await createSupabaseServerClient();
    // updated_by is required by the accounts_admin_update RLS policy.
    const { data, error } = await supabase
      .from("accounts")
      .update({ paid_at: paidAt, updated_by: actor.id })
      .eq("source", "supplier")
      .eq("supplier_id", supplierId)
      .in("status", PAYABLE_STATUSES)
      .is("paid_at", null)
      .gte("created_at", startISO)
      .lt("created_at", endISO)
      .select("id");
    if (error) {
      await writeAuditLog({ actorId: actor.id, actorEmail: actor.email, action: "supplier.payment", entityType: "profile", entityId: supplierId, outcome: "error", metadata: { day, dbError: error.message } });
      return { ok: false, error: "Could not save the payment. Please try again." };
    }
    newlyPaid = (data ?? []).length;
    if (newlyPaid === 0) return { ok: false, error: "There are no accepted IDs left to pay for on that day." };
  }

  const previous = await loadPayment(supplierId, day);
  const accountCount = (previous?.accountCount ?? 0) + newlyPaid;
  const total = Math.round(((previous?.amount ?? 0) + amount) * 100) / 100;

  if (isDemoMode) {
    const store = getDemoStore();
    store.supplierPayments = store.supplierPayments.filter((p) => !(p.supplierId === supplierId && p.day === day));
    store.supplierPayments.push({ supplierId, day, accountCount, amount: total, paidAt, paidBy: actor.id });
  } else {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("supplier_payments")
      .upsert(
        { supplier_id: supplierId, day, account_count: accountCount, amount: total, paid_at: paidAt, paid_by: actor.id },
        { onConflict: "supplier_id,day" }
      );
    if (error) {
      await writeAuditLog({ actorId: actor.id, actorEmail: actor.email, action: "supplier.payment", entityType: "profile", entityId: supplierId, outcome: "error", metadata: { day, newlyPaid, dbError: error.message } });
      return { ok: false, error: "The IDs were marked paid, but the amount could not be saved. Please Undo and try again." };
    }
  }

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "supplier.payment",
    entityType: "profile",
    entityId: isDemoMode ? null : supplierId,
    outcome: "success",
    metadata: { supplierId, day, newlyPaid, amount, dayTotal: total },
  });
  return { ok: true };
}

/** Undo: every ID of that day goes back to not paid, and the day's amount is removed. */
export async function markSupplierDayUnpaid(supplierId: string, day: string, actor: SessionUser): Promise<MutationResult> {
  if (isDemoMode) {
    const store = getDemoStore();
    for (const a of store.accounts) {
      if (a.source === "supplier" && a.supplierId === supplierId && dayKey(a.createdAt) === day) a.paidAt = null;
    }
    store.supplierPayments = store.supplierPayments.filter((p) => !(p.supplierId === supplierId && p.day === day));
  } else {
    const { startISO, endISO } = dayRangeUtc(day);
    const supabase = await createSupabaseServerClient();
    const cleared = await supabase
      .from("accounts")
      .update({ paid_at: null, updated_by: actor.id })
      .eq("source", "supplier")
      .eq("supplier_id", supplierId)
      .not("paid_at", "is", null)
      .gte("created_at", startISO)
      .lt("created_at", endISO);
    const removed = cleared.error
      ? cleared
      : await supabase.from("supplier_payments").delete().eq("supplier_id", supplierId).eq("day", day);
    if (removed.error) {
      await writeAuditLog({ actorId: actor.id, actorEmail: actor.email, action: "supplier.payment_undo", entityType: "profile", entityId: supplierId, outcome: "error", metadata: { day, dbError: removed.error.message } });
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

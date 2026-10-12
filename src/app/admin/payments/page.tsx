import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarDays, CheckCircle2, Clock, Database, Undo2, Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getSupplierDayReport } from "@/lib/data/payments";
import { markSupplierDayPaidAction, markSupplierDayUnpaidAction } from "@/app/actions/payments";
import { StatTiles } from "@/components/StatTiles";
import { FilterChip } from "@/components/FilterChip";
import { Pagination } from "@/components/Pagination";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { CountRow } from "@/components/CountRow";
import { formatDayKey, todayKey } from "@/lib/day";
import { formatDate, formatTime } from "@/lib/formatDate";
import type { SupplierDayRow } from "@/lib/types";

const DAYS_PER_PAGE = 10;
const cardStyle = { borderColor: "var(--border)", background: "var(--surface)" };

type Show = "unpaid" | "paid";

interface PaymentsSearchParams {
  show?: string;
  supplier?: string;
  page?: string;
}

const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** IDs given that day which no payment covers yet (all of them if the day isn't paid). */
function unpaidCount(row: SupplierDayRow): number {
  return Math.max(0, row.given - (row.payment?.accountCount ?? 0));
}

function isPaid(row: SupplierDayRow): boolean {
  return !!row.payment && unpaidCount(row) === 0;
}

function hrefWith(current: PaymentsSearchParams, changes: Partial<PaymentsSearchParams>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, page: undefined, ...changes })) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/admin/payments?${query}` : "/admin/payments";
}

export default async function SupplierPaymentsPage({ searchParams }: { searchParams: Promise<PaymentsSearchParams> }) {
  // Checked here as well as in the layout: a layout is not re-run on every
  // navigation, so each admin page protects its own data.
  await requireAdmin();
  const params = await searchParams;
  const all = await getSupplierDayReport();
  const today = todayKey();

  const suppliers = new Map<string, string>();
  for (const r of all) if (!suppliers.has(r.supplierId)) suppliers.set(r.supplierId, r.supplierName);
  const supplierOptions = [...suppliers.entries()].sort((a, b) => a[1].localeCompare(b[1]));

  const show: Show | undefined = params.show === "unpaid" || params.show === "paid" ? params.show : undefined;
  const supplier = params.supplier && suppliers.has(params.supplier) ? params.supplier : undefined;
  const current: PaymentsSearchParams = { show, supplier };

  // Tiles count across every supplier (or the one picked), whatever the paid/unpaid filter.
  const scope = supplier ? all.filter((r) => r.supplierId === supplier) : all;
  const givenToday = scope.filter((r) => r.day === today).reduce((n, r) => n + r.given, 0);
  const unpaidRows = scope.filter((r) => !isPaid(r));
  const unpaidIds = unpaidRows.reduce((n, r) => n + unpaidCount(r), 0);
  const paidRows = scope.length - unpaidRows.length;

  const rows = scope.filter((r) => (show === "paid" ? isPaid(r) : show === "unpaid" ? !isPaid(r) : true));

  // Group by date (rows are already newest day first) and page by date.
  const days: { day: string; rows: SupplierDayRow[] }[] = [];
  for (const r of rows) {
    const last = days[days.length - 1];
    if (last && last.day === r.day) last.rows.push(r);
    else days.push({ day: r.day, rows: [r] });
  }
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const pageDays = days.slice((page - 1) * DAYS_PER_PAGE, page * DAYS_PER_PAGE);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
          Supplier payments
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          On which date each supplier gave how many IDs, and whether you have paid him for that day.
        </p>
      </div>

      <StatTiles
        tiles={[
          { label: "IDs given today", value: givenToday, icon: <Database size={18} strokeWidth={2} /> },
          { label: "Days not paid", value: unpaidRows.length, href: hrefWith(current, { show: "unpaid" }), icon: <Clock size={18} strokeWidth={2} />, tone: "var(--warning)", toneBg: "var(--warning-bg)" },
          { label: "IDs not paid for", value: unpaidIds, href: hrefWith(current, { show: "unpaid" }), icon: <Wallet size={18} strokeWidth={2} />, tone: "var(--warning)", toneBg: "var(--warning-bg)" },
          { label: "Days paid", value: paidRows, href: hrefWith(current, { show: "paid" }), icon: <CheckCircle2 size={18} strokeWidth={2} />, tone: "var(--success)", toneBg: "var(--success-bg)" },
        ]}
      />

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by payment">
            <FilterChip href={hrefWith(current, { show: undefined })} active={!show}>All days</FilterChip>
            <FilterChip href={hrefWith(current, { show: "unpaid" })} active={show === "unpaid"}>Not paid</FilterChip>
            <FilterChip href={hrefWith(current, { show: "paid" })} active={show === "paid"}>Paid</FilterChip>
          </div>

          {supplierOptions.length > 1 ? (
            <form method="get" className="flex flex-wrap items-end gap-2" aria-label="Filter by supplier">
              {show ? <input type="hidden" name="show" value={show} /> : null}
              <div className="flex flex-col gap-1">
                <label htmlFor="supplier" className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                  Supplier
                </label>
                <select
                  id="supplier"
                  name="supplier"
                  defaultValue={supplier ?? ""}
                  className="h-10 min-w-[200px] rounded-lg border px-3 text-sm"
                  style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
                >
                  <option value="">All suppliers</option>
                  {supplierOptions.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="h-10 rounded-lg border px-4 text-sm font-medium hover:bg-[var(--surface-muted)]"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                Apply
              </button>
            </form>
          ) : null}
        </div>

        {pageDays.length === 0 ? (
          <p className="card rounded-xl border p-10 text-center text-sm" style={{ ...cardStyle, color: "var(--muted)" }}>
            {all.length === 0
              ? "No supplier has given an ID yet."
              : show === "unpaid"
                ? "Nothing to pay — every day is paid."
                : "No days match this filter."}
          </p>
        ) : (
          pageDays.map(({ day, rows: dayRows }) => {
            const total = dayRows.reduce((n, r) => n + r.given, 0);
            const paid = dayRows.filter(isPaid).length;
            return (
              <section key={day} className="card overflow-hidden rounded-xl border" style={cardStyle} aria-labelledby={`day-${day}`}>
                <header
                  className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3"
                  style={{ borderColor: "var(--border)", background: "var(--surface-muted)" }}
                >
                  <h2 id={`day-${day}`} className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                    <CalendarDays size={16} style={{ color: "var(--primary)" }} aria-hidden />
                    {formatDayKey(day)}
                    {day === today ? (
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
                        Today
                      </span>
                    ) : null}
                  </h2>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    {total} ID{total === 1 ? "" : "s"} from {dayRows.length} supplier{dayRows.length === 1 ? "" : "s"} · {paid} of {dayRows.length} paid
                  </p>
                </header>

                <ul>
                  {dayRows.map((row) => (
                    <li
                      key={row.supplierId}
                      className="flex flex-col gap-3 border-b p-4 last:border-0 lg:flex-row lg:items-center lg:gap-6"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <div className="min-w-0 lg:w-56 lg:shrink-0">
                        <p className="font-medium" style={{ color: "var(--foreground)" }}>
                          {row.supplierName}
                        </p>
                        <p className="font-mono text-xs break-all" style={{ color: "var(--muted)" }}>
                          UPI: {row.upiId ?? "not set"}
                        </p>
                        <Link
                          href={`/admin/accounts?${new URLSearchParams({ day: row.day, supplier: row.supplierId }).toString()}`}
                          className="mt-1 inline-block text-xs font-medium hover:opacity-70"
                          style={{ color: "var(--primary)" }}
                        >
                          View IDs<span className="sr-only"> from {row.supplierName} on {formatDayKey(row.day)}</span>
                        </Link>
                      </div>

                      <div className="lg:w-80 lg:shrink-0">
                        <CountRow
                          items={[
                            { label: "Given", value: row.given },
                            { label: "Accepted", value: row.accepted, tone: "var(--success)" },
                            { label: "Rejected", value: row.rejected, tone: "var(--danger)" },
                            { label: "Pending", value: row.pending, tone: "var(--warning)" },
                          ]}
                        />
                      </div>

                      <div className="min-w-0 lg:flex-1">
                        <PaymentControl row={row} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}

        <Pagination page={page} pageSize={DAYS_PER_PAGE} total={days.length} searchParams={{ show, supplier }} />
      </section>
    </div>
  );
}

function Badge({ tone, toneBg, children }: { tone: string; toneBg: string; children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"
      style={{ background: toneBg, color: tone }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: tone }} aria-hidden />
      {children}
    </span>
  );
}

/** Paid / not paid for one supplier-day, with the button that changes it. */
function PaymentControl({ row }: { row: SupplierDayRow }) {
  const pay = markSupplierDayPaidAction.bind(null, row.supplierId, row.day);
  const undo = markSupplierDayUnpaidAction.bind(null, row.supplierId, row.day);
  const p = row.payment;
  const missing = unpaidCount(row);
  const paidLine = p
    ? `${p.amount !== null ? `${rupees.format(p.amount)} · ` : ""}${formatDate(p.paidAt)}, ${formatTime(p.paidAt)}${p.paidByName ? ` · by ${p.paidByName}` : ""}`
    : "";

  if (p && missing === 0) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Badge tone="var(--success)" toneBg="var(--success-bg)">
          Paid · {p.accountCount} ID{p.accountCount === 1 ? "" : "s"}
        </Badge>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {paidLine}
        </span>
        <ActionForm action={undo}>
          <SubmitButton
            pendingLabel="Undoing…"
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium hover:bg-[var(--surface-muted)] disabled:opacity-60"
            style={{ color: "var(--muted)" }}
          >
            <Undo2 size={12} aria-hidden />
            Undo
          </SubmitButton>
        </ActionForm>
      </div>
    );
  }

  const inputId = `amount-${row.supplierId}-${row.day}`;
  return (
    <div className="flex flex-col items-start gap-2">
      {p ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Badge tone="var(--warning)" toneBg="var(--warning-bg)">
            Paid for {p.accountCount} · {missing} new not paid
          </Badge>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            {paidLine}
          </span>
        </div>
      ) : (
        <Badge tone="var(--warning)" toneBg="var(--warning-bg)">
          Not paid · {row.given} ID{row.given === 1 ? "" : "s"}
        </Badge>
      )}
      <ActionForm action={pay} className="flex flex-wrap items-center gap-2">
        <label htmlFor={inputId} className="sr-only">
          Amount paid to {row.supplierName} for {formatDayKey(row.day)}
        </label>
        <input
          id={inputId}
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder={p ? "New total ₹ (optional)" : "Amount ₹ (optional)"}
          className="h-9 w-44 rounded-lg border px-2.5 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
        />
        <SubmitButton
          pendingLabel="Saving…"
          className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium shadow-sm hover:shadow-md disabled:opacity-60"
          style={{ background: "var(--success)", color: "var(--success-contrast)" }}
        >
          <CheckCircle2 size={14} aria-hidden />
          {p ? `Mark all ${row.given} paid` : "Mark paid"}
        </SubmitButton>
      </ActionForm>
    </div>
  );
}

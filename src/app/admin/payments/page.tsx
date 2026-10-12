import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, Database, IndianRupee, Undo2, Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getSupplierDayReport, isDayPaid, summarizeByMonth, unpaidIdCount } from "@/lib/data/payments";
import { markSupplierDayPaidAction, markSupplierDayUnpaidAction } from "@/app/actions/payments";
import { StatTiles } from "@/components/StatTiles";
import { FilterChip } from "@/components/FilterChip";
import { Pagination } from "@/components/Pagination";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { CountRow } from "@/components/CountRow";
import { currentMonthKey, formatDayKey, formatMonthKey, isMonthKey, monthOf, todayKey } from "@/lib/day";
import { formatDate, formatTime } from "@/lib/formatDate";
import { formatRupees } from "@/lib/money";
import type { MonthSpending, SupplierDayRow } from "@/lib/types";

const DAYS_PER_PAGE = 10;
const cardStyle = { borderColor: "var(--border)", background: "var(--surface)" };

type Show = "unpaid" | "paid";

interface PaymentsSearchParams {
  show?: string;
  supplier?: string;
  /** "YYYY-MM" — only that month's days. */
  month?: string;
  page?: string;
}

const unpaidCount = unpaidIdCount;
const isPaid = isDayPaid;

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
  const month = isMonthKey(params.month) ? params.month : undefined;
  const current: PaymentsSearchParams = { show, supplier, month };
  const thisMonth = currentMonthKey();

  // Spending by month covers every month (for the supplier picked, if any).
  const bySupplier = supplier ? all.filter((r) => r.supplierId === supplier) : all;
  const months = summarizeByMonth(bySupplier);

  // Tiles count across the month picked (or all time), whatever the paid/unpaid filter.
  const scope = month ? bySupplier.filter((r) => monthOf(r.day) === month) : bySupplier;
  const givenToday = scope.filter((r) => r.day === today).reduce((n, r) => n + r.given, 0);
  const unpaidRows = scope.filter((r) => !isPaid(r));
  const unpaidIds = unpaidRows.reduce((n, r) => n + unpaidCount(r), 0);
  const spent = summarizeByMonth(scope).reduce((n, m) => n + m.spent, 0);

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
          On which date each supplier gave how many IDs, and whether you have paid him for that day. When you mark a day
          paid, the supplier sees those IDs as paid on his dashboard — never the amount.
        </p>
      </div>

      <StatTiles
        tiles={[
          month
            ? { label: `IDs given in ${formatMonthKey(month)}`, value: scope.reduce((n, r) => n + r.given, 0), icon: <Database size={18} strokeWidth={2} /> }
            : { label: "IDs given today", value: givenToday, icon: <Database size={18} strokeWidth={2} /> },
          { label: month ? "Spent" : "Spent (all time)", value: formatRupees(spent), icon: <IndianRupee size={18} strokeWidth={2} />, tone: "var(--success)", toneBg: "var(--success-bg)" },
          { label: "Days not paid", value: unpaidRows.length, href: hrefWith(current, { show: "unpaid" }), icon: <Clock size={18} strokeWidth={2} />, tone: "var(--warning)", toneBg: "var(--warning-bg)" },
          { label: "IDs not paid for", value: unpaidIds, href: hrefWith(current, { show: "unpaid" }), icon: <Wallet size={18} strokeWidth={2} />, tone: "var(--warning)", toneBg: "var(--warning-bg)" },
        ]}
      />

      {months.length > 0 ? <MonthlySpending months={months} thisMonth={thisMonth} current={current} /> : null}

      <section className="flex flex-col gap-4">
        {month ? (
          <p
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-sm"
            style={{ background: "var(--primary-soft)", color: "var(--foreground)" }}
          >
            <span>
              Showing <strong>{formatMonthKey(month)}</strong>
            </span>
            <Link href={hrefWith(current, { month: undefined })} className="font-medium hover:opacity-70" style={{ color: "var(--primary)" }}>
              Show all months
            </Link>
          </p>
        ) : null}

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by payment">
            <FilterChip href={hrefWith(current, { show: undefined })} active={!show}>All days</FilterChip>
            <FilterChip href={hrefWith(current, { show: "unpaid" })} active={show === "unpaid"}>Not paid</FilterChip>
            <FilterChip href={hrefWith(current, { show: "paid" })} active={show === "paid"}>Paid</FilterChip>
          </div>

          {supplierOptions.length > 1 ? (
            <form method="get" className="flex flex-wrap items-end gap-2" aria-label="Filter by supplier">
              {show ? <input type="hidden" name="show" value={show} /> : null}
              {month ? <input type="hidden" name="month" value={month} /> : null}
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

        <Pagination page={page} pageSize={DAYS_PER_PAGE} total={days.length} searchParams={{ show, supplier, month }} />
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
    ? `${p.amount !== null ? `${formatRupees(p.amount)} · ` : "No amount entered · "}${formatDate(p.paidAt)}, ${formatTime(p.paidAt)}${p.paidByName ? ` · by ${p.paidByName}` : ""}`
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
          required
          placeholder={p ? "New total paid ₹" : "Amount paid ₹"}
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

/** Month by month: how many IDs came in, how many are paid for, and what was spent. */
function MonthlySpending({ months, thisMonth, current }: { months: MonthSpending[]; thisMonth: string; current: PaymentsSearchParams }) {
  const missingAmounts = months.reduce((n, m) => n + m.paidDaysWithoutAmount, 0);
  const th = "px-4 py-2.5 font-medium whitespace-nowrap";
  const num = "px-4 py-2.5 text-right tabular-nums";

  return (
    <section className="flex flex-col gap-3" aria-labelledby="monthly-spending">
      <h2 id="monthly-spending" className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
        Spending by month
      </h2>

      {/* Phones: one card per month. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {months.map((m) => (
          <li
            key={m.month}
            className="card flex flex-col gap-3 rounded-xl border p-4"
            style={{ ...cardStyle, borderColor: m.month === current.month ? "var(--primary)" : "var(--border)" }}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 font-semibold" style={{ color: "var(--foreground)" }}>
                {formatMonthKey(m.month)}
                {m.month === thisMonth ? <ThisMonthBadge /> : null}
              </p>
              <p className="text-lg font-bold tabular-nums" style={{ color: "var(--foreground)" }}>
                {formatRupees(m.spent)}
              </p>
            </div>
            <CountRow
              items={[
                { label: "Given", value: m.given },
                { label: "Accepted", value: m.accepted, tone: "var(--success)" },
                { label: "Paid for", value: m.paidIds, tone: "var(--success)" },
                { label: "Not paid", value: m.unpaidIds, tone: "var(--warning)" },
              ]}
            />
            <MonthLink m={m} current={current} />
          </li>
        ))}
      </ul>

      {/* Wider screens: a table. */}
      <div className="card hidden overflow-hidden rounded-xl border md:block" style={cardStyle}>
        <div className="relative overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: "var(--border)", background: "var(--surface-muted)", color: "var(--muted)" }}>
                <th scope="col" className={th}>Month</th>
                <th scope="col" className={`${th} text-right`}>IDs given</th>
                <th scope="col" className={`${th} text-right`}>Accepted</th>
                <th scope="col" className={`${th} text-right`}>IDs paid for</th>
                <th scope="col" className={`${th} text-right`}>Spent</th>
                <th scope="col" className={`${th} text-right`}>Not paid yet</th>
                <th scope="col" className={`${th} text-right`}><span className="sr-only">Show</span></th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr
                  key={m.month}
                  className="border-b last:border-0"
                  style={{ borderColor: "var(--border)", background: m.month === current.month ? "var(--primary-soft)" : undefined }}
                >
                  <th scope="row" className="px-4 py-2.5 text-left font-medium whitespace-nowrap" style={{ color: "var(--foreground)" }}>
                    <span className="flex items-center gap-2">
                      {formatMonthKey(m.month)}
                      {m.month === thisMonth ? <ThisMonthBadge /> : null}
                    </span>
                  </th>
                  <td className={`${num} font-semibold`} style={{ color: "var(--foreground)" }}>{m.given}</td>
                  <td className={num} style={{ color: m.accepted ? "var(--success)" : "var(--muted)" }}>{m.accepted}</td>
                  <td className={num} style={{ color: m.paidIds ? "var(--foreground)" : "var(--muted)" }}>{m.paidIds}</td>
                  <td className={`${num} font-bold`} style={{ color: "var(--foreground)" }}>{formatRupees(m.spent)}</td>
                  <td className={num} style={{ color: m.unpaidIds ? "var(--warning)" : "var(--muted)" }}>{m.unpaidIds}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <MonthLink m={m} current={current} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {missingAmounts > 0 ? (
        <p className="flex items-start gap-2 text-xs" style={{ color: "var(--warning)" }}>
          <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden />
          {missingAmounts} paid day{missingAmounts === 1 ? " was" : "s were"} marked paid without an amount, so{" "}
          {missingAmounts === 1 ? "it isn't" : "they aren't"} in the Spent total. Undo and mark {missingAmounts === 1 ? "it" : "them"} paid again with the amount to fix it.
        </p>
      ) : null}
    </section>
  );
}

function ThisMonthBadge() {
  return (
    <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
      This month
    </span>
  );
}

function MonthLink({ m, current }: { m: MonthSpending; current: PaymentsSearchParams }) {
  const selected = current.month === m.month;
  return (
    <Link
      href={hrefWith(current, { month: selected ? undefined : m.month })}
      className="text-sm font-medium hover:opacity-70"
      style={{ color: "var(--primary)" }}
    >
      {selected ? "Show all months" : "Show days"}
      <span className="sr-only"> for {formatMonthKey(m.month)}</span>
    </Link>
  );
}

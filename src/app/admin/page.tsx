import Link from "next/link";
import { Database, Clock, AlertTriangle, CheckCircle2, X, IndianRupee, Wallet, CalendarDays } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getDashboardStats } from "@/lib/data/accounts";
import { getSupplierDayReport, summarizeByMonth } from "@/lib/data/payments";
import { StatTiles } from "@/components/StatTiles";
import { currentMonthKey, formatMonthKey } from "@/lib/day";
import { formatRupees } from "@/lib/money";

export default async function AdminDashboardPage() {
  // Checked here as well as in the layout: a layout is not re-run on every
  // navigation, so each admin page protects its own data.
  await requireAdmin();
  const [stats, report] = await Promise.all([getDashboardStats(), getSupplierDayReport()]);

  const thisMonth = currentMonthKey();
  const months = summarizeByMonth(report);
  const month = months.find((m) => m.month === thisMonth) ?? {
    month: thisMonth,
    given: 0,
    pending: 0,
    accepted: 0,
    rejected: 0,
    paidIds: 0,
    spent: 0,
    unpaidIds: 0,
    paidDaysWithoutAmount: 0,
  };
  const lastMonth = months.find((m) => m.month < thisMonth);
  const monthHref = `/admin/payments?month=${thisMonth}`;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
          Admin dashboard
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Overview of every ID suppliers have given.
        </p>
      </div>

      <StatTiles
        tiles={[
          { label: "Total IDs", value: stats.totalAccounts, href: "/admin/accounts", icon: <Database size={18} strokeWidth={2} /> },
          { label: "Pending review", value: stats.pending, href: "/admin/accounts?status=pending", icon: <Clock size={18} strokeWidth={2} />, tone: "var(--warning)", toneBg: "var(--warning-bg)" },
          { label: "Waiting to assign", value: stats.waitingToAssign, href: "/admin/accounts?assigned=unassigned", icon: <AlertTriangle size={18} strokeWidth={2} />, tone: "var(--warning)", toneBg: "var(--warning-bg)" },
          { label: "Active", value: stats.active, href: "/admin/accounts?status=active", icon: <CheckCircle2 size={18} strokeWidth={2} />, tone: "var(--success)", toneBg: "var(--success-bg)" },
          { label: "Rejected", value: stats.rejected, href: "/admin/accounts?status=rejected", icon: <X size={18} strokeWidth={2} />, tone: "var(--danger)", toneBg: "var(--danger-bg)" },
        ]}
      />

      <section className="flex flex-col gap-3" aria-labelledby="this-month">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="this-month" className="flex items-center gap-2 text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            <CalendarDays size={18} style={{ color: "var(--primary)" }} aria-hidden />
            This month · {formatMonthKey(thisMonth)}
          </h2>
          <Link href="/admin/payments" className="text-sm font-medium hover:opacity-70" style={{ color: "var(--primary)" }}>
            Spending by month
          </Link>
        </div>
        <StatTiles
          tiles={[
            { label: "IDs bought", value: month.given, href: monthHref, icon: <Database size={18} strokeWidth={2} /> },
            { label: "Pending review", value: month.pending, href: monthHref, icon: <Clock size={18} strokeWidth={2} />, tone: "var(--warning)", toneBg: "var(--warning-bg)" },
            { label: "Accepted", value: month.accepted, href: monthHref, icon: <CheckCircle2 size={18} strokeWidth={2} />, tone: "var(--success)", toneBg: "var(--success-bg)" },
            { label: "Rejected", value: month.rejected, href: monthHref, icon: <X size={18} strokeWidth={2} />, tone: "var(--danger)", toneBg: "var(--danger-bg)" },
            { label: "Paid for (accepted)", value: month.paidIds, href: `${monthHref}&show=paid`, icon: <Wallet size={18} strokeWidth={2} />, tone: "var(--success)", toneBg: "var(--success-bg)" },
            { label: "Spent", value: formatRupees(month.spent), href: monthHref, icon: <IndianRupee size={18} strokeWidth={2} />, tone: "var(--success)", toneBg: "var(--success-bg)" },
          ]}
        />
        {month.unpaidIds > 0 ? (
          <p className="text-sm" style={{ color: "var(--warning)" }}>
            {month.unpaidIds} accepted ID{month.unpaidIds === 1 ? " is" : "s are"} not paid yet.{" "}
            <Link href={`${monthHref}&show=unpaid`} className="font-medium hover:opacity-70" style={{ color: "var(--primary)" }}>
              Pay now
            </Link>
          </p>
        ) : null}
        {lastMonth ? (
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            {formatMonthKey(lastMonth.month)}: {lastMonth.given} ID{lastMonth.given === 1 ? "" : "s"} bought, {lastMonth.accepted} accepted,{" "}
            {lastMonth.paidIds} paid for · {formatRupees(lastMonth.spent)} spent.
          </p>
        ) : null}
      </section>
    </div>
  );
}

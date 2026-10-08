import Link from "next/link";
import { Database, Clock, CheckCircle2, X, ChevronRight, PlusCircle, UserPlus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { listAccountsForBuyer, type BuyerFilter } from "@/lib/data/accounts";
import { StatTiles } from "@/components/StatTiles";
import { StatusBadge } from "@/components/StatusBadge";
import { Pagination } from "@/components/Pagination";
import { FilterChip } from "@/components/FilterChip";
import { buyerStatusLabel } from "@/lib/buyerLabels";
import { formatDate } from "@/lib/formatDate";

const PAGE_SIZE = 25;
const FILTERS: { value: BuyerFilter; label: string }[] = [
  { value: "to_check", label: "To check" },
  { value: "active", label: "Active" },
  { value: "rejected", label: "Rejected" },
  { value: "self_added", label: "Added by me" },
];

/** A small badge marking an ID the buyer added himself. */
function OwnBadge() {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
    >
      <UserPlus size={11} aria-hidden />
      Added by me
    </span>
  );
}

const cardStyle = { borderColor: "var(--border)", background: "var(--surface)" };

export default async function BuyerHomePage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; page?: string }>;
}) {
  // Only ever this buyer's own assignments — the id comes from the session.
  const user = await requireRole("media_buyer");
  const params = await searchParams;
  const filter = FILTERS.find((f) => f.value === params.show)?.value;
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const { accounts, total, counts } = await listAccountsForBuyer(user.id, { filter, page, pageSize: PAGE_SIZE });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
            My IDs
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            IDs assigned to you, plus ones you added yourself. Open one to see its login details and mark it active or rejected.
          </p>
        </div>
        <Link
          href="/buyer/accounts/new"
          className="flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg px-5 text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5 sm:w-auto"
          style={{ background: "var(--primary)", color: "var(--primary-contrast)" }}
        >
          <PlusCircle size={16} />
          Add an ID
        </Link>
      </div>

      <StatTiles
        tiles={[
          { label: "Assigned to me", value: counts.assigned, href: "/buyer", icon: <Database size={18} strokeWidth={2} /> },
          { label: "To check", value: counts.toCheck, href: "/buyer?show=to_check", icon: <Clock size={18} strokeWidth={2} />, tone: "var(--warning)", toneBg: "var(--warning-bg)" },
          { label: "Active", value: counts.active, href: "/buyer?show=active", icon: <CheckCircle2 size={18} strokeWidth={2} />, tone: "var(--success)", toneBg: "var(--success-bg)" },
          { label: "Rejected", value: counts.rejected, href: "/buyer?show=rejected", icon: <X size={18} strokeWidth={2} />, tone: "var(--danger)", toneBg: "var(--danger-bg)" },
          { label: "Added by me", value: counts.selfAdded, href: "/buyer?show=self_added", icon: <UserPlus size={18} strokeWidth={2} /> },
        ]}
      />

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter IDs">
          <FilterChip href="/buyer" active={!filter}>All</FilterChip>
          {FILTERS.map((f) => (
            <FilterChip key={f.value} href={`/buyer?show=${f.value}`} active={filter === f.value}>
              {f.label}
            </FilterChip>
          ))}
        </div>

        {accounts.length === 0 ? (
          <p className="card rounded-xl border p-10 text-center text-sm" style={{ ...cardStyle, color: "var(--muted)" }}>
            {filter === "self_added"
              ? "You haven't added any IDs of your own yet."
              : counts.assigned === 0
                ? "No IDs have been assigned to you yet."
                : "No IDs match this filter."}
          </p>
        ) : (
          <>
            {/* Phones and tablets: one card per ID; the whole card opens it. */}
            <ul className="flex flex-col gap-3 lg:hidden">
              {accounts.map((account) => (
                <li key={account.id}>
                  <Link
                    href={`/buyer/accounts/${account.id}`}
                    className="card card-interactive flex items-center gap-3 rounded-xl border p-4"
                    style={cardStyle}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 font-mono text-sm break-all" style={{ color: "var(--foreground)" }}>
                          {account.loginIdentifier}
                        </p>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <StatusBadge status={account.status} label={buyerStatusLabel(account.status)} />
                          {account.source === "media_buyer" ? <OwnBadge /> : null}
                        </div>
                      </div>
                      <p className="mt-1 font-mono text-xs break-all" style={{ color: "var(--muted)" }}>
                        {account.linkedEmail ?? "No Outlook mail"}
                      </p>
                      <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                        {account.source === "media_buyer"
                          ? account.assignedAt ? `Added ${formatDate(account.assignedAt)}` : "Added by you"
                          : account.assignedAt ? `Assigned ${formatDate(account.assignedAt)}` : "Assigned to you"}
                      </p>
                    </div>
                    <ChevronRight size={18} className="shrink-0" style={{ color: "var(--muted)" }} aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>

            {/* Wide screens: the same list as a table. */}
            <div className="card hidden overflow-hidden rounded-xl border lg:block" style={cardStyle}>
              <div className="relative overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left" style={{ borderColor: "var(--border)", background: "var(--surface-muted)" }}>
                      <th scope="col" className="px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }}>Facebook login</th>
                      <th scope="col" className="px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }}>Outlook mail</th>
                      <th scope="col" className="px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }}>Assigned</th>
                      <th scope="col" className="px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }}>Status</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium" style={{ color: "var(--muted)" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((account) => (
                      <tr key={account.id} className="border-b last:border-0 hover:bg-[var(--surface-muted)]" style={{ borderColor: "var(--border)" }}>
                        <td className="px-4 py-2.5 font-mono text-xs" style={{ color: "var(--foreground)" }}>{account.loginIdentifier}</td>
                        <td className="px-4 py-2.5 font-mono text-xs" style={{ color: "var(--muted)" }}>{account.linkedEmail ?? "—"}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--muted)" }}>
                          {account.assignedAt ? formatDate(account.assignedAt) : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-col items-start gap-1">
                            <StatusBadge status={account.status} label={buyerStatusLabel(account.status)} />
                            {account.source === "media_buyer" ? <OwnBadge /> : null}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Link href={`/buyer/accounts/${account.id}`} className="font-medium hover:opacity-70" style={{ color: "var(--primary)" }}>
                            Open<span className="sr-only"> {account.loginIdentifier}</span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <Pagination page={page} pageSize={PAGE_SIZE} total={total} searchParams={{ show: filter }} />
      </section>
    </div>
  );
}

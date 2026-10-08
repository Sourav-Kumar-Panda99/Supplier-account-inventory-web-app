import Link from "next/link";
import { Database, Clock, CheckCircle2, X, ChevronRight } from "lucide-react";
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
];

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
      <div>
        <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
          My IDs
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          The IDs assigned to you. Open one to see its login details, check it, then mark it active or reject it.
        </p>
      </div>

      <StatTiles
        tiles={[
          { label: "Assigned to me", value: counts.assigned, href: "/buyer", icon: <Database size={18} strokeWidth={2} /> },
          { label: "To check", value: counts.toCheck, href: "/buyer?show=to_check", icon: <Clock size={18} strokeWidth={2} />, tone: "var(--warning)", toneBg: "var(--warning-bg)" },
          { label: "Active", value: counts.active, href: "/buyer?show=active", icon: <CheckCircle2 size={18} strokeWidth={2} />, tone: "var(--success)", toneBg: "var(--success-bg)" },
          { label: "Rejected", value: counts.rejected, href: "/buyer?show=rejected", icon: <X size={18} strokeWidth={2} />, tone: "var(--danger)", toneBg: "var(--danger-bg)" },
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
            {counts.assigned === 0 ? "No IDs have been assigned to you yet." : "No IDs match this filter."}
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
                        <StatusBadge status={account.status} label={buyerStatusLabel(account.status)} />
                      </div>
                      <p className="mt-1 font-mono text-xs break-all" style={{ color: "var(--muted)" }}>
                        {account.linkedEmail ?? "No Outlook mail"}
                      </p>
                      <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                        {account.assignedAt ? `Assigned ${formatDate(account.assignedAt)}` : "Assigned to you"}
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
                          <StatusBadge status={account.status} label={buyerStatusLabel(account.status)} />
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

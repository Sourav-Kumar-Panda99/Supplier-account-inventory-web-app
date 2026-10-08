import Link from "next/link";
import { PlusCircle, ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { listAccountsForBuyer } from "@/lib/data/accounts";
import { StatusBadge } from "@/components/StatusBadge";
import { Pagination } from "@/components/Pagination";
import { buyerStatusLabel } from "@/lib/buyerLabels";
import { formatDate } from "@/lib/formatDate";

const PAGE_SIZE = 25;
const cardStyle = { borderColor: "var(--border)", background: "var(--surface)" };

/** The media buyer's own-added IDs only (source = media_buyer), his alone. */
export default async function BuyerAddedPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireRole("media_buyer");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  // filter: "self_added" keeps only the IDs this buyer added for himself.
  const { accounts, total, counts } = await listAccountsForBuyer(user.id, {
    filter: "self_added",
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
            My added IDs
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            IDs you added yourself{counts.selfAdded > 0 ? ` — ${counts.selfAdded} in total` : ""}. These are yours alone.
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

      {accounts.length === 0 ? (
        <p className="card rounded-xl border p-10 text-center text-sm" style={{ ...cardStyle, color: "var(--muted)" }}>
          You haven&apos;t added any IDs of your own yet.
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
                      {account.assignedAt ? `Added ${formatDate(account.assignedAt)}` : "Added by you"}
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
                    <th scope="col" className="px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }}>Added</th>
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

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} searchParams={{}} />
    </div>
  );
}

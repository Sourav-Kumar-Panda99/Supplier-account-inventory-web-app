import Link from "next/link";
import { Database, Clock, CheckCircle2, X, PlusCircle, Wallet } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getSupplierDashboard } from "@/lib/data/accounts";
import { updateMyUpiAction } from "@/app/actions/users";
import { StatTiles } from "@/components/StatTiles";
import { StatusBadge } from "@/components/StatusBadge";
import { Pagination } from "@/components/Pagination";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { CountRow } from "@/components/CountRow";
import { FilterChip } from "@/components/FilterChip";
import { formatDayKey, isDayKey } from "@/lib/day";
import { SUPPLIER_BUCKETS } from "@/lib/types";
import type { SupplierBucket, SupplierDayStats } from "@/lib/types";

const PAGE_SIZE = 25;

const BUCKET_LABELS: Record<SupplierBucket, string> = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
};

interface SupplierSearchParams {
  day?: string;
  status?: string;
  page?: string;
}

function hrefWith(current: SupplierSearchParams, changes: Partial<SupplierSearchParams>): string {
  const params = new URLSearchParams();
  const merged = { ...current, page: undefined, ...changes };
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/supplier?${query}#my-ids` : "/supplier#my-ids";
}

function dayCounts(d: SupplierDayStats) {
  return [
    { label: "Given", value: d.given },
    { label: "Accepted", value: d.accepted, tone: "var(--success)" },
    { label: "Rejected", value: d.rejected, tone: "var(--danger)" },
    { label: "Pending", value: d.pending, tone: "var(--warning)" },
  ];
}

const cardStyle = { borderColor: "var(--border)", background: "var(--surface)" };
const emptyClass = "card rounded-xl border p-8 text-center text-sm";

export default async function SupplierDashboardPage({
  searchParams,
}: {
  searchParams: Promise<SupplierSearchParams>;
}) {
  // The dashboard is always the signed-in supplier's own — the id comes from
  // the session, never from the URL.
  const user = await requireRole("supplier");
  const params = await searchParams;
  const { totals, days, rows } = await getSupplierDashboard(user.id);

  const day = isDayKey(params.day) ? params.day : undefined;
  const bucket = SUPPLIER_BUCKETS.includes(params.status as SupplierBucket) ? (params.status as SupplierBucket) : undefined;
  const filters: SupplierSearchParams = { day, status: bucket };

  const filtered = rows.filter((r) => (!day || r.day === day) && (!bucket || r.bucket === bucket));
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
            My dashboard
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Every ID you have given, and what happened to it.
          </p>
        </div>
        <Link
          href="/supplier/accounts/new"
          className="flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg px-5 text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5 sm:w-auto"
          style={{ background: "var(--primary)", color: "var(--primary-contrast)" }}
        >
          <PlusCircle size={16} />
          Submit an ID
        </Link>
      </div>

      <StatTiles
        tiles={[
          { label: "IDs given", value: totals.given, icon: <Database size={18} strokeWidth={2} /> },
          { label: "Accepted", value: totals.accepted, icon: <CheckCircle2 size={18} strokeWidth={2} />, tone: "var(--success)", toneBg: "var(--success-bg)" },
          { label: "Rejected", value: totals.rejected, icon: <X size={18} strokeWidth={2} />, tone: "var(--danger)", toneBg: "var(--danger-bg)" },
          { label: "Pending", value: totals.pending, icon: <Clock size={18} strokeWidth={2} />, tone: "var(--warning)", toneBg: "var(--warning-bg)" },
        ]}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          Day by day
        </h2>
        {days.length === 0 ? (
          <p className={emptyClass} style={{ ...cardStyle, color: "var(--muted)" }}>
            You haven&apos;t submitted any IDs yet.
          </p>
        ) : (
          <>
            {/* Phones and tablets: one card per day. */}
            <ul className="grid gap-3 sm:grid-cols-2 lg:hidden">
              {days.map((d) => (
                <li
                  key={d.day}
                  className="card rounded-xl border p-4"
                  style={{ background: "var(--surface)", borderColor: d.day === day ? "var(--primary)" : "var(--border)" }}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      {formatDayKey(d.day)}
                    </h3>
                    <Link
                      href={hrefWith(filters, { day: d.day === day ? undefined : d.day })}
                      className="-my-2 py-2 text-sm font-medium hover:opacity-70"
                      style={{ color: "var(--primary)" }}
                    >
                      {d.day === day ? "Show all days" : "Show IDs"}
                      <span className="sr-only"> for {formatDayKey(d.day)}</span>
                    </Link>
                  </div>
                  <CountRow items={dayCounts(d)} />
                </li>
              ))}
            </ul>

            {/* Wide screens: the same figures as a table. */}
            <div className="card hidden overflow-hidden rounded-xl border lg:block" style={cardStyle}>
              <div className="relative overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left" style={{ borderColor: "var(--border)", background: "var(--surface-muted)" }}>
                      <th scope="col" className="px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }}>Date</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium" style={{ color: "var(--muted)" }}>Given</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium" style={{ color: "var(--muted)" }}>Accepted</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium" style={{ color: "var(--muted)" }}>Rejected</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium" style={{ color: "var(--muted)" }}>Pending</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium" style={{ color: "var(--muted)" }}>
                        <span className="sr-only">Show</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((d) => (
                      <tr
                        key={d.day}
                        className="border-b last:border-0 hover:bg-[var(--surface-muted)]"
                        style={{ borderColor: "var(--border)", background: d.day === day ? "var(--primary-soft)" : undefined }}
                      >
                        <th scope="row" className="px-4 py-2.5 text-left font-medium whitespace-nowrap" style={{ color: "var(--foreground)" }}>
                          {formatDayKey(d.day)}
                        </th>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>{d.given}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: d.accepted ? "var(--success)" : "var(--muted)" }}>{d.accepted}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: d.rejected ? "var(--danger)" : "var(--muted)" }}>{d.rejected}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: d.pending ? "var(--warning)" : "var(--muted)" }}>{d.pending}</td>
                        <td className="px-4 py-2.5 text-right">
                          <Link
                            href={hrefWith(filters, { day: d.day === day ? undefined : d.day })}
                            className="font-medium hover:opacity-70"
                            style={{ color: "var(--primary)" }}
                          >
                            {d.day === day ? "Show all days" : "Show IDs"}
                            <span className="sr-only"> for {formatDayKey(d.day)}</span>
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
      </section>

      <section id="my-ids" className="flex scroll-mt-20 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            My IDs{day ? ` · ${formatDayKey(day)}` : ""}
          </h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by result">
            <FilterChip href={hrefWith(filters, { status: undefined })} active={!bucket}>All</FilterChip>
            {SUPPLIER_BUCKETS.map((b) => (
              <FilterChip key={b} href={hrefWith(filters, { status: b })} active={bucket === b}>
                {BUCKET_LABELS[b]}
              </FilterChip>
            ))}
          </div>
        </div>

        {pageRows.length === 0 ? (
          <p className={emptyClass} style={{ ...cardStyle, color: "var(--muted)" }}>
            {rows.length === 0 ? "Nothing here yet — submit your first ID." : "No IDs match this filter."}
          </p>
        ) : (
          <>
            {/* Phones and tablets: one card per ID. */}
            <ul className="flex flex-col gap-3 lg:hidden">
              {pageRows.map((r) => (
                <li key={r.id} className="card rounded-xl border p-4" style={cardStyle}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 font-mono text-sm break-all" style={{ color: "var(--foreground)" }}>
                      {r.loginIdentifier}
                    </p>
                    <StatusBadge status={r.bucket} />
                  </div>
                  <p className="mt-1 font-mono text-xs break-all" style={{ color: "var(--muted)" }}>
                    {r.linkedEmail ?? "No Outlook mail"}
                  </p>
                  <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                    Given on {formatDayKey(r.day)}
                  </p>
                  {r.bucket === "rejected" ? (
                    <p className="mt-3 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
                      <span className="font-medium">Reason:</span> {r.rejectionNote ?? "No reason given"}
                    </p>
                  ) : null}
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
                      <th scope="col" className="px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }}>Given on</th>
                      <th scope="col" className="px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }}>Result</th>
                      <th scope="col" className="px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }}>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-[var(--surface-muted)]" style={{ borderColor: "var(--border)" }}>
                        <td className="px-4 py-2.5 font-mono text-xs" style={{ color: "var(--foreground)" }}>{r.loginIdentifier}</td>
                        <td className="px-4 py-2.5 font-mono text-xs" style={{ color: "var(--muted)" }}>{r.linkedEmail ?? "—"}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--muted)" }}>{formatDayKey(r.day)}</td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={r.bucket} />
                        </td>
                        <td className="px-4 py-2.5" style={{ color: r.rejectionNote ? "var(--foreground)" : "var(--muted)" }}>
                          {r.bucket === "rejected" ? r.rejectionNote ?? "No reason given" : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} searchParams={{ day, status: bucket }} />
      </section>

      <section className="card flex max-w-xl flex-col gap-3 rounded-2xl border p-6" style={cardStyle}>
        <h2 className="flex items-center gap-2 text-base font-semibold" style={{ color: "var(--foreground)" }}>
          <Wallet size={16} style={{ color: "var(--primary)" }} />
          Payment UPI ID
        </h2>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Saved with every ID you submit from now on. IDs you already submitted keep the UPI ID they were given with.
        </p>
        <ActionForm action={updateMyUpiAction} className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
            <label htmlFor="upiId" className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              UPI ID
            </label>
            <input
              id="upiId"
              name="upiId"
              defaultValue={user.upiId ?? ""}
              placeholder="e.g. name@bank"
              autoComplete="off"
              className="h-11 rounded-lg border px-3 text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            />
          </div>
          <SubmitButton
            pendingLabel="Saving…"
            className="h-11 rounded-lg border px-4 text-sm font-medium hover:bg-[var(--surface-muted)] disabled:opacity-60"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            Save UPI ID
          </SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}

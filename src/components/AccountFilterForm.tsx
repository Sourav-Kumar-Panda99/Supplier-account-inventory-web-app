import Link from "next/link";
import { Search } from "lucide-react";
import { ACCOUNT_STATUSES, STATUS_LABELS } from "@/lib/types";

export interface AccountFilterValues {
  search?: string;
  status?: string;
  assigned?: string;
}

export interface BuyerOption {
  id: string;
  name: string;
}

/** Must match UNASSIGNED in lib/data/accounts.ts (that module is server-only, so it can't be imported here). */
const UNASSIGNED = "unassigned";

const hasAnyFilter = (values: AccountFilterValues) => Boolean(values.search || values.status || values.assigned);

export function AccountFilterForm({
  values,
  buyers,
  resetHref,
}: {
  values: AccountFilterValues;
  buyers: BuyerOption[];
  resetHref: string;
}) {
  return (
    <form
      method="get"
      className="card animate-fade-in-up flex flex-wrap items-end gap-3 rounded-xl border p-4"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      role="search"
      aria-label="Filter IDs"
    >
      <div className="flex min-w-[260px] flex-1 flex-col gap-1.5">
        <label htmlFor="search" className="text-xs font-medium" style={{ color: "var(--muted)" }}>
          Search
        </label>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} aria-hidden />
          <input
            id="search"
            name="search"
            type="search"
            defaultValue={values.search}
            placeholder="Supplier, UPI ID, login, email…"
            className="h-11 w-full rounded-lg border pl-9 pr-3 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="status" className="text-xs font-medium" style={{ color: "var(--muted)" }}>
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={values.status ?? ""}
          className="h-11 rounded-lg border px-3 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <option value="">All statuses</option>
          {ACCOUNT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="assigned" className="text-xs font-medium" style={{ color: "var(--muted)" }}>
          Assigned to
        </label>
        <select
          id="assigned"
          name="assigned"
          defaultValue={values.assigned ?? ""}
          className="h-11 rounded-lg border px-3 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <option value="">Anyone or no one</option>
          <option value={UNASSIGNED}>Not assigned yet</option>
          {buyers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="h-11 rounded-lg px-4 text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5"
          style={{ background: "var(--primary)", color: "var(--primary-contrast)" }}
        >
          Apply filters
        </button>
        {hasAnyFilter(values) ? (
          <Link
            href={resetHref}
            className="flex h-11 items-center rounded-lg border px-4 text-sm font-medium hover:bg-[var(--surface-muted)]"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            Reset
          </Link>
        ) : null}
      </div>
    </form>
  );
}

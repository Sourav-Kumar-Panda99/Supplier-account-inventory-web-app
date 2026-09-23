import Link from "next/link";
import { Search } from "lucide-react";
import { ACCOUNT_STATUSES, STATUS_LABELS } from "@/lib/types";

export interface AccountFilterValues {
  search?: string;
  status?: string;
  age?: string;
}

const hasAnyFilter = (values: AccountFilterValues) => Boolean(values.search || values.status || values.age);

export function AccountFilterForm({ values, resetHref }: { values: AccountFilterValues; resetHref: string }) {
  return (
    <form
      method="get"
      className="card animate-fade-in-up flex flex-wrap items-end gap-3 rounded-xl border p-4"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      role="search"
      aria-label="Filter accounts"
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
        <label htmlFor="age" className="text-xs font-medium" style={{ color: "var(--muted)" }}>
          Profile age contains
        </label>
        <input
          id="age"
          name="age"
          type="text"
          defaultValue={values.age}
          placeholder="e.g. months"
          className="h-11 w-32 rounded-lg border px-3 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        />
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

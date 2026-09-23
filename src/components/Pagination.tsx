import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  page,
  pageSize,
  total,
  searchParams,
}: {
  page: number;
  pageSize: number;
  total: number;
  searchParams: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  function hrefFor(targetPage: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) params.set(key, value);
    }
    params.set("page", String(targetPage));
    return `?${params.toString()}`;
  }

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
      <p style={{ color: "var(--muted)" }}>
        Page {page} of {totalPages} · {total} total
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={hrefFor(page - 1)}
            className="flex items-center gap-1 rounded-lg border px-3 py-2 hover:bg-[var(--surface-muted)] hover:border-[var(--border-strong)]"
            style={{ borderColor: "var(--border)" }}
          >
            <ChevronLeft size={16} />
            Previous
          </Link>
        ) : (
          <span
            className="flex items-center gap-1 rounded-lg border px-3 py-2 opacity-40"
            style={{ borderColor: "var(--border)" }}
            aria-hidden
          >
            <ChevronLeft size={16} />
            Previous
          </span>
        )}
        {page < totalPages ? (
          <Link
            href={hrefFor(page + 1)}
            className="flex items-center gap-1 rounded-lg border px-3 py-2 hover:bg-[var(--surface-muted)] hover:border-[var(--border-strong)]"
            style={{ borderColor: "var(--border)" }}
          >
            Next
            <ChevronRight size={16} />
          </Link>
        ) : (
          <span
            className="flex items-center gap-1 rounded-lg border px-3 py-2 opacity-40"
            style={{ borderColor: "var(--border)" }}
            aria-hidden
          >
            Next
            <ChevronRight size={16} />
          </span>
        )}
      </div>
    </nav>
  );
}

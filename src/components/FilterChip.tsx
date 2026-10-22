import Link from "next/link";
import type { ReactNode } from "react";

/** A pill-shaped filter link; `active` marks the one currently applied. */
export function FilterChip({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className="rounded-full border px-3.5 py-2 text-xs font-medium hover:border-[var(--border-strong)] lg:px-3 lg:py-1.5"
      style={
        active
          ? { background: "var(--primary)", borderColor: "var(--primary)", color: "var(--primary-contrast)" }
          : { background: "var(--surface)", borderColor: "var(--border)", color: "var(--foreground)" }
      }
    >
      {children}
    </Link>
  );
}

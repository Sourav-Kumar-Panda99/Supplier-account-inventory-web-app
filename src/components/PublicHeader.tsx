import Link from "next/link";
import { ShieldCheck } from "lucide-react";

/**
 * Header for the team submission flow, which requires no login. Deliberately
 * has no user menu / sign-out — there's no session to show. The "Admin sign
 * in" link is the only way back to authenticated territory from here.
 */
export function PublicHeader() {
  return (
    <header
      className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b px-4 sm:px-6"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <Link
        href="/team/accounts/new"
        className="flex items-center gap-2 font-semibold tracking-tight hover:opacity-80"
        style={{ color: "var(--foreground)" }}
      >
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: "var(--primary)", color: "var(--primary-contrast)" }}
          aria-hidden
        >
          <ShieldCheck size={18} strokeWidth={2} />
        </span>
        <span className="hidden sm:inline">Supplier Account Inventory</span>
      </Link>

      <Link href="/login" className="ml-auto text-sm font-medium hover:opacity-70" style={{ color: "var(--muted)" }}>
        Admin sign in →
      </Link>
    </header>
  );
}

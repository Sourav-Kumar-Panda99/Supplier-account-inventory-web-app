import Link from "next/link";
import { Bell, ShieldCheck } from "lucide-react";
import { UserMenu } from "@/components/UserMenu";
import { MobileSidebar } from "@/components/MobileSidebar";
import type { SessionUser } from "@/lib/auth";

export function TopBar({ user }: { user: SessionUser }) {
  return (
    <header
      className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b px-4 sm:px-6"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <MobileSidebar user={user} />
      <Link
        href={user.role === "admin" ? "/admin" : "/team/accounts/new"}
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

      <div className="ml-auto flex items-center gap-3">
        <span
          title="No new notifications"
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ color: "var(--muted)" }}
          aria-hidden
        >
          <Bell size={18} strokeWidth={2} />
        </span>
        <UserMenu user={user} />
      </div>
    </header>
  );
}

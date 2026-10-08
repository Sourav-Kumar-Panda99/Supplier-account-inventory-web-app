"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Database, Users, PlusCircle, ListChecks, UserPlus } from "lucide-react";
import type { ComponentType } from "react";
import type { Role } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  exact?: boolean;
}

// Navigation per role. Kept in this client module (and picked by a plain
// `role` string prop) because icon components can't be passed as props from
// a Server Component layout. This is only what's *shown* — every page and
// action re-checks the role on the server.
export const NAV_ITEMS: Record<Role, NavItem[]> = {
  admin: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/admin/accounts", label: "All IDs", icon: Database },
    { href: "/admin/users", label: "Suppliers & buyers", icon: Users },
    { href: "/admin/added-by-buyers", label: "Buyer-added IDs", icon: UserPlus },
  ],
  media_buyer: [
    { href: "/buyer", label: "My IDs", icon: ListChecks, exact: true },
    { href: "/buyer/accounts/new", label: "Add an ID", icon: PlusCircle },
  ],
  supplier: [
    { href: "/supplier", label: "My dashboard", icon: LayoutDashboard, exact: true },
    { href: "/supplier/accounts/new", label: "Submit an ID", icon: PlusCircle },
  ],
};

export function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-[var(--surface-muted)]"
            style={
              active
                ? { background: "var(--primary-soft)", color: "var(--primary)" }
                : { color: "var(--foreground)" }
            }
          >
            <Icon size={18} strokeWidth={2} className={active ? "" : "opacity-70"} />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function Sidebar({ role }: { role: Role }) {
  return (
    <nav
      aria-label="Primary"
      className="hidden w-60 shrink-0 flex-col gap-1 border-r p-3 md:flex"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <NavLinks items={NAV_ITEMS[role]} />
    </nav>
  );
}

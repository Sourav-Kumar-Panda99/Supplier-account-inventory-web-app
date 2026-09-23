"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Database } from "lucide-react";
import type { ComponentType } from "react";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  exact?: boolean;
}

// Only admins ever see a sidebar now — team members have no login and no
// nav beyond the single public submit page (see PublicHeader instead).
export const ADMIN_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/accounts", label: "All accounts", icon: Database },
];

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

export function Sidebar() {
  return (
    <nav
      aria-label="Primary"
      className="hidden w-60 shrink-0 flex-col gap-1 border-r p-3 md:flex"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <NavLinks items={ADMIN_ITEMS} />
    </nav>
  );
}

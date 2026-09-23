"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { NavLinks, navItemsFor } from "@/components/Sidebar";
import type { SessionUser } from "@/lib/auth";

export function MobileSidebar({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const items = navItemsFor(user.role);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[var(--surface-muted)] md:hidden"
        style={{ color: "var(--foreground)" }}
      >
        <Menu size={20} strokeWidth={2} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 animate-fade-in"
            style={{ background: "color-mix(in srgb, var(--foreground) 40%, transparent)" }}
            onClick={() => setOpen(false)}
          />
          <div
            className="animate-scale-in absolute left-0 top-0 flex h-full w-64 flex-col gap-1 border-r p-3 shadow-lg"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                Menu
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[var(--surface-muted)]"
              >
                <X size={18} />
              </button>
            </div>
            <NavLinks items={items} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}

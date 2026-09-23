"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import type { SessionUser } from "@/lib/auth";

export function UserMenu({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const initials = (user.fullName ?? user.email).charAt(0).toUpperCase();

  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickAway);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickAway);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--surface-muted)]"
      >
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
          style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
          aria-hidden
        >
          {initials}
        </span>
        <span className="hidden flex-col items-start leading-tight sm:flex">
          <span className="font-medium" style={{ color: "var(--foreground)" }}>
            {user.fullName ?? user.email}
          </span>
          <span
            className="rounded px-1.5 py-0.5 text-[11px] font-medium"
            style={{ background: "var(--surface-muted)", color: "var(--muted)" }}
          >
            {user.role === "admin" ? "Admin" : "Team"}
          </span>
        </span>
        <ChevronDown size={16} className="text-[var(--muted)]" aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          className="animate-scale-in absolute right-0 z-30 mt-2 w-56 rounded-xl border p-1.5 shadow-lg"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="px-2.5 py-2 text-xs" style={{ color: "var(--muted)" }}>
            Signed in as
            <div className="truncate font-medium" style={{ color: "var(--foreground)" }}>
              {user.email}
            </div>
          </div>
          <div className="my-1 border-t" style={{ borderColor: "var(--border)" }} />
          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className="w-full rounded-lg px-2.5 py-2 text-left text-sm hover:bg-[var(--surface-muted)]"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

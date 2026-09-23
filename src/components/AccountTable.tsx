"use client";

import { useState } from "react";
import Link from "next/link";
import type { Account } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/formatDate";

export function AccountTable({ accounts, basePath }: { accounts: Account[]; basePath: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (accounts.length === 0) {
    return (
      <p
        className="card animate-fade-in rounded-xl border p-10 text-center text-sm"
        style={{ borderColor: "var(--border)", color: "var(--muted)" }}
      >
        No accounts match these filters.
      </p>
    );
  }

  const allSelected = selected.size === accounts.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(accounts.map((a) => a.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="card animate-fade-in-up overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
      <table className="w-full text-sm">
        <thead>
          <tr
            className="sticky top-0 z-10 border-b text-left"
            style={{ borderColor: "var(--border)", background: "var(--surface-muted)" }}
          >
            <th scope="col" className="w-10 px-4 py-2.5">
              <input
                type="checkbox"
                aria-label="Select all accounts"
                checked={allSelected}
                onChange={toggleAll}
                className="h-4 w-4 rounded accent-[var(--primary)]"
              />
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }}>
              Supplier
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }}>
              UPI ID
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }}>
              Login
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }}>
              Profile age
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }}>
              Status
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }}>
              Updated
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium" style={{ color: "var(--muted)" }}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => (
            <tr
              key={account.id}
              className="border-b last:border-0 hover:bg-[var(--surface-muted)]"
              style={{
                borderColor: "var(--border)",
                background: selected.has(account.id) ? "var(--primary-soft)" : undefined,
              }}
            >
              <td className="px-4 py-2.5">
                <input
                  type="checkbox"
                  aria-label={`Select ${account.supplierName} account`}
                  checked={selected.has(account.id)}
                  onChange={() => toggleOne(account.id)}
                  className="h-4 w-4 rounded accent-[var(--primary)]"
                />
              </td>
              <td className="px-4 py-2.5 font-medium" style={{ color: "var(--foreground)" }}>
                {account.supplierName}
              </td>
              <td className="px-4 py-2.5 font-mono text-xs" style={{ color: "var(--muted)" }}>
                {account.upiId ?? "—"}
              </td>
              <td className="px-4 py-2.5 font-mono text-xs" style={{ color: "var(--muted)" }}>
                {account.loginIdentifier}
              </td>
              <td className="px-4 py-2.5" style={{ color: "var(--foreground)" }}>
                {account.profileAge ?? "—"}
              </td>
              <td className="px-4 py-2.5">
                <StatusBadge status={account.status} />
              </td>
              <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                {formatDate(account.updatedAt)}
              </td>
              <td className="px-4 py-2.5 text-right">
                <Link href={`${basePath}/${account.id}`} className="font-medium hover:opacity-70" style={{ color: "var(--primary)" }}>
                  View<span className="sr-only"> {account.platform} account</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

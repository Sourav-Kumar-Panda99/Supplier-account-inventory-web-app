"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Trash2, X } from "lucide-react";
import type { Account, ActionResult } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { AssignSelect } from "@/components/AssignSelect";
import type { BuyerOption } from "@/components/AccountFilterForm";
import { formatDate } from "@/lib/formatDate";
import { assignAccountsAction, deleteAccountsAction, setAccountsStatusAction } from "@/app/actions/accounts";

type BarMode = "idle" | "reject" | "delete";

/**
 * Admin list of IDs. Each row can be assigned to a media buyer by name; tick
 * several rows to accept, reject, assign or delete them together. Everything
 * here calls a Server Action that re-checks the admin role itself.
 */
export function AccountTable({
  accounts,
  buyers,
  basePath,
}: {
  accounts: Account[];
  buyers: BuyerOption[];
  basePath: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<BarMode>("idle");
  const [bulkBuyer, setBulkBuyer] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isWorking, startWork] = useTransition();

  if (accounts.length === 0) {
    return (
      <p
        className="card animate-fade-in rounded-xl border p-10 text-center text-sm"
        style={{ borderColor: "var(--border)", color: "var(--muted)" }}
      >
        No IDs match these filters.
      </p>
    );
  }

  // Only act on rows that are on screen — the selection can outlive a filter or page change.
  const selectedIds = accounts.filter((a) => selected.has(a.id)).map((a) => a.id);
  const count = selectedIds.length;
  const allSelected = count === accounts.length;
  const plural = count === 1 ? "" : "s";

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

  function clearSelection() {
    setSelected(new Set());
    setMode("idle");
    setRejectNote("");
    setError(null);
  }

  function run(action: () => Promise<ActionResult>, fallbackError: string) {
    setError(null);
    startWork(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? fallbackError);
        setMode("idle");
        return;
      }
      clearSelection();
      router.refresh();
    });
  }

  const barButton = "rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-[var(--surface)] disabled:opacity-60";

  return (
    // overflow-clip (not -hidden): it still rounds the corners but, unlike
    // hidden, lets the selection bar below stay stuck under the top bar while
    // a long list scrolls. The bar's z-index sits above the table header
    // (z-10) and below the top bar and its menu (z-20).
    <div className="card animate-fade-in-up overflow-clip rounded-xl border" style={{ borderColor: "var(--border)" }}>
      {count > 0 ? (
        <div
          className="sticky top-16 z-[15] flex flex-wrap items-center gap-3 border-b px-4 py-3 text-sm"
          style={{
            borderColor: "var(--border)",
            background: mode === "idle" ? "var(--primary-soft)" : "var(--danger-bg)",
          }}
        >
          {mode === "delete" ? (
            <>
              <span className="font-medium" style={{ color: "var(--danger)" }}>
                Delete {count} ID{plural}? This can&apos;t be undone — stored credentials are deleted with them.
              </span>
              <div className="ml-auto flex shrink-0 gap-2">
                <button type="button" onClick={() => setMode("idle")} disabled={isWorking} className={barButton} style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => run(() => deleteAccountsAction(selectedIds), "Failed to delete.")}
                  disabled={isWorking}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60"
                  style={{ background: "var(--danger)", color: "var(--danger-contrast)" }}
                >
                  {isWorking ? "Deleting…" : "Yes, delete"}
                </button>
              </div>
            </>
          ) : mode === "reject" ? (
            <>
              <label htmlFor="bulk-reject-note" className="font-medium" style={{ color: "var(--danger)" }}>
                Reject {count} ID{plural} — reason
              </label>
              <input
                id="bulk-reject-note"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                maxLength={500}
                placeholder="Optional, shown to the supplier"
                className="h-9 min-w-[200px] flex-1 rounded-lg border px-3 text-sm"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              />
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => setMode("idle")} disabled={isWorking} className={barButton} style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => run(() => setAccountsStatusAction(selectedIds, "rejected", rejectNote), "Failed to reject.")}
                  disabled={isWorking}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60"
                  style={{ background: "var(--danger)", color: "var(--danger-contrast)" }}
                >
                  {isWorking ? "Rejecting…" : "Reject"}
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="font-medium" style={{ color: "var(--primary)" }}>
                {count} selected
              </span>

              <button
                type="button"
                onClick={() => run(() => setAccountsStatusAction(selectedIds, "active"), "Failed to update.")}
                disabled={isWorking}
                className={`${barButton} flex items-center gap-1.5`}
                style={{ borderColor: "var(--success)", color: "var(--success)", background: "var(--surface)" }}
              >
                <Check size={14} />
                Set active
              </button>
              <button
                type="button"
                onClick={() => setMode("reject")}
                disabled={isWorking}
                className={`${barButton} flex items-center gap-1.5`}
                style={{ borderColor: "var(--danger)", color: "var(--danger)", background: "var(--surface)" }}
              >
                <X size={14} />
                Reject
              </button>

              {buyers.length > 0 ? (
                <div className="flex items-center gap-2">
                  <label htmlFor="bulk-assign" className="sr-only">
                    Assign selected IDs to
                  </label>
                  <select
                    id="bulk-assign"
                    value={bulkBuyer}
                    onChange={(e) => setBulkBuyer(e.target.value)}
                    className="h-9 rounded-lg border px-2 text-sm"
                    style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                  >
                    <option value="">Assign to…</option>
                    {buyers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => run(() => assignAccountsAction(selectedIds, bulkBuyer), "Failed to assign.")}
                    disabled={isWorking || !bulkBuyer}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                    style={{ background: "var(--primary)", color: "var(--primary-contrast)" }}
                  >
                    {isWorking ? "Working…" : "Assign"}
                  </button>
                </div>
              ) : null}

              <div className="ml-auto flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={clearSelection}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-[var(--surface)]"
                  style={{ color: "var(--muted)" }}
                >
                  <X size={14} />
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setMode("delete")}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-[var(--danger-bg)]"
                  style={{ color: "var(--danger)" }}
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="animate-fade-in-up border-b px-4 py-2 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--danger-bg)", color: "var(--danger)" }}
        >
          {error}
        </p>
      ) : null}

      {/* Phones, tablets and narrow windows: one card per ID. Same data and
          same controls as the table below, which needs a wide screen. */}
      <div className="xl:hidden">
        <label
          className="flex items-center gap-3 border-b px-4 py-3 text-sm font-medium"
          style={{ borderColor: "var(--border)", background: "var(--surface-muted)", color: "var(--muted)" }}
        >
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="h-5 w-5 rounded accent-[var(--primary)]"
          />
          Select all on this page
        </label>
        <ul>
          {accounts.map((account) => (
            <li
              key={account.id}
              className="flex flex-col gap-3 border-b p-4 last:border-0"
              style={{
                borderColor: "var(--border)",
                background: selected.has(account.id) ? "var(--primary-soft)" : "var(--surface)",
              }}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  aria-label={`Select ${account.loginIdentifier}`}
                  checked={selected.has(account.id)}
                  onChange={() => toggleOne(account.id)}
                  className="mt-0.5 h-5 w-5 shrink-0 rounded accent-[var(--primary)]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 font-medium" style={{ color: "var(--foreground)" }}>
                      {account.supplierName}
                    </p>
                    <StatusBadge status={account.status} />
                  </div>
                  <p className="mt-1 font-mono text-sm break-all" style={{ color: "var(--foreground)" }}>
                    {account.loginIdentifier}
                  </p>
                  <p className="mt-1 text-xs break-all" style={{ color: "var(--muted)" }}>
                    {account.upiId ?? "No UPI ID"} · Given {formatDate(account.createdAt)}
                  </p>
                  {account.status === "rejected" && account.rejectionNote ? (
                    <p className="mt-2 rounded-lg px-3 py-2 text-xs" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
                      {account.rejectionNote}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 pl-8">
                <AssignSelect
                  accountId={account.id}
                  assignedTo={account.assignedTo}
                  buyers={buyers}
                  label={`Media buyer for ${account.loginIdentifier}`}
                />
                <Link
                  href={`${basePath}/${account.id}`}
                  className="-my-2 shrink-0 py-2 text-sm font-medium hover:opacity-70"
                  style={{ color: "var(--primary)" }}
                >
                  View<span className="sr-only"> {account.loginIdentifier}</span>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative hidden overflow-x-auto xl:block">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="sticky top-0 z-10 border-b text-left"
              style={{ borderColor: "var(--border)", background: "var(--surface-muted)" }}
            >
              <th scope="col" className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Select all IDs on this page"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded accent-[var(--primary)]"
                />
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }}>
                Supplier
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }}>
                Facebook login
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }}>
                Status
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }}>
                Media buyer
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
                    aria-label={`Select ${account.loginIdentifier}`}
                    checked={selected.has(account.id)}
                    onChange={() => toggleOne(account.id)}
                    className="h-4 w-4 rounded accent-[var(--primary)]"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <div className="font-medium" style={{ color: "var(--foreground)" }}>
                    {account.supplierName}
                  </div>
                  <div className="font-mono text-xs" style={{ color: "var(--muted)" }}>
                    {account.upiId ?? "No UPI ID"}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="font-mono text-xs whitespace-nowrap" style={{ color: "var(--foreground)" }}>
                    {account.loginIdentifier}
                  </div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>
                    Given {formatDate(account.createdAt)}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={account.status} />
                  {account.status === "rejected" && account.rejectionNote ? (
                    <div className="mt-1 max-w-[220px] truncate text-xs" style={{ color: "var(--muted)" }} title={account.rejectionNote}>
                      {account.rejectionNote}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-2.5">
                  <AssignSelect
                    accountId={account.id}
                    assignedTo={account.assignedTo}
                    buyers={buyers}
                    label={`Media buyer for ${account.loginIdentifier}`}
                  />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link href={`${basePath}/${account.id}`} className="font-medium hover:opacity-70" style={{ color: "var(--primary)" }}>
                    View<span className="sr-only"> {account.loginIdentifier}</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

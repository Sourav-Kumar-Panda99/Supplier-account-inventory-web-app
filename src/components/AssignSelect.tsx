"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignAccountsAction } from "@/app/actions/accounts";
import type { BuyerOption } from "@/components/AccountFilterForm";

/**
 * Pick a media buyer by name and the ID is assigned straight away — no
 * separate save button. Choosing "Not assigned" takes it back.
 *
 * This is only the control: assignAccountsAction re-checks on the server that
 * the caller is an admin and that the chosen id really is a media buyer.
 */
export function AssignSelect({
  accountId,
  assignedTo,
  buyers,
  label,
}: {
  accountId: string;
  assignedTo: string | null;
  buyers: BuyerOption[];
  label: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Bumped after a failed attempt so the menu snaps back to the saved value.
  const [resetCount, setResetCount] = useState(0);

  // Someone who is no longer a media buyer may still be recorded on an old ID.
  const unknownAssignee = assignedTo && !buyers.some((b) => b.id === assignedTo);

  function handleChange(buyerId: string) {
    setError(null);
    startTransition(async () => {
      const result = await assignAccountsAction([accountId], buyerId);
      if (!result.ok) {
        setError(result.error ?? "Could not assign.");
        setResetCount((n) => n + 1);
        return;
      }
      router.refresh();
    });
  }

  if (buyers.length === 0 && !assignedTo) {
    return <span className="text-xs" style={{ color: "var(--muted)" }}>No media buyers yet</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      {/* Uncontrolled, re-created whenever the saved assignment changes: the
          menu shows the new choice immediately, and the server's answer
          (arriving via router.refresh) is what it settles on. */}
      <select
        key={`${assignedTo ?? ""}:${resetCount}`}
        aria-label={label}
        defaultValue={assignedTo ?? ""}
        disabled={isPending}
        onChange={(e) => handleChange(e.target.value)}
        className="h-9 max-w-[180px] rounded-lg border px-2 text-sm disabled:opacity-60"
        style={{
          borderColor: assignedTo ? "var(--border)" : "var(--border-strong)",
          background: "var(--surface)",
          color: assignedTo ? "var(--foreground)" : "var(--muted)",
        }}
      >
        <option value="">Not assigned</option>
        {unknownAssignee ? <option value={assignedTo}>Former media buyer</option> : null}
        {buyers.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      {error ? (
        <span role="alert" className="text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

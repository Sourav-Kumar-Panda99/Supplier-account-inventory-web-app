"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X } from "lucide-react";
import { changeSecretAction } from "@/app/actions/secrets";
import { CopyValue } from "@/components/CopyValue";
import type { SecretType } from "@/lib/types";

/**
 * One stored credential of an ID (Facebook password, Outlook password or 2FA
 * key): shown as plain text with Copy, plus a Change button that opens an
 * inline form. Saving calls changeSecretAction, which checks on the server
 * that the person is an admin or the media buyer this ID is assigned to.
 */
export function SecretEditor({
  accountId,
  secretType,
  label,
  value,
  unreadable,
}: {
  accountId: string;
  secretType: SecretType;
  label: string;
  value: string | null | undefined;
  unreadable?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const inputId = `secret-${secretType}`;

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(timer);
  }, [saved]);

  function open() {
    setDraft(value ?? "");
    setError(null);
    setSaved(false);
    setEditing(true);
  }

  function save() {
    setError(null);
    startSaving(async () => {
      const formData = new FormData();
      formData.set("value", draft);
      const result = await changeSecretAction(accountId, secretType, formData);
      if (!result.ok) {
        setError(result.error ?? "Could not save. Please try again.");
        return;
      }
      setEditing(false);
      setSaved(true);
      router.refresh();
    });
  }

  const smallButton =
    "flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-[var(--surface-muted)] hover:border-[var(--border-strong)] disabled:opacity-60";

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={editing ? inputId : undefined} className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
          {label}
        </label>
        <div className="flex items-center gap-3">
          {saved ? (
            <span role="status" className="animate-fade-in flex items-center gap-1 text-xs font-medium" style={{ color: "var(--success)" }}>
              <Check size={12} aria-hidden />
              Saved
            </span>
          ) : null}
          {!editing ? (
            <button
              type="button"
              onClick={open}
              className="-my-1 flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium hover:bg-[var(--primary-soft)]"
              style={{ color: "var(--primary)" }}
            >
              <Pencil size={12} aria-hidden />
              {value ? "Change" : "Add"}
              <span className="sr-only"> {label}</span>
            </button>
          ) : null}
        </div>
      </div>

      {editing ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <input
            id={inputId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={500}
            placeholder={`New ${label.toLowerCase()}`}
            className="h-9 min-w-0 flex-1 rounded-lg border px-3 font-mono text-sm"
            style={{ borderColor: "var(--primary)", background: "var(--surface)", color: "var(--foreground)" }}
          />
          <button
            type="submit"
            disabled={isSaving}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium shadow-sm hover:shadow-md disabled:opacity-60"
            style={{ background: "var(--primary)", color: "var(--primary-contrast)" }}
          >
            <Check size={14} aria-hidden />
            {isSaving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setError(null);
            }}
            disabled={isSaving}
            className={`${smallButton} h-9`}
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            <X size={14} aria-hidden />
            Cancel
          </button>
        </form>
      ) : (
        value ? (
          <CopyValue value={value} label={label} />
        ) : (
          <p className="py-1.5 text-sm italic" style={{ color: unreadable ? "var(--danger)" : "var(--muted)" }}>
            {unreadable ? "Stored, but it could not be decrypted." : "No value stored."}
          </p>
        )
      )}

      {error ? (
        <p role="alert" className="animate-fade-in-up text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

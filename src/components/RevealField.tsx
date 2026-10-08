"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import { copySecretAction, revealSecretAction } from "@/app/actions/secrets";
import type { SecretType } from "@/lib/types";
import { formatDate } from "@/lib/formatDate";

interface RevealFieldProps {
  accountId: string;
  secretType: SecretType;
  label: string;
  present: boolean;
  updatedAt: string | null;
}

/**
 * Admin-only masked credential field. Nothing decrypted ever sits in this
 * component's state longer than necessary: "Reveal" holds it in memory just
 * long enough to display (with a visible countdown, then auto re-mask), and
 * "Copy" never calls setState with the value at all — it goes straight from
 * the server response into the clipboard and is discarded.
 */
export function RevealField({ accountId, secretType, label, present, updatedAt }: RevealFieldProps) {
  const [value, setValue] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copying" | "copied" | "error">("idle");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function reMask() {
    setValue(null);
    setSecondsLeft(null);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden) reMask();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      reMask();
    };
  }, []);

  async function handleReveal() {
    setStatus("loading");
    setError(null);
    const result = await revealSecretAction(accountId, secretType);
    if (!result.ok || !result.value) {
      setStatus("error");
      setError(result.error ?? "Unable to reveal this value.");
      return;
    }
    setStatus("idle");
    setValue(result.value);
    const total = result.expiresInSeconds ?? 20;
    setSecondsLeft(total);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null || prev <= 1) {
          reMask();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleCopy() {
    setCopyStatus("copying");
    setError(null);
    const result = await copySecretAction(accountId, secretType);
    if (!result.ok || !result.value) {
      setCopyStatus("error");
      setError(result.error ?? "Unable to copy this value.");
      return;
    }
    try {
      await navigator.clipboard.writeText(result.value);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      setCopyStatus("error");
      setError("Clipboard access was blocked by the browser.");
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{label}</span>
        {present ? (
          <span className="text-xs text-[var(--muted)]">
            {updatedAt ? `Last set ${formatDate(updatedAt)}` : null}
          </span>
        ) : null}
      </div>

      {!present ? (
        <p className="text-sm text-[var(--muted)]" style={{ fontStyle: "italic" }}>
          No value stored.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <code
            key={value ? "revealed" : "masked"}
            className="animate-scale-in rounded-md border px-3 py-1.5 text-sm font-mono min-w-[14ch]"
            style={{
              borderColor: value ? "var(--primary)" : "var(--border)",
              background: "var(--surface-muted)",
            }}
            aria-live="polite"
          >
            {value ?? "•".repeat(14)}
          </code>

          {value && secondsLeft !== null ? (
            <span className="animate-fade-in text-xs text-[var(--muted)]">re-masking in {secondsLeft}s</span>
          ) : (
            <button
              type="button"
              onClick={handleReveal}
              disabled={status === "loading"}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-[var(--surface-muted)] hover:border-[var(--border-strong)] disabled:opacity-60"
              style={{ borderColor: "var(--border)" }}
            >
              <Eye size={14} />
              {status === "loading" ? "Revealing…" : "Reveal"}
            </button>
          )}

          {value && (
            <button
              type="button"
              onClick={reMask}
              className="animate-fade-in flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-[var(--surface-muted)] hover:border-[var(--border-strong)]"
              style={{ borderColor: "var(--border)" }}
            >
              <EyeOff size={14} />
              Hide
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            disabled={copyStatus === "copying"}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-[var(--surface-muted)] hover:border-[var(--border-strong)] disabled:opacity-60"
            style={{ borderColor: copyStatus === "copied" ? "var(--success)" : "var(--border)" }}
          >
            <span key={copyStatus} className="inline-flex items-center gap-1.5 animate-scale-in">
              {copyStatus === "copied" ? <Check size={14} /> : <Copy size={14} />}
              {copyStatus === "copied" ? "Copied" : copyStatus === "copying" ? "Copying…" : "Copy"}
            </span>
          </button>
        </div>
      )}

      {error ? (
        <p role="alert" className="animate-fade-in-up text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

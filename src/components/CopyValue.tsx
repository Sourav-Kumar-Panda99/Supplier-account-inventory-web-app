"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

/** A plain (non-secret) value with a copy button — e.g. a login email a media buyer needs to paste. */
export function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked by the browser — the value is on screen to copy by hand.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code
        className="rounded-md border px-3 py-1.5 font-mono text-sm break-all"
        style={{ borderColor: "var(--border)", background: "var(--surface-muted)" }}
      >
        {value}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy ${label}`}
        className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-[var(--surface-muted)] hover:border-[var(--border-strong)]"
        style={{ borderColor: copied ? "var(--success)" : "var(--border)" }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

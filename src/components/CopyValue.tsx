"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

<<<<<<< HEAD
/** A plain (non-secret) value with a copy button — e.g. a login email a media buyer needs to paste. */
=======
/** A value shown as plain text with a copy button — a login email, password, temp mail or 2FA key. */
>>>>>>> 45768fe (Update existing file)
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
<<<<<<< HEAD
    <div className="flex flex-wrap items-center gap-2">
      <code
        className="rounded-md border px-3 py-1.5 font-mono text-sm break-all"
=======
    <div className="flex min-w-0 items-start gap-2">
      <code
        className="min-w-0 rounded-md border px-3 py-1.5 font-mono text-sm break-all"
>>>>>>> 45768fe (Update existing file)
        style={{ borderColor: "var(--border)", background: "var(--surface-muted)" }}
      >
        {value}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy ${label}`}
<<<<<<< HEAD
        className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-[var(--surface-muted)] hover:border-[var(--border-strong)]"
=======
        className="flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-[var(--surface-muted)] hover:border-[var(--border-strong)]"
>>>>>>> 45768fe (Update existing file)
        style={{ borderColor: copied ? "var(--success)" : "var(--border)" }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

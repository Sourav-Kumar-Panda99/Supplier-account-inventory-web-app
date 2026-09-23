"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordField({
  id,
  name,
  placeholder,
}: {
  id: string;
  name: string;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete="new-password"
        placeholder={placeholder}
        className="w-full rounded-lg border px-3 py-2.5 pr-10 text-sm font-mono"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide value" : "Show value"}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center hover:opacity-70"
        style={{ color: "var(--muted)" }}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

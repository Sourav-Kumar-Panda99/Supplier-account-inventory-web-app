"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

<<<<<<< HEAD
=======
/**
 * A password input that shows what is typed by default (so it can be checked
 * before submitting), with an eye button to hide it.
 */
>>>>>>> 45768fe (Update existing file)
export function PasswordField({
  id,
  name,
  placeholder,
<<<<<<< HEAD
=======
  required,
  autoComplete = "new-password",
  defaultVisible = true,
>>>>>>> 45768fe (Update existing file)
}: {
  id: string;
  name: string;
  placeholder?: string;
<<<<<<< HEAD
}) {
  const [visible, setVisible] = useState(false);
=======
  required?: boolean;
  autoComplete?: string;
  defaultVisible?: boolean;
}) {
  const [visible, setVisible] = useState(defaultVisible);
>>>>>>> 45768fe (Update existing file)

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
<<<<<<< HEAD
        autoComplete="new-password"
=======
        required={required}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
>>>>>>> 45768fe (Update existing file)
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border px-3 pr-10 text-sm font-mono"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
<<<<<<< HEAD
        aria-label={visible ? "Hide value" : "Show value"}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center hover:opacity-70"
=======
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center hover:opacity-70"
>>>>>>> 45768fe (Update existing file)
        style={{ color: "var(--muted)" }}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

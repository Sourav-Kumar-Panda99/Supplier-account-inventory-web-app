"use client";

import { useActionState, type CSSProperties, type ReactNode } from "react";
import type { ActionResult } from "@/lib/types";

const DEFAULT_STATE: ActionResult = { ok: false };

/**
 * Thin wrapper around useActionState for forms that call a Server Action
 * returning the shared ActionResult shape and just need to surface an
 * error — status buttons, sign-in, supplier creation.
 *
 * children must be plain JSX (built by the caller, often a Server
 * Component), not a render-prop function — functions can't be passed as
 * children across the Server->Client Component boundary. Pending state for
 * the submit button comes from SubmitButton's own useFormStatus() instead.
 */
export function ActionForm({
  action,
  initialState = DEFAULT_STATE,
  className,
  style,
  children,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  initialState?: ActionResult;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const [state, formAction] = useActionState(async (_prev: ActionResult, formData: FormData) => {
    return action(formData);
  }, initialState);

  return (
    <form action={formAction} className={className} style={style}>
      {state.error ? (
        <p role="alert" className="animate-fade-in-up mb-2 rounded-md px-3 py-2 text-sm" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
          {state.error}
        </p>
      ) : null}
      {children}
    </form>
  );
}

"use client";

import { useFormStatus } from "react-dom";
import type { CSSProperties, ReactNode } from "react";

/**
 * Must be rendered inside a <form>. Reads pending state via useFormStatus
 * instead of having it threaded down through props — that's what lets the
 * form built by ActionForm live as plain server-rendered JSX children
 * rather than a render-prop function (functions can't cross the
 * Server->Client Component boundary as children; elements can).
 */
export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  className,
  style,
}: {
  children: ReactNode;
  pendingLabel?: ReactNode;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={disabled || pending} className={className} style={style}>
      {pending ? pendingLabel ?? children : children}
    </button>
  );
}

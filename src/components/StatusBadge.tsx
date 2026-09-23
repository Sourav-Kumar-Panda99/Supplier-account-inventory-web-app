import type { AccountStatus } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";

const STYLES: Record<AccountStatus, { bg: string; fg: string }> = {
  pending: { bg: "var(--info-bg)", fg: "var(--info)" },
  active: { bg: "var(--success-bg)", fg: "var(--success)" },
  needs_review: { bg: "var(--warning-bg)", fg: "var(--warning)" },
  archived: { bg: "var(--surface-muted)", fg: "var(--muted)" },
};

export function StatusBadge({ status }: { status: AccountStatus }) {
  const style = STYLES[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"
      style={{ background: style.bg, color: style.fg }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: style.fg }} aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}

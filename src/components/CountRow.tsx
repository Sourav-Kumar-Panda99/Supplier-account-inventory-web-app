export interface CountItem {
  label: string;
  value: number;
  /** CSS colour used for the number when it is above zero, e.g. "var(--success)". */
  tone?: string;
}

/**
 * A compact row of labelled numbers for the phone "card" layouts — the same
 * figures a table row shows on a wide screen. The label comes first in the
 * markup (so it reads "Accepted 2") and is shown under the number.
 */
export function CountRow({ items }: { items: CountItem[] }) {
  return (
    <dl className="grid gap-2 text-center" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((item) => (
        <div
          key={item.label}
          className="flex flex-col-reverse rounded-lg px-1 py-2"
          style={{ background: "var(--surface-muted)" }}
        >
          <dt className="text-[11px] leading-tight" style={{ color: "var(--muted)" }}>
            {item.label}
          </dt>
          <dd
            className="text-base font-semibold tabular-nums"
            style={{ color: item.value > 0 && item.tone ? item.tone : "var(--foreground)" }}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

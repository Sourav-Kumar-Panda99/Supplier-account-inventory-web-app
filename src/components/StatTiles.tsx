import Link from "next/link";
import type { ReactNode } from "react";

export interface StatTile {
  label: string;
  value: number;
  icon: ReactNode;
  href?: string;
  /** CSS colour for the icon chip, e.g. "var(--success)". Defaults to the primary colour. */
  tone?: string;
  toneBg?: string;
}

/** A row of count tiles. Icons are passed as rendered elements so this works from Server Components. */
export function StatTiles({ tiles }: { tiles: StatTile[] }) {
  // Up to four tiles sit in one row; more than that wrap in threes until there is room for six across.
  const columns = tiles.length <= 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6";

  return (
    <div className={`stagger grid gap-4 ${columns}`}>
      {tiles.map((tile) => {
        const body = (
          <>
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: tile.toneBg ?? "var(--primary-soft)", color: tile.tone ?? "var(--primary)" }}
            >
              {tile.icon}
            </span>
            <div>
              <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--foreground)" }}>
                {tile.value}
              </p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {tile.label}
              </p>
            </div>
          </>
        );
        const className = "card animate-fade-in-up flex flex-col gap-3 rounded-2xl border p-5";
        const style = { background: "var(--surface)", borderColor: "var(--border)" };

        return tile.href ? (
          <Link key={tile.label} href={tile.href} className={`${className} card-interactive`} style={style}>
            {body}
          </Link>
        ) : (
          <div key={tile.label} className={className} style={style}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

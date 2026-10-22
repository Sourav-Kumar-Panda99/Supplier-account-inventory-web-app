import { UserPlus } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getSelfAddedByDay } from "@/lib/data/accounts";
import { formatDayKey } from "@/lib/day";

const th = "px-4 py-2.5 font-medium whitespace-nowrap";
const num = "px-4 py-2.5 text-right tabular-nums";
const cardStyle = { borderColor: "var(--border)", background: "var(--surface)" };

export default async function AddedByBuyersPage() {
  // Checked here as well as in the layout: a layout is not re-run on every
  // navigation, so each admin page protects its own data.
  await requireAdmin();
  const rows = await getSelfAddedByDay();

  // Per-buyer totals, from the same rows.
  const totals = new Map<string, { name: string; total: number }>();
  for (const r of rows) {
    const t = totals.get(r.buyerId) ?? { name: r.buyerName, total: 0 };
    t.total += r.count;
    totals.set(r.buyerId, t);
  }
  const perBuyer = [...totals.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const grandTotal = perBuyer.reduce((n, b) => n + b.total, 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
          Buyer-added IDs
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          IDs media buyers added for themselves — which media buyer added how many, and on which date. These are
          kept out of the main <strong>All IDs</strong> list.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="card rounded-xl border p-10 text-center text-sm" style={{ ...cardStyle, color: "var(--muted)" }}>
          No media buyer has added an ID of his own yet.
        </p>
      ) : (
        <>
          {/* Per-buyer totals */}
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              Totals by media buyer
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {perBuyer.map((b) => (
                <div key={b.name} className="card flex flex-col gap-2 rounded-2xl border p-5" style={cardStyle}>
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                  >
                    <UserPlus size={18} strokeWidth={2} />
                  </span>
                  <div>
                    <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--foreground)" }}>
                      {b.total}
                    </p>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>
                      {b.name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Day-by-day breakdown */}
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              Day by day
            </h2>

            {/* Phones: one card per entry. */}
            <ul className="flex flex-col gap-3 sm:hidden">
              {rows.map((r) => (
                <li key={`${r.buyerId}-${r.day}`} className="card flex items-center justify-between gap-3 rounded-xl border p-4" style={cardStyle}>
                  <div className="min-w-0">
                    <p className="font-medium" style={{ color: "var(--foreground)" }}>{r.buyerName}</p>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>{formatDayKey(r.day)}</p>
                  </div>
                  <span className="text-xl font-bold tabular-nums" style={{ color: "var(--foreground)" }}>{r.count}</span>
                </li>
              ))}
            </ul>

            {/* Wider screens: a table. */}
            <div className="card hidden overflow-hidden rounded-xl border sm:block" style={cardStyle}>
              <div className="relative overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left" style={{ borderColor: "var(--border)", background: "var(--surface-muted)", color: "var(--muted)" }}>
                      <th scope="col" className={th}>Date</th>
                      <th scope="col" className={th}>Media buyer</th>
                      <th scope="col" className={`${th} text-right`}>IDs added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={`${r.buyerId}-${r.day}`} className="border-b last:border-0 hover:bg-[var(--surface-muted)]" style={{ borderColor: "var(--border)" }}>
                        <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--foreground)" }}>{formatDayKey(r.day)}</td>
                        <td className="px-4 py-2.5" style={{ color: "var(--foreground)" }}>{r.buyerName}</td>
                        <td className={`${num} font-semibold`} style={{ color: "var(--foreground)" }}>{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t" style={{ borderColor: "var(--border)", background: "var(--surface-muted)" }}>
                      <td className="px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }} colSpan={2}>Total</td>
                      <td className={`${num} font-bold`} style={{ color: "var(--foreground)" }}>{grandTotal}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

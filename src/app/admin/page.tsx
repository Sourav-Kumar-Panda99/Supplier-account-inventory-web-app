import Link from "next/link";
import { Database, Clock, AlertTriangle, CheckCircle2, Archive } from "lucide-react";
import { getDashboardStats } from "@/lib/data/accounts";

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  const tiles = [
    { label: "Total accounts", value: stats.totalAccounts, href: "/admin/accounts", icon: Database },
    { label: "Pending review", value: stats.pending, href: "/admin/accounts?status=pending", icon: Clock },
    { label: "Needs review", value: stats.needsReview, href: "/admin/accounts?status=needs_review", icon: AlertTriangle },
    { label: "Active", value: stats.active, href: "/admin/accounts?status=active", icon: CheckCircle2 },
    { label: "Archived", value: stats.archived, href: "/admin/accounts?status=archived", icon: Archive },
  ];

  return (
    <div className="animate-fade-in-up flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
          Admin dashboard
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Overview of the supplier account inventory.
        </p>
      </div>

      <div className="stagger grid grid-cols-2 gap-4 sm:grid-cols-5">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className="card card-interactive animate-fade-in-up flex flex-col gap-3 rounded-2xl border p-5"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
            >
              <tile.icon size={18} strokeWidth={2} />
            </span>
            <div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                {tile.value}
              </p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {tile.label}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

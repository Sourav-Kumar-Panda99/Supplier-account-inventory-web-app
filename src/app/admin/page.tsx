import { Database, Clock, AlertTriangle, CheckCircle2, X, ListChecks } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getDashboardStats } from "@/lib/data/accounts";
import { StatTiles } from "@/components/StatTiles";

export default async function AdminDashboardPage() {
  // Checked here as well as in the layout: a layout is not re-run on every
  // navigation, so each admin page protects its own data.
  await requireAdmin();
  const stats = await getDashboardStats();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
          Admin dashboard
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Overview of every ID suppliers have given.
        </p>
      </div>

      <StatTiles
        tiles={[
          { label: "Total IDs", value: stats.totalAccounts, href: "/admin/accounts", icon: <Database size={18} strokeWidth={2} /> },
          { label: "Pending review", value: stats.pending, href: "/admin/accounts?status=pending", icon: <Clock size={18} strokeWidth={2} />, tone: "var(--warning)", toneBg: "var(--warning-bg)" },
          { label: "Waiting to assign", value: stats.waitingToAssign, href: "/admin/accounts?assigned=unassigned", icon: <AlertTriangle size={18} strokeWidth={2} />, tone: "var(--warning)", toneBg: "var(--warning-bg)" },
          { label: "Accepted", value: stats.accepted, href: "/admin/accounts?status=accepted", icon: <ListChecks size={18} strokeWidth={2} /> },
          { label: "Active", value: stats.active, href: "/admin/accounts?status=active", icon: <CheckCircle2 size={18} strokeWidth={2} />, tone: "var(--success)", toneBg: "var(--success-bg)" },
          { label: "Rejected", value: stats.rejected, href: "/admin/accounts?status=rejected", icon: <X size={18} strokeWidth={2} />, tone: "var(--danger)", toneBg: "var(--danger-bg)" },
        ]}
      />
    </div>
  );
}

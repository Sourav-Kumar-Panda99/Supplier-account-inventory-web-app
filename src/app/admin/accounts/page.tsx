import { Download } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { listAccounts, UNASSIGNED } from "@/lib/data/accounts";
import { listProfiles, displayName } from "@/lib/data/profiles";
import { AccountFilterForm } from "@/components/AccountFilterForm";
import { AccountTable } from "@/components/AccountTable";
import { Pagination } from "@/components/Pagination";
import { ACCOUNT_STATUSES } from "@/lib/types";
import { isDayKey } from "@/lib/day";
import type { AccountStatus } from "@/lib/types";

interface AdminAccountsSearchParams {
  search?: string;
  status?: string;
  assigned?: string;
  day?: string;
  page?: string;
}

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<AdminAccountsSearchParams>;
}) {
  // Checked here as well as in the layout: a layout is not re-run on every
  // navigation, so each admin page protects its own data.
  await requireAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const status = ACCOUNT_STATUSES.includes(params.status as AccountStatus) ? (params.status as AccountStatus) : undefined;
  const day = isDayKey(params.day) ? params.day : undefined;

  // Only what the table needs crosses to the browser: an id and a name.
  const buyers = (await listProfiles("media_buyer")).map((b) => ({ id: b.id, name: displayName(b) }));

  // The "assigned" filter comes from the URL — only accept a value we offered.
  const assigned =
    params.assigned === UNASSIGNED || buyers.some((b) => b.id === params.assigned) ? params.assigned : undefined;

  const { accounts, total } = await listAccounts({ search: params.search, status, assigned, day, page, pageSize: 20 });

  const exportHref = `/api/export/accounts?${new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([k, v]) => k !== "page" && v))
  ).toString()}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
            All IDs
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Accept or reject IDs and assign them to a media buyer. Tick several to do it in one go.
          </p>
        </div>
        <a
          href={exportHref}
          className="flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5"
          style={{ background: "var(--primary)", color: "var(--primary-contrast)" }}
          title="Excel file, one sheet per day, including decrypted passwords and 2FA — handle with care"
        >
          <Download size={16} />
          Export Excel (with credentials)
        </a>
      </div>

      <AccountFilterForm values={params} buyers={buyers} resetHref="/admin/accounts" />

      <AccountTable accounts={accounts} buyers={buyers} basePath="/admin/accounts" />

      <Pagination page={page} pageSize={20} total={total} searchParams={params as Record<string, string | undefined>} />
    </div>
  );
}

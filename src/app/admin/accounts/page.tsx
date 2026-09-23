import { Download } from "lucide-react";
import { listAccounts } from "@/lib/data/accounts";
import { AccountFilterForm } from "@/components/AccountFilterForm";
import { AccountTable } from "@/components/AccountTable";
import { Pagination } from "@/components/Pagination";
import type { AccountStatus } from "@/lib/types";

interface AdminAccountsSearchParams {
  search?: string;
  status?: string;
  age?: string;
  page?: string;
}

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<AdminAccountsSearchParams>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "1") || 1;

  const { accounts, total } = await listAccounts({
    search: params.search,
    status: params.status as AccountStatus | undefined,
    age: params.age,
    page,
    pageSize: 20,
  });

  const exportHref = `/api/export/accounts?${new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([k, v]) => k !== "page" && v))
  ).toString()}`;

  return (
    <div className="animate-fade-in-up flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
            All accounts
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Review, search, filter, and archive supplier accounts.
          </p>
        </div>
        <a
          href={exportHref}
          className="flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5"
          style={{ background: "var(--primary)", color: "var(--primary-contrast)" }}
          title="Exports metadata only — never credential values"
        >
          <Download size={16} />
          Export CSV (metadata only)
        </a>
      </div>

      <AccountFilterForm values={params} resetHref="/admin/accounts" />

      <AccountTable accounts={accounts} basePath="/admin/accounts" />

      <Pagination page={page} pageSize={20} total={total} searchParams={params as Record<string, string | undefined>} />
    </div>
  );
}

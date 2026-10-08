import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ListChecks, Lock, History, Users, X } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getAccount } from "@/lib/data/accounts";
import { listAuditLog } from "@/lib/data/audit";
import { listProfiles, displayName } from "@/lib/data/profiles";
import { updateAccountAction, setAccountStatusAction } from "@/app/actions/accounts";
import { AccountForm } from "@/components/AccountForm";
import { StatusBadge } from "@/components/StatusBadge";
import { RevealField } from "@/components/RevealField";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { AssignSelect } from "@/components/AssignSelect";
import { formatDateTime } from "@/lib/formatDate";
import { SECRET_LABELS, SECRET_TYPES, STATUS_LABELS } from "@/lib/types";
import type { AccountStatus } from "@/lib/types";

/**
 * The only one-click status an admin sets is "Active". Rejecting has its own
 * form (with a reason) below, and assigning to a media buyer is its own
 * section. Pending/Accepted/Archived are no longer set from here.
 */
const BUTTON_STATUSES: AccountStatus[] = ["active"];

export default async function AdminAccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string }>;
}) {
  // Checked here as well as in the layout: a layout is not re-run on every
  // navigation, so each admin page protects its own data.
  await requireAdmin();
  const { id } = await params;
  const { updated } = await searchParams;

  const [account, audit, buyerProfiles] = await Promise.all([
    getAccount(id),
    listAuditLog({ entityType: "account", entityId: id, pageSize: 15 }),
    listProfiles("media_buyer"),
  ]);

  if (!account) notFound();

  const buyers = buyerProfiles.map((b) => ({ id: b.id, name: displayName(b) }));
  const boundUpdate = updateAccountAction.bind(null, id);
  const boundReject = setAccountStatusAction.bind(null, id, "rejected");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link
        href="/admin/accounts"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium hover:opacity-70"
        style={{ color: "var(--muted)" }}
      >
        <ArrowLeft size={16} />
        Back to all IDs
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
            {account.supplierName} · {account.platform}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            {account.loginIdentifier}
            {account.upiId ? ` · UPI: ${account.upiId}` : ""}
          </p>
        </div>
        <StatusBadge status={account.status} />
      </div>

      {updated ? (
        <p role="status" className="animate-scale-in rounded-lg px-3 py-2 text-sm" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
          Changes saved.
        </p>
      ) : null}

      <section className="card rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold" style={{ color: "var(--foreground)" }}>
          <ListChecks size={16} style={{ color: "var(--primary)" }} />
          Status
        </h2>

        {account.status === "rejected" ? (
          <p className="mb-4 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
            <strong>Rejected{account.statusChangedByName ? ` by ${account.statusChangedByName}` : ""}.</strong>{" "}
            {account.rejectionNote ?? "No reason given."}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {BUTTON_STATUSES.map((status) => (
            <StatusButton key={status} accountId={id} status={status} active={account.status === status} />
          ))}
        </div>

        <ActionForm action={boundReject} className="mt-4 flex flex-col gap-2 border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <label htmlFor="note" className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            Reject with a reason
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="note"
              name="note"
              maxLength={500}
              defaultValue={account.status === "rejected" ? account.rejectionNote ?? "" : ""}
              placeholder="Optional — the supplier sees this"
              className="h-10 min-w-[220px] flex-1 rounded-lg border px-3 text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            />
            <SubmitButton
              pendingLabel="Saving…"
              className="flex h-10 items-center gap-1.5 rounded-lg border px-3.5 text-sm font-medium hover:bg-[var(--danger-bg)] disabled:opacity-60"
              style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
            >
              <X size={14} />
              {account.status === "rejected" ? "Update rejection" : "Reject"}
            </SubmitButton>
          </div>
        </ActionForm>

        <p className="mt-4 text-xs" style={{ color: "var(--muted)" }}>
          Given {formatDateTime(account.createdAt)}
          {account.createdByEmail ? ` by ${account.createdByEmail}` : ""}
          {account.statusChangedAt
            ? ` · Status last changed ${formatDateTime(account.statusChangedAt)}${account.statusChangedByName ? ` by ${account.statusChangedByName}` : ""}`
            : ""}
        </p>
      </section>

      <section className="card rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold" style={{ color: "var(--foreground)" }}>
          <Users size={16} style={{ color: "var(--primary)" }} />
          Media buyer
        </h2>
        <p className="mb-3 text-xs" style={{ color: "var(--muted)" }}>
          The media buyer you pick can see this ID&apos;s login details and mark it active or rejected.
        </p>
        <AssignSelect accountId={id} assignedTo={account.assignedTo} buyers={buyers} label="Media buyer for this ID" />
        {account.assignedTo && account.assignedAt ? (
          <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
            Assigned to {account.assignedToName ?? "a former media buyer"} on {formatDateTime(account.assignedAt)}
          </p>
        ) : null}
        {buyers.length === 0 ? (
          <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
            <Link href="/admin/users" className="font-medium" style={{ color: "var(--primary)" }}>
              Add a media buyer
            </Link>{" "}
            to start assigning IDs.
          </p>
        ) : null}
      </section>

      <section className="card rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold" style={{ color: "var(--foreground)" }}>
          <Lock size={16} style={{ color: "var(--primary)" }} />
          Credentials
        </h2>
        <p className="mb-4 text-xs" style={{ color: "var(--muted)" }}>
          Revealing or copying a value is logged with your identity, the record, and the field — every time.
        </p>
        <div className="flex flex-col gap-4">
          {SECRET_TYPES.map((type) => (
            <RevealField
              key={type}
              accountId={id}
              secretType={type}
              label={SECRET_LABELS[type]}
              present={account.secrets[type].present}
              updatedAt={account.secrets[type].updatedAt}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          Edit details
        </h2>
        <div className="card rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <AccountForm mode="edit" initial={account} action={boundUpdate} redirectTo={`/admin/accounts/${id}?updated=1`} />
        </div>
      </section>

      <section className="card rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold" style={{ color: "var(--foreground)" }}>
          <History size={16} style={{ color: "var(--primary)" }} />
          Activity on this record
        </h2>
        {audit.entries.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            No activity recorded yet.
          </p>
        ) : (
          <ul className="stagger flex flex-col gap-2 text-sm">
            {audit.entries.map((entry) => (
              <li key={entry.id} className="animate-fade-in-up flex flex-wrap items-center justify-between gap-2">
                <span style={{ color: "var(--foreground)" }}>
                  {entry.actorEmail ?? "Unknown"} — {entry.action}
                  {entry.secretType ? ` (${entry.secretType})` : ""}{" "}
                  <span style={{ color: "var(--muted)" }}>[{entry.outcome}]</span>
                </span>
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  {formatDateTime(entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusButton({ accountId, status, active }: { accountId: string; status: AccountStatus; active: boolean }) {
  const boundAction = setAccountStatusAction.bind(null, accountId, status);

  return (
    <ActionForm action={boundAction}>
      <SubmitButton
        disabled={active}
        className="h-10 rounded-lg border px-3.5 text-sm hover:shadow-sm disabled:opacity-50 disabled:hover:shadow-none"
        style={{
          borderColor: "var(--border)",
          color: active ? "var(--muted)" : "var(--foreground)",
          background: active ? "var(--surface-muted)" : "var(--surface)",
        }}
      >
        {active ? `Current: ${STATUS_LABELS[status]}` : `Set ${STATUS_LABELS[status]}`}
      </SubmitButton>
    </ActionForm>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ListChecks, Lock, CheckCircle2, X } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getAccountForBuyer } from "@/lib/data/accounts";
import { buyerReviewAction } from "@/app/actions/accounts";
import { StatusBadge } from "@/components/StatusBadge";
import { RevealField } from "@/components/RevealField";
import { CopyValue } from "@/components/CopyValue";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { buyerStatusLabel } from "@/lib/buyerLabels";
import { formatDateTime } from "@/lib/formatDate";
import { SECRET_LABELS, SECRET_TYPES } from "@/lib/types";

export default async function BuyerAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("media_buyer");
  const { id } = await params;

  // Returns null unless this ID is assigned to this buyer — an ID that
  // belongs to someone else looks exactly like one that doesn't exist.
  const account = await getAccountForBuyer(id, user.id);
  if (!account) notFound();

  const markActive = buyerReviewAction.bind(null, id, "active");
  const reject = buyerReviewAction.bind(null, id, "rejected");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link
        href="/buyer"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium hover:opacity-70"
        style={{ color: "var(--muted)" }}
      >
        <ArrowLeft size={16} />
        Back to my IDs
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold break-all" style={{ color: "var(--foreground)" }}>
            {account.loginIdentifier}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            {account.platform} ID
            {account.assignedAt ? ` · assigned to you ${formatDateTime(account.assignedAt)}` : ""}
          </p>
        </div>
        <StatusBadge status={account.status} label={buyerStatusLabel(account.status)} />
      </div>

      {account.status === "rejected" ? (
        <p role="status" className="rounded-lg px-3 py-2 text-sm" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
          <strong>Rejected.</strong> {account.rejectionNote ?? "No reason given."}
        </p>
      ) : null}

      <section className="card rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold" style={{ color: "var(--foreground)" }}>
          <Lock size={16} style={{ color: "var(--primary)" }} />
          Login details
        </h2>
        <p className="mb-4 text-xs" style={{ color: "var(--muted)" }}>
          Revealing or copying a password or 2FA key is logged with your name — every time.
        </p>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Facebook login email</span>
            <CopyValue value={account.loginIdentifier} label="Facebook login email" />
          </div>
          <RevealField
            accountId={id}
            secretType="password"
            label={SECRET_LABELS.password}
            present={account.secrets.password.present}
            updatedAt={account.secrets.password.updatedAt}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Outlook mail</span>
            {account.linkedEmail ? (
              <CopyValue value={account.linkedEmail} label="Outlook mail" />
            ) : (
              <p className="text-sm italic" style={{ color: "var(--muted)" }}>No value stored.</p>
            )}
          </div>
          {SECRET_TYPES.filter((type) => type !== "password").map((type) => (
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

      <section className="card rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold" style={{ color: "var(--foreground)" }}>
          <ListChecks size={16} style={{ color: "var(--primary)" }} />
          Result of your check
        </h2>
        <p className="mb-4 text-xs" style={{ color: "var(--muted)" }}>
          You can change this later if the ID starts or stops working.
        </p>

        <div className="grid gap-6 sm:grid-cols-2">
          <ActionForm action={markActive} className="flex flex-col gap-2">
            <p className="text-sm" style={{ color: "var(--muted)" }}>The ID logs in and works.</p>
            <SubmitButton
              disabled={account.status === "active"}
              pendingLabel="Saving…"
              className="flex h-11 w-fit items-center gap-2 rounded-lg px-4 text-sm font-medium shadow-sm hover:shadow-md disabled:opacity-50 disabled:shadow-none"
              style={{ background: "var(--success)", color: "var(--success-contrast)" }}
            >
              <CheckCircle2 size={16} />
              {account.status === "active" ? "Marked active" : "Mark as active"}
            </SubmitButton>
          </ActionForm>

          <ActionForm action={reject} className="flex flex-col gap-2">
            <label htmlFor="note" className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              Why are you rejecting it? <span aria-hidden style={{ color: "var(--danger)" }}>*</span>
            </label>
            <textarea
              id="note"
              name="note"
              required
              rows={3}
              maxLength={500}
              defaultValue={account.status === "rejected" ? account.rejectionNote ?? "" : ""}
              placeholder="e.g. wrong password, checkpoint, disabled"
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            />
            <SubmitButton
              pendingLabel="Saving…"
              className="flex h-11 w-fit items-center gap-2 rounded-lg border px-4 text-sm font-medium hover:bg-[var(--danger-bg)] disabled:opacity-60"
              style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
            >
              <X size={16} />
              {account.status === "rejected" ? "Update rejection" : "Reject"}
            </SubmitButton>
          </ActionForm>
        </div>
      </section>
    </div>
  );
}

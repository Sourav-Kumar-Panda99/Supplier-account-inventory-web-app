import Link from "next/link";
import { CheckCircle2, PlusCircle, Info } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createOwnAccountAction } from "@/app/actions/accounts";
import { AccountForm } from "@/components/AccountForm";

export default async function BuyerNewAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  // Media-buyer only. The ID is filed under this buyer from the session.
  await requireRole("media_buyer");
  const { created } = await searchParams;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {created ? (
        <SubmittedConfirmation />
      ) : (
        <>
          <div>
            <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
              Add an ID
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              Add one of your own IDs. It&apos;s saved to your IDs as <strong>active</strong> — only you and an admin can see it.
            </p>
          </div>

          <p
            className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
            style={{ background: "var(--surface-muted)", color: "var(--muted)" }}
          >
            <Info size={16} className="mt-0.5 shrink-0" style={{ color: "var(--primary)" }} aria-hidden />
            <span>
              These are your own IDs, not ones a supplier submitted. They appear under{" "}
              <strong style={{ color: "var(--foreground)" }}>Added by me</strong> on your dashboard.
            </span>
          </p>

          <div className="card rounded-2xl border p-6" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <AccountForm mode="create" action={createOwnAccountAction} redirectTo="/buyer/accounts/new?created=1" />
          </div>
        </>
      )}
    </div>
  );
}

function SubmittedConfirmation() {
  return (
    <div
      className="card animate-scale-in flex flex-col items-center gap-4 rounded-2xl border p-10 text-center"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <span
        className="flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background: "var(--success-bg)", color: "var(--success)" }}
        aria-hidden
      >
        <CheckCircle2 size={28} strokeWidth={2} />
      </span>

      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          ID added
        </h1>
        <p className="mt-1 max-w-sm text-sm" style={{ color: "var(--muted)" }}>
          It&apos;s saved to your IDs as <strong>active</strong>. Add another, or go back to your list.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/buyer/accounts/new"
          className="flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5"
          style={{ background: "var(--primary)", color: "var(--primary-contrast)" }}
        >
          <PlusCircle size={16} />
          Add another ID
        </Link>
        <Link
          href="/buyer/added"
          className="flex h-11 items-center rounded-lg border px-5 text-sm font-medium hover:bg-[var(--surface-muted)]"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          See my added IDs
        </Link>
      </div>
    </div>
  );
}

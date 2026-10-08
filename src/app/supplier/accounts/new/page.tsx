import Link from "next/link";
import { CheckCircle2, PlusCircle } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAccountAction } from "@/app/actions/accounts";
import { AccountForm } from "@/components/AccountForm";
import { SecurityInfoCard } from "@/components/SecurityInfoCard";

export default async function SupplierNewAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const user = await requireRole("supplier");
  const { created } = await searchParams;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      <div className="flex-1">
        {created ? (
          <SubmittedConfirmation />
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
                  Submit an ID
                </h1>
                <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                  New IDs start as <strong>pending</strong>. You&apos;ll see on your dashboard when each one is accepted or rejected.
                </p>
              </div>
            </div>

            <div className="card rounded-2xl border p-6" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <AccountForm
                mode="create"
                action={createAccountAction}
                submitter={{ name: user.fullName ?? user.email, upiId: user.upiId }}
                redirectTo="/supplier/accounts/new?created=1"
              />
            </div>
          </>
        )}
      </div>

      <SecurityInfoCard />
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
          ID submitted
        </h1>
        <p className="mt-1 max-w-sm text-sm" style={{ color: "var(--muted)" }}>
          It&apos;s now <strong>pending</strong> until it has been checked. Have more IDs to add? Go ahead and submit
          another one.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/supplier/accounts/new"
          className="flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5"
          style={{ background: "var(--primary)", color: "var(--primary-contrast)" }}
        >
          <PlusCircle size={16} />
          Submit another ID
        </Link>
        <Link
          href="/supplier"
          className="flex h-11 items-center rounded-lg border px-5 text-sm font-medium hover:bg-[var(--surface-muted)]"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          Back to my dashboard
        </Link>
      </div>
    </div>
  );
}

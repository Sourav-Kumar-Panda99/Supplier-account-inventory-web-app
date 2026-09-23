import Link from "next/link";
import { CheckCircle2, PlusCircle } from "lucide-react";
import { createAccountAction } from "@/app/actions/accounts";
import { AccountForm } from "@/components/AccountForm";
import { SecurityInfoCard } from "@/components/SecurityInfoCard";

export default async function NewAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { created } = await searchParams;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      <div className="flex-1">
        {created ? <SubmittedConfirmation /> : <SubmitForm />}
      </div>

      <SecurityInfoCard />
    </div>
  );
}

function SubmitForm() {
  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
            Submit a supplier account
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            New accounts start as <strong>pending</strong> until an admin reviews them.
          </p>
        </div>
        <button
          type="submit"
          form="account-form"
          className="h-11 shrink-0 rounded-lg px-5 text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5"
          style={{ background: "var(--primary)", color: "var(--primary-contrast)" }}
        >
          Submit account
        </button>
      </div>

      <div className="card rounded-2xl border p-6" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <AccountForm mode="create" action={createAccountAction} redirectTo="/team/accounts/new?created=1" />
      </div>
    </>
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
          Account submitted
        </h1>
        <p className="mt-1 max-w-sm text-sm" style={{ color: "var(--muted)" }}>
          It&apos;s now <strong>pending</strong> until an admin reviews it. Have more accounts to add? Go ahead
          and submit another one.
        </p>
      </div>

      <Link
        href="/team/accounts/new"
        className="flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5"
        style={{ background: "var(--primary)", color: "var(--primary-contrast)" }}
      >
        <PlusCircle size={16} />
        Submit another account
      </Link>
    </div>
  );
}

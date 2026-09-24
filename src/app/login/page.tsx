import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { isDemoMode } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import { getDemoStore } from "@/lib/demo/store";
import { demoSignInAction, signInAction } from "@/app/actions/auth";
import { DemoBanner } from "@/components/DemoBanner";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { LoginBrandPanel } from "@/components/LoginBrandPanel";

const REASON_MESSAGES: Record<string, string> = {
  "signin-required": "Please sign in to continue.",
  "session-expired": "Your session has expired. Please sign in again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const existing = await getCurrentUser();
  if (existing) {
    redirect(existing.role === "admin" ? "/admin" : "/team/accounts/new");
  }

  const { reason } = await searchParams;
  const message = reason ? REASON_MESSAGES[reason] : undefined;

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--background)" }}>
      <DemoBanner />
      <div className="flex flex-1">
        <LoginBrandPanel />

        <main id="main-content" className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
          <div
            className="animate-scale-in card w-full max-w-sm rounded-2xl border p-8"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <Link
              href="/team/accounts/new"
              className="mb-4 inline-flex w-fit items-center gap-1.5 text-sm font-medium hover:opacity-70"
              style={{ color: "var(--muted)" }}
            >
              <ArrowLeft size={16} />
              Back to submit form
            </Link>

            <div
              className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl lg:hidden"
              style={{ background: "var(--primary)", color: "var(--primary-contrast)" }}
              aria-hidden
            >
              <ShieldCheck size={20} strokeWidth={2} />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
              Admin sign in
            </h1>
            <p className="mt-1 text-sm lg:hidden" style={{ color: "var(--muted)" }}>
              Supplier Account Inventory
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              Submitting a supplier account doesn&apos;t need an account — this sign-in is for reviewing and
              managing them.
            </p>

            {message ? (
              <p
                role="status"
                className="animate-fade-in mt-4 rounded-lg px-3 py-2 text-sm"
                style={{ background: "var(--info-bg)", color: "var(--info)" }}
              >
                {message}
              </p>
            ) : null}

            {isDemoMode ? <DemoSignIn /> : <LiveSignIn />}
          </div>
        </main>
      </div>
    </div>
  );
}

function LiveSignIn() {
  return (
    <ActionForm action={signInAction} className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          className="h-11 rounded-lg border px-3 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="h-11 rounded-lg border px-3 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        />
      </div>

      <SubmitButton
        pendingLabel="Signing in…"
        className="h-11 rounded-lg px-3 text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
        style={{ background: "var(--primary)", color: "var(--primary-contrast)" }}
      >
        Sign in
      </SubmitButton>
    </ActionForm>
  );
}

function DemoSignIn() {
  const store = getDemoStore();
  // Only admin profiles are offered here — team members never sign in at
  // all now, demo mode included.
  const adminProfiles = store.profiles.filter((profile) => profile.role === "admin");

  return (
    <div className="mt-6 flex flex-col gap-3">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        No Supabase project is configured, so sign-in is simulated. Pick a fictional demo admin to continue —
        this is not real authentication.
      </p>
      <div className="stagger flex flex-col gap-3">
        {adminProfiles.map((profile) => (
          <ActionForm key={profile.id} action={demoSignInAction} className="animate-fade-in-up">
            <input type="hidden" name="userId" value={profile.id} />
            <SubmitButton
              className="w-full rounded-lg border px-3 py-2.5 text-left text-sm hover:bg-[var(--surface-muted)] hover:border-[var(--border-strong)] hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
              style={{ borderColor: "var(--border)" }}
            >
              <span className="font-medium" style={{ color: "var(--foreground)" }}>
                {profile.fullName}
              </span>
              <br />
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                {profile.email}
              </span>
            </SubmitButton>
          </ActionForm>
        ))}
      </div>
    </div>
  );
}

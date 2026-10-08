import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { isDemoMode } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import { getDemoStore } from "@/lib/demo/store";
import { demoSignInAction, signInAction } from "@/app/actions/auth";
import { DemoBanner } from "@/components/DemoBanner";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { LoginBrandPanel } from "@/components/LoginBrandPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ROLE_HOME, ROLE_LABELS } from "@/lib/types";
import type { Role } from "@/lib/types";

const REASON_MESSAGES: Record<string, string> = {
  "signin-required": "Please sign in to continue.",
  "session-expired": "Your session has expired. Please sign in again.",
  "account-created": "Your account was created. Sign in to continue.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const existing = await getCurrentUser();
  if (existing) {
    redirect(ROLE_HOME[existing.role]);
  }

  const { reason } = await searchParams;
  const message = reason ? REASON_MESSAGES[reason] : undefined;

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--background)" }}>
      <DemoBanner />
      <div className="flex flex-1">
        <LoginBrandPanel />

        <main id="main-content" className="relative flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
          <ThemeToggle className="absolute right-3 top-3" />
          <div
            className="animate-scale-in card w-full max-w-sm rounded-2xl border p-8"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div
              className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl lg:hidden"
              style={{ background: "var(--primary)", color: "var(--primary-contrast)" }}
              aria-hidden
            >
              <ShieldCheck size={20} strokeWidth={2} />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
              Sign in
            </h1>
            <p className="mt-1 text-sm lg:hidden" style={{ color: "var(--muted)" }}>
              Supplier Account Inventory
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              Sign in to go to your own dashboard.
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

            <p className="mt-6 border-t pt-4 text-sm" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
              New supplier?{" "}
              <Link href="/signup" className="font-medium hover:opacity-70" style={{ color: "var(--primary)" }}>
                Create an account
              </Link>
            </p>
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

const DEMO_ROLE_ORDER: Role[] = ["admin", "media_buyer", "supplier"];

function DemoSignIn() {
  const store = getDemoStore();

  return (
    <div className="mt-6 flex flex-col gap-4">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        No Supabase project is configured, so sign-in is simulated. Pick a fictional demo user to continue —
        this is not real authentication.
      </p>
      {DEMO_ROLE_ORDER.map((role) => {
        const profiles = store.profiles.filter((profile) => profile.role === role);
        if (profiles.length === 0) return null;
        return (
          <div key={role} className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              {ROLE_LABELS[role]}
            </p>
            {profiles.map((profile) => (
              <ActionForm key={profile.id} action={demoSignInAction}>
                <input type="hidden" name="userId" value={profile.id} />
                <SubmitButton
                  className="w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-[var(--surface-muted)] hover:border-[var(--border-strong)] disabled:opacity-60"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span className="font-medium" style={{ color: "var(--foreground)" }}>
                    {profile.fullName ?? profile.email}
                  </span>
                  <br />
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    {profile.email}
                  </span>
                </SubmitButton>
              </ActionForm>
            ))}
          </div>
        );
      })}
    </div>
  );
}

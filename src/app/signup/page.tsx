import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { signUpSupplierAction } from "@/app/actions/auth";
import { DemoBanner } from "@/components/DemoBanner";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { PasswordField } from "@/components/PasswordField";
import { LoginBrandPanel } from "@/components/LoginBrandPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ROLE_HOME } from "@/lib/types";
import { MIN_PASSWORD_LENGTH } from "@/lib/validation";

const inputClass = "h-11 rounded-lg border px-3 text-sm";
const inputStyle = { borderColor: "var(--border)", background: "var(--surface)" };

/** Supplier self-signup. Media buyers are added by an admin; admins are promoted by hand. */
export default async function SignupPage() {
  const existing = await getCurrentUser();
  if (existing) {
    redirect(ROLE_HOME[existing.role]);
  }

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
              Create a supplier account
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              Sign up once, then submit your IDs and see which were accepted or rejected, day by day.
            </p>

            <ActionForm action={signUpSupplierAction} className="mt-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="fullName" className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                  Your name <span aria-hidden style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input id="fullName" name="fullName" required autoComplete="name" className={inputClass} style={inputStyle} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="upiId" className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                  UPI ID
                </label>
                <input id="upiId" name="upiId" placeholder="e.g. name@bank" autoComplete="off" className={inputClass} style={inputStyle} />
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  Where you want to be paid. You can change it later.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                  Email <span aria-hidden style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input id="email" name="email" type="email" required autoComplete="username" className={inputClass} style={inputStyle} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                  Password <span aria-hidden style={{ color: "var(--danger)" }}>*</span>
                </label>
                <PasswordField id="password" name="password" />
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  At least {MIN_PASSWORD_LENGTH} characters. This is the password for this site, not for any Facebook ID.
                </p>
              </div>

              <SubmitButton
                pendingLabel="Creating account…"
                className="h-11 rounded-lg px-3 text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
                style={{ background: "var(--primary)", color: "var(--primary-contrast)" }}
              >
                Create account
              </SubmitButton>
            </ActionForm>

            <p className="mt-6 border-t pt-4 text-sm" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
              Already have an account?{" "}
              <Link href="/login" className="font-medium hover:opacity-70" style={{ color: "var(--primary)" }}>
                Sign in
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/types";

export default async function UnauthorizedPage() {
  const user = await getCurrentUser();

  return (
    <main className="animate-fade-in-up flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center" style={{ background: "var(--background)" }}>
      <div
        className="animate-scale-in mb-2 flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: "var(--danger-bg)", color: "var(--danger)" }}
        aria-hidden
      >
        <ShieldAlert size={22} strokeWidth={2} />
      </div>
      <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
        You don&apos;t have access to this page
      </h1>
      <p className="max-w-md text-sm" style={{ color: "var(--muted)" }}>
        Your account isn&apos;t allowed to open this page. If you believe you should have access, ask an admin
        to update your role.
      </p>
      <Link
        href={user ? ROLE_HOME[user.role] : "/login"}
        className="mt-2 flex h-11 items-center rounded-lg px-4 text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5"
        style={{ background: "var(--primary)", color: "var(--primary-contrast)" }}
      >
        {user ? "Back to my dashboard" : "Sign in"}
      </Link>
    </main>
  );
}

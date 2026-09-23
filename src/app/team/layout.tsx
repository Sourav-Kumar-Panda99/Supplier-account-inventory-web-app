import type { ReactNode } from "react";
import { PublicHeader } from "@/components/PublicHeader";
import { DemoBanner } from "@/components/DemoBanner";

// No auth check here on purpose — submitting a new account requires no
// login. See src/app/actions/accounts.ts#createAccountAction for the
// (equally deliberate) server-side consequence of that.
export default function TeamLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--background)" }}>
      <DemoBanner />
      <PublicHeader />
      <main id="main-content" className="animate-fade-in-up mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

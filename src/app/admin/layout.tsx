import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";
import { TopBar } from "@/components/TopBar";
import { Sidebar } from "@/components/Sidebar";
import { DemoBanner } from "@/components/DemoBanner";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--background)" }}>
      <DemoBanner />
      <TopBar user={user} />
      <div className="flex flex-1 overflow-x-hidden">
        <Sidebar user={user} />
        <main id="main-content" className="animate-fade-in-up mx-auto w-full min-w-0 max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

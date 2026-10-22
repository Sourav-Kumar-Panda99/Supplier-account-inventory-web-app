import type { ReactNode } from "react";
import type { SessionUser } from "@/lib/auth";
import { TopBar } from "@/components/TopBar";
import { Sidebar } from "@/components/Sidebar";
import { DemoBanner } from "@/components/DemoBanner";

/**
 * The signed-in page frame shared by the admin, media buyer and supplier
 * areas. It only draws the frame — each area's layout is responsible for
 * calling requireRole() and passing the user it got back.
 */
export function RoleShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--background)" }}>
      <DemoBanner />
      <TopBar user={user} />
      <div className="flex flex-1 overflow-x-hidden">
        <Sidebar role={user.role} />
        <main id="main-content" className="animate-fade-in-up mx-auto w-full min-w-0 max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

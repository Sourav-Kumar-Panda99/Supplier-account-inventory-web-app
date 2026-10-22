import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";
import { RoleShell } from "@/components/RoleShell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();
  return <RoleShell user={user}>{children}</RoleShell>;
}

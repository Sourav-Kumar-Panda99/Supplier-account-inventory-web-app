import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth";
import { RoleShell } from "@/components/RoleShell";

export default async function SupplierLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("supplier");
  return <RoleShell user={user}>{children}</RoleShell>;
}

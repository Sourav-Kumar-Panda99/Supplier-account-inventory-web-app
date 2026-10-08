import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth";
import { RoleShell } from "@/components/RoleShell";

export default async function BuyerLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("media_buyer");
  return <RoleShell user={user}>{children}</RoleShell>;
}

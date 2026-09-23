import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function RootPage() {
  const user = await getCurrentUser();
  redirect(user?.role === "admin" ? "/admin" : "/team/accounts/new");
}

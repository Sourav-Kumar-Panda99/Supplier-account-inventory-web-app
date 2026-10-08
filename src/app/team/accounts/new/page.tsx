import { redirect } from "next/navigation";

/** Old link to the no-login submit form — submitting now needs a supplier login. */
export default function LegacyNewAccountPage() {
  redirect("/supplier/accounts/new");
}

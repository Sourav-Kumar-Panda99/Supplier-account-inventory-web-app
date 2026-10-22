import { redirect } from "next/navigation";

/** Old bookmarked/shared link — never reveals whether the id exists or belongs to anyone. */
export default function TeamAccountDetailPage() {
  redirect("/supplier");
}

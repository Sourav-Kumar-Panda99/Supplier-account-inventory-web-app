import { redirect } from "next/navigation";

/**
 * Team members have no account detail/edit view — that's admin-only now.
 * This route only exists so an old bookmarked/shared link doesn't 404; it
 * never reveals whether the id exists or belongs to anyone.
 */
export default function TeamAccountDetailPage() {
  redirect("/team/accounts/new");
}

import { redirect } from "next/navigation";

/**
 * Team members can only reach the submit flow — there is no account list or
 * detail view for them (that's admin-only now). This route only exists so
 * old links/bookmarks to /team land somewhere sensible instead of a 404.
 */
export default function TeamIndexPage() {
  redirect("/team/accounts/new");
}

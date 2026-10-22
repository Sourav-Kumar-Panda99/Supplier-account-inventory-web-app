import { redirect } from "next/navigation";

/**
 * The old no-login submit flow lived under /team. Suppliers now sign in and
 * work from /supplier; this route only exists so old links and bookmarks land
 * somewhere sensible instead of a 404.
 */
export default function TeamIndexPage() {
  redirect("/supplier");
}

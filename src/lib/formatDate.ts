/**
 * Pinned-locale date formatting. Using the runtime's default locale (plain
 * toLocaleDateString()) causes SSR/client hydration mismatches whenever the
 * server process and the browser resolve a different default locale —
 * pinning to "en-US" keeps server-rendered and client-rendered output
 * identical regardless of where either happens to run.
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "numeric", day: "numeric" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

import { APP_TIMEZONE } from "@/lib/day";

/**
 * Pinned-locale date formatting. Using the runtime's default locale (plain
 * toLocaleDateString()) causes SSR/client hydration mismatches whenever the
 * server process and the browser resolve a different default locale —
 * pinning to "en-US" (and to the app timezone, Asia/Kolkata) keeps
 * server-rendered and client-rendered output identical regardless of where
 * either happens to run, and on the same day as "today" in lib/day.ts.
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: APP_TIMEZONE, year: "numeric", month: "numeric", day: "numeric" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Time of day in the app timezone, e.g. "3:40 PM". */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: APP_TIMEZONE, hour: "numeric", minute: "2-digit" });
}

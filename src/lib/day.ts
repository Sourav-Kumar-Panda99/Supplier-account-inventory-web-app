/**
 * "Per day" everywhere in this app means the calendar day in this timezone —
 * the supplier dashboard and the Excel export must agree on which day an ID
 * belongs to, regardless of where the server happens to run.
 */
export const APP_TIMEZONE = "Asia/Kolkata";

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dayLabelFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** ISO timestamp -> "YYYY-MM-DD" in the app timezone. */
export function dayKey(iso: string): string {
  return dayKeyFormatter.format(new Date(iso));
}

/** "YYYY-MM-DD" -> "Thu, 8 Oct 2026". */
export function formatDayKey(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? day : dayLabelFormatter.format(date);
}

export function isDayKey(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * The UTC [start, end) that covers one calendar day in the app timezone, for
 * filtering a timestamptz column. Asia/Kolkata is a fixed +05:30 with no DST,
 * so the local day maps cleanly to a 24-hour UTC window.
 */
export function dayRangeUtc(day: string): { startISO: string; endISO: string } {
  const start = new Date(`${day}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

import type { AccountStatus } from "@/lib/types";

/**
 * How a status reads to a media buyer. An ID that an admin accepted and
 * handed over is simply one he still has to check.
 */
export function buyerStatusLabel(status: AccountStatus): string | undefined {
  return status === "pending" || status === "accepted" ? "To check" : undefined;
}

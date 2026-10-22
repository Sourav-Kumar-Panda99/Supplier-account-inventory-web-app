import { isDemoMode } from "@/lib/env";

export function DemoBanner() {
  if (!isDemoMode) return null;

  return (
    <div
      role="status"
      className="animate-slide-down w-full px-4 py-2 text-sm text-center border-b"
      style={{ background: "var(--warning-bg)", color: "var(--warning)", borderColor: "var(--border)" }}
    >
      <strong>Demo mode</strong> — Supabase is not configured, so this app is running on in-memory fictional
      data that resets on every restart. It is not persisted and not encrypted with a durable key. See{" "}
      <code>.env.example</code> and the README to connect a real Supabase project.
    </div>
  );
}

import "server-only";
import { isDemoMode } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDemoStore, newId } from "@/lib/demo/store";
import type { AuditLogEntry, SecretType } from "@/lib/types";

export interface WriteAuditLogInput {
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  secretType?: SecretType | null;
  outcome: "success" | "denied" | "error";
  /**
   * Free-form context for the log entry. NEVER put a secret value or
   * ciphertext in here — callers must not pass plaintext/ciphertext through
   * this field. This function does not attempt to scrub it.
   */
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  const entry: AuditLogEntry = {
    id: newId("audit"),
    actorId: input.actorId,
    actorEmail: input.actorEmail,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    secretType: input.secretType ?? null,
    outcome: input.outcome,
    metadata: input.metadata ?? {},
    createdAt: new Date().toISOString(),
  };

  if (isDemoMode) {
    const store = getDemoStore();
    store.auditLog.unshift(entry);
    store.auditLog.length = Math.min(store.auditLog.length, 500);
    return;
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("audit_log").insert({
    actor_id: entry.actorId,
    actor_email: entry.actorEmail,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    secret_type: entry.secretType,
    outcome: entry.outcome,
    metadata: entry.metadata,
  });

  if (error) {
    // Audit writes must never silently vanish. Surface to server logs (no
    // secret values ever pass through this path) so an operator notices.
    console.error("Failed to write audit log entry", error, { action: entry.action, entityType: entry.entityType });
  }
}

export interface AuditLogFilters {
  entityType?: string;
  entityId?: string;
  action?: string;
  outcome?: string;
  page?: number;
  pageSize?: number;
}

export async function listAuditLog(filters: AuditLogFilters = {}): Promise<{ entries: AuditLogEntry[]; total: number }> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;

  if (isDemoMode) {
    const store = getDemoStore();
    let entries = store.auditLog;
    if (filters.entityType) entries = entries.filter((e) => e.entityType === filters.entityType);
    if (filters.entityId) entries = entries.filter((e) => e.entityId === filters.entityId);
    if (filters.action) entries = entries.filter((e) => e.action === filters.action);
    if (filters.outcome) entries = entries.filter((e) => e.outcome === filters.outcome);
    const total = entries.length;
    const start = (page - 1) * pageSize;
    return { entries: entries.slice(start, start + pageSize), total };
  }

  const admin = createSupabaseAdminClient();
  let query = admin.from("audit_log").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (filters.entityType) query = query.eq("entity_type", filters.entityType);
  if (filters.entityId) query = query.eq("entity_id", filters.entityId);
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.outcome) query = query.eq("outcome", filters.outcome);
  const start = (page - 1) * pageSize;
  query = query.range(start, start + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to list audit log: ${error.message}`);

  return {
    entries: (data ?? []).map((row) => ({
      id: row.id,
      actorId: row.actor_id,
      actorEmail: row.actor_email,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      secretType: row.secret_type as SecretType | null,
      outcome: row.outcome as AuditLogEntry["outcome"],
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
    })),
    total: count ?? 0,
  };
}

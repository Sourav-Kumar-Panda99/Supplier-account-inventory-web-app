import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listAccounts } from "@/lib/data/accounts";
import { writeAuditLog } from "@/lib/data/audit";
import type { AccountStatus } from "@/lib/types";

const CSV_HEADERS = [
  "supplier_name",
  "upi_id",
  "platform",
  "login_identifier",
  "linked_email",
  "recovery_email",
  "profile_age",
  "status",
  "notes",
  "created_by",
  "updated_by",
  "created_at",
  "updated_at",
];

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Metadata-only CSV export. Deliberately excludes every credential field —
 * password/email_password never appear here, only whether one
 * is present would even be derivable from other fields, and this endpoint
 * doesn't include that either. Every export is audit-logged (no secret
 * values, obviously, since none are ever read here).
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    await writeAuditLog({
      actorId: user?.id ?? null,
      actorEmail: user?.email ?? null,
      action: "accounts.export_csv",
      entityType: "account",
      entityId: null,
      outcome: "denied",
      metadata: { reason: user ? "not_admin" : "unauthenticated" },
    });
    return NextResponse.json({ error: "Not authorized" }, { status: user ? 403 : 401 });
  }

  const { searchParams } = request.nextUrl;
  const { accounts, total } = await listAccounts({
    search: searchParams.get("search") ?? undefined,
    status: (searchParams.get("status") as AccountStatus | null) ?? undefined,
    age: searchParams.get("age") ?? undefined,
    page: 1,
    pageSize: 5000,
  });

  const rows = accounts.map((a) =>
    [
      a.supplierName,
      a.upiId ?? "",
      a.platform,
      a.loginIdentifier,
      a.linkedEmail ?? "",
      a.recoveryEmail ?? "",
      a.profileAge ?? "",
      a.status,
      a.notes ?? "",
      a.createdByEmail ?? "",
      a.updatedByEmail ?? "",
      a.createdAt,
      a.updatedAt,
    ]
      .map((v) => csvEscape(String(v)))
      .join(",")
  );

  const csv = [CSV_HEADERS.join(","), ...rows].join("\n");

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "accounts.export_csv",
    entityType: "account",
    entityId: null,
    outcome: "success",
    metadata: { rowCount: accounts.length, totalMatched: total, note: "metadata only — no credential fields" },
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="supplier-accounts-metadata-SENSITIVE-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

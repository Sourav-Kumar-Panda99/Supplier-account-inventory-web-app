import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/auth";
import { listAccounts, UNASSIGNED } from "@/lib/data/accounts";
import { writeAuditLog } from "@/lib/data/audit";
import { decryptSecretsForAccounts } from "@/lib/data/secrets";
import { APP_TIMEZONE, isDayKey } from "@/lib/day";
import { ACCOUNT_STATUSES, SECRET_LABELS, SECRET_TYPES, STATUS_LABELS, type Account, type AccountStatus } from "@/lib/types";

/** Accounts are grouped into one sheet per calendar day in this timezone. */
const EXPORT_TIMEZONE = APP_TIMEZONE;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: EXPORT_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: EXPORT_TIMEZONE,
  dateStyle: "medium",
  timeStyle: "short",
});

const COLUMNS: { header: string; key: string; width: number }[] = [
  { header: "Supplier name", key: "supplierName", width: 24 },
  { header: "UPI ID", key: "upiId", width: 22 },
  { header: "Platform", key: "platform", width: 12 },
  { header: "Facebook login email", key: "loginIdentifier", width: 30 },
  ...SECRET_TYPES.map((type) => ({ header: SECRET_LABELS[type], key: `secret_${type}`, width: 26 })),
  { header: "Outlook mail", key: "linkedEmail", width: 28 },
  { header: "Recovery email", key: "recoveryEmail", width: 28 },
  { header: "Profile age", key: "profileAge", width: 12 },
  { header: "Status", key: "status", width: 14 },
  { header: "Reject reason", key: "rejectionNote", width: 30 },
  { header: "Media buyer", key: "assignedTo", width: 22 },
  { header: "Notes", key: "notes", width: 30 },
  { header: "Created by", key: "createdBy", width: 26 },
  { header: "Submitted at", key: "createdAt", width: 22 },
  { header: "Updated at", key: "updatedAt", width: 22 },
];

/**
 * Admin-only Excel export with one sheet per day (by submission date) and
 * every credential DECRYPTED in plain text. The downloaded file is as
 * sensitive as the whole secrets table — every export is audit-logged.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    await writeAuditLog({
      actorId: user?.id ?? null,
      actorEmail: user?.email ?? null,
      action: "accounts.export_xlsx",
      entityType: "account",
      entityId: null,
      outcome: "denied",
      metadata: { reason: user ? "not_admin" : "unauthenticated" },
    });
    return NextResponse.json({ error: "Not authorized" }, { status: user ? 403 : 401 });
  }

  // Same filters as the admin list page. Values come from the URL, so only
  // well-formed ones are passed on.
  const { searchParams } = request.nextUrl;
  const statusParam = searchParams.get("status") as AccountStatus | null;
  const assignedParam = searchParams.get("assigned");
  const { accounts, total } = await listAccounts({
    search: searchParams.get("search") ?? undefined,
    status: statusParam && ACCOUNT_STATUSES.includes(statusParam) ? statusParam : undefined,
    assigned:
      assignedParam && (assignedParam === UNASSIGNED || UUID_RE.test(assignedParam) || assignedParam.startsWith("demo-"))
        ? assignedParam
        : undefined,
    age: searchParams.get("age") ?? undefined,
    day: isDayKey(searchParams.get("day") ?? undefined) ? (searchParams.get("day") as string) : undefined,
    page: 1,
    pageSize: 5000,
  });

  const secrets = await decryptSecretsForAccounts(accounts.map((a) => a.id));

  // Group by submission day, newest day first.
  const byDay = new Map<string, Account[]>();
  for (const account of accounts) {
    const day = dayFormatter.format(new Date(account.createdAt));
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(account);
  }
  const days = [...byDay.keys()].sort().reverse();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = user.email;
  workbook.created = new Date();

  for (const day of days) {
    const sheet = workbook.addWorksheet(day, { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.columns = COLUMNS;
    sheet.getRow(1).font = { bold: true };
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };

    const dayAccounts = byDay.get(day)!.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const a of dayAccounts) {
      const accountSecrets = secrets.get(a.id) ?? {};
      const row: Record<string, string> = {
        supplierName: a.supplierName,
        upiId: a.upiId ?? "",
        platform: a.platform,
        loginIdentifier: a.loginIdentifier,
        linkedEmail: a.linkedEmail ?? "",
        recoveryEmail: a.recoveryEmail ?? "",
        profileAge: a.profileAge ?? "",
        status: STATUS_LABELS[a.status] ?? a.status,
        rejectionNote: a.rejectionNote ?? "",
        assignedTo: a.assignedToName ?? "",
        notes: a.notes ?? "",
        createdBy: a.createdByEmail ?? "",
        createdAt: timeFormatter.format(new Date(a.createdAt)),
        updatedAt: timeFormatter.format(new Date(a.updatedAt)),
      };
      for (const type of SECRET_TYPES) {
        const value = accountSecrets[type];
        row[`secret_${type}`] = value === undefined ? "" : value === null ? "(could not decrypt)" : value;
      }
      sheet.addRow(row);
    }
  }

  if (days.length === 0) {
    const sheet = workbook.addWorksheet("No accounts");
    sheet.columns = COLUMNS;
    sheet.getRow(1).font = { bold: true };
  }

  const buffer = await workbook.xlsx.writeBuffer();

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "accounts.export_xlsx",
    entityType: "account",
    entityId: null,
    outcome: "success",
    metadata: { rowCount: accounts.length, totalMatched: total, days: days.length, includesDecryptedSecrets: true },
  });

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="supplier-accounts-CREDENTIALS-${dayFormatter.format(new Date())}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

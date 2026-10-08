import Link from "next/link";
import { PlusCircle, Users, Building2 } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getPeopleSummaries } from "@/lib/data/accounts";
import { listProfiles, displayName } from "@/lib/data/profiles";
import { createMediaBuyerAction } from "@/app/actions/users";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { PasswordField } from "@/components/PasswordField";
import { CountRow } from "@/components/CountRow";
import { MIN_PASSWORD_LENGTH } from "@/lib/validation";

const th = "px-4 py-2.5 font-medium whitespace-nowrap";
const num = "px-4 py-2.5 text-right tabular-nums";
const inputClass = "h-11 rounded-lg border px-3 text-sm";
const inputStyle = { borderColor: "var(--border)", background: "var(--surface)" };

export default async function AdminUsersPage() {
  // Checked here as well as in the layout: a layout is not re-run on every
  // navigation, so each admin page protects its own data.
  await requireAdmin();
  const [buyers, suppliers, summaries] = await Promise.all([
    listProfiles("media_buyer"),
    listProfiles("supplier"),
    getPeopleSummaries(),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
          Suppliers &amp; media buyers
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Suppliers sign up themselves. Media buyers are added here, by you.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          <Users size={18} style={{ color: "var(--primary)" }} />
          Media buyers
        </h2>

        <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
          <div className="card min-w-0 flex-1 overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            {buyers.length === 0 ? (
              <p className="p-8 text-center text-sm" style={{ color: "var(--muted)" }}>
                No media buyers yet. Add the first one to start assigning IDs.
              </p>
            ) : (
              <>
              <ul className="lg:hidden">
                {buyers.map((b) => {
                  const c = summaries.buyers.get(b.id) ?? { assigned: 0, toCheck: 0, active: 0, rejected: 0 };
                  return (
                    <li key={b.id} className="flex flex-col gap-3 border-b p-4 last:border-0" style={{ borderColor: "var(--border)" }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium" style={{ color: "var(--foreground)" }}>{displayName(b)}</p>
                          <p className="text-xs break-all" style={{ color: "var(--muted)" }}>{b.email}</p>
                        </div>
                        <Link href={`/admin/accounts?assigned=${b.id}`} className="-my-2 shrink-0 py-2 text-sm font-medium hover:opacity-70" style={{ color: "var(--primary)" }}>
                          View IDs<span className="sr-only"> assigned to {displayName(b)}</span>
                        </Link>
                      </div>
                      <CountRow
                        items={[
                          { label: "Assigned", value: c.assigned },
                          { label: "To check", value: c.toCheck, tone: "var(--warning)" },
                          { label: "Active", value: c.active, tone: "var(--success)" },
                          { label: "Rejected", value: c.rejected, tone: "var(--danger)" },
                        ]}
                      />
                    </li>
                  );
                })}
              </ul>
              <div className="relative hidden overflow-x-auto lg:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left" style={{ borderColor: "var(--border)", background: "var(--surface-muted)", color: "var(--muted)" }}>
                      <th scope="col" className={th}>Name</th>
                      <th scope="col" className={`${th} text-right`}>Assigned</th>
                      <th scope="col" className={`${th} text-right`}>To check</th>
                      <th scope="col" className={`${th} text-right`}>Active</th>
                      <th scope="col" className={`${th} text-right`}>Rejected</th>
                      <th scope="col" className={`${th} text-right`}><span className="sr-only">IDs</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {buyers.map((b) => {
                      const c = summaries.buyers.get(b.id) ?? { assigned: 0, toCheck: 0, active: 0, rejected: 0 };
                      return (
                        <tr key={b.id} className="border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                          <th scope="row" className="px-4 py-2.5 text-left font-normal">
                            <div className="font-medium" style={{ color: "var(--foreground)" }}>{displayName(b)}</div>
                            <div className="text-xs" style={{ color: "var(--muted)" }}>{b.email}</div>
                          </th>
                          <td className={`${num} font-semibold`} style={{ color: "var(--foreground)" }}>{c.assigned}</td>
                          <td className={num} style={{ color: c.toCheck ? "var(--warning)" : "var(--muted)" }}>{c.toCheck}</td>
                          <td className={num} style={{ color: c.active ? "var(--success)" : "var(--muted)" }}>{c.active}</td>
                          <td className={num} style={{ color: c.rejected ? "var(--danger)" : "var(--muted)" }}>{c.rejected}</td>
                          <td className="px-4 py-2.5 text-right">
                            <Link href={`/admin/accounts?assigned=${b.id}`} className="font-medium whitespace-nowrap hover:opacity-70" style={{ color: "var(--primary)" }}>
                              View IDs<span className="sr-only"> assigned to {displayName(b)}</span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>

          <div className="card w-full shrink-0 rounded-2xl border p-6 xl:max-w-sm" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <h3 className="flex items-center gap-2 text-base font-semibold" style={{ color: "var(--foreground)" }}>
              <PlusCircle size={16} style={{ color: "var(--primary)" }} />
              Add a media buyer
            </h3>
            <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
              Give them this email and password to sign in. They only ever see the IDs you assign to them.
            </p>
            <ActionForm action={createMediaBuyerAction} className="mt-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="fullName" className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Name</label>
                <input id="fullName" name="fullName" required autoComplete="off" className={inputClass} style={inputStyle} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Email</label>
                <input id="email" name="email" type="email" required autoComplete="off" className={inputClass} style={inputStyle} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Password</label>
                <PasswordField id="password" name="password" />
                <p className="text-xs" style={{ color: "var(--muted)" }}>At least {MIN_PASSWORD_LENGTH} characters.</p>
              </div>
              <SubmitButton
                pendingLabel="Adding…"
                className="h-11 rounded-lg px-3 text-sm font-medium shadow-sm hover:shadow-md disabled:opacity-60"
                style={{ background: "var(--primary)", color: "var(--primary-contrast)" }}
              >
                Add media buyer
              </SubmitButton>
            </ActionForm>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          <Building2 size={18} style={{ color: "var(--primary)" }} />
          Suppliers
        </h2>

        <div className="card overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          {suppliers.length === 0 ? (
            <p className="p-8 text-center text-sm" style={{ color: "var(--muted)" }}>
              No supplier has signed up yet. Send them the sign-up link: <code>/signup</code>
            </p>
          ) : (
            <>
            <ul className="lg:hidden">
              {suppliers.map((s) => {
                const c = summaries.suppliers.get(s.id) ?? { given: 0, pending: 0, accepted: 0, rejected: 0 };
                return (
                  <li key={s.id} className="flex flex-col gap-3 border-b p-4 last:border-0" style={{ borderColor: "var(--border)" }}>
                    <div className="min-w-0">
                      <p className="font-medium" style={{ color: "var(--foreground)" }}>{displayName(s)}</p>
                      <p className="text-xs break-all" style={{ color: "var(--muted)" }}>{s.email}</p>
                      <p className="mt-1 font-mono text-xs break-all" style={{ color: "var(--muted)" }}>UPI: {s.upiId ?? "not set"}</p>
                    </div>
                    <CountRow
                      items={[
                        { label: "Given", value: c.given },
                        { label: "Accepted", value: c.accepted, tone: "var(--success)" },
                        { label: "Rejected", value: c.rejected, tone: "var(--danger)" },
                        { label: "Pending", value: c.pending, tone: "var(--warning)" },
                      ]}
                    />
                  </li>
                );
              })}
            </ul>
            <div className="relative hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left" style={{ borderColor: "var(--border)", background: "var(--surface-muted)", color: "var(--muted)" }}>
                    <th scope="col" className={th}>Supplier</th>
                    <th scope="col" className={th}>UPI ID</th>
                    <th scope="col" className={`${th} text-right`}>Given</th>
                    <th scope="col" className={`${th} text-right`}>Accepted</th>
                    <th scope="col" className={`${th} text-right`}>Rejected</th>
                    <th scope="col" className={`${th} text-right`}>Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => {
                    const c = summaries.suppliers.get(s.id) ?? { given: 0, pending: 0, accepted: 0, rejected: 0 };
                    return (
                      <tr key={s.id} className="border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                        <th scope="row" className="px-4 py-2.5 text-left font-normal">
                          <div className="font-medium" style={{ color: "var(--foreground)" }}>{displayName(s)}</div>
                          <div className="text-xs" style={{ color: "var(--muted)" }}>{s.email}</div>
                        </th>
                        <td className="px-4 py-2.5 font-mono text-xs" style={{ color: "var(--muted)" }}>{s.upiId ?? "—"}</td>
                        <td className={`${num} font-semibold`} style={{ color: "var(--foreground)" }}>{c.given}</td>
                        <td className={num} style={{ color: c.accepted ? "var(--success)" : "var(--muted)" }}>{c.accepted}</td>
                        <td className={num} style={{ color: c.rejected ? "var(--danger)" : "var(--muted)" }}>{c.rejected}</td>
                        <td className={num} style={{ color: c.pending ? "var(--warning)" : "var(--muted)" }}>{c.pending}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

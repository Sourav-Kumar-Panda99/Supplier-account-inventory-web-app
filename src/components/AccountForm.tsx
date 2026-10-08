"use client";

import { useActionState, useEffect, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Building2, Wallet, AtSign, Mail, Clock, Lock } from "lucide-react";
import type { Account, SecretType } from "@/lib/types";
import { FIXED_PLATFORM, SECRET_LABELS } from "@/lib/types";
import { PasswordField } from "@/components/PasswordField";

export interface AccountFormActionResult {
  ok: boolean;
  error?: string;
  accountId?: string;
}

interface AccountFormProps {
  /**
   * "create" — a supplier submitting one of his own IDs. There is no supplier
   *            name / UPI field: those come from his profile on the server.
   * "edit"   — an admin editing a stored ID, including the supplier details
   *            that were copied onto it.
   */
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<AccountFormActionResult>;
  initial?: Partial<Account>;
  /** Create mode only: who the ID will be filed under, shown for reassurance. */
  submitter?: { name: string; upiId: string | null };
  redirectTo: string | ((result: AccountFormActionResult) => string);
}

const initialState: AccountFormActionResult = { ok: false };
const inputClass = "h-11 w-full rounded-lg border pl-9 pr-3 text-sm";
const inputStyle = { borderColor: "var(--border)", background: "var(--surface)" };

export function AccountForm({ mode, action, initial, submitter, redirectTo }: AccountFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(async (_prev: AccountFormActionResult, formData: FormData) => {
    return action(formData);
  }, initialState);

  useEffect(() => {
    if (state.ok) {
      router.push(typeof redirectTo === "string" ? redirectTo : redirectTo(state));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  // Each credential sits next to the login it belongs to. In edit mode a
  // blank field means "keep the stored value".
  const secretField = (type: SecretType) => {
    const present = initial?.secrets?.[type]?.present;
    return (
      <Field
        label={SECRET_LABELS[type]}
        htmlFor={`secret_${type}`}
        hint={mode === "edit" && present ? "A value is already stored — this will replace it." : undefined}
      >
        <PasswordField
          id={`secret_${type}`}
          name={`secret_${type}`}
          placeholder={mode === "edit" && present ? "•••••••• (unchanged)" : undefined}
        />
      </Field>
    );
  };

  return (
    <form id="account-form" action={formAction} className="animate-fade-in-up flex flex-col gap-7" noValidate>
      {state.error ? (
        <p role="alert" className="animate-fade-in-up rounded-lg px-3 py-2 text-sm" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
          {state.error}
        </p>
      ) : null}

      <fieldset className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <legend className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
            Account details
          </legend>
          <span
            className="rounded-full px-2.5 py-1 text-xs font-medium"
            style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
          >
            Platform: {FIXED_PLATFORM}
          </span>
        </div>

        {mode === "edit" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Supplier name" htmlFor="supplierName" required>
              <IconInput icon={Building2}>
                <input
                  id="supplierName"
                  name="supplierName"
                  required
                  placeholder="e.g. your name"
                  defaultValue={initial?.supplierName}
                  className={inputClass}
                  style={inputStyle}
                />
              </IconInput>
            </Field>

            <Field label="Supplier UPI ID" htmlFor="upiId">
              <IconInput icon={Wallet}>
                <input
                  id="upiId"
                  name="upiId"
                  placeholder="e.g. name@bank"
                  defaultValue={initial?.upiId ?? undefined}
                  className={inputClass}
                  style={inputStyle}
                />
              </IconInput>
            </Field>
          </div>
        ) : submitter ? (
          <p
            className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-3 py-2 text-sm"
            style={{ background: "var(--surface-muted)", color: "var(--muted)" }}
          >
            <Building2 size={16} aria-hidden />
            Submitting as <strong style={{ color: "var(--foreground)" }}>{submitter.name}</strong>
            <span className="inline-flex items-center gap-1.5">
              <Wallet size={14} aria-hidden />
              {submitter.upiId ? `UPI ${submitter.upiId}` : "No UPI ID saved yet"}
            </span>
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Facebook login email" htmlFor="loginIdentifier" required>
            <IconInput icon={AtSign}>
              <input
                id="loginIdentifier"
                name="loginIdentifier"
                required
                placeholder="Email used to log in to Facebook"
                defaultValue={initial?.loginIdentifier}
                className={inputClass}
                style={inputStyle}
              />
            </IconInput>
          </Field>

          {secretField("password")}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Outlook mail" htmlFor="linkedEmail">
            <IconInput icon={Mail}>
              <input
                id="linkedEmail"
                name="linkedEmail"
                type="email"
                placeholder="e.g. name@outlook.com"
                defaultValue={initial?.linkedEmail ?? undefined}
                className={inputClass}
                style={inputStyle}
              />
            </IconInput>
          </Field>

          {secretField("email_password")}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Temp mail" htmlFor="recoveryEmail">
            <IconInput icon={Mail}>
              <input
                id="recoveryEmail"
                name="recoveryEmail"
                type="email"
                placeholder="e.g. temporary / recovery email"
                defaultValue={initial?.recoveryEmail ?? undefined}
                className={inputClass}
                style={inputStyle}
              />
            </IconInput>
          </Field>

          {secretField("two_factor")}
        </div>

        <p className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          <Lock size={14} className="mt-0.5 shrink-0" style={{ color: "var(--primary)" }} aria-hidden />
          <span>
            {/* Create mode is what a supplier reads: it must not say who
                handles an ID after it is submitted (no roles, no names). */}
            {mode === "create"
              ? "Passwords and the 2FA key are encrypted as soon as you submit. After that only our team can open them — you won't see them here again, so keep your own copy."
              : "Passwords and the 2FA key are stored encrypted. Only an admin, or the media buyer this ID is assigned to, can reveal them — and every reveal is logged. Leave one blank to keep its current value unchanged."}
          </span>
        </p>
      </fieldset>

      {mode === "edit" ? (
        // Profile age isn't asked of suppliers — kept on the admin edit form
        // so a value stored for an older record isn't wiped on save.
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 text-base font-semibold" style={{ color: "var(--foreground)" }}>
            Admin-only details
          </legend>

          <Field label="Profile age" htmlFor="profileAge">
            <div className="max-w-xs">
              <IconInput icon={Clock}>
                <input
                  id="profileAge"
                  name="profileAge"
                  placeholder="e.g. new or old"
                  defaultValue={initial?.profileAge ?? undefined}
                  className={inputClass}
                  style={inputStyle}
                />
              </IconInput>
            </div>
          </Field>
        </fieldset>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="h-11 rounded-lg px-5 text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
          style={{ background: "var(--primary)", color: "var(--primary-contrast)" }}
        >
          {isPending ? "Saving…" : mode === "create" ? "Submit ID" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function IconInput({
  icon: Icon,
  children,
}: {
  icon: ComponentTypeWithSize;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <Icon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} aria-hidden />
      {children}
    </div>
  );
}

type ComponentTypeWithSize = ComponentType<{ size?: number; className?: string; style?: CSSProperties }>;

function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
        {label} {required ? <span aria-hidden style={{ color: "var(--danger)" }}>*</span> : null}
      </label>
      {children}
      {hint ? <p className="text-xs" style={{ color: "var(--muted)" }}>{hint}</p> : null}
    </div>
  );
}

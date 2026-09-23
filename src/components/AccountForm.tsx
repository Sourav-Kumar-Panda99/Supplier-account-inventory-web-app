"use client";

import { useActionState, useEffect, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Building2, Wallet, AtSign, Mail, Clock, StickyNote, Lock } from "lucide-react";
import type { Account } from "@/lib/types";
import { FIXED_PLATFORM, SECRET_LABELS, SECRET_TYPES } from "@/lib/types";
import { PasswordField } from "@/components/PasswordField";

export interface AccountFormActionResult {
  ok: boolean;
  error?: string;
  accountId?: string;
}

interface AccountFormProps {
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<AccountFormActionResult>;
  initial?: Partial<Account>;
  redirectTo: string | ((result: AccountFormActionResult) => string);
}

const initialState: AccountFormActionResult = { ok: false };
const inputClass = "h-11 w-full rounded-lg border pl-9 pr-3 text-sm";
const inputStyle = { borderColor: "var(--border)", background: "var(--surface)" };

export function AccountForm({ mode, action, initial, redirectTo }: AccountFormProps) {
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

        <Field label="Profile ID or login email" htmlFor="loginIdentifier" required>
          <IconInput icon={AtSign}>
            <input
              id="loginIdentifier"
              name="loginIdentifier"
              required
              placeholder="Your login email for this Facebook profile"
              defaultValue={initial?.loginIdentifier}
              className={inputClass}
              style={inputStyle}
            />
          </IconInput>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Linked email" htmlFor="linkedEmail">
            <IconInput icon={Mail}>
              <input
                id="linkedEmail"
                name="linkedEmail"
                type="email"
                placeholder="e.g. Outlook or Gmail address"
                defaultValue={initial?.linkedEmail ?? undefined}
                className={inputClass}
                style={inputStyle}
              />
            </IconInput>
          </Field>

          <Field label="Recovery / temporary email" htmlFor="recoveryEmail">
            <IconInput icon={Mail}>
              <input
                id="recoveryEmail"
                name="recoveryEmail"
                type="email"
                placeholder="e.g. Outlook temp mail"
                defaultValue={initial?.recoveryEmail ?? undefined}
                className={inputClass}
                style={inputStyle}
              />
            </IconInput>
          </Field>
        </div>

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

        <Field label="Internal notes" htmlFor="notes">
          <div className="relative">
            <StickyNote size={16} className="absolute left-3 top-3" style={{ color: "var(--muted)" }} aria-hidden />
            <textarea
              id="notes"
              name="notes"
              rows={4}
              defaultValue={initial?.notes ?? undefined}
              className="w-full resize-y rounded-lg border py-2.5 pl-9 pr-3 text-sm"
              style={{ ...inputStyle, minHeight: "100px" }}
            />
          </div>
        </Field>
      </fieldset>

      <fieldset
        className="flex flex-col gap-4 rounded-xl border p-5"
        style={{ borderColor: "var(--border)", background: "var(--primary-soft)" }}
      >
        <legend className="flex items-center gap-2 text-base font-semibold" style={{ color: "var(--foreground)" }}>
          <Lock size={16} style={{ color: "var(--primary)" }} />
          Credentials
        </legend>
        <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          These values are encrypted immediately and are only ever visible again to an authorized admin who
          explicitly reveals them — including you. {mode === "edit" ? "Leave a field blank to keep its current value unchanged." : ""}
        </p>

        <div className="flex flex-col gap-4 rounded-lg p-4" style={{ background: "var(--surface)" }}>
          {SECRET_TYPES.map((type) => {
            const present = initial?.secrets?.[type]?.present;
            return (
              <Field
                key={type}
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
          })}
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="h-11 rounded-lg px-5 text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
          style={{ background: "var(--primary)", color: "var(--primary-contrast)" }}
        >
          {isPending ? "Saving…" : mode === "create" ? "Submit account" : "Save changes"}
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

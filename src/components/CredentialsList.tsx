import { CopyValue } from "@/components/CopyValue";
import type { Account, SecretType } from "@/lib/types";
import { SECRET_LABELS } from "@/lib/types";

type Item = { label: string; value: string | null | undefined; unreadable?: boolean };

/**
 * Every login detail of one ID, shown as plain text with a Copy button — the
 * Facebook login, Outlook mail and Temp mail next to the password / key that
 * goes with each. `secrets` are the decrypted values from getSecretsForViewer;
 * a stored value that couldn't be decrypted arrives as null.
 */
export function CredentialsList({
  account,
  secrets,
}: {
  account: Pick<Account, "loginIdentifier" | "linkedEmail" | "recoveryEmail" | "secrets">;
  secrets: Partial<Record<SecretType, string | null>>;
}) {
  const secret = (type: SecretType): Item => ({
    label: SECRET_LABELS[type],
    value: secrets[type],
    unreadable: account.secrets[type].present && secrets[type] === null,
  });

  const rows: [Item, Item][] = [
    [{ label: "Facebook login email", value: account.loginIdentifier }, secret("password")],
    [{ label: "Outlook mail", value: account.linkedEmail }, secret("email_password")],
    [{ label: "Temp mail", value: account.recoveryEmail }, secret("two_factor")],
  ];

  return (
    <div className="flex flex-col gap-4">
      {rows.map(([left, right]) => (
        <div key={left.label} className="grid gap-4 sm:grid-cols-2">
          <Field item={left} />
          <Field item={right} />
        </div>
      ))}
    </div>
  );
}

function Field({ item }: { item: Item }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
        {item.label}
      </span>
      {item.value ? (
        <CopyValue value={item.value} label={item.label} />
      ) : (
        <p className="text-sm italic" style={{ color: item.unreadable ? "var(--danger)" : "var(--muted)" }}>
          {item.unreadable ? "Stored, but it could not be decrypted." : "No value stored."}
        </p>
      )}
    </div>
  );
}

import { CopyValue } from "@/components/CopyValue";
import { SecretEditor } from "@/components/SecretEditor";
import type { Account, SecretType } from "@/lib/types";
import { SECRET_LABELS } from "@/lib/types";

type Item =
  | { kind: "plain"; label: string; value: string | null | undefined }
  | { kind: "secret"; type: SecretType; label: string; value: string | null | undefined; unreadable: boolean };

/**
 * Every login detail of one ID, shown as plain text with a Copy button — the
 * Facebook login, Outlook mail and Temp mail next to the password / key that
 * goes with each. `secrets` are the decrypted values from getSecretsForViewer;
 * a stored value that couldn't be decrypted arrives as null.
 *
 * The password and 2FA fields also have a Change button. Only render this for
 * an admin or the media buyer the ID is assigned to — the server action checks
 * that again before saving anything.
 */
export function CredentialsList({
  accountId,
  account,
  secrets,
}: {
  accountId: string;
  account: Pick<Account, "loginIdentifier" | "linkedEmail" | "recoveryEmail" | "secrets">;
  secrets: Partial<Record<SecretType, string | null>>;
}) {
  const secret = (type: SecretType): Item => ({
    kind: "secret",
    type,
    label: SECRET_LABELS[type],
    value: secrets[type],
    unreadable: account.secrets[type].present && secrets[type] === null,
  });

  const rows: [Item, Item][] = [
    [{ kind: "plain", label: "Facebook login email", value: account.loginIdentifier }, secret("password")],
    [{ kind: "plain", label: "Outlook mail", value: account.linkedEmail }, secret("email_password")],
    [{ kind: "plain", label: "Temp mail", value: account.recoveryEmail }, secret("two_factor")],
  ];

  return (
    <div className="flex flex-col gap-4">
      {rows.map(([left, right]) => (
        <div key={left.label} className="grid gap-4 sm:grid-cols-2">
          <Field item={left} accountId={accountId} />
          <Field item={right} accountId={accountId} />
        </div>
      ))}
    </div>
  );
}

function Field({ item, accountId }: { item: Item; accountId: string }) {
  if (item.kind === "secret") {
    return (
      <SecretEditor
        accountId={accountId}
        secretType={item.type}
        label={item.label}
        value={item.value}
        unreadable={item.unreadable}
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
        {item.label}
      </span>
      {item.value ? (
        <CopyValue value={item.value} label={item.label} />
      ) : (
        <p className="py-1.5 text-sm italic" style={{ color: "var(--muted)" }}>
          No value stored.
        </p>
      )}
    </div>
  );
}

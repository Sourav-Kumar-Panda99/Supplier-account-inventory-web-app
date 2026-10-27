import { CheckCircle2, KeyRound, LockOpen, TriangleAlert } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { convertSecretsToPlainText } from "@/lib/data/secrets";
import { convertSecretsToPlainTextAction } from "@/app/actions/secrets";
import { encryptionKeyProblem } from "@/lib/crypto";
import { StatTiles } from "@/components/StatTiles";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";

// Converting a couple of thousand rows takes a few seconds; leave headroom.
export const maxDuration = 60;

const cardStyle = { borderColor: "var(--border)", background: "var(--surface)" };

/**
 * One-time tool, reached by URL only (not in the sidebar): converts the
 * credentials saved before they were stored as plain text, using the
 * ENCRYPTION_KEYS this deployment has. Once nothing is left encrypted,
 * ENCRYPTION_KEYS can be removed from the hosting settings.
 */
export default async function ConvertSecretsPage() {
  await requireAdmin();
  const outcome = await convertSecretsToPlainText(false);
  if (!outcome.ok) return null;
  const { encrypted, readable, unreadable } = outcome.result;
  const keyProblem = unreadable > 0 ? encryptionKeyProblem() : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
          Convert old credentials
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Credentials saved before the switch to plain text are still encrypted and need ENCRYPTION_KEYS to be read. This
          rewrites them as plain text using the key this site already has, so the key can then be removed.
        </p>
      </div>

      <StatTiles
        tiles={[
          { label: "Still encrypted", value: encrypted, icon: <KeyRound size={18} strokeWidth={2} /> },
          { label: "Can be converted", value: readable, icon: <LockOpen size={18} strokeWidth={2} />, tone: "var(--success)", toneBg: "var(--success-bg)" },
          { label: "Cannot be read", value: unreadable, icon: <TriangleAlert size={18} strokeWidth={2} />, tone: "var(--danger)", toneBg: "var(--danger-bg)" },
        ]}
      />

      {encrypted === 0 ? (
        <p className="flex items-start gap-2 rounded-lg border p-4 text-sm" style={{ ...cardStyle, color: "var(--foreground)" }}>
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" style={{ color: "var(--success)" }} />
          <span>
            Every credential is stored as plain text. You can now delete ENCRYPTION_KEYS and ENCRYPTION_KEY_VERSION from the
            hosting settings and redeploy.
          </span>
        </p>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border p-4" style={cardStyle}>
          {unreadable > 0 ? (
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {unreadable} cannot be read with this site&apos;s ENCRYPTION_KEYS
              {keyProblem ? ` (${keyProblem})` : " — it is not the key they were saved with"}. They will be left as they are.
              Keep the key until they are re-entered on their ID pages.
            </p>
          ) : null}
          {readable > 0 ? (
            <ActionForm action={convertSecretsToPlainTextAction}>
              <SubmitButton
                pendingLabel="Converting…"
                className="flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium shadow-sm hover:shadow-md disabled:opacity-60"
                style={{ background: "var(--primary)", color: "var(--primary-contrast)" }}
              >
                <LockOpen size={16} />
                Convert {readable} to plain text
              </SubmitButton>
            </ActionForm>
          ) : null}
        </div>
      )}
    </div>
  );
}

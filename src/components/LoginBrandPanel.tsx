import { ShieldCheck, Lock, Users, FileClock } from "lucide-react";

const FEATURES = [
  { icon: Lock, text: "Encrypted credential storage, revealed only when authorized" },
  { icon: Users, text: "Separate team and admin roles, enforced on every request" },
  { icon: FileClock, text: "A full audit trail on every sensitive action" },
];

/**
 * Left-hand brand panel shown alongside the sign-in card on wide screens.
 * Solid brand color, no gradients/glassmorphism — matches the rest of the
 * app's "clean fintech dashboard" visual language.
 */
export function LoginBrandPanel() {
  return (
    <aside
      className="relative hidden w-[45%] max-w-xl flex-col justify-between overflow-hidden p-10 lg:flex"
      style={{ background: "var(--primary)", color: "var(--primary-contrast)" }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ background: "var(--primary-contrast)", color: "var(--primary)" }}
          aria-hidden
        >
          <ShieldCheck size={20} strokeWidth={2.25} />
        </span>
        <span className="text-lg font-semibold tracking-tight">Supplier Account Inventory</span>
      </div>

      <div className="max-w-md">
        <h1 className="text-3xl font-bold leading-tight">Manage supplier accounts with confidence.</h1>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: "color-mix(in srgb, var(--primary-contrast) 78%, transparent)" }}>
          A secure, centralized place for your team to submit accounts and for admins to review, approve,
          and control access to supplier credentials.
        </p>

        <ul className="mt-8 flex flex-col gap-4">
          {FEATURES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-sm">
              <span
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                style={{ background: "color-mix(in srgb, var(--primary-contrast) 16%, transparent)" }}
              >
                <Icon size={14} strokeWidth={2.25} />
              </span>
              <span className="leading-snug" style={{ color: "color-mix(in srgb, var(--primary-contrast) 92%, transparent)" }}>
                {text}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <Illustration />
    </aside>
  );
}

function Illustration() {
  return (
    <svg viewBox="0 0 400 120" className="w-full opacity-90" role="presentation" aria-hidden="true">
      <rect x="16" y="52" width="140" height="56" rx="10" fill="var(--primary-contrast)" opacity="0.1" />
      <rect x="30" y="66" width="60" height="6" rx="3" fill="var(--primary-contrast)" opacity="0.35" />
      <rect x="30" y="80" width="90" height="6" rx="3" fill="var(--primary-contrast)" opacity="0.22" />
      <rect x="90" y="30" width="150" height="66" rx="10" fill="var(--primary-contrast)" opacity="0.14" />
      <rect x="106" y="46" width="70" height="7" rx="3.5" fill="var(--primary-contrast)" opacity="0.4" />
      <rect x="106" y="62" width="100" height="7" rx="3.5" fill="var(--primary-contrast)" opacity="0.25" />
      <rect x="106" y="78" width="50" height="7" rx="3.5" fill="var(--primary-contrast)" opacity="0.4" />
      <circle cx="320" cy="40" r="10" fill="var(--primary-contrast)" opacity="0.18" />
      <circle cx="350" cy="70" r="6" fill="var(--primary-contrast)" opacity="0.25" />
      <circle cx="300" cy="90" r="14" fill="var(--primary-contrast)" opacity="0.12" />
    </svg>
  );
}

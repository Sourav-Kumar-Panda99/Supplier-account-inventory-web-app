import { ShieldCheck, Lock, LayoutGrid, TrendingUp } from "lucide-react";

const BENEFITS = [
  { icon: Lock, text: "Secure & encrypted storage" },
  { icon: LayoutGrid, text: "Centralized account management" },
  { icon: ShieldCheck, text: "Easy tracking and updates" },
  { icon: TrendingUp, text: "Built for teams and growth" },
];

export function SecurityInfoCard() {
  return (
    <aside
      className="card animate-fade-in-up hidden w-full max-w-xs shrink-0 flex-col gap-6 self-start rounded-2xl border p-6 lg:flex"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <Illustration />

      <div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          Secure Supplier Management.
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Organize, track, and scale your supplier accounts with confidence.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {BENEFITS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-2.5 text-sm" style={{ color: "var(--foreground)" }}>
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
              style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
            >
              <Icon size={14} strokeWidth={2.25} />
            </span>
            {text}
          </li>
        ))}
      </ul>
    </aside>
  );
}

function Illustration() {
  return (
    <svg viewBox="0 0 260 140" className="w-full" role="presentation" aria-hidden="true">
      <rect x="0" y="0" width="260" height="140" rx="16" fill="var(--primary-soft)" />
      <rect x="24" y="70" width="90" height="52" rx="10" fill="var(--surface)" stroke="var(--border)" />
      <rect x="36" y="84" width="40" height="6" rx="3" fill="var(--border-strong)" />
      <rect x="36" y="96" width="60" height="6" rx="3" fill="var(--border)" />
      <rect x="60" y="46" width="96" height="58" rx="10" fill="var(--surface)" stroke="var(--border)" />
      <rect x="72" y="60" width="48" height="7" rx="3.5" fill="var(--border-strong)" />
      <rect x="72" y="74" width="70" height="7" rx="3.5" fill="var(--border)" />
      <rect x="72" y="88" width="30" height="7" rx="3.5" fill="var(--primary-soft)" />
      <circle cx="204" cy="46" r="8" fill="var(--primary)" opacity="0.18" />
      <circle cx="222" cy="80" r="5" fill="var(--primary)" opacity="0.25" />
      <path
        d="M192 96c0-13.3 10.7-24 24-24s24 10.7 24 24-10.7 30-24 34c-13.3-4-24-20.7-24-34Z"
        fill="var(--primary)"
      />
      <path
        d="M206 96l6 6 12-13"
        stroke="var(--primary-contrast)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

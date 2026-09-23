# Supplier Account Inventory

An internal tool for submitting, reviewing, and controlling access to supplier account
credentials. Submitting a new account needs **no login at all** — it's a public form
anyone with the link can fill out, repeatedly, one after another. Everything else
(browsing, editing, approving, archiving, and revealing a stored credential) requires an
admin to sign in, and a reveal only happens after an explicit, freshly-authorized,
audit-logged action.

Stack: Next.js 16 (App Router) + TypeScript + Tailwind CSS v4, Supabase (Postgres + Auth),
server-side AES-256-GCM encryption for secrets.

## Table of contents

- [Quick start (demo mode)](#quick-start-demo-mode)
- [Setting up a real Supabase project](#setting-up-a-real-supabase-project)
- [Encryption key setup, rotation, and backups](#encryption-key-setup-rotation-and-backups)
- [Creating the first admin](#creating-the-first-admin)
- [Role management](#role-management)
- [Deployment](#deployment)
- [Security model summary](#security-model-summary)
- [Data retention](#data-retention)
- [What works today vs. what needs configuration](#what-works-today-vs-what-needs-configuration)

## Quick start (demo mode)

With no configuration at all, the app runs in **demo mode**: an in-memory, fictional data
set with one demo admin. Nothing is persisted — it resets every time the server restarts —
and this is loudly banner-labeled in the UI. Demo mode still exercises the real
AES-256-GCM encryption code path (with a random key generated once per process), so the
reveal/copy/audit flow behaves like production, just without durability.

```bash
npm install
npm run dev
```

Open http://localhost:3000 — you'll land straight on the submit form, no sign-in needed.
To see the admin side, click **Admin sign in** and pick the demo admin (a simulated
sign-in, clearly marked as such — see `src/app/actions/auth.ts`).

## Setting up a real Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run the migrations in `supabase/migrations/` **in filename order**:
   - `0001_schema.sql` — tables, triggers, the `profiles` role sync trigger.
   - `0002_rls.sql` — Row Level Security policies. This is the real authorization
     boundary; the app's server checks are a second layer, not a substitute.
   - `0003_secret_presence.sql` — a narrow, presence-only RPC so the UI can show
     "a value is stored" without ever exposing ciphertext through it.
3. Optionally run `supabase/seed.sql` for fictional sample suppliers/accounts (no secrets —
   attach fictional secret values afterward through the app UI so they go through the real
   encrypt-on-write path).
4. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project Settings → API.
   - `SUPABASE_SERVICE_ROLE_KEY` — same page. **Server-only.** Never expose this to the
     browser, never prefix with `NEXT_PUBLIC_`, never commit it.
   - `ENCRYPTION_KEYS` / `ENCRYPTION_KEY_VERSION` — see the next section.
5. `npm run dev`. The app detects the Supabase env vars and leaves demo mode automatically.

New sign-ups default to the `team` role (enforced by the `handle_new_user` trigger and by
RLS — a user can never set their own role to `admin`). Email/password sign-up itself isn't
exposed in this app's UI (it's an internal tool); create users via the Supabase dashboard
(Authentication → Users → Add user) or your own invite flow, then see
[Creating the first admin](#creating-the-first-admin).

## Encryption key setup, rotation, and backups

Every profile password and linked-email password is encrypted with **AES-256-GCM**
before it is ever written to the database. Ciphertext, IV, and authentication tag are
stored in `account_secrets`, separate from ordinary account metadata in `accounts`. The
key itself lives only in the server environment — it is never in the database, never in
the browser bundle, never in logs.

**Generate a key:**

```bash
npm run generate-key
```

This prints a base64-encoded 32-byte key. Put it in `ENCRYPTION_KEYS` as a JSON object
keyed by version number:

```
ENCRYPTION_KEYS={"1":"<paste the generated key here>"}
ENCRYPTION_KEY_VERSION=1
```

**Rotating a key** (e.g. on a schedule, or after a suspected exposure):

1. Generate a new key: `npm run generate-key`.
2. Add it under the next version number without removing the old one:
   `ENCRYPTION_KEYS={"1":"<old key>","2":"<new key>"}`.
3. Set `ENCRYPTION_KEY_VERSION=2`. All new/replaced secrets are now encrypted with key
   version 2; existing rows keep working because their stored `key_version` still points
   at key 1, which is still present.
4. To fully retire key 1: re-encrypt every row currently at `key_version = 1` by reading
   it through the app (which decrypts with key 1) and re-saving it (which encrypts with
   the current version) — there is no bulk re-encryption script included, since doing
   this safely requires being run as an authenticated admin action per record. Once no
   rows reference version 1, it can be removed from `ENCRYPTION_KEYS`.

**Backups:** back up `ENCRYPTION_KEYS` (all versions still referenced by any row) with the
same rigor as a database backup — store it in a secrets manager or password manager with
restricted access, not in a plain file next to the deployment.

**Losing a key version that's still referenced by any row means every secret encrypted
under it is permanently unrecoverable.** There is no recovery path by design — this is
what makes the encryption meaningful rather than obfuscation. If a key is lost, the only
option is to have every affected supplier account's credentials manually reset and
re-entered.

## Creating the first admin

There's no bootstrap UI for this on purpose (an admin-creation button reachable by anyone
would defeat the point). After a user has signed in at least once (so a `profiles` row
exists via the `handle_new_user` trigger), promote them from the Supabase SQL editor:

```sql
update public.profiles set role = 'admin' where email = 'someone@yourcompany.example';
```

## Role management

- `profiles.role` is the single source of truth for authorization, checked fresh on every
  server action, route handler, and RLS policy — never cached from a JWT claim.
- A user can never change their own role from the client (`profiles_update_self_limited`
  RLS policy enforces this at the database level, independent of the app code).
- To promote/demote after the first admin exists, either use the SQL above or have an
  existing admin run the equivalent update through the Supabase dashboard's table editor.
  (There is no in-app "manage roles" UI in this version — see
  [What works today](#what-works-today-vs-what-needs-configuration).)

## Deployment

1. Set all of `.env.example`'s variables in your host's environment configuration (e.g.
   Vercel → Project → Settings → Environment Variables). Never commit them.
2. Make sure `SUPABASE_SERVICE_ROLE_KEY` and `ENCRYPTION_KEYS` are marked server-only /
   "sensitive" if your host distinguishes that; they must never end up in a client bundle.
3. Run the Supabase migrations against your production project (same steps as above).
4. `npm run build && npm run start`, or deploy via your platform's normal Next.js flow.
5. Promote your first admin (see above) before inviting the team.

## Security model summary

- **RLS is the enforced boundary**, not the UI. Every table has Row Level Security
  enabled; hiding a button never substitutes for a policy. See `supabase/migrations/0002_rls.sql`.
- **`account_secrets` denies all direct client access.** The only way to reach it is the
  server's service-role client inside `src/lib/data/secrets.ts`, which re-checks the
  caller's authentication and admin role from scratch on every single call — reveal,
  copy, or write.
- **Every reveal/copy attempt is audit-logged** — actor, record, secret type, outcome —
  with the secret value itself never included, by construction (see `writeAuditLog`
  call sites; the encrypted value and the audit call never touch the same variable).
- **Reveal is temporary in the UI**: values re-mask automatically after ~20 seconds, on
  tab-hide, or on navigation away (component unmount) — see `src/components/RevealField.tsx`.
- **Copy never displays the value on screen** — it's written straight to the clipboard
  and discarded, never passed through component state.
- **CSV export is metadata-only.** `src/app/api/export/accounts/route.ts` never reads
  `account_secrets`; the export is also audit-logged and the downloaded filename is
  suffixed `-SENSITIVE` as a handling reminder.
- **Submitting a new account needs no login.** There's no team-facing list, detail, or
  edit view, and no session to speak of — reviewing, editing, and every status change
  (approve, flag, archive) are admin-only, enforced both by the server action
  (`updateAccountAction` / `setAccountStatusAction` require `requireAdmin()`) and by the
  `accounts_admin_update` / `accounts_select_admin_only` RLS policies.
- **The anonymous submission path still goes through server code, never a client-writable
  RLS policy.** `accounts` has no INSERT policy for `anon`/`authenticated` at all — the
  same "deny by default, only the service-role server function can reach it" pattern this
  app already uses for `account_secrets` and `audit_log`. See `createAccount` in
  `src/lib/data/accounts.ts`.

## Data retention

This template does not implement automatic retention/deletion — decide policy for your
organization and enforce it operationally (e.g. a scheduled job) or ask for scoped
follow-up work:

- **Audit log**: grows indefinitely by default. Recommend deciding a retention window
  (e.g. 1–2 years) and deleting older rows on a schedule; audit rows never contain secret
  values, so retention risk here is about actor/record metadata, not credentials.
- **Archived accounts**: once a supplier relationship ends, archive the account (keeps
  the audit trail) and consider a separate hard-delete pass after your organization's
  retention window, which should also delete the matching `account_secrets` rows.
- **Fields collected are intentionally minimal** — only what's listed in the "Account
  fields" spec. Don't add fields (e.g. broader PII) without a specific need.

## What works today vs. what needs configuration

**Works out of the box (demo mode, no setup):**
- Public submit flow (no login) + admin UI behind sign-in, RBAC-gated, session redirects.
- Team/public: repeatable "submit another account" flow — no login, no list/detail access.
- Admin: search/filter/edit accounts, review/status actions, per-record activity trail.
- Real AES-256-GCM encrypt/decrypt on the reveal/copy path (demo key is ephemeral —
  regenerated per process, not durable — this is intentional, not a shortcut).
- Metadata-only CSV export.

**Works once you configure Supabase (see setup above):**
- Durable Postgres storage, real Supabase Auth sessions, RLS-enforced authorization.
- Persisted, versioned encryption keys via `ENCRYPTION_KEYS`.

**Needs your decision / follow-up work, not included by default:**
- An in-app "manage user roles" screen (promotion is currently a direct SQL statement —
  see [Role management](#role-management)); reasonable to add later behind an
  admin-only, re-checked-server-side action following the same pattern as everything else.
- Automated retention/deletion jobs (see [Data retention](#data-retention)).
- A bulk re-encryption tool for fully retiring an old key version after rotation.
- Rate limiting / anomaly detection on repeated reveal attempts (every attempt is logged,
  but nothing currently alerts on a burst of reveals — worth adding if this scales beyond
  a small trusted team).

## Project structure

```
src/
  app/
    actions/         Server Actions (auth, accounts, secrets) — the only write paths
    api/export/       Metadata-only CSV export route handler
    admin/           Admin portal pages (dashboard, accounts)
    team/            Team portal — submit only (repeatable "submit another")
    login/           Sign-in (real or simulated demo sign-in)
  components/        Shared UI (RevealField, AccountForm, AccountTable, TopBar, Sidebar, ...)
  lib/
    crypto.ts        AES-256-GCM encrypt/decrypt — server-only
    auth.ts          getCurrentUser/requireUser/requireAdmin — fresh check every call
    data/            Data-access layer (accounts, secrets, audit)
    demo/            In-memory demo-mode store (never used when Supabase is configured)
    supabase/        RLS-bound client (server.ts) and service-role client (admin.ts)
supabase/
  migrations/        Schema + RLS policies, run in order
  seed.sql           Fictional sample data (no secrets)
scripts/generate-key.mjs   Prints a new base64 AES-256 key
```

# Supplier Account Inventory

An internal tool for submitting, reviewing, assigning, and controlling access to supplier
account credentials ("IDs"). There are three kinds of user, each with their own sign-in
and their own screens:

| Role | How the login is created | What they can do |
| --- | --- | --- |
| **Supplier** | Signs up himself at `/signup` | Submit IDs; see his own dashboard — how many IDs he gave, and which were accepted or rejected (with the reason), day by day. Never sees a stored password again, and never sees another supplier's IDs. |
| **Media buyer** | Added by an admin on **Suppliers & buyers** | See only the IDs assigned to him, reveal their credentials to check them, and mark each one **active** or **rejected** (a note saying why is required). |
| **Admin** | Promoted by hand (see below) | See everything; accept or reject IDs; assign IDs to a media buyer by name, one at a time or in bulk; add media buyers; export. |

Life of an ID: a supplier submits it (**pending**) → an admin accepts it, or assigns it to
a media buyer, which also accepts it (**accepted**) → the media buyer checks it and marks
it **active** or **rejected**. An admin can also reject, archive or reassign at any point.
Every reveal of a credential is an explicit, freshly-authorized, audit-logged action.

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
set with a demo admin, two demo media buyers and two demo suppliers. Nothing is persisted — it resets every time the server restarts —
and this is loudly banner-labeled in the UI. Demo mode still exercises the real
AES-256-GCM encryption code path (with a random key generated once per process), so the
reveal/copy/audit flow behaves like production, just without durability.

```bash
npm install
npm run dev
```

On Windows you can instead double-click `start-app.bat`, which runs those two commands
and opens the browser.

Open http://localhost:3000 — you'll land on the sign-in page. In demo mode, pick any of
the listed demo users to see that role's screens (a simulated sign-in, clearly marked as
such — see `src/app/actions/auth.ts`), or use **Create an account** to try the supplier
sign-up.

## Setting up a real Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run the migrations in `supabase/migrations/` **in filename order**:
   - `0001_schema.sql` — tables, triggers, the `profiles` role sync trigger.
   - `0002_rls.sql` — Row Level Security policies. This is the real authorization
     boundary; the app's server checks are a second layer, not a substitute.
   - `0003_secret_presence.sql` — a narrow, presence-only RPC so the UI can show
     "a value is stored" without ever exposing ciphertext through it.
   - `0004_two_factor_secret.sql` — allows storing an encrypted 2FA key.
   - `0005_roles_assignment.sql` — supplier / media buyer / admin roles, which supplier
     an ID belongs to, which media buyer it is assigned to, the accepted / rejected
     statuses and the rejection note. **If your database already exists, this is the one
     you still need to run.** It is safe to run more than once; it renames the old `team`
     role to `supplier` and moves any `needs_review` IDs back to `pending`.
3. Optionally run `supabase/seed.sql` for fictional sample suppliers/accounts (no secrets —
   attach fictional secret values afterward through the app UI so they go through the real
   encrypt-on-write path).
4. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project Settings → API.
   - `SUPABASE_SERVICE_ROLE_KEY` — same page. **Server-only.** Never expose this to the
     browser, never prefix with `NEXT_PUBLIC_`, never commit it.
   - `ENCRYPTION_KEYS` / `ENCRYPTION_KEY_VERSION` — see the next section.
5. `npm run dev`. The app detects the Supabase env vars and leaves demo mode automatically.

New sign-ups are always the `supplier` role (enforced by the `handle_new_user` trigger and
by RLS — a user can never change their own role). Suppliers sign up at `/signup`; the
login is created by the server with the email already confirmed, so sign-up does not
depend on the Supabase project's email settings, and there is **no email verification** —
anyone who knows the address of the site can create a supplier account. Media buyers are
added by an admin inside the app. For the first admin, see
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
- **Media buyers** are added in the app: Admin → **Suppliers & buyers** → *Add a media
  buyer* (name, email, password). Give them that email and password to sign in.
- **Suppliers** create their own login at `/signup`.
- **Admins** are never created from the app. To promote/demote, either use the SQL above
  or have an existing admin run the equivalent update through the Supabase dashboard's
  table editor.
- **Taking a media buyer's access away:** change their role back to `supplier` with the
  same kind of SQL update (they immediately lose the media-buyer screens and can no longer
  reveal any credential), and ban the user in Supabase → Authentication if they should not
  be able to sign in at all. IDs that were assigned to them show "Former media buyer" in
  the admin list until you reassign them.

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
  caller's authentication and role from scratch on every single call — reveal, copy, or
  write. An admin can reveal any ID; a media buyer only an ID assigned to him *at that
  moment* (unassigning cuts him off immediately); a supplier never.
- **A supplier never sees who handled his ID.** His dashboard shows only pending /
  accepted / rejected and the rejection reason. Which media buyer an ID is assigned to,
  who accepted or rejected it, and even whether it has been assigned at all are never
  read for, or sent to, a supplier, and the pages he sees do not mention media buyers.
  (The reason text is passed on exactly as written — whoever rejects should not put
  their own name in it.)
- **Suppliers and media buyers have no RLS policy on `accounts` at all.** Their screens go
  through server code (`src/lib/data/accounts.ts`) that checks the role and then filters
  by `supplier_id` / `assigned_to` itself, using the id from the session — never one from
  the URL or a form. Directly against the database, with their own login, they can read
  nothing but their own profile row.
- **Every reveal/copy attempt is audit-logged** — actor, record, secret type, outcome —
  with the secret value itself never included, by construction (see `writeAuditLog`
  call sites; the encrypted value and the audit call never touch the same variable).
- **Reveal is temporary in the UI**: values re-mask automatically after ~20 seconds, on
  tab-hide, or on navigation away (component unmount) — see `src/components/RevealField.tsx`.
- **Copy never displays the value on screen** — it's written straight to the clipboard
  and discarded, never passed through component state.
- **The Excel export contains every credential in plain text.** The admin-only
  "Export Excel (with credentials)" button (`src/app/api/export/accounts/route.ts`)
  decrypts every password and 2FA key into the file, one sheet per day. Every export is
  audit-logged and the filename contains `CREDENTIALS` — treat the downloaded file as
  being as sensitive as the whole database.
- **Submitting an ID needs a supplier login.** The ID is filed under the signed-in
  supplier — his name and UPI ID are copied from his profile on the server, not taken
  from the form. Editing, accepting, assigning and deleting are admin-only, enforced both
  by the server actions (`requireAdmin()`) and by the `accounts_admin_update` /
  `accounts_select_admin_only` RLS policies.
- **Submission goes through server code, never a client-writable RLS policy.** `accounts`
  has no INSERT policy for `anon`/`authenticated` at all — the same "deny by default,
  only the service-role server function can reach it" pattern this app already uses for
  `account_secrets` and `audit_log`. See `createAccount` in `src/lib/data/accounts.ts`.

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
- Sign-in for all three roles, each sent to their own area; wrong-role access is refused.
- Supplier: sign-up, submit IDs, dashboard with totals, a day-by-day table and the reason
  for each rejection.
- Media buyer: list of assigned IDs, reveal/copy credentials, mark active or reject with a note.
- Admin: search/filter IDs, accept/reject, assign to a media buyer per row or in bulk,
  add media buyers, per-supplier and per-buyer totals, per-record activity trail.
- Real AES-256-GCM encrypt/decrypt on the reveal/copy path (demo key is ephemeral —
  regenerated per process, not durable — this is intentional, not a shortcut).
- Excel export (admin only, includes decrypted credentials).
- Light and dark theme: follows the device setting until someone uses the toggle (top
  bar, sign-in and sign-up pages); the choice is remembered in that browser.
- Phone layout: below desktop width the wide tables become cards, and the admin's
  accept / reject / assign bar stays in view while scrolling.

**Works once you configure Supabase (see setup above):**
- Durable Postgres storage, real Supabase Auth sessions, RLS-enforced authorization.
- Persisted, versioned encryption keys via `ENCRYPTION_KEYS`.

**Needs your decision / follow-up work, not included by default:**
- Protection on the public sign-up form. Anyone can create a supplier account and there
  is no email verification, captcha or rate limit. A supplier account can only submit IDs
  and see its own, but junk sign-ups and junk submissions are possible — worth adding an
  approval step or a captcha before sharing the link widely.
- Removing or disabling a user from inside the app, resetting a password, and promoting
  an admin (all currently done in the Supabase dashboard — see
  [Role management](#role-management)).
- Automated retention/deletion jobs (see [Data retention](#data-retention)).
- A bulk re-encryption tool for fully retiring an old key version after rotation.
- Rate limiting / anomaly detection on repeated reveal attempts (every attempt is logged,
  but nothing currently alerts on a burst of reveals — worth adding if this scales beyond
  a small trusted team).

## Project structure

```
src/
  app/
    actions/         Server Actions (auth, accounts, secrets, users) — the only write paths
    api/export/       Admin-only Excel export (includes decrypted credentials)
    admin/           Admin pages (dashboard, all IDs, suppliers & buyers)
    buyer/           Media buyer pages (my IDs, check one ID)
    supplier/        Supplier pages (my dashboard, submit an ID)
    signup/          Supplier sign-up
    login/           Sign-in for every role (real or simulated demo sign-in)
    team/            Old links only — redirects to the supplier area
  components/        Shared UI (RevealField, AccountForm, AccountTable, AssignSelect, RoleShell, ...)
  lib/
    crypto.ts        AES-256-GCM encrypt/decrypt — server-only
    auth.ts          getCurrentUser/requireUser/requireRole/requireAdmin — fresh check every call
    data/            Data-access layer (accounts, profiles, secrets, audit)
    demo/            In-memory demo-mode store (never used when Supabase is configured)
    supabase/        RLS-bound client (server.ts) and service-role client (admin.ts)
supabase/
  migrations/        Schema + RLS policies, run in order
  seed.sql           Fictional sample data (no secrets)
scripts/generate-key.mjs   Prints a new base64 AES-256 key
```

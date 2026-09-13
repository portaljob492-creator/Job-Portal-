# Nexora Jobs — React + Supabase

Production-oriented beauty-industry job portal for job seekers and employers. The frontend is React/Vite; Supabase provides Auth, PostgreSQL, RLS, Storage, Realtime, and transactional RPC workflows.

## Deployment status

The Jobs database is deployed to the existing **`nexora-staging`** Supabase project in `ap-south-1`.

```text
Project Ref: qwaehqsmodekbgvnaavz
Schema namespace: public.job_*
```

It coexists with the existing Nexora marketplace database and reuses its `profiles`, `organizations`, `salons`, and `push_subscriptions` tables without replacing their security model.

## Implemented backend

- Email/password signup with immediate activation, login, logout, and password recovery
- Permanent one-email/one-portal role assignment for `job_seeker`, `employer`, and `admin`
- Wrong-portal signup/login rejection with explicit role-specific errors
- Candidate profile, skills, experience, education, certifications, resume metadata, preferences, and portfolio
- Employer profile, salon membership/location, and protected verification workflow
- Draft/create/publish/pause/resume/close job lifecycle
- Published job search projections and deterministic saved-search alerts
- Saved jobs and duplicate-safe application submission
- Server-controlled application transition history
- Interview request, confirmation, reschedule, decline, and completion workflows
- Job offer send/accept/decline/withdraw and hired workflow
- Participant-scoped conversations and messages
- Notifications, support tickets, reporting, employer blocking, and audit log
- 7 Storage buckets with private document policies
- RLS on every one of the 35 Jobs tables
- Authenticated device location sync (`job_user_locations`) behind an owner-only RPC
- Realtime on applications, interviews, offers, notifications, conversations, and messages

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

Use only the project URL and publishable/anon key in the browser:

```env
VITE_SUPABASE_URL=https://qwaehqsmodekbgvnaavz.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY
VITE_SUPABASE_STORAGE_KEY=nexora.auth.qwaehqsmodekbgvnaavz
```

`VITE_SUPABASE_STORAGE_KEY` is optional: it defaults to `nexora.auth.<project-ref>`.

Never expose a Supabase secret or `service_role` key in a `VITE_*` variable, browser code, logs, or the repository.

## Versioned migrations

Migrations are under `supabase/migrations/`:

```text
20260808170000_jobs_core.sql
20260808170100_jobs_functions.sql
20260808170200_jobs_rls_storage.sql
20260808170300_jobs_seed.sql
20260808170400_jobs_security_hardening.sql
20260808170500_jobs_safe_read_rpcs.sql
20260808170600_jobs_platform_compat.sql
20260808170700_jobs_public_views.sql
20260808170800_jobs_permanent_portal_roles.sql
20260808170900_jobs_admin_approval.sql
20260810090000_jobs_location_sync.sql
20260913000000_jobs_backend_completion.sql
20260913000100_jobs_schema_integrity.sql
```

`20260913000100_jobs_schema_integrity.sql` completes the relational audit: one
employment-type vocabulary for posts/offers/saved searches, the application
history table constrained to the lifecycle vocabulary, closed vocabularies for
the notification/audit/ticket event columns, a guard so a job with applications
can never be deleted by accident (JOB_HAS_APPLICATIONS) plus notification
cleanup on delete, and an index for every remaining foreign key.

`20260913000000_jobs_backend_completion.sql` is the authoritative final state for
everything the admin-approval model changed: it re-points the application and
public-location gates at the live `approved` status, keeps one active offer per
application (a withdrawn or declined offer can be replaced), pins the strict
`job_register_role`, makes the signup trigger independent of trigger ordering,
adds the missing foreign-key/hot-path indexes and tightens helper execute
rights. Earlier migration files are historical records — never edit an applied
migration, add a new one.

They are recorded in `supabase_migrations.schema_migrations` on staging. For another linked project:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

## Core database groups

| Tables | Purpose |
| --- | --- |
| `job_user_roles`, `job_seeker_profiles`, `job_employer_profiles` | Role-specific identity and onboarding |
| `job_skills`, `job_candidate_*` | Candidate details, resume metadata, and preferences |
| `job_salon_members`, `job_salon_profiles`, `job_salon_locations` | Employer ownership and salon hiring access |
| `job_posts`, `job_post_skills`, `job_saved_jobs` | Job publishing and discovery |
| `job_applications`, `job_application_status_history` | Hiring pipeline and immutable status history |
| `job_interview_*`, `job_offers` | Interview and offer lifecycle |
| `job_notifications`, `job_saved_searches` | Alerts and workflow notifications |
| `job_conversations`, `job_messages` | Realtime participant-scoped messaging |
| `job_support_*`, `job_reports`, `job_audit_log` | Support, safety, moderation, and auditability |
| `job_user_locations` | Last synced device position for nearby-job ranking (owner-only) |

Safe projections:

- `public_job_listings`
- `public_job_salon_profiles`
- `job_employer_candidate_cards`

Critical mutations use checked RPCs such as `publish_job`, `submit_job_application`, `shortlist_application`, `create_interview_request`, `send_job_offer`, and `mark_candidate_hired`.

## Storage

Private buckets:

- `job-resumes`
- `job-certificates`
- `employer-verification`
- `job-offers`
- `job-support-attachments`
- `job-profile-media`

Public-safe bucket:

- `salon-public-media`

Private documents use stable storage paths; clients should request short-lived signed URLs only after authorization.

## Validation

```bash
npm run lint          # tsc --noEmit
npm run build         # vite build
npm run test:contract # frontend/backend contract (offline, no credentials)
npm run test:db       # replays every migration on a real PostgreSQL (offline)
npm run test:location # auth + location sync checks (offline, no credentials)
npm run test:reset    # password policy, recovery-token parsing, reset CLI (offline)
npm run test:pwa      # build + PWA artifact checks
```

`npm run test:db` boots an in-process PostgreSQL (PGlite), applies every file in
`supabase/migrations` in order on top of a minimal Supabase bootstrap (roles,
`auth.users`, `auth.uid()`, `storage.objects`, the realtime publication and the
shared Nexora tables) and then drives the real workflows as the `authenticated`
role: create job → admin approval → apply → shortlist → interview → offer →
hire, plus cross-user access attempts, storage buckets/policies and the realtime
publication. It is the fastest way to prove a backend change before deploying.

`npm run test:contract` proves the app and the SQL still agree: every `.rpc()`
call the frontend makes must exist in the migrations with matching argument
names, every table must be RLS-protected, the schema-integrity guarantees are
present, and no secret may reach the bundle.

`npm run test:location` executes the real modules (`src/lib/supabase.ts`,
`src/routing.ts`, `src/lib/authErrors.ts`, `src/services/locationSync.ts`) with
injected fakes and asserts the repository invariants: one Supabase client, one
auth listener owner, the PKCE storage key, the login route alias, watcher
throttling/cleanup, and the location migration's RLS posture.

An isolated end-to-end database acceptance test is included:

```bash
ALLOW_JOB_BACKEND_TEST=1 \
SUPABASE_URL=... \
SUPABASE_PUBLISHABLE_KEY=... \
SUPABASE_SERVICE_ROLE_KEY=... \
node scripts/test-supabase-backend.mjs
```

The test creates temporary users and fixtures, validates the full seeker/employer workflow and RLS isolation, then removes its data. Never run it against production without explicit approval.

Password recovery has a separate end-to-end test that verifies a recovery session, password update, old-password rejection, one-time token use, and role preservation:

```bash
ALLOW_JOB_BACKEND_TEST=1 \
SUPABASE_URL=... \
SUPABASE_PUBLISHABLE_KEY=... \
SUPABASE_SERVICE_ROLE_KEY=... \
npm run test:recovery
```

`npm run test:reset` is the offline counterpart: it runs the shared password
policy, the recovery-token parser, the rate-limit/recovery-error mapping (the
exact strings the screens show) and drives `scripts/reset-user-password.mjs`
against a mock GoTrue admin API, asserting the request it sends.

## Progressive Web App (PWA)

The production build includes a complete installable PWA:

- Floating **Install App** button with native `beforeinstallprompt` support
- iOS Safari, Android Chrome, and desktop manual-install instructions
- Standalone manifest with standard and maskable icons
- Auto-updating Workbox service worker
- Precached application shell for offline startup
- Network-first caching only for safe public job listings
- Stale-while-revalidate caching for public images and fonts
- Offline status banner; protected writes are never queued or faked offline
- Vercel cache headers for `sw.js`, the manifest, and versioned icons

Build output must include `manifest.webmanifest`, `sw.js`, and the Workbox runtime. The service worker is registered immediately from the app bundle so Chromium's one-shot install event is captured reliably. Test installation from the production HTTPS URL rather than the Vite development server.

## Vercel deployment

1. In Vercel, choose **Add New → Project** and import `portaljob492-creator/Job-Portal-`.
2. Keep **Framework Preset: Vite**. `vercel.json` already defines `npm ci`, `npm run build`, `dist`, and `/app/jobs` SPA rewrites.
3. Add these Production, Preview, and Development variables:

```env
VITE_SUPABASE_URL=https://qwaehqsmodekbgvnaavz.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_STAGING_PUBLISHABLE_KEY
VITE_SUPABASE_STORAGE_KEY=nexora.auth.qwaehqsmodekbgvnaavz
```

4. Deploy, then copy the final `https://*.vercel.app` domain into Supabase Auth URL Configuration before testing OAuth or recovery links.

Vite inlines every `VITE_*` variable into the bundle at **build time**, so a deployment that was built before the variables existed keeps running with them missing. After adding or changing `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` you must **redeploy** (Deployments → ⋯ → Redeploy, without build cache) — saving the variables alone does not update an existing deployment. The same applies locally: `cp .env.example .env`, fill in the key, and restart `npm run dev`.

Environment Variables must be enabled for the environment you actually serve. If the variables are scoped to Preview only, the Production deployment logs a console error and renders the "Supabase not configured" banner, because `import.meta.env.VITE_SUPABASE_ANON_KEY` is `undefined` in that build.

## Auth configuration

The portal uses the universal Nexora Supabase auth setup: one shared client
(`src/lib/supabase.ts`), PKCE, and a namespaced storage key.

```ts
createClient(url, anonKey, {
  auth: {
    storageKey: 'nexora.auth.qwaehqsmodekbgvnaavz',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});
```

- The storage key names this app's tokens, so another Nexora app on the same
  origin can never read or overwrite them. Sessions previously stored under
  `sb-<project-ref>-auth-token` are migrated once on boot so nobody is signed out.
- Auth state is owned by `src/lib/authSession.ts`, which registers the single
  `onAuthStateChange` listener for the whole app. `AuthSessionProvider` (mounted in
  `main.tsx`) exposes the snapshot; `App` and `useLocationSync` subscribe to the
  store instead of adding their own listeners.
- Handled events: `INITIAL_SESSION`, `SIGNED_IN`, `TOKEN_REFRESHED`, `SIGNED_OUT`
  (plus `PASSWORD_RECOVERY` and `USER_UPDATED`).
- Invalid or expired sessions are classified by `src/lib/authErrors.ts`. They clear
  the unusable tokens once and route to the login screen. Network failures,
  offline launches and RLS denials deliberately keep the session intact.
- Login route: the portal's canonical path is `/login` (`loginPath()` in
  `src/routing.ts`); the universal Nexora path `/auth/login` is accepted as an alias
  that resolves to the same screen. `redirectToLogin()` compares the current
  pathname first, so repeated invalid-session signals cannot loop.
- A deliberate logout is flagged (`markUserInitiatedSignOut`) and still returns to
  the welcome screen, exactly as before.

## Password recovery

Three independent ways back into an account, in order of preference:

| Path | Sends an email? | When it works |
| --- | --- | --- |
| Reset link in the email | Yes | Normal case; redirects to `/?recovery=1` |
| **Paste the link / 6-digit code** on the Forgot Password screen | **No** | Email quota exhausted, or the link was opened on another device |
| `npm run admin:reset-password` (service_role) | No | Owner-side rescue when self-service is blocked |

**A failed password sign-in is never a dead end.** When Supabase rejects a
password for an email that is already registered to that portal, `signIn` throws
a structured `PasswordSignInBlockedError` (`src/lib/authErrors.ts`) instead of a
plain message. The login screen renders it as an actionable panel: **Email a
reset link to <address>** (the email is carried into the reset screen, so it is
never retyped) plus **Continue with Google / Apple** for accounts that were
created socially and have no password at all. The same email is carried back to
the login form after a successful reset.

**Why the second path exists.** Supabase's built-in mailer sends only a couple of
auth emails per hour per project, so two reset requests can lock a user out of
recovery by email until the hour resets. The link they already received is still
valid for 60 minutes, so the Forgot Password screen accepts that link (or the
6-digit code inside it) and verifies it with
`supabase.auth.verifyOtp({ type: 'recovery', … })` — no new email, no quota.
`src/lib/recoveryLink.ts` parses a full `/auth/v1/verify?token=…` URL, a bare
token hash, or a bare OTP; `mapAuthError` in `src/services/backend.ts` turns
`over_email_send_rate_limit` / 429 into an `AuthRateLimitError` carrying
`retryAfterSeconds`, which the screen shows as a live countdown with the send
button disabled, so repeated clicks cannot extend the wait.

**Owner-side reset (no email at all).** `scripts/reset-user-password.mjs` sets a
new password straight through the GoTrue admin API and validates it against the
same `src/lib/passwordPolicy.ts` rules the reset form uses:

```bash
SUPABASE_URL=https://qwaehqsmodekbgvnaavz.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service_role key> \
  npm run admin:reset-password -- --list

SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  npm run admin:reset-password -- --email user@example.com --password 'New-Pass1'
# also: --user-id, --password-stdin, --confirm-email, --dry-run
```

Exit codes: `0` updated · `1` usage/policy · `2` account not found · `3` API
error. The password is never echoed back. The service_role key bypasses RLS —
keep it out of the repository and out of any `VITE_*` variable.

## Authenticated location synchronization

`src/hooks/useLocationSync.ts` keeps a signed-in user's approximate position in
sync so nearby jobs can be ranked. It is mounted once from
`AuthSessionProvider`, the authenticated root.

| Concern | Implementation |
| --- | --- |
| Authenticated only | Starts only when the shared store reports an authenticated user id |
| One watcher | Module-singleton engine (`src/services/locationSync.ts`) keyed by user id |
| One auth listener | Subscribes to `src/lib/authSession.ts`, never to Supabase directly |
| Logout cleanup | `SIGNED_OUT` / invalidated session releases the watch and drops the cached fix |
| Write volume | Client throttle (30s / 75m, 5-minute heartbeat) plus a server-side throttle |
| RLS | Writes only through `sync_user_location()`, which asserts `auth.uid()`, validates ranges and rate-limits; the table has no insert/update policy |
| Consent | Settings → Privacy → **Location Sharing**; turning it off stops the watcher and calls `clear_user_location()` |
| Missing migration | An unmigrated project returns `unsupported` and stops quietly instead of erroring |

The watcher never runs without HTTPS, never stores coordinates locally, and stops
on `PERMISSION_DENIED`.

1. Main Site URL and both Vercel origins are allow-listed in Supabase Auth.
2. Signup email verification is intentionally disabled (`mailer_autoconfirm=true`); new accounts activate immediately and no verification/resend UI is shipped.
3. Forgot/Reset Password email remains enabled and uses a one-time recovery link; the same screen also accepts the link or code from an email the user already has, so the email quota cannot block recovery.
4. Enable Google or Apple buttons only after those providers and callback URLs are configured.
5. Password recovery redirects to `/?recovery=1`, validates the recovery session before showing the form, and rejects expired/reused links. A dead recovery session swaps the form for the "request a new email" panel instead of failing silently.
6. Reset links expire after 60 minutes; Supabase and the UI require at least 8 characters with lowercase and uppercase letters plus a number (`src/lib/passwordPolicy.ts`, shared with the admin reset CLI).
7. The built-in mailer allows only a few auth emails per hour. Raise the limit under Authentication → Rate Limits or configure a custom SMTP provider before launch; the UI counts the wait down rather than letting users retry.
8. Mobile OTP remains disabled until a real SMS provider is configured.

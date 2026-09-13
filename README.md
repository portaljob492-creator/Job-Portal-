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
20260913000200_jobs_rls_policy_hardening.sql
20260913000300_jobs_query_performance.sql
20260913000400_jobs_rpc_automation.sql
20260913000500_jobs_integration_hardening.sql
20260913000600_jobs_profile_sync.sql
20260913000700_jobs_message_attachments.sql
20260913000800_jobs_signup_trigger_fk_guard.sql
20260913000900_jobs_register_role_profile_ensure.sql
20260913001000_jobs_module_completion.sql
20260913001100_jobs_my_applications.sql
```

`20260913001000_jobs_module_completion.sql` backs the eight-step candidate form
with one authenticated transaction. It saves the shared identity, candidate
profile, skills, experience, education, certifications and preferences, records
the explicit submission time, and returns the server-calculated Candidate ID,
completion percentage and application-readiness result used by the confirmation
screen. Existing owner/related-employer RLS remains in force for every table and
private profile/resume Storage objects remain owner-scoped.

`20260913001100_jobs_my_applications.sql` provides the candidate-owned listing
projection used by `/jobs/my-applications`. It returns only safe display fields
for applications linked to `auth.uid()`, so job details remain available after a
listing is paused, closed, or expired without weakening public `job_posts` RLS.

`20260913000500_jobs_integration_hardening.sql` closes the frontend/backend
gaps the integration audit found. Candidate search gains full-text search: a
generated `search_vector` column over headline/bio/city/state with a GIN index,
and `search_job_candidates()` now takes a text query, an experience floor and
orders by relevance (`websearch_to_tsquery`, so typed input can never raise).
Storage gains the three legitimate readers that were missing — an administrator
reviewing an employer verification or a support attachment, and a salon member
looking at the photo of somebody who applied to their posting — while private
buckets stay private for everyone else, resumes included. `publish_job()` is
revoked from clients (it is a deprecated alias of the admin-only `approve_job()`).
The employer dashboard finally drives moderation through the procedures: each
job card offers *Submit for approval* (the resubmit path a rejected posting
needs), *Pause*, *Resume* and *Close*, each mapped to its RPC and followed by a
workspace refresh. Authorization is no longer assumed to be a client concern:
`test:db` asserts that every procedure callable by a signed-in user carries a
server-side guard and that anonymous requests can reach nothing but the three
policy helpers.

`20260913000400_jobs_rpc_automation.sql` moves the last workflows that the
browser still assembled from several writes into single transactions:
`job_save_profile()` writes the profile and the role-specific row together,
`job_open_conversation()` resolves the participants on the server (a salon member
must name a candidate who applied; anybody else opens their own inquiry about a
live posting) instead of the browser reading the membership table and scanning
the salon's applicant list, and `job_send_message()` checks the sender against
the conversation inside the same transaction that inserts the message and
updates the unread counters. Closing a posting now notifies the candidates whose
applications it closes, and `job_expire_stale_jobs()` automates expiry — schedule
it (service role, or an administrator) so postings past `expires_at` leave the
pipeline and both sides are told:

```sql
select public.job_expire_stale_jobs();   -- returns (expired_jobs, closed_applications)
```

`20260913000300_jobs_query_performance.sql` makes the hot read paths answer
"which salons may this user act for?" once per query instead of once per row.
The membership helpers are `security definer`, so calling them inside a policy
(`... or job_can_manage_application(id) or ...`) re-ran a four-table lookup for
every row a scan touched. Measured on a replayed database with 50k postings,
100k applications, 30k conversations and 300k messages: the employer dashboard
went from 2565ms to 121ms, the employer application list from 7792ms to 98ms,
`get_job_applicant_cards()` from 2491ms to 111ms and
`get_job_conversation_summaries()` from 621ms to 77ms. One index was added (the
admin approval queue); the four indexes that were tried and measured as unused
are listed in the migration so they are not added again by guesswork.

`20260913000200_jobs_rls_policy_hardening.sql` closes the tenant-isolation gap
the policy audit found: `job_conversations_insert_participant` compared two
columns of the *inner* table with each other (`a.job_id = a.job_id`), so any
salon member could open a conversation about another salon's job, with a
candidate who never applied. The policy now binds both columns of the inserted
row, and the two helpers it needs run as `security definer` — a plain subquery
on `job_salon_members` is row-filtered by its own policy, which had silently
made candidate inquiries impossible. The same migration switches the shared
`notifications` / `push_subscriptions` tables (which shipped with RLS disabled)
to own-row policies.

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

`npm run test:db` covers tenant isolation as well as the happy paths: it runs
every workflow as the `authenticated` role and then tries to break out of it —
a second salon inserting a conversation on the first salon's job, opening a
thread with a candidate who never applied, forging salon membership or a
posting, reading another candidate's applications, and reading the rows of the
shared user tables as somebody else. It also scans every policy in `pg_policies`
for a comparison of a column with itself, the mistake that had made one policy
always true.

`npm run test:db` boots an in-process PostgreSQL (PGlite), applies every file in
`supabase/migrations` in order on top of a minimal Supabase bootstrap (roles,
`auth.users`, `auth.uid()`, `storage.objects`, the realtime publication and the
shared Nexora tables) and then drives the real workflows as the `authenticated`
role: create job → admin approval → apply → shortlist → interview → offer →
hire, plus cross-user access attempts, storage buckets/policies and the realtime
publication. It is the fastest way to prove a backend change before deploying.

`npm run test:db` also pins the query-performance guarantees: the set-returning
membership helper exists and is callable from inside policies, no policy or
hot-path RPC falls back to a per-row membership call, the approval-queue index
is present, and anonymous visitors can still read the approved listings.

The atomic-procedure guarantees are pinned too: both halves of a profile save
land together, a conversation can only name participants the caller may talk to,
a stranger cannot post into a thread, and the expiry procedure is idempotent and
refuses a non-administrator.

`npm run test:contract` proves the app and the SQL still agree: every `.rpc()`
call the frontend makes must exist in the migrations with matching argument
names, every table must be RLS-protected, the schema-integrity guarantees are
present, and no secret may reach the bundle.

`npm run test:location` executes the real modules (`src/lib/supabase.ts`,
`src/routing.ts`, `src/lib/authErrors.ts`, `src/lib/signUpOutcome.ts`,
`src/services/locationSync.ts`) with injected fakes and asserts the repository
invariants: one Supabase client, one auth listener owner, the PKCE storage key,
the login route alias, watcher throttling/cleanup, and the location migration's
RLS posture. The sign-up / sign-in flow is covered there too: an unconfirmed
sign-up is a success with a next step (never an error), the confirmation link
returns to this app, a session arriving from that link still opens the portal,
and the structured sign-in failures keep reaching the screens that render their
recovery actions.

## Sign-up and sign-in

`signUp` sends `emailRedirectTo` pointing at this app (`?confirmed=1`) because
the project uses PKCE: the code in the confirmation link can only be exchanged
by a page that runs the app. When Supabase requires the address to be confirmed,
sign-up returns a user and no session — that is a success, and the app shows the
confirmation screen with a re-send button and a countdown. Signing in before
confirming is reported as its own structured state, so the login screen offers
the re-send instead of a bare credential error.

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
2. Keep **Framework Preset: Vite**. `vercel.json` already defines `npm ci`, `npm run build`, `dist`, and a catch-all SPA rewrite (`/(.*) → /index.html`) so every client-side route — `/login`, `/signup`, `/dashboard/*`, `/reset-password`, … — resolves to the app shell on direct hits and refreshes instead of Vercel's platform `404: NOT_FOUND`. Static files in `dist/` (hashed assets, icons, manifest, service worker) are matched by the filesystem **before** rewrites, so they keep being served as files. Guarded by `npm run test:vercel`.
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

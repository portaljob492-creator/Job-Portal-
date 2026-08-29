# Nexora Job Portal — Codebase Gap Analysis

**Repository:** `portaljob492-creator/Job-Portal-`
**Deployment:** https://job-portal-nexora.vercel.app/
**Branch analysed:** `arena/01a04be5-job-portal` @ `3767814`
**Date:** 2026-08-29
**Method:** static analysis of all 11 migrations + 47 source files, cross-referenced against live runtime probes (`tsc --noEmit`, dev server, egress tests)

---

## Executive summary

The project has an unusually **mature backend** and an unusually **thin integration layer**. The Supabase schema is production-grade — 36 tables, 3 secure views, 54 RPCs, 67 RLS policies, 7 storage buckets, all RLS-enabled — but the React app only wires up a fraction of it, and several of the parts it *does* wire up are wired incorrectly.

The headline numbers:

| Metric | Value | Implication |
|---|---:|---|
| Migrations | 11 | all applied in filename order, no gaps |
| Tables defined | 36 | — |
| Tables with **no client read path** | **21** (58%) | schema-only features |
| RPCs defined | 54 | — |
| RPCs **never called from the app** | **34** (63%) | dead backend surface |
| RPCs called only by the test script | 4 | interview/offer lifecycle |
| Storage buckets defined | 7 | — |
| `storage.from()` calls in `src/` | **0** | uploads never reach Supabase |
| RLS-enabled tables without a policy | 0 | ✅ good — no lockouts |
| Tables depended on but **never defined** | 6 | migrations not portable |
| CI workflows | **0** | nothing runs automatically |
| TypeScript errors (`tsc --noEmit`) | 0 | ✅ clean |

**The single most important finding:** the employer *hire* flow shows a success screen while the database write is guaranteed to fail, and the interview scheduling form silently discards the employer's chosen date/time. Four of the five most business-critical workflows (interview → offer → accept → hire) exist only inside the integration test script, not in the UI.

---

## 1. Database: missing tables, schema mismatches, migrations

### 1.1 Migrations are complete and correctly ordered ✅

`supabase/migrations/` contains 11 files with contiguous timestamps (`20260808170000` → `20260810090000`). Every one is wrapped in `begin/commit`, and all DDL uses `create table if not exists` / `create or replace`. **There are no missing or unapplied migrations.**

However, `supabase/config.toml` sets `[db.migrations] schema_paths = []` and `[db.seed] enabled = false`, so `supabase db push` is the only application path — and with no CI (§2.4), **application is entirely manual and unverified**.

### 1.2 🔴 CRITICAL — Hard dependency on 6 tables that don't exist in this repo

The core migration states it reuses an existing "Nexora marketplace schema", but that schema is **not in this repository**:

| Table | References | Defined here? |
|---|---:|---|
| `public.profiles` | 41 | ❌ |
| `public.salons` | 29 | ❌ |
| `public.organizations` | 3 | ❌ |
| `public.organization_members` | 4 | ❌ |
| `public.notifications` | 2 | ❌ |
| `public.push_subscriptions` | 1 | ❌ |

`20260808170000_jobs_core.sql` opens with `references public.profiles(id)` on `job_user_roles`. **On a fresh Supabase project the very first migration aborts** — the whole schema is undeployable without a pre-existing marketplace database. There is no schema contract, no seed, and no documentation of the required columns (the code assumes `profiles.id/full_name/phone/avatar_path/preferred_city/preferred_area`, `salons.name/slug/logo_path/verified/rating_average/review_count/city/state/is_active/deleted_at`, `organizations.display_name/legal_name/business_category/status/created_by`).

### 1.3 🟠 HIGH — 21 of 36 tables have no client read path

These tables are created, RLS-protected, and mutated by server-side RPCs, but **no screen ever reads them**. They are schema-only features:

`job_offers`, `job_interview_requests`, `job_interview_schedule_history`, `job_skills`, `job_post_skills`, `job_salon_profiles`, `job_employer_verifications`, `job_candidate_experience`, `job_candidate_education`, `job_candidate_certifications`, `job_candidate_resumes`, `job_candidate_preferences`, `job_candidate_preferred_roles`, `job_candidate_employment_types`, `job_support_tickets`, `job_support_messages`, `job_reports`, `job_blocked_employers`, `job_audit_log`, `job_account_deletion_requests`, `job_user_locations`

The 28-row `job_skills` seed (`20260808170300_jobs_seed.sql`) is unreachable from the UI — there is no skills picker anywhere.

### 1.4 🟠 HIGH — `job_user_locations` is write-only (dead feature)

`20260810090000_jobs_location_sync.sql` states: *"Stores the last known device position … so that nearby-job ranking can be computed server side."*

The write path is fully wired (`useLocationSync` → `sync_user_location` / `clear_user_location`), but **nothing consumes the table**:

- `grep -rn "job_user_locations" supabase/migrations/*.sql` → matches only its own migration
- `public_job_listings` never references it
- `search_job_candidates` never references it
- `job_location_distance_m` is used only by `sync_user_location`'s own 25m throttle

Users grant geolocation permission and their coordinates are stored and never read. **This is a privacy/data-minimisation problem as well as dead code** — you are collecting location data with no purpose.

### 1.5 🟡 MEDIUM — Stale integration test (asserts a status that no longer exists)

`scripts/test-supabase-backend.mjs:100`:
```js
assertCheck('secure job create and publish', published.status === 'published');
```
Migration `20260808170900_jobs_admin_approval.sql` replaced `'published'` with `'approved'` and redefined `publish_job` as a wrapper for `approve_job`. **This assertion now fails by construction.** The test has not been re-run since the approval migration landed.

The script is additionally gated behind `ALLOW_JOB_BACKEND_TEST` + `SUPABASE_SERVICE_ROLE_KEY`, and there is no `.github/workflows` directory — so it never runs at all.

### 1.6 Schema mismatches found

| Location | Issue |
|---|---|
| `backend.ts` `createJob` | Never passes `p_responsibilities`; `create_job_post` has no such parameter. `mapJob` maps `requirements: textList(row.responsibilities)` → **job requirements are always empty**. The admin approval screen renders "Requirements:" blank. |
| `backend.ts` `saveProfile` | Writes `avatarUrl` (a base64 data URL) into `profiles.avatar_path`, a column intended for a storage path (§3.4). |
| `backend.ts` `createApplication` | Always passes `p_resume_id: null`. The `job-resumes` bucket and `job_candidate_resumes` table are unreachable from the UI. |
| `employmentToDb` | Lossy: both `'Commission'` and `'Chair Rental'` map to `'freelance'`; `'internship'` maps to `'Part-time'` on the way back. An internship round-trips as Part-time. |
| `job_account_deletion_requests` | `unique(user_id, status)` — a user can have a pending + a completed request, but never two pending. Correct, but there is no partial unique index, so this is the one path that works. |

---

## 2. API surface, integrations, and egress

### 2.1 🔴 CRITICAL — The interview → offer → hire lifecycle does not exist in the UI

Four RPCs are exercised **only** by `scripts/test-supabase-backend.mjs` and by nothing in `src/`:

```
accept_interview      complete_interview
send_job_offer        accept_job_offer
```

Verified: `grep -rn "send_job_offer\|accept_job_offer\|accept_interview\|complete_interview" src/` → **zero hits**.

Consequences:

1. **Employer "Send Offer" always fails server-side.** `EmployerWorkspace.tsx:818-823`:
   ```tsx
   onSendOffer={(details) => {
     onUpdateApplicantStatus(offeringApplicant.id, 'Hired');   // → mark_candidate_hired
     setHiredOfferDetails(details);
     setHiredApplicant(offeringApplicant);                     // shows success screen anyway
   }}
   ```
   `mark_candidate_hired` requires `app.status = 'offer_accepted'` (`20260808170100_jobs_functions.sql`), but the application is at most `shortlisted`. The RPC raises `INVALID_APPLICATION_TRANSITION`; the UI has already rendered `HiringSuccessScreen`. **Every offer details field — salary, joining date, employment type, offer notes, offer-letter PDF — is discarded. `job_offers` is never populated by the app.**

2. **Seeker "Accept Interview" / "Accept Offer" is local-only.** `App.tsx:971-1013` passes `onUpdateApplicationStatus` handlers that only `setApplications(...)` in React state. No RPC is called. The DB row stays at `interview_requested` / `offer_sent`, and the acceptance reverts on the next realtime refresh.

3. **Interview scheduling discards the employer's input.** `EmployerWorkspace.handleScheduleConfirm` → `backend.ts updateApplicationStatus` → `create_interview_request` with hardcoded arguments:
   ```ts
   p_interview_type: 'in_person',
   p_scheduled_start: new Date(Date.now() + 3 * 86_400_000).toISOString(),  // always +3 days
   p_duration_minutes: 30,
   p_location_text: 'Salon location',
   ```
   The date, time, duration, mode and location chosen in `RequestInterviewScreen` are thrown away. **The candidate receives an invitation for a slot the employer never selected.**

### 2.2 🔴 CRITICAL — Seeker-initiated messaging is blocked by RLS

`backend.ts createConversationRecord`, when a job seeker starts a conversation, resolves the employer with:
```ts
const { data: member, error } = await client.from('job_salon_members')
  .select('user_id').eq('salon_id', job.salon_id).eq('status','active')
  .order('created_at').limit(1).single();
if (error) throw error;
```
The `job_salon_members_read` policy is:
```sql
using (user_id = (select auth.uid()) or public.job_is_admin()
       or public.job_is_active_salon_member(salon_id));
```
`job_is_active_salon_member` requires the caller to be an owner/manager/recruiter of that salon — **false for a job seeker**. RLS therefore returns 0 rows, `.single()` throws `PGRST116`, and `App.tsx:637` rolls the conversation back with "Unable to start conversation."

**A job seeker can never open a new conversation.** (Replies inside an existing conversation work.)

### 2.3 🔴 CRITICAL — Supabase Storage is entirely unwired

7 buckets and 9 storage policies are defined (`job-resumes`, `job-certificates`, `employer-verification`, `job-offers`, `job-support-attachments`, `job-profile-media`, `salon-public-media`). **`grep -rc 'storage.from(' src/` returns 0.**

Every upload path uses `FileReader.readAsDataURL()` and keeps the result in React state:

| Component | Line | Behaviour |
|---|---|---|
| `ProfileImageUploader` | 212-218 | base64 → `onSaveAvatar` → `saveProfile` writes it to `profiles.avatar_path` |
| `PortfolioGallery` | 215-222 | base64 → local state only; `job_portfolio_items` is **read** by `loadWorkspace` but never written |
| `MessagingCenter` | 118-131 | base64 → inserted into `job_messages.attachment` (jsonb) as a data URL |
| `CreateJobOfferScreen` | 204 | `<input type="file" accept=".pdf">` — the offer letter is never uploaded anywhere |

A multi-megabyte base64 string is being written into a `text` column meant for a storage path, and it does not survive a reload. Portfolio work and offer letters are lost entirely.

### 2.4 🟠 HIGH — No CI, no automated verification

There is no `.github/workflows` directory. `package.json` exposes five test scripts (`test:backend`, `test:location`, `test:recovery`, `test:pwa`, `test:reset`), all manual, three of which need live Supabase credentials plus a service-role key. Combined with the stale assertion in §1.5, **no part of the backend contract is verified automatically**.

### 2.5 🟠 HIGH — Missing API surface

34 of 54 RPCs are never invoked by the app. The business-relevant ones:

- **Job lifecycle:** `submit_job_for_approval`, `pause_job`, `resume_job`, `close_job`
- **Application lifecycle:** `withdraw_application`, `withdraw_job_offer`, `decline_interview`, `decline_job_offer`, `request_interview_reschedule`, `reschedule_interview`
- **Trust & safety:** `report_job`, `report_employer`, `create_job_support_ticket`, `request_job_account_deletion`, `submit_employer_verification`, `review_employer_verification`
- **Discovery:** `search_job_candidates`

There is **no server/Edge Function layer at all** — `express` is a declared dependency with zero imports. All business logic is either in SQL or in the browser.

### 2.6 🟡 MEDIUM — Sandbox egress allowlist (verified with live probes)

Egress from this sandbox is allowlisted. Measured results:

| Host | Result |
|---|---|
| `registry.npmjs.org` | ✅ HTTP 200 |
| `api.github.com` | ✅ HTTP 200 |
| `qwaehqsmodekbgvnaavz.supabase.co` | ❌ HTTP 000 (blocked) |
| `job-portal-nexora.vercel.app` | ❌ HTTP 000 (blocked) |
| `fonts.googleapis.com` | ❌ HTTP 000 (blocked) |
| `images.unsplash.com` | ❌ HTTP 000 (blocked) |

Impact on this workspace specifically:

- The app **cannot reach Supabase** from here, so it always falls into demo mode (§3.3).
- **49 hardcoded `images.unsplash.com` URLs** in `mockData.ts` and the avatar/portfolio preset arrays, plus **17 `lh3.googleusercontent.com`** avatars, all render broken.
- The Google Fonts `<link>` in `index.html` fails. There is **no `font-display` fallback stack, no `onerror` handler on any `<img>`, and no image error boundary** — broken images render as empty boxes with no alt fallback.

Note this is a *sandbox* restriction, not a production one; the deployed Vercel app is unaffected. In this preview environment it makes the app look substantially more broken than it is.

### 2.7 🟡 MEDIUM — Unused dependencies

`@google/genai` (with its `GEMINI_API_KEY` env var) and `express` are declared in `package.json` with **zero imports** anywhere in `src/`, `scripts/`, or `vite.config.ts`.

---

## 3. UI, auth/authorization, and state handlers

### 3.1 ✅ RLS coverage is genuinely complete

This is the strongest part of the codebase, and worth stating explicitly:

- All 35 Jobs tables in the main RLS migration have RLS enabled **and** at least one policy — **zero RLS-enabled-but-policy-less tables**, i.e. no accidental total lockouts.
- `job_user_locations` (created later) is handled correctly in its own migration.
- Privileged read paths are properly funnelled through `security definer` RPCs (`get_job_applicant_cards`, `get_job_conversation_summaries`) that re-check `job_current_role()` / `job_is_active_salon_member()`.
- The three public views are `security_invoker=false` with `security_barrier=true` and an explicit column allowlist, and `revoke all … from public` precedes each grant.
- `job_guard_post_status` correctly blocks unprivileged status transitions.
- Storage policies correctly scope private objects to `(storage.foldername(name))[1] = auth.uid()::text`.

**The RLS problems that exist are not "missing policies" — they are policies that are too strict for a legitimate client path (§2.2) and client queries that over-fetch and rely on RLS to save them (§3.2).**

### 3.2 🔴 CRITICAL — Employer workspace over-fetches and depends entirely on RLS

`backend.ts loadWorkspace`:
```ts
role === 'seeker'
  ? client.from('job_applications').select(applicationSelect).eq('candidate_user_id', user.id)…
  : client.from('job_applications').select(applicationSelect).order('submitted_at', …)
```
The employer branch has **no salon filter** — it selects every application on the platform and relies on RLS to narrow it. Same for `client.from('job_messages').select('*')` with no conversation filter.

This is correct *today* because RLS holds, but it means **any RLS regression, any added policy, or any service-role key reaching the browser becomes a full cross-tenant data breach.** Defence in depth is absent.

### 3.3 🔴 CRITICAL — Silent demo mode when env vars are missing

`src/lib/supabase.ts`: `isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)`. When `VITE_SUPABASE_ANON_KEY` is absent, `supabase` is `null`, and `App.tsx` seeds every piece of state from `INITIAL_*` mock data:

```ts
const [jobs, setJobs] = useState<JobPosting[]>(INITIAL_JOBS);
const [userProfile, setUserProfile] = useState<UserProfile>({
  name: 'Jane Doe', email: 'jane@example.com', businessName: 'Nexora Beauty Group', …
```

Verified against the running dev server — the served bundle contains `import.meta.env = {"BASE_URL":"/","DEV":true,…}` with **no `VITE_SUPABASE_ANON_KEY`** and `supabase = null`.

The result is **a fully interactive app that silently persists nothing**: a user can sign up, post a job, apply, message and "hire", see plausible mock salons, and lose everything on refresh. Because `.env*` is gitignored and there is no CI smoke test, **a missing or rotated Vercel env var produces this state with no error banner**.

### 3.4 Broken state handlers

| # | Severity | Location | Defect |
|---|---|---|---|
| 1 | 🔴 | `App.tsx:527-546` `handleUpdateApplicantStatus` | Optimistically sets status and, on failure, only calls `setBackendError` — **no rollback**. Every other mutation (bookmark `414`, apply `471`, message `589`, conversation `638`) *does* roll back. A failed hire leaves a permanent phantom "Hired" row and the `HiringSuccessScreen` already shown. |
| 2 | 🟠 | `App.tsx:429` + `backend.ts:996` | `applicationId = crypto.randomUUID()` is passed as `_requestedId` — which is **unused** (note the `_` prefix). The RPC mints its own UUID, so the optimistic row's id never matches the DB row. Next refresh duplicates or replaces it. |
| 3 | 🟠 | `App.tsx:537-549` | `setApplications(prev => prev.map(app => …))` **ignores `applicantId`** — setting one applicant to "Interview Scheduled" sets *every* application to "Interview Scheduled" with the hardcoded date `'Tue, Aug 12 • 2:00 PM'`. |
| 4 | 🟡 | `backend.ts` `createConversationRecord` | Upserts with a fresh client-side UUID and `onConflict: 'job_id,candidate_user_id,employer_user_id'`. On conflict it rewrites the existing row's primary key, which **FK-violates `job_messages.conversation_id`** if any messages exist. |

### 3.5 🔴 CRITICAL — Trust & Safety surfaces are theatre

All three of these present a success state while writing nothing:

| Feature | Location | What actually happens |
|---|---|---|
| Support tickets | `SupportScreen.tsx` `handleFormSubmit` | `randomTicketId = '#' + Math.floor(1020 + Math.random()*8000)` → toast. `create_job_support_ticket` never called. |
| Report job / employer | `SupportScreen.tsx` `handleReportJobSubmit` | Toast only. `report_job` / `report_employer` never called. |
| Account deletion | `SettingsScreen.tsx:172-182` | Toast `"🛑 Account scheduled for deletion."` + `onLogout()` after 1.5s. `request_job_account_deletion` never called. **No data is deleted** — a GDPR/DPDP right-to-erasure exposure. |
| Block employer | `SettingsScreen.tsx:166` | Local state only. `job_blocked_employers` never written. |

### 3.6 🟠 HIGH — Features that read from mock data instead of the database

| Screen / tab | Location | Defect |
|---|---|---|
| Applicant portfolio (employer view) | `EmployerWorkspace.tsx:797` | `<PortfolioGallery items={INITIAL_PORTFOLIO_ITEMS} isEditable={false} />` — **every applicant shows the same hardcoded stock photos.** `onUpdateItems` is a no-op. |
| Employer Interviews tab | `EmployerInterviewsTab.tsx:15-35` | Hardcoded "Elena Rodriguez" / "Marcus Chen", with an inline comment admitting *"we will mock the split for the UI"*. Real `job_interview_requests` are never surfaced to the employer. |
| Saved searches | `JobSeekerWorkspace.tsx:286-306` | Created/deleted in React state only. `job_saved_searches` is read by `loadWorkspace` but never written → **saved searches vanish on refresh**, and `job_create_match_notifications` can never fire for a real user. |

### 3.7 🟡 MEDIUM — Incomplete realtime coverage

`App.tsx:283-296` subscribes to `job_messages`, `job_applications`, `job_notifications`. The `supabase_realtime` publication also contains `job_conversations`, `job_interview_requests`, `job_offers` — **none of which are subscribed to**, so interviews and offers never appear live. The channel also has no `filter`, so any permitted change triggers a full `hydrateWorkspace` refetch (debounced 250ms), which will not scale.

### 3.8 🟡 MEDIUM — Dead UI state

- `ScreenState` declares `'employer_onboarding_step3'` (`types.ts`) — **never rendered**; there is no `EmployerOnboardingStep3Screen`. `EmployerOnboardingStep2Screen.onContinue` jumps straight to `main_app` (`App.tsx:897`).
- `skills` are surfaced in `Applicant.skills` and `get_job_applicant_cards`, and `job_candidate_skills` is queried — but there is **no UI to add or edit skills**, so the array is always empty for new users.

---

## 4. Prioritised findings and action items

### 🔴 CRITICAL — fix before the next user touches the app

| # | Finding | Immediate action |
|---|---|---|
| **C1** | Interview → offer → hire lifecycle absent from UI; `send_job_offer` / `accept_job_offer` / `accept_interview` / `complete_interview` never called. Employer "Send Offer" calls `mark_candidate_hired`, which requires `status='offer_accepted'` → **guaranteed `INVALID_APPLICATION_TRANSITION`**, yet `HiringSuccessScreen` renders anyway. Offer payload discarded; `job_offers` never populated. | Wire the real state machine. Replace `onSendOffer` with `send_job_offer(...)` → `accept_job_offer` → `mark_candidate_hired`. Show `HiringSuccessScreen` **only after the RPC resolves**, not before. Add a `sendJobOffer()` / `acceptOffer()` / `acceptInterview()` / `completeInterview()` layer in `services/backend.ts`. |
| **C2** | Seeker cannot start a conversation — `job_salon_members` read is RLS-denied for non-members, `.single()` throws, conversation rolls back. | Add a `security definer` RPC (e.g. `get_job_salon_primary_member(salon_id uuid)`) that resolves the employer without exposing the membership table, and call it from `createConversationRecord`. Do **not** loosen `job_salon_members_read`. |
| **C3** | Supabase Storage unused (0 calls). Avatars/portfolio/attachments stored as base64 data URLs; `profiles.avatar_path` receives multi-MB base64. Portfolio and offer letters never persist. | Implement `storage.from('job-profile-media').upload()` (path `<uid>/…`, matching the existing folder policy) and store the returned path. Same for `job_portfolio_items.image_path`, `job-resumes`, `job-offers`. **Immediately stop writing data URLs to `*_path` columns.** |
| **C4** | Trust & Safety is theatre — support tickets, reports, and account deletion write nothing; account deletion is a compliance exposure. | Call `create_job_support_ticket`, `report_job`, `report_employer`, `request_job_account_deletion`. Until then, remove the success states or label them clearly as non-functional. Remove the fake ticket-ID generator. |
| **C5** | Silent demo mode: missing `VITE_SUPABASE_ANON_KEY` yields a fully interactive app seeded with "Jane Doe" / "Nexora Beauty Group" that persists nothing. | Fail loudly. If `!isSupabaseConfigured`, render an explicit misconfiguration banner and **disable auth and all mutating actions**. Add a post-deploy smoke test that asserts the built bundle contains a real key. |
| **C6** | Employer `loadWorkspace` selects all applications and all messages with no filter, relying solely on RLS. | Add explicit `.eq()` filters (`salon_id`, `conversation_id`) alongside RLS. Keep RLS as the security boundary; add the query filter as defence in depth. |
| **C7** | Failed applicant-status update has no rollback (unlike every other mutation) → permanent phantom "Hired". | Mirror the existing rollback pattern: capture prior status and restore it in `.catch()`. |

### 🟠 HIGH — fix this sprint

| # | Finding | Immediate action |
|---|---|---|
| **H1** | Interview scheduling discards the employer's date/time/type/location; `create_interview_request` is called with `now+3d`, `in_person`, `'Salon location'`. | Thread `RequestInterviewScreen`'s collected values through `handleScheduleConfirm` → `updateApplicationStatus` → `create_interview_request`. |
| **H2** | Seeker "Accept Interview" / "Accept Offer" only mutate React state; revert on refresh. | Call `accept_interview` / `accept_job_offer` from `InterviewInvitationScreen` / `JobOfferScreen`. |
| **H3** | 21 tables have no client read path; 34 of 54 RPCs never called (`pause_job`, `withdraw_application`, `reschedule_interview`, `search_job_candidates`, …). | Triage into *build the UI* vs *delete the SQL*. Either wire at least job pause/resume/close and application withdrawal, or drop them so the surface matches reality. |
| **H4** | 6 required tables (`profiles`, `salons`, `organizations`, …) are not defined here; a fresh project cannot run migration 1. | Ship a `00000000000000_marketplace_contract.sql` defining the required columns (even as a documented stub), or a `supabase/seed.sql` + README contract. Without this the repo is not deployable. |
| **H5** | Saved searches never persist → `job_create_match_notifications` can never fire; the entire job-alerts feature is inert. | Add `createSavedSearch` / `deleteSavedSearch` writes to `job_saved_searches` from `JobSeekerWorkspace`. |
| **H6** | Stale test asserts `status === 'published'` (now `'approved'`); **no CI exists**. | Fix the assertion, add a GitHub Actions workflow running `tsc --noEmit` + `npm run build` on every PR, and run the backend suite on a schedule against a preview branch. |
| **H7** | Optimistic application id never matches the server id (`_requestedId` unused). | Return the server-generated id from `submit_job_application` and reconcile it into state (`prev.map(...)`), rather than discarding it. |
| **H8** | Status change applied to **all** applications, ignoring `applicantId`, with a hardcoded interview date. | Filter by `applicantId` ↔ `jobId`; derive the interview date from the server row (`row.interviews[0].scheduled_start`, already mapped in `mapApplication`). |
| **H9** | Employer sees hardcoded `INITIAL_PORTFOLIO_ITEMS` for every applicant. | Load the applicant's real `job_portfolio_items` (needs `get_job_applicant_cards` to expose `candidate_profile_id`). Until then, show "No portfolio yet" rather than stock photos. |
| **H10** | Employer Interviews tab shows hardcoded candidates. | Render from `job_interview_requests` (add employer-side read + realtime subscription). |
| **H11** | Job `requirements` silently dropped — `create_job_post` has no `p_responsibilities` parameter. | Add the parameter to the RPC and pass it from `createJob`; surface it in the admin approval screen. |

### 🟡 MEDIUM — schedule

| # | Finding | Immediate action |
|---|---|---|
| **M1** | Sandbox egress blocks Supabase/Vercel/fonts/Unsplash; 49 Unsplash + 17 Google avatars break with no fallback. | Self-host or bundle the demo imagery (or route it through a stable CDN), add a local font fallback stack, and add an `onError` fallback image so broken assets degrade gracefully. |
| **M2** | Realtime covers 3 of 6 published tables; unfiltered channel triggers full refetch. | Subscribe to `job_conversations`, `job_interview_requests`, `job_offers`; add per-channel `filter` and patch state incrementally instead of refetching the whole workspace. |
| **M3** | Conversation upsert rewrites the PK on conflict, FK-violating existing messages. | Look up the existing conversation first and reuse its id; only insert when absent. |
| **M4** | `providers` / `salons` / `organizations` RLS is out of this repo's control but load-bearing. | Document the required policies and add a preflight check that verifies each dependent table is readable/writable as expected. |
| **M5** | Unused deps: `@google/genai` (+ `GEMINI_API_KEY`), `express`. | Remove, or implement the feature they imply. |
| **M6** | `employmentToDb` is lossy (`internship`→`Part-time`, `Chair Rental`→`freelance`). | Add distinct DB values or remove the UI options that cannot round-trip. |
| **M7** | Dead UI state `employer_onboarding_step3` and the skills taxonomy have no editor. | Remove the dead state; add a skills picker or drop `Applicant.skills`. |
| **M8** | `job_user_locations` collects and stores geolocation that nothing reads. | Either implement nearby-job ranking (the stated purpose) or stop collecting it. |

---

## Verification appendix

Commands used, all reproducible from the repo root:

```bash
# Schema vs. client surface
grep -rhoP 'create table (if not exists )?(public\.)?\K[a-z_0-9]+' supabase/migrations/*.sql | sort -u
grep -rhoP "\.from\(\s*'\K[a-z_0-9]+" src/ scripts/ | sort -u
grep -rhoP "\.rpc\(\s*'\K[a-z_0-9]+"   src/ scripts/ | sort -u

# RLS coverage: enabled-vs-policied (result: 35 / 35, zero lockouts)
sed -n '9,33p' supabase/migrations/20260808170200_jobs_rls_storage.sql \
  | grep -oP "'\K[a-z_0-9]+(?=')" | sort -u > /tmp/rls_enabled.txt
awk '/^on public\./{print $2}' supabase/migrations/20260808170200_jobs_rls_storage.sql \
  | sed 's/public\.//' | sort -u > /tmp/with_policy.txt
comm -23 /tmp/rls_enabled.txt /tmp/with_policy.txt

# Storage usage (result: 0)
grep -rc 'storage.from(' src/

# Lifecycle RPCs in src/ (result: none — test script only)
grep -rn "send_job_offer\|accept_job_offer\|accept_interview\|complete_interview" src/

# Type check (result: 0 errors)
npx tsc --noEmit

# Egress probe
for h in https://qwaehqsmodekbgvnaavz.supabase.co/rest/v1/ \
         https://job-portal-nexora.vercel.app/ \
         https://fonts.googleapis.com https://images.unsplash.com \
         https://api.github.com https://registry.npmjs.org; do
  curl -s -o /dev/null -m 12 -w "%{http_code} $h\n" "$h"
done
```

The dev server was run and inspected; the served bundle confirms `VITE_SUPABASE_ANON_KEY` is absent in this environment and `supabase` resolves to `null`, reproducing demo mode (C5).

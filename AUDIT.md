# Nexora Jobs — Complete Audit: Missing Items & Gaps Analysis

**Date:** 2026-09-13 · **Scope:** full repo (`src/`, `server.ts`, `supabase/migrations/`, `scripts/`, configs, docs)
**Method:** static code analysis + SQL migration review + build/test execution (no live Supabase access from sandbox)
**Codebase size:** ~21.5k LOC app code · 17 migrations (~200 KB SQL, 34 tables, 83 policies, 80 RPCs)

---

## 1. Executive summary

The foundation is genuinely strong: auth architecture, RLS posture, RPC discipline, and the
password-recovery flow are all well above average. **The backend (Supabase) is far ahead of the
frontend wiring.** The dominant gap pattern is: **UI exists + server capability exists, but the two
are not connected** — and in 7 cases the UI *claims success* (toast/alert) for operations that never
happen. Those "lying UI" cases are the P0s.

| Severity | Count | Meaning |
|----------|-------|---------|
| P0 Critical | 8 | Users misled / data silently lost / core workflow broken |
| P1 High | 12 | Major features missing, broken on Vercel, or unscalable |
| P2 Medium | 9 | Perf, resilience, platform-coupling, a11y gaps |
| P3 Low | 5 | Dead code, observability, docs drift |

**One-line verdict:** finish the last-mile wiring (storage, resumes, interviews, reports, tickets,
account deletion, password change), remove or clearly label demo fixtures, add CI + ErrorBoundary +
pagination — and this becomes a production-grade app. The database layer needs almost no work.

---

## 2. What's solid (keep doing this)

- **Auth core** (`src/lib/supabase.ts`, `authSession.ts`, `AuthSessionProvider`): exactly one
  client, one `onAuthStateChange` listener, PKCE-only, namespaced storage key, legacy-session
  migration, placeholder rejection, plus production diagnostics with masked secrets.
- **Signup/recovery flows** (`signUpOutcome.ts`, `recoveryLink.ts`, `Forgot/ResetPasswordScreen`):
  correctly handles confirm-required signups, resend, token-paste fallback when email quota is
  exhausted, recovery-session expiry. Rarely this thorough.
- **Backend discipline**: RPCs take identity from the session (forged `user_id` impossible);
  all 80 `SECURITY DEFINER` functions set `search_path`; RLS enabled on all 34 tables via explicit
  loops; 83 policies; no `USING (true)`; anon can only `SELECT` two public views.
- **Job lifecycle loop is fully wired**: create (draft) → submit → admin approve/reject →
  pause/resume/close, with employer-visible status labels (`EmployerWorkspace.tsx:445-461`).
- **Offer + interview-response flows** are wired both directions (`sendJobOffer`,
  `respondToJobOffer`, `respondToInterview`).
- **Realtime refresh** on `job_messages` / `job_applications` / `job_notifications` with debounced
  re-hydration; `job_match` alerts flow DB-trigger → realtime → UI correctly.
- **PWA install path** done right: early `beforeinstallprompt` capture, Safari guidance, manifest,
  icons, SW headers in `vercel.json`.
- **Demo-mode resilience**: app never crashes without env vars; config banner + diagnostics instead.
- **Docs**: README is strong on migrations, RLS, auth, and Vercel redeploy semantics.

---

## 3. P0 — Critical (fix before calling this production)

### P0-1. Interview scheduling form data is silently discarded
- **Where:** `RequestInterviewScreen.tsx:4-31` (form collects type/date/time/duration/location/
  message, but `onConfirm()` takes **no arguments**) → `EmployerWorkspace.tsx:146-152`
  (`handleScheduleConfirm` only flips status) → `backend.ts:updateApplicationStatus` calls
  `create_interview_request` with **hardcoded** values (`in_person`, now+3d, 30 min,
  `'Salon location'`, generic message).
- **Impact:** whatever the employer enters is thrown away; seekers receive wrong date/mode/venue.
- **Fix:** pass the form payload through `onConfirm(details)` → new `scheduleInterview(params)`
  backend function → RPC args. Validate date is in the future.

### P0-2. Resume upload is non-functional end-to-end
- **Where:** `SeekerProfileTab.tsx:910-975` stores **only the filename** in component state
  ("Ready and attached automatically" is false); download button fires
  `alert('Downloaded sample resume PDF')`; `ApplyJobScreen.tsx:182-200` shows hardcoded
  `Anjali_Resume_2024.pdf / 2.4 MB`; `backend.ts:createApplication` always sends
  `p_resume_id: null`.
- **Impact:** applications carry no resume; employers can't see one. Meanwhile
  `job_candidate_resumes` table + private `job-resumes` bucket (10 MB, pdf/doc/docx) sit unused.
- **Fix:** upload to `job-resumes` via signed URLs, insert `job_candidate_resumes` row, pass the id
  at apply time; render real file in `ResumePreview`.

### P0-3. "Delete Account" deletes nothing (compliance risk)
- **Where:** `SettingsScreen.tsx:178-189` toasts "scheduled for deletion" then logs out;
  in-app Privacy Policy text (§policy) **claims** "permanently remove all records… instantly
  through the Delete Account portal" — false. Employer `EmployerProfileTab.tsx:169-176` Delete
  button has **no `onClick` at all**. `request_job_account_deletion` RPC +
  `job_account_deletion_requests` table exist but have zero client callers; no admin review UI.
- **Impact:** DPDP Act (India) / GDPR erasure-request exposure; users misled about data removal.
- **Fix:** wire the RPC, show request status, add deletion-request queue to admin UI, document the
  retention/SLA honestly.

### P0-4. In-settings password change is fake
- **Where:** `SettingsScreen.tsx:151-165` validates locally, toasts "🔑 Password changed
  successfully", never calls `auth.updateUser` (the only `updatePassword` caller is the recovery
  flow, `backend.ts:603`).
- **Impact:** users believe their password changed; old password still works; lockout confusion.
- **Fix:** call `supabase.auth.updateUser({ password })`, require re-auth per policy, surface errors.

### P0-5. Job/employer reports go nowhere (Trust & Safety hole)
- **Where:** `SupportScreen.tsx:184-209` — both report submits only fire success toasts.
  `report_job` / `report_employer` RPCs + `job_reports` table are never called.
- **Impact:** harassment/scam reports evaporate while UI promises "coordinators will investigate
  immediately."
- **Fix:** call the RPCs, add reports queue to admin UI, add confirmation with reference id.

### P0-6. Support tickets go nowhere
- **Where:** `SupportScreen.tsx:172-182` toasts "ticket created… reply within 2 hours";
  `createSupportTicket` (`backend.ts:1189`) has **zero callers**; no admin ticket view; live-chat
  widget is component-local state with no persistence.
- **Fix:** persist via `createSupportTicket`, add ticket inbox (user + admin), or remove the SLA
  promise from copy.

### P0-7. Media stored as base64 data URLs inside Postgres (Storage layer 100% unwired)
- **Where:** zero `storage.*` calls in `src/`; avatars (`ProfileImageUploader` → `onSaveAvatar` →
  `App.tsx:847` → `saveProfile` → `p_avatar_path`), message attachments
  (`MessagingCenter.tsx:119-133` → `job_send_message.p_attachment`), portfolio photos
  (`PortfolioGallery`) all persist full `data:image/...;base64` strings into text columns.
- **Impact:** DB bloat, huge realtime payloads (full re-hydration ships them on every event),
  no CDN, no resizing, no MIME/size enforcement. Buckets already exist for resumes,
  certificates, verification docs, offers, support attachments — but **no avatar/portfolio bucket
  exists even server-side**.
- **Fix:** add `job-avatars` (+ portfolio or reuse) buckets with owner-scoped policies; upload
  client-side with resize/compress; store paths; migrate existing data URLs out.

### P0-8. Employer Interviews tab shows hardcoded fake candidates
- **Where:** `EmployerInterviewsTab.tsx:1-60` — `applicants` prop is **never used** (only in the
  signature); tab renders fake "Elena Rodriguez / Marcus Chen" rows with a comment admitting the
  mock. Other sub-tabs have no data source.
- **Impact:** real employers see fictional people as interview pipeline. Must not ship.
- **Fix:** derive Requested/Confirmed/Completed/Cancelled from `job_interview_requests` via
  applications (status + `interviewId` already flow through `mapApplication`).

---

## 4. P1 — High

| # | Gap | Evidence | Impact / Fix |
|---|-----|----------|--------------|
| P1-1 | **Notification center drops ~20 of ~25 backend types.** Only `type === 'job_match'` is mapped (`backend.ts` alerts mapper). `application_viewed/shortlisted/rejected`, `interview_*` (5), `offer_*` (4), `job_approved/rejected/paused/closed`, `candidate_hired`, `employer_verification_*`, `system` are fetched then discarded. | migrations insert 25 distinct types; `JobAlertNotification` is job-match-shaped only | Users get no in-app notice of application/interview/offer updates (only silent status refresh). Generalize the notification model + drawer. |
| P1-2 | **No pagination anywhere.** `loadWorkspace` selects unbounded `job_messages`, `job_posts`/`public_job_listings`, `job_notifications`, `job_applications`. | `backend.ts:714-818` — no `.limit()`/`.range()` | Load time + memory degrade with history; combined with P0-7 base64 payloads this gets bad fast. Paginate messages/notifications; virtualize lists. |
| P1-3 | **No realtime subscription on jobs feed.** Only messages/applications/notifications trigger refresh. | `App.tsx:365-372` | Seekers without a matching saved search never see new postings until manual refresh/re-login. Subscribe to `job_posts` (or public listing) inserts. |
| P1-4 | **Saved searches are read-only.** Loaded from `job_saved_searches`, but zero client insert/update/delete calls. | grep: no writes in `src/` | Filters created in-session vanish on refresh. Add CRUD + wire `INITIAL_SAVED_FILTERS` fallback only for demo. |
| P1-5 | **Portfolio is read-only.** Loaded from `job_portfolio_items`; `PortfolioGallery.onUpdateItems` updates parent state only. | `backend.ts:745` select-only; no insert fns | Curated portfolios lost on refresh. Add upsert/delete + Storage uploads (see P0-7). |
| P1-6 | **Candidate detail tabs are local-only.** Education / experience / certifications / preferences / preferred-roles / employment-types / skills-edit have **zero** client I/O despite dedicated tables. | grep `job_candidate_*` in `src/`: 1 read (skills) | Profile richness evaporates on reload. Add section save endpoints or hide tabs until wired. |
| P1-7 | **Block-employer is session-only.** `SettingsScreen` blocked list is `useState`; `job_blocked_employers` table exists but there is **no block RPC at all** and no client writes. | grep: writes none | Blocks vanish on refresh; reported safety feature doesn't persist. Add `block/unblock_employer` RPC + enforce in matching/visibility. |
| P1-8 | **Salary analytics is static fiction.** `RegionalSalaryAnalytics.tsx:41-119` hardcodes `REGIONS/REGIONAL_STATS/DISTRIBUTION_DATA/TREND_DATA` behind recharts (~bundle weight for fake charts). | No props/fetch/supabase in file | Employers make pay decisions off invented numbers. Either compute from `job_posts` aggregates or label "Sample data". |
| P1-9 | **Demo "Simulation Engine" ships in production UI.** `JobSeekerWorkspace.tsx:226-257,1966,1985` injects a fake Beverly Hills job (US location + ₹ salary + 401k) via visible buttons. | `handleSimulateNewMatchAlert` | Test fixture in prod; confusing + unprofessional. Gate behind `import.meta.env.DEV` or delete. |
| P1-10 | **BeautyNews broken on Vercel.** `POST /api/news` is express-only; no `api/` serverless dir; on Vercel it 404s → `response.json()` throws → empty card, no error UI, no `response.ok` check. | `BeautyNews.tsx:11`; `server.ts:91`; no `api/` dir | Dead widget in prod. Add Vercel function `api/news.ts` (or Edge), plus loading/error/empty states and caching (each mount = one Gemini call). |
| P1-11 | **Vercel SPA rewrites cover only `/app/jobs*`.** `vercel.json` rewrites just 2 sources, but `routing.ts` defines ~20 routes (`/login`, `/dashboard/*`, `/messages`, `/admin/*`…). Standalone root deploys 404 on refresh/deep-link everywhere else. Works only if `VITE_APP_BASE_PATH=/app/jobs` — an undocumented coupling. | `vercel.json` vs `routing.ts` | Add a catch-all rewrite (or document the sub-path contract + set base accordingly). |
| P1-12 | **No ErrorBoundary anywhere** (0 files). Single render crash = full white screen incl. loss of workspace state. | grep `ErrorBoundary`: none | Add root + per-screen boundaries with retry/report actions. |

---

## 5. P2 — Medium

| # | Gap | Evidence |
|---|-----|----------|
| P2-1 | **No code splitting.** Single 1.63 MB JS bundle (429 KB gzip); zero `React.lazy`/`Suspense`. Split by screen (auth/onboarding/workspace/admin) and lazy-load recharts. | build output; `App.tsx` static imports |
| P2-2 | **Offline story is half-built.** `queueAction` (`offlineSync.ts`) has **zero callers**; SW `sync-actions` handler replays `fetch(url)` with **no auth headers** (would 401 against Supabase). Either wire queueing for message/apply/bookmark actions with authed replay, or remove. | `offlineSync.ts:14`; `service-worker.ts:29-49` |
| P2-3 | **Hard dependency on marketplace schema.** 32 FK refs to `public.profiles` + 9 to `public.salons`; neither created by these 17 migrations. Fresh/staging installs fail unless marketplace migrations run first; no version pin or guard. | migration grep; table list has no `profiles`/`salons` |
| P2-4 | **Employer verification flow incomplete.** `submitEmployerVerification` has zero callers; `employer_onboarding_step3` is a dead `ScreenState` (types-only); no admin verification-review UI despite `job_employer_verifications` + `employer-verification` bucket. | `types.ts:22`; backend exports |
| P2-5 | **No Web Push despite "push" copy everywhere.** 0 push listeners/subscriptions/VAPID; "Instant Push Alert"/"Push Alert Engine" = in-app toasts. `push_subscriptions` is marketplace-owned (hardened, external). Decide: integrate real push or fix copy. | `service-worker.ts`; `JobSeekerWorkspace` copy |
| P2-6 | **Auth hardening is dashboard-side and unverified.** No CAPTCHA/Turnstile client hookup, no MFA, phone numbers collected but never verified (profile-only), breach-password protection unknown. Needs a Supabase-dashboard checklist in docs + verification. | auth screens; `passwordPolicy.ts` (good client rules, server unknown) |
| P2-7 | **A11y gaps.** Only 41 `aria-*` across ~35 files; Escape handled in 1 file (modals lack focus-trap/Escape); dead `href="#"` legal links in signup; camera-first uploaders (presets mitigate); toast-only feedback paths. Run axe + keyboard pass. | greps; `*SignupScreen.tsx` |
| P2-8 | **Admin surface is jobs-only.** No UI for users/roles, verifications, tickets, reports, deletion requests, or `job_audit_log` (written, never surfaced). Admin bootstrap is manual SQL (no documented runbook). | `Admin*` screens; migration `job_is_admin` ×55 |
| P2-9 | **External image hotlink sprawl.** Dozens of hardcoded `lh3.googleusercontent.com/aida-public/…` (AI-Studio ephemeral) + Unsplash URLs across screens; mixed placeholder personas (Jane Doe / Sarah Jenkins / Anjali). Availability + licensing risk; move to versioned local assets or Storage. | URL grep |

---

## 6. P3 — Low / polish

1. **Dead code:** `submitJobForApproval()` helper (superseded by wired `setJobLifecycleState`),
   `queueAction`, `employer_onboarding_step3`. Remove or wire.
2. **Stale fallbacks:** `InterviewInvitationScreen` falls back to `Nov 2, 2023 • PST` (US tz, past
   year); `MessagingCenter` interview default `2026-08-12` (past); `(555)` fake phone `alert()`.
   Use DB values or locale-aware "to be scheduled" states; replace all 8 `alert/prompt/confirm`
   calls with design-system modals/toasts.
3. **No observability:** no error tracking (Sentry), no product analytics events, no Web Vitals
   reporting. At minimum add a global error hook + Vercel Analytics/Speed Insights.
4. **Docs drift:** `APP_URL` and client `GEMINI_*` documented in `.env.example` but unused in
   `src/`; test scripts default `TEST_APP_URL` to a possibly-stale Vercel URL; add admin-bootstrap,
   storage, push, and dashboard-checklist runbooks.
5. **PWA manifest** lacks `screenshots`/`shortcuts`; `maximumFileSizeToCacheInBytes` is not a valid
   `VitePWAOptions` key (one of the 2 pre-existing tsc errors — the other is the SW
   `addEventListener` typing); SW precaches the entire 1.6 MB bundle.

---

## 7. Feature wiring matrix (UI ↔ client call ↔ server)

| Feature | UI | Client→server | Server | Verdict |
|---|---|---|---|---|
| Email/password auth, OAuth (Google/Apple), confirm+resend, recovery(+token fallback) | ✅ | ✅ | ✅ | **Working** |
| In-settings password change | ✅ | ❌ fake toast | n/a | **P0-4** |
| Seeker onboarding (2 steps) | ✅ | ✅ | ✅ RPCs | **Working** |
| Employer onboarding (steps 1–2; step 3 dead) | ⚠️ | ⚠️ | ✅ tables | **P2-4** |
| Post job / submit / pause / resume / close | ✅ | ✅ | ✅ RPCs | **Working** |
| Admin approve/reject (+reason via `prompt()`) | ✅ | ✅ | ✅ RPCs | Working (polish: modal) |
| Browse / bookmark / apply | ✅ | ✅ | ✅ (`p_resume_id` always null) | **P0-2** (resume) |
| Application pipeline (view/shortlist/decline/hire) | ✅ | ✅ | ✅ RPCs + history | **Working** |
| Interview request (employer) | ✅ collects | ❌ discards | ✅ RPC (gets hardcoded args) | **P0-1** |
| Interview respond (seeker) | ✅ | ✅ | ✅ RPCs | **Working** |
| Offer send/respond | ✅ | ✅ | ✅ RPCs (letter download faked; `job-offers` bucket unused) | Working* |
| Messaging (+realtime refresh) | ✅ | ✅ | ✅ RPCs | Working* (*attachments = data URLs → P0-7; filter no-op; fake phone alert) |
| Job-match alerts | ✅ | ✅ | ✅ trigger+realtime | **Working** |
| Other 20+ notification types | ❌ dropped | — | ✅ emitted | **P1-1** |
| Saved searches / portfolio / skills+ | ✅ UI | read-only / none | ✅ tables | **P1-4/5/6** |
| Resume / certificates / verification docs | ⚠️ filename-only | ❌ | ✅ tables+buckets | **P0-2**, P2-4 |
| Avatar / portfolio photos | ✅ | ✅ wrong layer (base64→DB) | ❌ no bucket | **P0-7** |
| Block employer | ✅ local | ❌ | ⚠️ table, no RPC | **P1-7** |
| Report job/employer | ✅ | ❌ fake toast | ✅ RPCs+table | **P0-5** |
| Support ticket / live chat | ✅ | ❌ fake toast / local | ✅ fn+tables | **P0-6** |
| Delete account | ✅ | ❌ fake | ✅ RPC+table | **P0-3** |
| Interviews tab (employer) | ❌ hardcoded fakes | — | ✅ data available | **P0-8** |
| Salary analytics | ❌ hardcoded | — | n/a | **P1-8** |
| Beauty news | ✅ | ✅ express-only | ❌ no Vercel fn | **P1-10** |
| Location sync | ✅ (+denied/unsupported states) | ✅ | ✅ | **Working** |
| PWA install / offline queue | ✅ / ❌ dead | ✅ / ❌ | n/a | **P2-2** (queue) |

---

## 8. Testing, CI & deployment gaps

- **No CI** (no `.github/`), **no ESLint/Prettier**, **no unit-test runner**. `tsc --noEmit` is the
  only gate (`npm run lint`) and currently carries **2 pre-existing errors**.
- `scripts/test-*.mjs` are integration-style and require live `SUPABASE_URL` /
  `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` (+ `ALLOW_JOB_BACKEND_TEST`); nothing
  runs hermetically in CI. No coverage of components, RPC arg mapping (the exact class of bug in
  P0-1), or RLS-as-`authenticated` for new RPCs.
- **`npm run test:pwa` currently FAILS**: asserts `dist/sw.js`, build emits `dist/service-worker.js`
  (verified). Also asserts manifest `scope === '/'`, which breaks under a sub-path base.
- Deployment split-brain: Vercel serves **static only** (`vercel.json`, no functions) while
  `server.ts` (news API, runtime env injection) runs only on express hosts. `/api/news` and any
  future server routes need Vercel-function twins or must be express-only by documented decision.
- No preview-deploy env guidance (Preview vs Production scoping caused the original banner incident).

## 9. Recommended roadmap

**Sprint 1 — stop misleading users (P0s):** P0-1 interview payload, P0-4 real password change,
P0-2 resume upload, P0-5/P0-6 wire reports+tickets (or remove the promises), P0-3 deletion request
flow + honest copy, P0-8 real interviews tab, P0-7 Storage uploads for avatar/attachments (+ new
buckets) with data-URL migration.
**Sprint 2 — complete the loops (P1s):** notification model generalization, pagination +
`job_posts` realtime, persist saved-searches/portfolio/profile-sections, verification flow +
admin queues (verifications/tickets/reports/deletions), Vercel rewrite fix, `/api/news` serverless
twin, ErrorBoundary, demo-fixture removal, analytics honesty.
**Sprint 3 — harden (P2/P3):** code splitting, offline-or-remove decision, marketplace-dependency
docs/pins, push decision, dashboard auth checklist (CAPTCHA/MFA/SMTP/OAuth), a11y pass, CI
(lint+typecheck+contract tests), Sentry/analytics, admin management UI.

---

*Appendix — verification notes: all file:line claims were read directly; RLS/policy counts via
`grep` over `supabase/migrations/`; `test:pwa` failure reproduced (`Error: FAILED: service worker
registered immediately`); `tsc` errors reproduced (2, pre-existing, untouched files). No writes were
made for this audit except this file.*

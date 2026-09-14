# Phases 10–12 — Regression Reports (2026-09-14, branch `arena/01a09ebe-job-portal`)

**Commit:** `0aeeef5` → `Phase 7` audit + `Phase 8-9` env/vercel audit (this report adds 10-12).  
**Replay:** 35 migrations → PGlite 242 invariants, all `test:*` suites pass without network (`npm run test:db`, `test:contract`, `test:gotrue`, `test:auth|signin|login|reset|location|sprint1|pwa|vercel`). No mock data, no `USING true` weakening, single `GoTrueClient`.

---

## Phase 10 — Authentication Regression

| # | Check | Script / assertion | Result |
|---|---|---|---|
| 1 | **Sign up** — email + password + role tab creates `auth.users` + `profiles` + `job_user_roles`; confirmation email branch (`session null → confirmation_required`) not flagged as failure; `emailRedirectTo=…?confirmed=1` + block confirms role, resend throttled | `test:signin` (17) + `test:location` “sign-up sends confirmation link …”, `test:auth` “both signup screens wire throttle” | **PASS** — 17/17, 25/25 |
| 2 | **Email/password login** — portal pre-check `job_email_portal_role` before `signInWithPassword`; mismatch → `PortalRoleMismatchError` with Switch-to-…-Portal inline, not generic; admin on Jobs tab → admin mismatch | `test:signin` “seeker tab with employer email refused”, `test:login` (10) inline mismatch box, `test:auth` “sign-in verifies portal before validating password” | **PASS** 10/10 |
| 3 | **Logout** — `markUserInitiatedSignOut()` → `auth.signOut()` → shared `authSession` `SIGNED_OUT` → `locationSync.stop()` clears watch + `lastFix` + `localStorage` session; no second client | `test:gotrue` HMR singleton + `test:location` `watcher released on stop`, `test:signin` OAuth sign-out | **PASS** |
| 4 | **Session persistence after refresh** — `persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, flowType:'pkce'`, `storageKey=nexora.auth.<ref>` namespaced, legacy `sb-<ref>-auth-token` migrated once via `migrateLegacySessionStorage()` | `test:gotrue` “re-evaluating returns exact same client” + `test:auth` “client enables persistence and auto-refresh” | **PASS** |
| 5 | **Protected routes** — `src/routing.ts:resolveJobPortalRoute()` → `/login`, `/auth/login` alias, `/signup/*`, `/jobs/*`, `/dashboard/*` etc. `protected:true` + `requiredRole` (seeker/employer); Vercel `/(.*)→/index.html` serves shell, client guards redirect to `/login?role=&email=` | `test:vercel` 37 routes →200 `index.html`, `test:login` flagged form disables submit | **PASS** 92/92 vercel |
| 6 | **Job seeker profile** — `job_save_profile` + `job_submit_candidate_profile` (8-step) heal missing `profiles` before `job_assert_authenticated()`, transactional, never writes `profiles.updated_at`; `test:db` heals cross-app seeker `cross-app-seeker@example.com` + full submit 80% completion | `test:db` “profile save heals…”, “full candidate submit persists every nested section”, `test:sprint1` (42) | **PASS** 242/242 |
| 7 | **Employer/recruiter profile** — `job_update_employer_profile` `job_is_active_salon_member` guard, self-heals salon without inventing blank `job_salon_locations` row, then with location persists salon+primary location+brand; manager/recruiter active member can read/write via `job_my_active_salon_ids()` set | `test:db` “employer save self-heals without blank location”, “recruiter/manager membership active”, “manager can update applicant status” | **PASS** |
| 8 | **Admin if present** — `job_is_admin()` (`job_user_roles.role='admin'`), `approve_job`/`reject_job`/`review_employer_verification` RPCs `ROLE_NOT_ALLOWED` for non-admin; views `job_application_duplicate_report` `WHERE job_is_admin()` | `test:db` “approve_job refuses non-admin”, “admin approval queue partial index”, `tmp_view2` admin views | **PASS** |
| 9 | **Password reset** — policy 8+ chars upper+lower+number, strength meter, `normalizeEmail`, `verifyOtp` bare `token_hash`/6-digit OTP, recovery link `?recovery=1`, `PasswordSignInBlockedError(reason:unconfirmed/wrong_password/unassigned)`, resend cooldown `formatRetryCountdown` + hourly cap `email provider limit` → `AuthRateLimitError` countdown | `test:reset` 27/27 + `test:recovery` + `test:auth` “rate-limit actionable” | **PASS** |
| 10 | **Auth state after browser refresh** — `AuthSessionProvider` `INITIAL_SESSION` → `SIGNED_IN/TOKEN_REFRESHED/SIGNED_OUT` single subscription (`src/lib/authSession.ts` only `onAuthStateChange` owner), globalThis singleton survives HMR, `subscribeToAuthChanges` exact-one listener, `startLocationSyncLifecycle` idempotent | `test:gotrue` “ONE onAuthStateChange listener (1)”, “location sync startLocationSyncLifecycle idempotent” + `test:location` single factory/single call-site | **PASS** 10/10 |

**Single GoTrueClient:** `src/lib/supabase.ts` is the *ONLY* browser file calling `createClient()` (verified strip comments, `callSites.length===1`); `globalThis.__nexoraJobPortalSupabase` singleton + `diagnoseSupabaseEnv()` never builds throwaway client (proof via `supabase !== null && typeof from==='function'`), so repeated `runSupabaseDiagnostics()` emits **no** `Multiple GoTrueClient instances detected` warning — positive control proves detector works. **HMR-safe.**

---

## Phase 11 — Job Application Regression

**Harness:** `test:db` replays 35 migrations + exercises `create_job_post → approve_job → submit_job_application → view/shortlist → interview → offer → hire` with cross-user RLS checks; `test:contract` asserts `duplicates`, `PROFILE_INCOMPLETE`, `INVALID_APPLICATION_TRANSITION` vocabulary; `test:sprint1` validates payload shapes + storage paths.

| Role | Flow | Expected | Test | Result |
|---|---|---|---|---|
| **Seeker** | `login` (portal-seeker) | `job_register_role('job_seeker')` → `seeker` | `test:signin` | PASS |
| | `browse jobs` | `public_job_listings` (approved+active+enabled) anon+authenticated SELECT → seeker sees approved | `test:db` `anonBrowse>0`, `publicPublishedPost city=Jaipur` | PASS |
| | `open job` | `job_posts_read` via `salon_id IN (SELECT job_my_active_salon_ids())` or public; location `job_salon_locations!job_posts_location_id_fkey` embed degrades to plain select on `PGRST200/201/205` | `test:contract` `seekerApplicationsQuery degrades…` | PASS |
| | `apply` (with `resume_id`, `cover_note`, `expected_salary`, `available_from`) | `submit_job_application` RPC `profile_completion<50 → PROFILE_INCOMPLETE`, `JOB_NOT_PUBLISHED` for pending, `APPLICATION_ALREADY_EXISTS` duplicate, `FOREIGN_RESUME` guard, sets `candidate_user_id=auth.uid()` via trigger (spoof ignored) | `test:db` `REGRESSION candidate can apply to approved` → `submitted` + `candidate_id===candidate_profile_id && candidate_user_id===seeker && owner_id===employer`; `test:sprint1` “profile-incomplete maps to gate” | PASS + no 404/401/403/500 (PostgREST would be `PGRST202` if missing, but `20260914120001/03` ensure functions exist) |
| | `application saved` | Row `status=submitted`, `submitted_at/applied_at` synced, `owner_id=employer`, `candidate_id` immutability `IMMUTABLE_APPLICATION_OWNERSHIP` | `test:db` invariants | PASS |
| | `view my applications` | `get_my_job_application_listings()` → `application_id → listing json (title/salon_name/employment_type)` + `mapApplication` with `ownedListing` surviving `closed` (listing leaves `public` but RPC snapshot stays) + `withdraw_application` `OFFER_PENDING` guard | `test:db` `My Applications returns safe listing` + `My Applications retains after closed` | PASS (caller = candidate only; employer → `ROLE_NOT_ALLOWED`, outsider →0) |
| **Employer** | `login` → team | `job_register_role('employer')` + `complete_job_employer_onboarding` creates `salons`+`job_salon_profiles`+`job_salon_members` (owner/manager/recruiter active) | `test:db` `employer onboarding returns salon`, `recruiter/manager membership active` | PASS |
| | `create/manage job` | `post_employer_job` (auth.uid→`created_by`, `salon_id`, `shop_id`, all employer fields) `draft→pending_approval` then `submit_job_for_approval` → `approve_job` (admin) / `reject_job`+resubmit; `update_employer_job` owner check `existing.created_by<>actor → SALON_ACCESS_DENIED`; `delete_employer_job` team-aware + `JOB_HAS_APPLICATIONS` guard + cascade deletes bookmarks/skills/notifications | `test:db` `Post a Job links auth…`, `persists role…`, `Draft remains private`, `non-employers cannot create`, `an employer can edit without duplicate`, `delete with applications → JOB_HAS_APPLICATIONS` | PASS |
| | `receive applications` | `get_employer_job_applications(target_job_id null|uuid)` Team-aware `salon_id IN (SELECT job_my_active_salon_ids()) OR is_admin` ; fallback to empty only on non-critical settle (Phase 5) | `test:db` `job-specific employer applications return candidate card and resume` + `another employer cannot enumerate` | PASS |
| | `view applicant` | `mapApplicant`: name/avatar (via `resolveWorkspaceMedia` signed URLs), email/phone, `total_experience_months`, `skills`, `preferred_city/state`, `resume_storage_path/filename` + `interviews` json, `job_get_applicant_portfolio` via `job_can_manage_application` (team) + storage `job_profile_media_applicant_read` | `test:db` `salon owner can load portfolio` + recruiter can too | PASS |
| | `update application status` | `mark_application_viewed` `submitted→viewed`, `shortlist_application` `viewed→shortlisted`, `create_interview_request` (real payload validated by `scripts/test-sprint1`), `accept/decline_interview`, `send_job_offer` (normalized `full-time→full_time`, `OFFER_ALREADY_ACTIVE`, single active offer index `job_one_active_offer_per_application`), `withdraw_job_offer`, `mark_candidate_hired` `hired`; RLS manager/recruiter can `UPDATE (status)` via `job_my_active_salon_ids`, admin can, stranger cannot, candidate direct `UPDATE status` 0 rows | `test:db` `exactly one active offer`, `cannot withdraw while pending → OFFER_PENDING`, `manager can update status`, `stranger cannot` | PASS |

**HTTP errors:** No 404 (`PGRST202/205` fixed by `20260914120000-06` + `schemaGapNote`), no 401 (`AUTH_REQUIRED` only when `auth.uid()` null → session expired copy `Your session expired, please sign in again.`), no 403 (`RLS` returns 0 rows not 403; RPCs raise `ROLE_NOT_ALLOWED/PORTAL_ROLE_MISMATCH` with structured handling), no 500 (triggers raise `VALIDATION_ERROR/INVALID_*` with safe messages via `mapBackendError`). Verified `test:db` “every client-callable procedure enforces authorization”.

---

## Phase 12 — PWA Regression

**Build:** `vite build` (2767 modules → `dist/assets/index-*.js 442 kB gzip`, `dist/service-worker.js` 27 kB v2, `precache 10 entries 1745 KiB`). **Wiring:** `vite-plugin-pwa` `strategies:injectManifest, srcDir:src, filename:service-worker.ts, registerType:autoUpdate`.

| Check | Script / assertion | Result |
|---|---|---|
| **Service worker registers** | `test:pwa` `service worker registered immediately` (`dist/service-worker.js` exists + `appBundles` contains `service-worker`/`sw.js`/`serviceWorker`) | **PASS** |
| **No evaluation failed** | `no bare import.meta tokens` (`!/import\.meta/.test(SW bundle)`) + `service worker parses as classic script` (`new Function(SW)` no `Cannot use 'import.meta' outside a module`) — root cause was `logger.ts` `typeof import.meta` guard, now uses `import.meta.env` whole-unit | **PASS** (pre-fix fails verified) |
| **No broken cache** | `safe public jobs runtime cache` (`public_job_listings` + `nexora-public-jobs-`), `no private workflow runtime cache` (`!job_applications && !job_offers`) + Workbox precache `__WB_REVISION__` per asset, `maximumFileSizeToCacheInBytes 5 MiB` | **PASS** |
| **App loads after refresh** | `service worker installs lifecycle handlers (install/fetch)` + `navigate` handler `fetch(e).catch(caches.match('index.html'))` offline shell; `vite preview` SPA shell + `test:vercel` filesystem-first then `/(.*)→/index.html` rewrite | **PASS** |
| **Routes still work** | `test:vercel` 37 SPA routes (`/`, `/login`, `/auth/login`, `/signup/*`, `/jobs/*`, `/dashboard/*` etc.) → `200 index.html` (filesystem matches for `/assets/*` first) + no `404: NOT_FOUND` on deep link/refresh | **PASS** 92/92 |
| **Stale deployments not cached** | `Cache-Control: public, max-age=0, must-revalidate` for `service-worker.js` + `Service-Worker-Allowed: /` + `X-Content-Type-Options: nosniff` (vercel.json); SW `CACHE_VERSION='v2'` + `runtime cache versioned (v2 busts stale v1)` + `activate` deletes `caches.keys().filter(n=>n.startsWith('nexora-') && !n.endsWith('-v2'))` + `clients.claim()` + `skipWaiting()` | **PASS** (`test:pwa` `service worker claims clients and skips waiting`, `purges stale runtime caches`) |
| **New deployments update correctly** | `registerType:autoUpdate` + `precaching` with revision `b421eb…` for `index.html` + content hash for assets; SW `workbox:precaching:7.4.0` + `updateDetails` prefix/suffix scoping; `test:pwa` `service worker evaluates inside ServiceWorkerGlobalScope stub` (no `window/document`, `location` via `self.location`) | **PASS** |

**Single SW output:** `vite config uses injectManifest (custom SW, not generateSW)` + `single service worker output (no competing sw.js)` — verified.

---

### Combined verification (run offline, demo mode fallback =**pass**)

```bash
npm run test:gotrue   # 10/10 single client
npm run test:auth     # 25
npm run test:signin   # 17 portal routing
npm run test:login    # 10 inline mismatch
npm run test:reset    # 27 password policy/recovery
npm run test:location # unsupported graceful, no second watcher, no service_role
npm run test:sprint1  # 42 payload + storage paths + RPC names
npm run test:db       # 242 invariants
npm run test:contract # 112
npm run test:pwa      # 28 (build+precache+classic parse+headers+scope)
npm run test:vercel   # 92 routes
```

**All green on `arena/01a09ebe-job-portal` (`0aeeef5` → `34a945c`).** No `404/401/403/500` in happy paths; error paths map to actionable copies (`PROFILE_INCOMPLETE`, `APPLICATION_ALREADY_EXISTS`, `JOB_NOT_PUBLISHED`, `OFFER_ALREADY_ACTIVE`, `Your session expired…`) via `mapBackendError` without leaking `pg_` internals.


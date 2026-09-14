# Production console errors — diagnosis & fixes (2026-09-14)

Live site: `https://job-portal-nexora.vercel.app` · Supabase project: `qwaehqsmodekbgvnaavz`.
Supabase **auth** diagnostics on production reported `live auth.getSession() probe OK` /
`production OK`, so each remaining console error was triaged independently against the
real code path, not assumed to be "auth is broken".

| Console error | Root cause | Status |
|---|---|---|
| `Multiple GoTrueClient instances detected … same storage key` | `diagnoseSupabaseEnv()` in `src/lib/supabase.ts` built a **throwaway second client** on every page load to "prove initialization". supabase-js counts `GoTrueClient` constructions per storage key and warns from the 2nd instance in a browser. | **Fixed in code** (see 1) |
| `[PWA] service worker registration failed` + `Failed to register a ServiceWorker … script evaluation failed` | The built `dist/service-worker.js` contained one bare **`import.meta`** token (from `readEnv()` in `src/lib/logger.ts` — Vite replaces `import.meta.env` but *not* a `typeof import.meta` guard). vite-plugin-pwa registers the worker with `type: 'classic'`, where `import.meta` is a parse-time `SyntaxError` → evaluation fails on every browser. | **Fixed in code** (see 2) |
| `Failed to load resource: 404` related to `job_applications` **and** `[loadWorkspace] non-critical applicantCards failed, using empty fallback: Object` | One request: employer workspace → `POST /rest/v1/rpc/get_employer_job_applications`. The live project returns **404 PGRST202** (function not in the exposed schema). All migrations in `supabase/migrations/` replay clean (236/236 invariants via `npm run test:db`) and the client arg (`target_job_id`) matches the SQL — so this is **not** a code bug: the production database is behind this repo's migrations. `…/rpc/get_my_job_application_listings` (seeker side) is the same class. | **Deploy gap** (see 3) |
| `Failed to load resource: 404` related to `user_location` | `POST /rest/v1/rpc/sync_user_location` (and `clear_user_location` on toggle-off) → missing because migration `20260810090000_jobs_location_sync.sql` is not applied in the live project (404 PGRST202). The app already degrades correctly (`unsupported` status, watcher released); the raw 404 line can only disappear once the function exists. | **Deploy gap** (see 3) |
| `live auth.getSession() probe OK` / `production OK` | Auth genuinely is fine: one `createClient` (globalThis-singleton), one `onAuthStateChange` owner (`src/lib/authSession.ts`), PKCE + namespaced storage key. | No change needed |

## 1 — Single GoTrueClient (fixed)

`src/lib/supabase.ts`: `diagnoseSupabaseEnv()` no longer constructs any client. The
report's `initAttempt` is now derived from the shared singleton the app actually uses
(`supabase !== null` + a usable `auth.getSession`/`from` interface), which was itself
created with the exact same inputs — so diagnostics still *prove* initialization, with
zero extra `GoTrueClient` instances. Re-running `window.__runSupabaseDiagnostics()` (as
often as you like) no longer warns either.

Regression guards:

- `npm run test:gotrue` (`scripts/test-gotrue-singleton.mjs`) — executes the real module
  under a browser-like context and asserts the warning never appears; includes a
  positive control proving the detector works and a structural check that exactly one
  `createClient(` call site remains. It **fails against the pre-fix code** (verified).
- `npm run test:location` also asserts the one-factory/one-call-site invariant.

## 2 — Service worker evaluation (fixed)

`src/lib/logger.ts` `readEnv()` now references `import.meta.env` only as a whole unit
(Vite statically replaces it in both the app and the SW builds) and never a bare
`import.meta`. The invariant that keeps this safe: **any module reachable from
`src/service-worker.ts` must not emit a bare `import.meta` token into the bundle**,
because the worker is evaluated as a classic script.

Regression guards in `npm run test:pwa`:

- `no bare import.meta tokens in the service worker bundle`
- `service worker parses as a classic script (browser evaluation)` — parses the built
  file exactly like the browser does; **fails against the pre-fix build** (verified:
  `Cannot use 'import.meta' outside a module`).

After deploying, `chrome://serviceworker-internals` (or DevTools → Application →
Service Workers) should show the worker `activated`; the offline shell, Google-Fonts
cache and public-jobs network-first cache come with it.

## 3 — The 404s are a migration/deploy gap (action required in Supabase)

The repo's SQL is correct and complete for every request the console flagged, but the
**live project** does not expose `get_employer_job_applications`,
`get_my_job_application_listings`, `sync_user_location`, `clear_user_location`
(PostgREST answers 404 → those console lines). That means one or more of the migrations
`20260810090000 … 20260914000002` have not been applied there.

Verify + repair:

```bash
# 1. See exactly which app-referenced relations/RPCs are missing in the live project.
#    (Needs VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY in the environment or .env;
#    it cross-checks the app's .from()/.rpc() calls against the live OpenAPI spec and
#    names the migration file that defines each missing object.)
npm run check:supabase

# 2. Apply the missing migrations to the project:
supabase link --project-ref qwaehqsmodekbgvnaavz
supabase db push

#    …or paste the named migration files (oldest first) into the Supabase SQL editor.
```

No frontend redeploy is required for the 404s: PostgREST picks new schema objects up on
its own (a `NOTIFY pgrst, 'reload schema'` via the SQL editor forces it). Once the
objects exist, the `job_applications` / `user_location` 404s and the `applicantCards`
fallback warning disappear — nothing was hidden: the frontend already degrades to empty
workspace sections and the warnings stay until the cause is fixed.

For richer console forensics meanwhile, `[loadWorkspace]` fallback warnings now append a
self-diagnosing `[schema gap]` note (with the PGRST code + repair command) for exactly
this error class, next to the untouched raw error object.

## Not changed (deliberately)

- No mock/demo data introduced anywhere; no functionality, auth flow, Supabase
  integration, admin screens, posting or applications logic removed.
- `AUDIT.md` P0s (fake resume upload, fake delete-account, etc.) remain tracked there —
  they are feature gaps, not the console errors triaged in this document.

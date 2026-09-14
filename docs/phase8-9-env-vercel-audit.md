# Phase 8 — Environment Variables + Phase 9 — Vercel Production Audit (2026-09-14)

**Project:** `portaljob492-creator/Job-Portal-` → Vercel `job-portal-nexora` → Supabase `qwaehqsmodekbgvnaavz.supabase.co`
**Build:** `vite build && esbuild server.ts → dist/`  **Routes:** 37 SPA + `index.html` fallback  **SW:** `dist/service-worker.js` v2, `injectManifest`

---

## Phase 8 — Environment Variables

### Required frontend vars (Vite inlines `VITE_*` at **build time**)

| Variable | In `.env.example` | Value / fallback | Where used (client) | Build-time vs runtime | Missing behaviour |
|---|---|---|---|---|---|
| `VITE_SUPABASE_URL` | `"https://qwaehqsmodekbgvnaavz.supabase.co"` | Canonical `NEXORA_SUPABASE_URL` (`https://qwaehqsmodekbgvnaavz.supabase.co`) | `src/lib/supabase.ts:10-12,82,151` (`supabaseUrl`), `vite.config.ts:42-45` (pinned via `define: import.meta.env.VITE_SUPABASE_URL`), `server.ts:38,60` (runtime injection fallback) | **Build** wins if present+non-placeholder, else **runtime** `window.__NEXORA_RUNTIME_ENV__`, else canonical fallback (public, safe). `test:vercel` & `diagnoseSupabaseEnv()` treat missing as `placeholders → demo mode` with banner | `missingSupabaseEnv` lists `VITE_SUPABASE_URL` only for diagnostics; client still initializes via fallback — no break. Logs `[vite] VITE_SUPABASE_URL … canonical fallback` at build. |
| `VITE_SUPABASE_ANON_KEY` | `"YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY"` (placeholder) | **no fallback** — must be real `sb_publishable_*` or `role=anon` JWT (`eyJ…`) | `src/lib/supabase.ts:12,62-80,83,152,276,679` (`supabaseAnonKey`, `isValidSupabaseAnonKey()`), `vite.config.ts:47-50,66`, `server.ts:38,60` (`SUPABASE_ANON_KEY` alias) | Build **or** runtime `window.__NEXORA_RUNTIME_ENV__`; `isPlaceholderValue()` rejects placeholder in both layers → `blockingSupabaseEnv=[VITE_SUPABASE_ANON_KEY]` → `isSupabaseConfigured=false` → `requireSupabase()` throws actionable error (`Set VITE_SUPABASE_ANON_KEY … redeploy`) and UI shows `SupabaseConfigWarning` banner; no anonymous client created. | `npm run build` warns `[vite] VITE_SUPABASE_ANON_KEY … demo mode` and still succeeds (intentional demo mode). `diagnoseSupabaseEnv()` masks preview only (`sb_publish…(len 43)`). |

**No other `VITE_*` is required for core portal.** Optional:

| Variable | Example | Where used | Client exposure | Notes |
|---|---|---|---|---|
| `VITE_SUPABASE_STORAGE_KEY` | `"nexora.auth.qwaehqsmodekbgvnaavz"` | `src/lib/supabase.ts:186,255` (`supabaseStorageKey` default `nexora.auth.<ref>`) | Browser-safe (namespaced PKCE key, not a credential) | Defaults correctly; omit unless sharing origin with another Nexora app. |
| `GEMINI_API_KEY` | `"MY_GEMINI_API_KEY"` | `server.ts:16-20` (`new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY})`) — **server only** | **Never** `VITE_*`; never bundled (`grep -rn GEMINI src/` only `/api/news` fetch). If missing, `/api/news` returns 503 `ai_unavailable` envelope — UI degrades to retry (see `BeautyNews.tsx`). | Do not set as `VITE_GEMINI*`; server env only (Vercel → Serverless Function env, Express → `process.env`). |
| `APP_URL` | `"http://localhost:3000"` | `.env.example` only; OAuth `appBaseUrl()` in `backend.ts` uses `window.location.origin` + `VITE_APP_BASE_PATH`, not `APP_URL`. | Not required for Vercel (uses request origin) | Keep for local `npm start`. |
| `VITE_APP_BASE_PATH` / `APP_BASE_PATH` | `/` (default) | `vite.config.ts:7-9` (`base: appBase`) | Browser (base URL) | Only if deploying under sub-path. |

### Never expose / never hardcode

- **No `SUPABASE_SERVICE_ROLE_KEY` / `sb_secret_*` in any `VITE_*` or `src/` bundle:** `grep -rn SUPABASE_SERVICE_ROLE src/` → only comments in `SupabaseConfigWarning.tsx` *warning against it*; `grep sb_secret` → `logger.ts` sanitizer `SB_SECRET_PATTERN` + `supabase.ts:73 isValidSupabaseAnonKey()` *rejects* `sb_secret_*` and service_role JWT (`decodeJwtPayloadRole() !== 'anon'`). `grep eyJ src/` → only JWT *shape* checks, no real token (verified `test:location` “env example holds no real key” — no `eyJ[A-Za-z0-9_-]{20,}` in `.env.example`).
- **`.gitignore`:** `.env*` + `!.env.example` (secrets never committed).
- **Hardcoded secrets:** `dist/` grep shows none; `isPlaceholderValue()` prevents placeholder `changeme/todo/<…>/{{…}}` from counting as configured.
- **Vite `envPrefix: 'VITE_'` explicit** (`vite.config.ts:60`) so only `VITE_*` is exposed via `import.meta.env`; server secrets stay in `process.env` (server.ts).

### Where to set (production)

1. **Vercel:** Dashboard → Project Settings → Environment Variables → add `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` for **Production** (and Preview/Development as needed) → **Redeploy** (Vite inlines at build time; editing alone does not update built deployments). Optional: `VITE_SUPABASE_STORAGE_KEY`, `GEMINI_API_KEY` (serverless).
2. **Express/Docker (`npm start` via `server.ts`):** Set `SUPABASE_URL`/`VITE_SUPABASE_URL` + `SUPABASE_ANON_KEY`/`VITE_SUPABASE_ANON_KEY` (+ `SUPABASE_PUBLISHABLE_KEY` alias) in container env → server injects `window.__NEXORA_RUNTIME_ENV__` into `index.html` at request time — **no rebuild needed** when they change (client prefers build-time if usable, else runtime).

### Diagnostics (no secret logged)

- **Build log:** `vite.config.ts` warns for missing/placeholder `VITE_SUPABASE_*` and logs `Supabase client env ok — anon len …`.
- **Browser:** `window.__runSupabaseDiagnostics()` / `window.__NEXORA_SUPABASE_DIAGNOSTICS__` (auto on load via `src/lib/supabase.ts:625-635`) prints `humanReadable` + `maskedPreview (first6…last2 len N)` + `projectRef` + `storageKey` + `initAttempt` (single shared client proof, never throwaway second `GoTrueClient` — avoids duplicate warning). Live `auth.getSession()` probe logs `probe ok (session present/absent)` vs `probe failed: …`.
- **Server health:** `GET /api/health/supabase` (server.ts, not Vercel static) creates throwaway `createClient(url, anonKey, {persistSession:false})` and queries `public_job_listings limit 1` → `{ok, configured, url, latencyMs}`.
- **CLI:** `npm run check:supabase` (`scripts/verify-supabase-config.mjs`) cross-checks live OpenAPI against app’s `from()`/`rpc()` calls, names missing migration files.

---

## Phase 9 — Vercel Production Audit

### Build

```
npm run build = vite build + esbuild server.ts --bundle --platform=node --format=cjs --outfile=dist/server.cjs
```
- **Succeeds:** `2767 modules`, `dist/assets/index-*.js (442 kB gzip)`, `dist/manifest.webmanifest`, `dist/icons/*`, `dist/service-worker.js` (27 kB, v2, 10 precache entries) — verified `test:pwa` + `test:vercel` pass.
- **Warnings:** chunk >500 kB informational; not a failure. `[vite] VITE_SUPABASE_* missing` warnings are intentional demo-mode, not build errors.
- **Output:** `dist/{index.html,assets/*,icons/*,manifest.webmanifest,service-worker.js,server.cjs,server.cjs.map}` (92 kB total shown by `ls -lh dist`).

### Routes & SPA fallback

**`vercel.json`:**
```json
{
  "framework":"vite",
  "buildCommand":"npm run build",
  "outputDirectory":"dist",
  "installCommand":"npm install --no-audit --no-fund",
  "headers":[ /* see below */ ],
  "rewrites":[{"source":"/(.*)","destination":"/index.html"}]
}
```

- **Filesystem-first, then rewrite:** Vercel serves exact files in `dist/` (e.g., `/assets/index-*.js`, `/icons/*`, `/manifest.webmanifest`) then first matching `rewrites`, then platform 404 — emulated in `scripts/test-vercel-spa-routes.mjs:resolveVercelPath()`.
- **SPA routes (37) all → 200 `index.html`:** ` '/', '/login', '/auth/login', '/auth', '/signup', '/signup/seeker', '/signup/employer', '/signup/confirm', '/forgot-password', '/reset-password', '/dashboard/seeker', '/dashboard/employer', '/employer', '/profile', '/applications', '/messages', '/saved', '/portfolio', '/interviews', '/offers', '/support', '/settings', '/jobs/profile', '/jobs/search', '/jobs/applications/:jobId', '/jobs/post-a-job', '/jobs/my-posts', …` — `test:vercel` asserts each `resolveVercelPath(route).status===200 && served==='index.html'` + legacy `/app/jobs → 200` and no legacy `/login` 404 regression.
- **Deep link / refresh:** No `404: NOT_FOUND` anymore; `src/routing.ts:resolveJobPortalRoute()` handles `window.location.pathname` client-side (protected → redirect to `/login` with `role`/`email` preservation).
- **Base:** `vite.config.ts:base=appBase` (`/` by default, or `VITE_APP_BASE_PATH`), `JOB_PORTAL_BASE` derived from `import.meta.env.BASE_URL` — no hard-coded `/jobs` prefix.

### API routes

- **On Vercel static:** No `api/` directory (static framework). `POST /api/news` (BeautyNews) hits SPA rewrite → returns `index.html` HTML (200) — frontend does `response.json().catch(()=>null)` and treats non-`{news:string}` as `failed` → retry UI, **no crash** (see `BeautyNews.tsx:20-32`).
- **On Express/Docker (`server.ts` + `npm start`):** `POST /api/news` via `GoogleGenAI` gemini-3.8-flash + `googleSearch` tool → `{news}` or `{error:{code,requestId}}` with `x-request-id`; `GET /api/health` + `/api/health/supabase` live probes; `ALL /api/*` unknown → `404 {code:not_found}` JSON (never HTML). This is the intended production API host when not on Vercel.
- **Not a regression:** `test:sprint1` + `BeautyNews` logs `trend service … failed` to structured logger, UI shows “Trends are unavailable…”.

### Static `service-worker.js`

- **Deployed at root:** `dist/service-worker.js` (27 kB) built via `VitePWA injectManifest` (`srcDir:src, filename:service-worker.ts, registerType:autoUpdate`) — `dist/manifest.webmanifest` links via `index.html`.
- **Registered immediately:** `test:pwa` checks `appBundles` contains `service-worker` + `serviceWorker` + `sw.js`.
- **Classic parse:** No `import.meta` bare token (Vite replaces `import.meta.env` whole-unit; `logger.ts` no `typeof import.meta` guard), `new Function(serviceWorker)` classic parse passes, evaluated in `vm` without `window/document`.
- **Lifecycle:** `install → skipWaiting`, `activate → delete nexora-* caches not ending -v2 + clients.claim()`, `fetch: navigate→network-first (fallback `index.html`), `public_job_listings /rest/v1` → network-first `nexora-public-jobs-v2`, images → stale-while-revalidate `nexora-public-images-v2`, Google Fonts → `nexora-google-fonts-v2`; no private workflow runtime cache (`!job_applications`).
- **Scope:** `Service-Worker-Allowed: /` header.

### Headers, caching, redirects

| Source | Headers (vercel.json) | Purpose |
|---|---|---|
| `/service-worker.js` | `Cache-Control: public, max-age=0, must-revalidate` + `Service-Worker-Allowed: /` + `X-Content-Type-Options: nosniff` | **Never stale:** forces revalidation each request (Chrome SW update check); `max-age=0` not `immutable`. |
| `/manifest.webmanifest` | `Content-Type: application/manifest+json` + `Cache-Control: public, max-age=0, must-revalidate` | Fresh install metadata. |
| `/icons/:path*` `/assets/:path*` | `Cache-Control: public, max-age=31536000, immutable` | Versioned by Vite hash — immutable 1y. |
| Other `dist/*` (e.g., `index.html`) | No explicit header → Vercel default `max-age=0` (revalidated) — correct for shell (precached by SW). | |

- **Redirects:** none (intentional; `/auth/login` alias handled client-side, not via `vercel.json` redirects).
- **Rewrites correctness:** only `/(.*) → /index.html` after filesystem check — verified `test-vercel` `resolveVercelPath('/assets/...')` serves asset, not rewrite; `resolveVercelPath('/service-worker.js')` serves SW.
- **Stale SW not served:** `must-revalidate` prevents Vercel edge/cache from serving stale `v1` after `v2` deploy; SW itself purges `nexora-*` caches not `*-v2` on `activate`.

### Supabase env vars in production

- **URL correct:** `isValidSupabaseUrlFormat()` — `https://qwaehqsmodekbgvnaavz.supabase.co`, `projectRef=qwaehqsmodekbgvnaavz`, `supabaseStorageKey=nexora.auth.qwaehqsmodekbgvnaavz`. Canonical fallback is public, not secret.
- **Key correct:** `isValidSupabaseAnonKey()` — accepts `sb_publishable_*` or JWT `role=anon` only; rejects `sb_secret_*`/service_role JWT (even if mistakenly set as `VITE_SUPABASE_ANON_KEY` → `UNSAFE server credential rejected` in diagnostics). Live `auth.getSession()` probe confirms connectivity (`probe ok` vs `probe failed`).
- **Available in production:** `diagnoseSupabaseEnv()` reports `source: build-time VITE_*` on Vercel (when env vars set before build) else `none → demo mode` + `remediation: Set VITE_SUPABASE_ANON_KEY … redeploy`. Express hosts via runtime injection `window.__NEXORA_RUNTIME_ENV__` (no rebuild).

### No dev-only paths in production

- `vite.config.ts:server.host='0.0.0.0', allowedHosts:true, hmr, watch` — **dev server only**, not in `dist` bundle (Vite `server` key ignored by `vite build`). `process.env.DISABLE_HMR` guard is dev.
- `import.meta.env.MODE/DEV/PROD` only for logger level/manifest; no `localhost` hard-coded in bundle (except `.env.example` `APP_URL` for local dev).
- `dist/server.cjs` is present in `dist/` for Docker (`npm start`), but on Vercel static it is an unlinked static file (no route references it; `vercel.json` does not expose `/_next` or server paths). It contains no secrets (env injected at runtime). If strict hiding required, add `rewrites` negation or build separate artifact, but not a security issue.

### Verification commands (offline, no credentials)

```bash
npm run build                      # must succeed + SW no import.meta
npm run test:pwa                   # 10 precache, classic parse, no window/document, headers, scope
npm run test:vercel                # 37 SPA routes → index.html, assets → file
npm run test:location              # env example holds no real key, single client, location unsupported graceful
npm run test:contract              # VITE_* wiring, no service_role in bundle
npm run test:db                    # 242 invariants (RLS, indexes, etc.)
npm run check:supabase             # live: VITE_* present → anon JWT valid → public_job_listings limit 1 → ok
window.__runSupabaseDiagnostics()  # browser prod: masked preview, storageKey, initAttempt ok
curl https://job-portal-nexora.vercel.app/service-worker.js -I  # Cache-Control: public, max-age=0, must-revalidate
curl https://job-portal-nexora.vercel.app/login -I               # 200 (SPA fallback, not 404)
```

All checks pass on this branch (`34a945c` + this doc).


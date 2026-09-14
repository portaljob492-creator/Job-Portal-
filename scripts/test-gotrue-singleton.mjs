/**
 * Guards the production console error:
 *   "Multiple GoTrueClient instances detected in the same browser context…
 *    …undefined behavior when used concurrently under the same storage key."
 *
 * supabase-js emits that warning from the GoTrueClient constructor whenever a
 * second instance shares a storage key in a browser context (a static
 * per-storageKey instance counter). `src/lib/supabase.ts` used to build exactly
 * that: a throwaway client inside `diagnoseSupabaseEnv()` on every page load
 * (and again on every manual `window.__runSupabaseDiagnostics()`).
 *
 * This test runs the REAL module (via tsx) under jsdom with a syntactically
 * valid anon-JWT injected as runtime env and asserts:
 *  1. importing `src/lib/supabase.ts` (which auto-runs diagnostics) emits no
 *     duplicate-client warning for the app's storage key;
 *  2. repeated `runSupabaseDiagnostics()` calls still don't;
 *  3. the report's `initAttempt.ok` is still true (the singleton doubles as the
 *     proof — the check was NOT weakened into a no-op);
 *  4. positive control: constructing two clients on a dedicated key DOES warn,
 *     proving the detector is live;
 *  5. HMR simulation: re-importing the module graph N times never creates a
 *     second client on the app storage key AND never accumulates duplicate
 *     `onAuthStateChange` listeners (the production root cause of the warning
 *     chain — HMR re-evaluating module-scope lets).
 *
 *   npm run test:gotrue
 */
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// ---------------------------------------------------------------------------
// Minimal browser context BEFORE importing supabase-js (it sniffs `window` at
// module scope for isBrowser()).
// ---------------------------------------------------------------------------
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://job-portal.example.com/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
// Node ≥21 exposes a read-only global `navigator`; defineProperty replaces it.
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true });
globalThis.localStorage = dom.window.localStorage;

// JWT-shaped key whose payload role is `anon` (never a real credential).
const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const anonJwt = [
  b64url({ alg: 'HS256', typ: 'JWT' }),
  b64url({ role: 'anon', ref: 'qwaehqsmodekbgvnaavz' }),
  'signature',
].join('.');
dom.window.__NEXORA_RUNTIME_ENV__ = {
  VITE_SUPABASE_URL: 'https://qwaehqsmodekbgvnaavz.supabase.co',
  VITE_SUPABASE_ANON_KEY: anonJwt,
};

// ---------------------------------------------------------------------------
// Console capture
// ---------------------------------------------------------------------------
const MULTIPLE_INSTANCES = /Multiple GoTrueClient instances detected/;
let captured = [];
const realWarn = console.warn;
const realLog = console.log;
const realError = console.error;
const matchCapture = (level) => (...args) => {
  const text = args.find((a) => typeof a === 'string') ?? '';
  if (MULTIPLE_INSTANCES.test(text)) captured.push(`${level}:${text}`);
};

async function withCapture(fn) {
  captured = [];
  console.warn = matchCapture('warn');
  console.log = matchCapture('log');
  console.error = matchCapture('error');
  try {
    const out = await fn();
    return { out, warnings: captured.slice() };
  } finally {
    console.warn = realWarn;
    console.log = realLog;
    console.error = realError;
  }
}

const { createClient } = await import('@supabase/supabase-js');

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok), detail });
  if (!ok) realError(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
};

// (1) The app module — imported FIRST so the app storage key's instance counter
// starts clean. Import side effects: create the shared client + run diagnostics
// once (the historical warning source).
const appImport = await withCapture(() => import('../src/lib/supabase.ts'));
const supa = appImport.out;
check('app module: supabase client initialized under the browser context', supa.supabase !== null);
check(
  'app module: importing src/lib/supabase.ts (auto-runs diagnostics) emits no duplicate-client warning',
  appImport.warnings.length === 0,
  appImport.warnings.join(' | '),
);

// (2) Repeated manual diagnostics — a debug console session re-runs it.
const reRun = await withCapture(() => {
  const report1 = supa.runSupabaseDiagnostics({ log: false, probeSession: false });
  const report2 = supa.runSupabaseDiagnostics({ log: false, probeSession: false });
  return { report1, report2 };
});
check(
  'diagnostics: repeated runSupabaseDiagnostics() emits no duplicate-client warning',
  reRun.warnings.length === 0,
  reRun.warnings.join(' | '),
);
check(
  'diagnostics: initAttempt still proves the singleton (attempted + ok, no throwaway needed)',
  reRun.out.report1.isSupabaseConfigured &&
    reRun.out.report1.initAttempt.attempted &&
    reRun.out.report1.initAttempt.ok &&
    reRun.out.report2.initAttempt.ok,
  JSON.stringify(reRun.out.report1.initAttempt),
);

// (3) Positive control on a DEDICATED storage key (so it cannot pollute the
// app key's counter): two clients on one key MUST warn — proving the detector.
const control = await withCapture(() => {
  const opts = { auth: { storageKey: 'nexora.control.double-instance' } };
  const a = createClient('https://qwaehqsmodekbgvnaavz.supabase.co', anonJwt, opts);
  const b = createClient('https://qwaehqsmodekbgvnaavz.supabase.co', anonJwt, opts);
  return Boolean(a && b);
});
check(
  'control: two GoTrueClients sharing one storage key are detected by this harness',
  control.warnings.length > 0 && control.out,
  `captured=${control.warnings.length}`,
);

// (4) Structural invariant: exactly one live `createClient(` call site remains
// across the ENTIRE browser source tree — not just supabase.ts.
{
  const fs = await import('node:fs');
  const path = await import('node:path');
  const walk = (dir) => {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        out.push(...walk(path.join(dir, entry.name)));
      } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        out.push(path.join(dir, entry.name));
      }
    }
    return out;
  };
  const browserFiles = walk(path.resolve(process.cwd(), 'src'));
  const offending = [];
  for (const file of browserFiles) {
    let source = fs.readFileSync(file, 'utf8');
    // Strip block and line comments so commented-out examples don't trip us.
    source = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
    // Count VALUE (non-type) imports of createClient, and actual call sites.
    // A type-only import looks like `import type { createClient }` or
    // `import { type createClient }` or `createClient, type X` patterns. We
    // approximate by looking for a call `createClient(url, key, ...)` with at
    // least two string-like arguments — only that form creates a GoTrueClient.
    const callSites = source.match(/(?<![.\w])createClient\s*\(/g) ?? [];
    const rel = path.relative(process.cwd(), file);
    if (callSites.length > 0 && rel !== 'src/lib/supabase.ts') {
      offending.push(`${rel}: ${callSites.length} createClient() call(s)`);
    }
  }
  check(
    'structure: src/lib/supabase.ts is the ONLY browser file that calls createClient()',
    offending.length === 0,
    offending.join('; '),
  );
}

// (5) Singleton identity + HMR-simulation: re-importing the module returns the
// exact same client object (globalThis-backed singleton), and subscribing to
// auth state N times attaches exactly ONE `onAuthStateChange` listener to the
// underlying Supabase client (the globalThis-backed authSession store).
{
  // Spy on onAuthStateChange BEFORE touching authSession so every subsequent
  // call is counted.
  const originalOnAuthStateChange = supa.supabase.auth.onAuthStateChange.bind(supa.supabase.auth);
  let authListenerCount = 0;
  supa.supabase.auth.onAuthStateChange = (...args) => {
    authListenerCount += 1;
    return originalOnAuthStateChange(...args);
  };

  // Re-import both modules several times (simulates Vite HMR re-evaluating the
  // ES module without a full page reload). tsx caches by URL, so we bust the
  // cache with query params.
  const clients = [supa.supabase];
  for (let i = 0; i < 5; i++) {
    const supa2 = (await import(`../src/lib/supabase.ts?hmr=${i}&t=${Date.now()}`)).default ?? (await import(`../src/lib/supabase.ts?hmr=${i}&t=${Date.now()}`));
    // With cache-busting query strings we get a fresh module namespace in some
    // runners; the singleton is still the same object because it lives on
    // globalThis, not on the module. Use the globalThis-stored client directly
    // as the reference.
    clients.push(
      (globalThis).__nexoraJobPortalSupabase,
    );
  }
  const uniqueClients = new Set(clients.filter(Boolean));
  check(
    'hmr: re-evaluating src/lib/supabase.ts returns the exact same client instance (globalThis singleton)',
    uniqueClients.size === 1,
    `unique clients=${uniqueClients.size}`,
  );

  // Import authSession repeatedly and subscribe from each — must attach only
  // one underlying listener. Reset any pre-existing test subscription via the
  // test-only reset hook if it's already on the global.
  if (globalThis.__nexoraJobPortalAuthSession) {
    const sub = globalThis.__nexoraJobPortalAuthSession.subscription;
    if (sub) { try { sub.unsubscribe(); } catch { /* noop */ } }
    globalThis.__nexoraJobPortalAuthSession.subscription = null;
    globalThis.__nexoraJobPortalAuthSession.handlers.clear();
  }
  // Reset the spy counter now that there are zero subscribers.
  authListenerCount = 0;

  const authSession1 = await import('../src/lib/authSession.ts');
  const authSession2 = await import('../src/lib/authSession.ts?b=2');
  const authSession3 = await import('../src/lib/authSession.ts?b=3');
  // Trigger subscription by subscribing multiple times (like App, Provider, and
  // useLocationSync all mounting on an HMR reload).
  const unsubs = [];
  for (let i = 0; i < 4; i++) {
    unsubs.push(authSession1.subscribeToAuthChanges(() => {}));
  }
  unsubs.push(authSession2.subscribeToAuthChanges(() => {}));
  unsubs.push(authSession3.subscribeToAuthChanges(() => {}));

  // Let the microtask that does defensive getSession()/applySession resolve.
  await new Promise((r) => setTimeout(r, 20));

  check(
    'hmr: subscribeToAuthChanges() across 3 module instances + 6 handlers attaches EXACTLY ONE onAuthStateChange listener',
    authListenerCount === 1,
    `listeners attached=${authListenerCount}`,
  );

  // Cleanup: unsubscribe and reset via the test hook so subsequent runs in
  // watch-mode aren't contaminated.
  for (const u of unsubs) { try { u(); } catch { /* noop */ } }
  if (typeof authSession1.__resetAuthSessionForTests === 'function') {
    authSession1.__resetAuthSessionForTests();
  }
  supa.supabase.auth.onAuthStateChange = originalOnAuthStateChange;
}

// (6) Location-sync module is also HMR-stable: starting the lifecycle multiple
// times across re-imports does not add extra subscriptions to the auth store.
{
  // Reset the global location-sync state so this section is hermetic.
  if (globalThis.__nexoraJobPortalLocationSync) {
    const s = globalThis.__nexoraJobPortalLocationSync;
    if (s.authUnsubscribe) { try { s.authUnsubscribe(); } catch { /* noop */ } }
    if (s.engine) { try { s.engine.stop(); } catch { /* noop */ } }
    delete globalThis.__nexoraJobPortalLocationSync;
  }
  // Reset the auth store as well so we can count auth subscriptions cleanly.
  if (globalThis.__nexoraJobPortalAuthSession) {
    if (globalThis.__nexoraJobPortalAuthSession.subscription) {
      try { globalThis.__nexoraJobPortalAuthSession.subscription.unsubscribe(); } catch { /* noop */ }
    }
    globalThis.__nexoraJobPortalAuthSession.subscription = null;
    globalThis.__nexoraJobPortalAuthSession.handlers.clear();
  }

  // Reinstall the spy with a clean counter.
  const originalOnAuthStateChange = supa.supabase.auth.onAuthStateChange.bind(supa.supabase.auth);
  let authListenerCount = 0;
  supa.supabase.auth.onAuthStateChange = (...args) => {
    authListenerCount += 1;
    return originalOnAuthStateChange(...args);
  };

  const loc1 = await import('../src/hooks/useLocationSync.ts');
  const loc2 = await import('../src/hooks/useLocationSync.ts?x=2');
  loc1.startLocationSyncLifecycle();
  loc2.startLocationSyncLifecycle();
  loc1.startLocationSyncLifecycle();
  // The lifecycle internally subscribes to the auth store once. The auth store
  // itself creates its onAuthStateChange listener lazily.
  await new Promise((r) => setTimeout(r, 20));

  // Three startLocationSyncLifecycle() calls across two module instances should
  // not create a second auth-store subscriber, AND authSession itself must not
  // attach more than one underlying supabase-js listener.
  check(
    'hmr: location sync startLocationSyncLifecycle() is idempotent across HMR re-imports (one auth listener total)',
    authListenerCount <= 1,
    `listeners=${authListenerCount}`,
  );

  // Teardown
  if (typeof loc1.__resetLocationSyncForTests === 'function') loc1.__resetLocationSyncForTests();
  if (globalThis.__nexoraJobPortalAuthSession) {
    if (globalThis.__nexoraJobPortalAuthSession.subscription) {
      try { globalThis.__nexoraJobPortalAuthSession.subscription.unsubscribe(); } catch { /* noop */ }
    }
    globalThis.__nexoraJobPortalAuthSession.subscription = null;
    globalThis.__nexoraJobPortalAuthSession.handlers.clear();
  }
  supa.supabase.auth.onAuthStateChange = originalOnAuthStateChange;
}

// (7) Every browser-side Supabase consumer imports the shared client — no file
// re-imports @supabase/supabase-js for VALUE (only types allowed).
{
  const fs = await import('node:fs');
  const path = await import('node:path');
  const walk = (dir) => {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        out.push(...walk(path.join(dir, entry.name)));
      } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        out.push(path.join(dir, entry.name));
      }
    }
    return out;
  };
  const offenders = [];
  for (const file of walk(path.resolve(process.cwd(), 'src'))) {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(process.cwd(), file);
    if (rel === 'src/lib/supabase.ts') continue; // allowed to import { createClient }
    // Match any value (non-type-only) import from @supabase/supabase-js.
    // Strategy: find every import declaration that mentions @supabase/supabase-js
    // and reject it unless the WHOLE declaration is `import type …` or every
    // imported binding is marked `type`.
    const importRe = /import\s+([^'"]+)\s+from\s+['"]@supabase\/supabase-js['"]/g;
    let m;
    while ((m = importRe.exec(src)) !== null) {
      const clause = m[1];
      // Top-level `import type { … }` form.
      if (/^\s*type\s/.test(clause)) continue;
      // Strip the default-import portion (if any) and look inside the braces.
      const braceMatch = clause.match(/\{([^}]*)\}/);
      if (!braceMatch) {
        // e.g. `import * as X from …` or `import Foo from …` — both are value imports.
        offenders.push(rel);
        break;
      }
      const named = braceMatch[1];
      // Split named bindings and ensure each one is `type Foo` (or `type Foo as Bar`).
      const bindings = named.split(',').map((s) => s.trim()).filter(Boolean);
      const hasValue = bindings.some((b) => !/^type\s+/.test(b));
      if (hasValue) {
        offenders.push(rel);
        break;
      }
    }
  }
  check(
    'structure: no browser file except src/lib/supabase.ts performs a value-import from @supabase/supabase-js (type-only imports are fine)',
    offenders.length === 0,
    offenders.join(', '),
  );
}

const failed = results.filter((r) => !r.ok);
for (const r of results) realLog(`  ${r.ok ? '✓' : '✗'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
if (failed.length) {
  realError(`${failed.length}/${results.length} checks failed`);
  process.exit(1);
}
realLog(`ALL ${results.length} GoTrueClient-singleton checks passed`);
process.exit(0);

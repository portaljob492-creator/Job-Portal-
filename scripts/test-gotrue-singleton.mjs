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
 *     proving the detector is live.
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

// (4) Structural invariant: exactly one live `createClient(` call site remains.
{
  const fs = await import('node:fs');
  const path = await import('node:path');
  const file = path.resolve(process.cwd(), 'src/lib/supabase.ts');
  const source = fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const callSites = source.match(/(?<![.\w])createClient\s*\(/g) ?? [];
  check('structure: exactly one createClient() call site in src/lib/supabase.ts', callSites.length === 1);
}

const failed = results.filter((r) => !r.ok);
for (const r of results) realLog(`  ${r.ok ? '✓' : '✗'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
if (failed.length) {
  realError(`${failed.length}/${results.length} checks failed`);
  process.exit(1);
}
realLog(`ALL ${results.length} GoTrueClient-singleton checks passed`);
process.exit(0);

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Canonical Nexora Supabase project. Every Nexora app talks to this project ref
 * so that a single identity works across the marketplace and the job portal.
 * The URL is public; only the publishable/anon key comes from the environment.
 */
export const NEXORA_SUPABASE_URL = 'https://qwaehqsmodekbgvnaavz.supabase.co';

/** Vite only exposes variables prefixed with `VITE_` to the browser bundle. */
export const SUPABASE_URL_ENV_VAR = 'VITE_SUPABASE_URL';
export const SUPABASE_ANON_KEY_ENV_VAR = 'VITE_SUPABASE_ANON_KEY';

// `?? {}` keeps this module importable outside Vite (tests, scripts) while Vite
// still statically replaces `import.meta.env` with the real values in the app.
const env = import.meta.env ?? ({} as ImportMetaEnv);

function readEnvValue(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * A placeholder copied straight out of `.env.example` is not a credential.
 * Treating it as missing keeps the app on the explicit "not configured" path
 * instead of building a client that fails every request with a confusing
 * "Invalid API key" error.
 */
function isPlaceholderValue(value: string): boolean {
  return /^(your[_-].*|.*placeholder.*|<.*>|\{\{.*\}\}|changeme|replace[_-]me|todo|x{3,})$/i.test(value);
}

// `?? {}` keeps this module importable outside Vite (tests, scripts) while Vite
// still statically replaces `import.meta.env` with the real values in the app.
function resolveEnv(key: string): string | undefined {
  try {
    const metaVal = (import.meta as any)?.env?.[key];
    if (typeof metaVal === 'string' && metaVal.trim()) {
      return metaVal.trim();
    }
  } catch {}

  if (typeof window !== 'undefined') {
    const win = window as any;
    const windowVal = win.__ENV__?.[key] || win.__NEXT_DATA__?.env?.[key];
    if (typeof windowVal === 'string' && windowVal.trim()) {
      return windowVal.trim();
    }
  }

  if (typeof process !== 'undefined' && process?.env) {
    const procVal = process.env[key] || process.env[key.replace(/^VITE_/, '')];
    if (typeof procVal === 'string' && procVal.trim()) {
      return procVal.trim();
    }
  }

  return undefined;
}

export function isValidSupabaseAnonKey(key: string | undefined): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  if (
    trimmed === 'YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY' ||
    trimmed === 'YOUR_SUPABASE_ANON_KEY' ||
    trimmed === 'your-anon-key'
  ) {
    return false;
  }
  // New-style publishable keys are browser-safe. Secret keys are deliberately
  // rejected even if somebody accidentally puts one in VITE_SUPABASE_ANON_KEY.
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(trimmed)) return true;
  if (/^sb_secret_/i.test(trimmed)) return false;

  // Legacy browser keys are JWTs whose payload role is exactly `anon`. Merely
  // looking JWT-shaped is not enough: accepting a service_role JWT here would
  // put an RLS-bypassing credential into the browser bundle.
  const parts = trimmed.split('.');
  return parts.length === 3 && trimmed.startsWith('eyJ') && decodeJwtPayloadRole(trimmed) === 'anon';
}

const rawSupabaseUrl = readEnvValue(env.VITE_SUPABASE_URL);
const rawSupabaseAnonKey = readEnvValue(env.VITE_SUPABASE_ANON_KEY);

/**
 * Where an effective value came from. Build-time `import.meta.env` wins when
 * usable; otherwise the server-injected `window.__NEXORA_RUNTIME_ENV__`
 * fallback is used (express hosts / Docker-style deploys where the bundle was
 * built without env vars, so no rebuild is needed to reconfigure Supabase).
 * The URL additionally falls back to the canonical project below.
 */
export type SupabaseEnvSource = 'build-time' | 'runtime' | 'none';

export interface NexoraRuntimeEnv {
  VITE_SUPABASE_URL?: unknown;
  VITE_SUPABASE_ANON_KEY?: unknown;
  VITE_SUPABASE_STORAGE_KEY?: unknown;
}

function readRuntimeEnv(): NexoraRuntimeEnv {
  try {
    if (typeof window === 'undefined') return {};
    const win = window as unknown as { __NEXORA_RUNTIME_ENV__?: unknown; __ENV__?: unknown };
    // Primary: this repo's server injection (see server.ts). Secondary: the
    // plain `window.__ENV__` injection some hosts provide instead.
    const injected = win.__NEXORA_RUNTIME_ENV__ ?? win.__ENV__;
    if (!injected || typeof injected !== 'object') return {};
    return injected as NexoraRuntimeEnv;
  } catch {
    // Locked-down iframe / restricted window access: build-time env only.
    return {};
  }
}

function readUnknownEnvValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function pickUsableEnvValue(
  buildValue: string,
  runtimeValue: string,
): { value: string; source: SupabaseEnvSource } {
  if (buildValue && !isPlaceholderValue(buildValue)) return { value: buildValue, source: 'build-time' };
  if (runtimeValue && !isPlaceholderValue(runtimeValue)) return { value: runtimeValue, source: 'runtime' };
  return { value: '', source: 'none' };
}

const runtimeEnv = readRuntimeEnv();

const buildSupabaseUrl = rawSupabaseUrl;
const buildSupabaseAnonKey = rawSupabaseAnonKey;
const runtimeSupabaseUrl = readUnknownEnvValue(runtimeEnv.VITE_SUPABASE_URL);
const runtimeSupabaseAnonKey = readUnknownEnvValue(runtimeEnv.VITE_SUPABASE_ANON_KEY);

const pickedUrl = pickUsableEnvValue(buildSupabaseUrl, runtimeSupabaseUrl);
const pickedAnonKey = pickUsableEnvValue(buildSupabaseAnonKey, runtimeSupabaseAnonKey);

/** Effective usable values (empty when missing/placeholder in every layer). */
const effectiveSupabaseUrl = pickedUrl.value;
const effectiveSupabaseAnonKey = pickedAnonKey.value;

/** Which layer supplied each effective value — surfaced in diagnostics. */
export const supabaseUrlEnvSource: SupabaseEnvSource = pickedUrl.source;
export const supabaseAnonKeyEnvSource: SupabaseEnvSource = pickedAnonKey.source;

const hasUsableUrl = pickedUrl.source !== 'none';
const hasUsableAnonKey = pickedAnonKey.source !== 'none';

// The project URL is public, so it falls back to the canonical Nexora project.
// The key is a credential and never has a fallback.
const supabaseUrl = (hasUsableUrl ? effectiveSupabaseUrl : NEXORA_SUPABASE_URL).replace(/\/+$/, '');
const supabaseAnonKey = hasUsableAnonKey ? effectiveSupabaseAnonKey : '';

/**
 * Environment variables that are genuinely absent or still hold a placeholder.
 * `VITE_SUPABASE_URL` is listed for diagnostics only: because the canonical URL
 * is public, a missing URL never disables the client on its own.
 */
export const missingSupabaseEnv: readonly string[] = [
  ...(hasUsableUrl ? [] : [SUPABASE_URL_ENV_VAR]),
  ...(hasUsableAnonKey ? [] : [SUPABASE_ANON_KEY_ENV_VAR]),
];

/** The variables whose absence is what actually puts the app in demo mode. */
export const blockingSupabaseEnv: readonly string[] = hasUsableAnonKey
  ? []
  : [SUPABASE_ANON_KEY_ENV_VAR];


export function projectRefFromUrl(url: string): string {
  try {
    const [ref] = new URL(url).hostname.split('.');
    return ref || 'nexora';
  } catch {
    return 'nexora';
  }
}

export const supabaseProjectRef = projectRefFromUrl(supabaseUrl);

/**
 * Universal Nexora auth storage key. It namespaces the persisted PKCE session so
 * several Nexora apps on the same origin never read or overwrite each other's
 * tokens, and it is stable across deploys.
 */
const rawStorageKey = resolveEnv('VITE_SUPABASE_STORAGE_KEY');
export const supabaseStorageKey =
  rawStorageKey && !rawStorageKey.startsWith('eyJ')
    ? rawStorageKey
    : `nexora.auth.${supabaseProjectRef}`;

/**
 * The app remains usable in demo mode when Supabase environment variables are
 * absent or uninitialized.
 */
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  isValidSupabaseAnonKey(supabaseAnonKey)
);

export interface NexoraAuthClientOptions {
  storageKey: string;
  persistSession: boolean;
  autoRefreshToken: boolean;
  detectSessionInUrl: boolean;
  flowType: 'pkce';
}

/**
 * The one and only auth configuration used by the shared client.
 * PKCE is required so that no access token ever travels through the redirect URL.
 */
export function buildAuthClientOptions(storageKey: string = supabaseStorageKey): NexoraAuthClientOptions {
  return {
    storageKey,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  };
}

/**
 * supabase-js previously persisted sessions under `sb-<ref>-auth-token`. Moving
 * to the Nexora storage key must not silently sign existing users out, so the
 * stored session is carried over exactly once before the client is created.
 */
export function migrateLegacySessionStorage(storageKey: string = supabaseStorageKey): boolean {
  if (typeof window === 'undefined') return false;
  const legacyKey = `sb-${supabaseProjectRef}-auth-token`;
  if (legacyKey === storageKey) return false;
  try {
    if (window.localStorage.getItem(storageKey)) return false;
    const legacySession = window.localStorage.getItem(legacyKey);
    if (!legacySession) return false;
    window.localStorage.setItem(storageKey, legacySession);
    window.localStorage.removeItem(legacyKey);
    return true;
  } catch {
    // Private browsing / blocked storage: the PKCE flow still works in memory.
    return false;
  }
}

// Exactly one client per runtime, even when the module is re-evaluated by HMR.
const globalForSupabase = globalThis as unknown as { __nexoraJobPortalSupabase?: SupabaseClient | null };

function createSharedClient(): SupabaseClient | null {
  if (globalForSupabase.__nexoraJobPortalSupabase !== undefined) {
    return globalForSupabase.__nexoraJobPortalSupabase;
  }

  const client = isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseAnonKey!, {
        auth: buildAuthClientOptions(),
        realtime: {
          params: { eventsPerSecond: 10 },
        },
      })
    : null;

  globalForSupabase.__nexoraJobPortalSupabase = client;
  return client;
}

if (isSupabaseConfigured) migrateLegacySessionStorage();

export const supabase: SupabaseClient | null = createSharedClient();

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      `Supabase is not configured. Set ${blockingSupabaseEnv.join(', ')} and rebuild the app ` +
        '(locally: .env in the project root; on Vercel: Project Settings -> Environment Variables, then redeploy; ' +
        'on express hosts: set SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY in the server environment and restart — no rebuild needed).',
    );
  }

  return supabase;
}

/* ------------------------------------------------------------------ */
/* Production diagnostics: confirm `VITE_*` env vars made it into the  */
/* browser bundle. Never logs the anon key itself — only presence,     */
/* length, shape and a short masked preview.                           */
/* ------------------------------------------------------------------ */

export interface SupabaseEnvVarDiagnosis {
  varName: string;
  /** A non-empty value exists in at least one layer (build-time or runtime). */
  present: boolean;
  /** Non-empty in some layer but placeholder everywhere, so it was ignored. */
  isPlaceholder: boolean;
  /** Passed format/shape validation (placeholder values never count). */
  valid: boolean;
  /** Which layer supplied the effective value (`none` when unusable everywhere). */
  source: SupabaseEnvSource;
  /** Build-time `import.meta.env` carried a usable (non-placeholder) value. */
  buildTimeUsable: boolean;
  /** Server-injected `window.__NEXORA_RUNTIME_ENV__` carried a usable value. */
  runtimeUsable: boolean;
  humanReadable: string;
}

export interface SupabaseDiagnosticsReport {
  timestamp: string;
  mode: string;
  isProductionBuild: boolean;
  url: SupabaseEnvVarDiagnosis & {
    usingCanonicalFallback: boolean;
    /** The URL is public, so the effective value is safe to log. */
    effectiveUrl: string;
    projectRef: string;
  };
  anonKey: SupabaseEnvVarDiagnosis & {
    length: number;
    /** e.g. `eyJhbG…a1 (len 208)` — never the full credential. */
    maskedPreview: string;
    looksLikeJwt: boolean;
    looksLikePublishableKey: boolean;
    looksLikeSecretKey: boolean;
    payloadRole: string | null;
  };
  isSupabaseConfigured: boolean;
  clientInitialized: boolean;
  /** Result of a throwaway `createClient(...)` init attempt with the same inputs. */
  initAttempt: { attempted: boolean; ok: boolean; error: string | null };
  storageKey: string;
  missingSupabaseEnv: readonly string[];
  blockingSupabaseEnv: readonly string[];
  verdict: 'ok' | 'misconfigured';
  remediation: string | null;
}

/** `https://<ref>.supabase.co` (or a custom Supabase/self-hosted https URL). */
export function isValidSupabaseUrlFormat(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    if (!parsed.hostname) return false;
    // Reject obvious non-URLs that slipped past the placeholder check.
    if (/\s/.test(url)) return false;
    return true;
  } catch {
    return false;
  }
}

/** Short non-sensitive preview: first 6 + last 2 chars plus length. */
export function maskSupabaseAnonKey(key: string): string {
  if (!key) return '(missing)';
  if (key.length <= 10) return '*** (too short to be valid)';
  return `${key.slice(0, 6)}…${key.slice(-2)} (len ${key.length})`;
}

function decodeJwtPayloadRole(key: string): string | null {
  try {
    const parts = key.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1] ?? '';
    if (!payload) return null;
    // Base64url -> base64 for `atob`; fall back gracefully outside the browser.
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const json =
      typeof atob === 'function'
        ? atob(padded)
        : typeof Buffer !== 'undefined'
          ? Buffer.from(padded, 'base64').toString('utf8')
          : '';
    if (!json) return null;
    const parsed = JSON.parse(json) as { role?: unknown };
    return typeof parsed.role === 'string' ? parsed.role : null;
  } catch {
    return null;
  }
}

export function diagnoseSupabaseEnv(): SupabaseDiagnosticsReport {
  const timestamp = new Date().toISOString();
  const mode = readEnvValue(env.MODE) || (env.PROD ? 'production' : env.DEV ? 'development' : 'unknown');
  const isProductionBuild = Boolean(env.PROD) || mode === 'production';

  const sourceLabel = (source: SupabaseEnvSource): string =>
    source === 'build-time'
      ? 'build-time VITE_*'
      : source === 'runtime'
        ? 'server runtime injection (window.__NEXORA_RUNTIME_ENV__)'
        : 'none';

  const urlBuildUsable = Boolean(buildSupabaseUrl) && !isPlaceholderValue(buildSupabaseUrl);
  const urlRuntimeUsable = Boolean(runtimeSupabaseUrl) && !isPlaceholderValue(runtimeSupabaseUrl);
  const urlPresent = buildSupabaseUrl.length > 0 || runtimeSupabaseUrl.length > 0;
  const urlIsPlaceholder = urlPresent && pickedUrl.source === 'none';
  const urlValid = hasUsableUrl && isValidSupabaseUrlFormat(effectiveSupabaseUrl);
  const usingCanonicalFallback = !hasUsableUrl;

  const keyBuildUsable = Boolean(buildSupabaseAnonKey) && !isPlaceholderValue(buildSupabaseAnonKey);
  const keyRuntimeUsable = Boolean(runtimeSupabaseAnonKey) && !isPlaceholderValue(runtimeSupabaseAnonKey);
  const keyPresent = buildSupabaseAnonKey.length > 0 || runtimeSupabaseAnonKey.length > 0;
  const keyIsPlaceholder = keyPresent && pickedAnonKey.source === 'none';
  const looksLikeJwt = hasUsableAnonKey && effectiveSupabaseAnonKey.split('.').length === 3;
  const looksLikePublishableKey =
    hasUsableAnonKey && /^sb_publishable_[A-Za-z0-9_-]+$/.test(effectiveSupabaseAnonKey);
  const looksLikeSecretKey = hasUsableAnonKey && /^sb_secret_/i.test(effectiveSupabaseAnonKey);
  const payloadRole = hasUsableAnonKey ? decodeJwtPayloadRole(effectiveSupabaseAnonKey) : null;
  // Use the exact client-initialization validator here as well, so diagnostics
  // can never label an sb_secret_* key or service_role JWT as browser-safe.
  const keyValidShape = isValidSupabaseAnonKey(effectiveSupabaseAnonKey);

  // Attempt a throwaway client init with the exact same inputs, so the report
  // proves initialization works instead of only reporting env presence.
  let initOk = false;
  let initError: string | null = null;
  let attempted = false;
  if (isSupabaseConfigured) {
    attempted = true;
    try {
      createClient(supabaseUrl, supabaseAnonKey, { auth: buildAuthClientOptions() });
      initOk = true;
    } catch (error) {
      initError = error instanceof Error ? error.message : String(error);
    }
  } else {
    initError = `Missing ${blockingSupabaseEnv.join(', ') || 'credentials'} — client not created (demo mode).`;
  }

  const clientInitialized = supabase !== null;
  const verdict: SupabaseDiagnosticsReport['verdict'] =
    isSupabaseConfigured && clientInitialized && initOk ? 'ok' : 'misconfigured';

  const urlHuman = !urlPresent
    ? 'MISSING in every layer — using canonical fallback URL'
    : urlIsPlaceholder
      ? 'PLACEHOLDER in every layer — using canonical fallback URL'
      : urlValid
        ? `present and well-formed (source: ${sourceLabel(pickedUrl.source)})`
        : `present but MALFORMED (source: ${sourceLabel(pickedUrl.source)}) — not a valid URL`;
  const keyHuman = !keyPresent
    ? 'MISSING in every layer — Supabase client cannot initialize'
    : keyIsPlaceholder
      ? 'PLACEHOLDER in every layer — Supabase client cannot initialize'
      : looksLikeSecretKey || (looksLikeJwt && payloadRole !== 'anon')
        ? `UNSAFE server credential rejected (source: ${sourceLabel(pickedAnonKey.source)}) — use an anon or sb_publishable_* key`
        : keyValidShape
          ? `present and browser-safe (source: ${sourceLabel(pickedAnonKey.source)})${payloadRole ? ` — JWT role=${payloadRole}` : looksLikePublishableKey ? ' — publishable key' : ''}`
          : `present but UNRECOGNIZED shape (source: ${sourceLabel(pickedAnonKey.source)}) — expected a role=anon JWT or sb_publishable_* key`;

  return {
    timestamp,
    mode,
    isProductionBuild,
    url: {
      varName: SUPABASE_URL_ENV_VAR,
      present: urlPresent,
      isPlaceholder: urlIsPlaceholder,
      valid: urlValid || usingCanonicalFallback,
      source: pickedUrl.source,
      buildTimeUsable: urlBuildUsable,
      runtimeUsable: urlRuntimeUsable,
      humanReadable: urlHuman,
      usingCanonicalFallback,
      effectiveUrl: supabaseUrl,
      projectRef: supabaseProjectRef,
    },
    anonKey: {
      varName: SUPABASE_ANON_KEY_ENV_VAR,
      present: keyPresent,
      isPlaceholder: keyIsPlaceholder,
      valid: keyValidShape,
      source: pickedAnonKey.source,
      buildTimeUsable: keyBuildUsable,
      runtimeUsable: keyRuntimeUsable,
      humanReadable: keyHuman,
      length: effectiveSupabaseAnonKey.length,
      maskedPreview: maskSupabaseAnonKey(effectiveSupabaseAnonKey),
      looksLikeJwt,
      looksLikePublishableKey,
      looksLikeSecretKey,
      payloadRole,
    },
    isSupabaseConfigured,
    clientInitialized,
    initAttempt: { attempted, ok: initOk, error: initError },
    storageKey: supabaseStorageKey,
    missingSupabaseEnv,
    blockingSupabaseEnv,
    verdict,
    remediation:
      verdict === 'ok'
        ? null
        : `Set ${blockingSupabaseEnv.join(', ') || SUPABASE_ANON_KEY_ENV_VAR} ` +
          '(locally: .env in the project root; on Vercel: Settings → Environment Variables → Production, then redeploy — ' +
          'Vite inlines VITE_* values at build time).',
  };
}

export interface RunSupabaseDiagnosticsOptions {
  /** Write the formatted report to the console (default: true). */
  log?: boolean;
  /** Fire a live `auth.getSession()` probe and log its outcome (default: true in browser). */
  probeSession?: boolean;
}

/**
 * Diagnostic entry point: attempts client initialization, checks both `VITE_*`
 * variables for presence + validity, and prints the result to the console so a
 * production deploy can be verified from DevTools. Returns the full report and
 * stores it on `window.__NEXORA_SUPABASE_DIAGNOSTICS__` for inspection.
 *
 * The anon key itself is never logged — only a masked preview.
 */
export function runSupabaseDiagnostics(options: RunSupabaseDiagnosticsOptions = {}): SupabaseDiagnosticsReport {
  const { log = true, probeSession = typeof window !== 'undefined' } = options;
  const report = diagnoseSupabaseEnv();

  try {
    (globalThis as Record<string, unknown>).__NEXORA_SUPABASE_DIAGNOSTICS__ = report;
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__NEXORA_SUPABASE_DIAGNOSTICS__ = report;
    }
  } catch {
    // Read-only global (locked-down iframe) — the return value still works.
  }

  if (log && typeof console !== 'undefined') {
    const ok = report.verdict === 'ok';
    const title = `[Supabase] diagnostics (${report.mode}) — ${ok ? 'OK ✅' : 'MISCONFIGURED ❌'}`;
    const group = console.groupCollapsed ?? console.group ?? console.log;
    const groupEnd = console.groupEnd ?? (() => {});
    try {
      (group as (...args: unknown[]) => void).call(
        console,
        `%c${title}`,
        ok ? 'color: green; font-weight: bold' : 'color: #b45309; font-weight: bold',
      );
    } catch {
      console.log(title);
    }
    console.log(`[${report.timestamp}] Supabase env check (Vite inlines VITE_* at build time — redeploy after changing them):`);
    console.log(
      `${report.url.valid ? '✅' : '❌'} ${report.url.varName}: ${report.url.humanReadable} — effective URL: ${report.url.effectiveUrl}${report.url.usingCanonicalFallback ? ' (canonical fallback)' : ''} — project ref: ${report.url.projectRef}`,
    );
    console.log(
      `${report.anonKey.valid ? '✅' : '❌'} ${report.anonKey.varName}: ${report.anonKey.humanReadable} — preview: ${report.anonKey.maskedPreview}`,
    );
    console.log(
      `${report.clientInitialized && report.initAttempt.ok ? '✅' : '❌'} Client initialization: ` +
        (report.clientInitialized && report.initAttempt.ok
          ? `initialized (storage key: ${report.storageKey})`
          : `NOT initialized — ${report.initAttempt.error ?? 'unknown error'}`),
    );
    if (report.missingSupabaseEnv.length > 0) {
      console.log(`ℹ️ missingSupabaseEnv: [${report.missingSupabaseEnv.join(', ')}]`);
    }
    if (report.remediation) {
      (ok ? console.info : console.warn).call(console, `ℹ️ Fix: ${report.remediation}`);
    }
    console.log('ℹ️ Full report: window.__NEXORA_SUPABASE_DIAGNOSTICS__ — re-run with window.__runSupabaseDiagnostics()');
    try {
      groupEnd.call(console);
    } catch {
      /* noop */
    }
    if (!ok && typeof console.warn === 'function') {
      console.warn(`[Supabase] ${report.anonKey.humanReadable}. ${report.remediation ?? ''}`);
    }
  }

  // Live usability probe: confirms the initialized client can actually talk to
  // the Supabase auth layer (reads local session; no credentials are logged).
  if (probeSession && supabase) {
    try {
      supabase.auth
        .getSession()
        .then(({ data, error }) => {
          if (error) {
            console.warn('[Supabase] diagnostics: live auth.getSession() probe failed:', error.message);
          } else {
            console.log(
              `[Supabase] diagnostics: live auth.getSession() probe ok (session ${data.session ? 'present' : 'absent — signed out, client is usable'})`,
            );
          }
        })
        .catch((error: unknown) => {
          console.warn(
            '[Supabase] diagnostics: live auth.getSession() probe threw:',
            error instanceof Error ? error.message : String(error),
          );
        });
    } catch (error) {
      console.warn(
        '[Supabase] diagnostics: could not start auth.getSession() probe:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return report;
}

declare global {
  interface Window {
    __NEXORA_SUPABASE_DIAGNOSTICS__?: SupabaseDiagnosticsReport;
    __runSupabaseDiagnostics?: (options?: RunSupabaseDiagnosticsOptions) => SupabaseDiagnosticsReport;
    /** Server-injected runtime env (see server.ts) — fallback when build-time `VITE_*` is missing. */
    __NEXORA_RUNTIME_ENV__?: NexoraRuntimeEnv | null;
  }
}

// Expose a manual re-run hook and print once per page load (guarded for HMR),
// including production builds, so env loading can be confirmed from DevTools.
const globalForDiagnostics = globalThis as unknown as {
  __nexoraSupabaseDiagnosticsLogged?: boolean;
  __runSupabaseDiagnostics?: (options?: RunSupabaseDiagnosticsOptions) => SupabaseDiagnosticsReport;
};

globalForDiagnostics.__runSupabaseDiagnostics = runSupabaseDiagnostics;
if (typeof window !== 'undefined') {
  window.__runSupabaseDiagnostics = runSupabaseDiagnostics;
  if (!globalForDiagnostics.__nexoraSupabaseDiagnosticsLogged) {
    globalForDiagnostics.__nexoraSupabaseDiagnosticsLogged = true;
    runSupabaseDiagnostics({ log: true, probeSession: true });
  }
}

// ---------------------------------------------------------------------------
// Live configuration checks (client initialization + network probes against
// the Supabase project). Complements the build-time diagnostics above.
// ---------------------------------------------------------------------------

export interface SupabaseLiveCheckResult {
  ok: boolean;
  configured: boolean;
  url: string;
  projectRef: string;
  hasAnonKey: boolean;
  validKeyFormat: boolean;
  clientInitialized: boolean;
  latencyMs?: number;
  error?: string | null;
  timestamp: string;
}

export interface SupabaseConfigDiagnostics {
  url: string;
  projectRef: string;
  hasAnonKey: boolean;
  validKeyFormat: boolean;
  storageKey: string;
  isConfigured: boolean;
  clientInitialized: boolean;
}

export function getSupabaseConfigDiagnostics(): SupabaseConfigDiagnostics {
  return {
    url: supabaseUrl,
    projectRef: supabaseProjectRef,
    hasAnonKey: Boolean(supabaseAnonKey),
    validKeyFormat: isValidSupabaseAnonKey(supabaseAnonKey),
    storageKey: supabaseStorageKey,
    isConfigured: isSupabaseConfigured,
    clientInitialized: supabase !== null,
  };
}

/**
 * Performs a live check of VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
 * against Supabase client initialization and network endpoints.
 */
export async function checkSupabaseLive(
  targetClient: SupabaseClient | null = supabase,
): Promise<SupabaseLiveCheckResult> {
  const result: SupabaseLiveCheckResult = {
    ok: false,
    configured: isSupabaseConfigured,
    url: supabaseUrl,
    projectRef: supabaseProjectRef,
    hasAnonKey: Boolean(supabaseAnonKey),
    validKeyFormat: isValidSupabaseAnonKey(supabaseAnonKey),
    clientInitialized: targetClient !== null,
    error: null,
    timestamp: new Date().toISOString(),
  };

  if (!isSupabaseConfigured || !targetClient) {
    result.error = !supabaseAnonKey
      ? 'VITE_SUPABASE_ANON_KEY is missing or empty'
      : !isValidSupabaseAnonKey(supabaseAnonKey)
      ? 'VITE_SUPABASE_ANON_KEY is a placeholder or invalid JWT format'
      : 'Supabase client failed to initialize';
    return result;
  }

  const startTime = Date.now();
  try {
    // 1. Check Auth service connectivity via getSession
    const { error: authError } = await targetClient.auth.getSession();
    if (authError) {
      result.latencyMs = Date.now() - startTime;
      result.error = `Supabase auth service returned error: ${authError.message}`;
      return result;
    }

    // 2. Perform a lightweight public table query
    const { error: queryError } = await targetClient
      .from('public_job_listings')
      .select('id')
      .limit(1);

    result.latencyMs = Date.now() - startTime;

    if (queryError) {
      result.error = `Supabase query error: ${queryError.message}`;
      return result;
    }

    result.ok = true;
    return result;
  } catch (err: any) {
    result.latencyMs = Date.now() - startTime;
    result.error = err?.message || 'Network error connecting to Supabase';
    return result;
  }
}

/**
 * Async live check alias for isSupabaseConfigured
 */
export const isSupabaseConfiguredLive = checkSupabaseLive;
export const verifySupabaseConfiguration = checkSupabaseLive;

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Canonical Nexora Supabase project. Every Nexora app talks to this project ref
 * so that a single identity works across the marketplace and the job portal.
 * The URL is public; only the publishable/anon key comes from the environment.
 */
export const NEXORA_SUPABASE_URL = 'https://qwaehqsmodekbgvnaavz.supabase.co';

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
  const parts = trimmed.split('.');
  return parts.length === 3 && trimmed.startsWith('eyJ');
}

const supabaseUrl = (resolveEnv('VITE_SUPABASE_URL') || NEXORA_SUPABASE_URL).replace(/\/+$/, '');
const supabaseAnonKey = resolveEnv('VITE_SUPABASE_ANON_KEY');

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
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.',
    );
  }

  return supabase;
}

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

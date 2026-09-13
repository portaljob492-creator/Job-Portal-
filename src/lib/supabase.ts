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

const rawSupabaseUrl = readEnvValue(env.VITE_SUPABASE_URL);
const rawSupabaseAnonKey = readEnvValue(env.VITE_SUPABASE_ANON_KEY);

const hasUsableUrl = Boolean(rawSupabaseUrl) && !isPlaceholderValue(rawSupabaseUrl);
const hasUsableAnonKey = Boolean(rawSupabaseAnonKey) && !isPlaceholderValue(rawSupabaseAnonKey);

// The project URL is public, so it falls back to the canonical Nexora project.
// The key is a credential and never has a fallback.
const supabaseUrl = (hasUsableUrl ? rawSupabaseUrl : NEXORA_SUPABASE_URL).replace(/\/+$/, '');
const supabaseAnonKey = hasUsableAnonKey ? rawSupabaseAnonKey : '';

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
export const supabaseStorageKey =
  readEnvValue(env.VITE_SUPABASE_STORAGE_KEY) || `nexora.auth.${supabaseProjectRef}`;

/**
 * The app remains usable in demo mode when Supabase environment variables are
 * absent. Production data/auth methods explicitly fail instead of silently
 * pretending that a request succeeded.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

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
        '(locally: .env in the project root; on Vercel: Project Settings -> Environment Variables, then redeploy).',
    );
  }

  return supabase;
}

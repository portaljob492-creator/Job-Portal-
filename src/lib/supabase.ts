import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Canonical Nexora Supabase project. Every Nexora app talks to this project ref
 * so that a single identity works across the marketplace and the job portal.
 * The URL is public; only the publishable/anon key comes from the environment.
 */
export const NEXORA_SUPABASE_URL = 'https://qwaehqsmodekbgvnaavz.supabase.co';

// `?? {}` keeps this module importable outside Vite (tests, scripts) while Vite
// still statically replaces `import.meta.env` with the real values in the app.
const env = import.meta.env ?? ({} as ImportMetaEnv);

const supabaseUrl = (env.VITE_SUPABASE_URL?.trim() || NEXORA_SUPABASE_URL).replace(/\/+$/, '');
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY?.trim();

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
  env.VITE_SUPABASE_STORAGE_KEY?.trim() || `nexora.auth.${supabaseProjectRef}`;

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
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.',
    );
  }

  return supabase;
}

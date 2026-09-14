import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { logger } from './logger';
import { isSessionInvalidError } from './authErrors';
import { loginPath } from '../routing';

/**
 * Single source of truth for Supabase auth state.
 *
 * The whole app registers exactly ONE `onAuthStateChange` listener (owned here)
 * and every consumer — the root provider, `App`, and `useLocationSync` — reads
 * this store. That is what prevents duplicate auth listeners when several
 * features need auth events at the same time.
 *
 * HMR/StrictMode safety: the shared Supabase client itself is stored on
 * `globalThis` (see `src/lib/supabase.ts`) so a hot module replacement never
 * creates a second GoTrueClient. This module's mutable state (the listener
 * subscription, the handler set, snapshot, and bookkeeping flags) is also kept
 * on `globalThis` so a re-evaluated module sees the live subscription instead
 * of attaching a second one to the same client. Without this guard, Vite HMR
 * doubles the auth listener on every hot reload of authSession.ts, producing
 * duplicated redirects on sign-out and, in some edge cases, contributing to
 * the "Multiple GoTrueClient instances detected" diagnostic noise.
 */

export type AuthSessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthSessionSnapshot {
  /** Last Supabase auth event: INITIAL_SESSION | SIGNED_IN | SIGNED_OUT | TOKEN_REFRESHED | … */
  event: AuthChangeEvent | null;
  session: Session | null;
  userId: string | null;
  status: AuthSessionStatus;
  /** False until the initial session has been resolved from storage. */
  isInitialised: boolean;
  /** True when the session was lost without the user asking to sign out. */
  invalidated: boolean;
  invalidReason: string | null;
}

export type AuthSessionHandler = (
  event: AuthChangeEvent | null,
  session: Session | null,
  snapshot: AuthSessionSnapshot,
) => void;

interface AuthSessionModuleState {
  handlers: Set<AuthSessionHandler>;
  snapshot: AuthSessionSnapshot;
  subscription: { unsubscribe: () => void } | null;
  /** Timestamp of the last explicit sign-out request (0 = none pending). */
  deliberateSignOutAt: number;
  invalidSessionHandled: boolean;
}

const EMPTY_SNAPSHOT: AuthSessionSnapshot = {
  event: null,
  session: null,
  userId: null,
  status: 'loading',
  isInitialised: false,
  invalidated: false,
  invalidReason: null,
};

const GLOBAL_KEY = '__nexoraJobPortalAuthSession' as const;

function getState(): AuthSessionModuleState {
  const g = globalThis as unknown as {
    [GLOBAL_KEY]?: AuthSessionModuleState;
  };
  let state = g[GLOBAL_KEY];
  if (!state) {
    state = {
      handlers: new Set<AuthSessionHandler>(),
      snapshot: { ...EMPTY_SNAPSHOT },
      subscription: null,
      deliberateSignOutAt: 0,
      invalidSessionHandled: false,
    };
    g[GLOBAL_KEY] = state;
  }
  return state;
}

// Every module re-evaluation (initial load and Vite HMR) binds to the SAME
// state object, so handlers/snapshot/subscription/flags survive reloads.
const state = getState();
const { handlers } = state;

const DELIBERATE_SIGN_OUT_WINDOW_MS = 10_000;

function notify(event: AuthChangeEvent | null) {
  const current = state.snapshot;
  handlers.forEach((handler) => {
    try {
      handler(event, current.session, current);
    } catch (error) {
      logger('auth').error('auth subscriber failed', error);
    }
  });
}

function setSnapshot(next: Partial<AuthSessionSnapshot>, event: AuthChangeEvent | null) {
  state.snapshot = { ...state.snapshot, ...next };
  notify(event);
}

function applySession(event: AuthChangeEvent, session: Session | null) {
  const user = session?.user ?? null;
  const invalidated = event === 'SIGNED_OUT' ? state.snapshot.invalidated && !wasDeliberateSignOut() : false;
  setSnapshot(
    {
      event,
      session,
      userId: user?.id ?? null,
      status: user ? 'authenticated' : 'unauthenticated',
      isInitialised: true,
      invalidated,
      invalidReason: invalidated ? state.snapshot.invalidReason : null,
    },
    event,
  );
}

function wasDeliberateSignOut(): boolean {
  if (!state.deliberateSignOutAt) return false;
  const recent = Date.now() - state.deliberateSignOutAt < DELIBERATE_SIGN_OUT_WINDOW_MS;
  state.deliberateSignOutAt = 0;
  return recent;
}

/** Called by explicit sign-out paths so a logout is not treated as a session failure. */
export function markUserInitiatedSignOut(): void {
  state.deliberateSignOutAt = Date.now();
}

/**
 * A sign-up request must start anonymously. In particular, a browser can still
 * contain a structurally valid JWT after its auth user was deleted; attaching
 * that token to the public email-role lookup makes GoTrue reject the lookup with
 * "User from sub claim in JWT does not exist" before sign-up is even attempted.
 *
 * Clear only this browser's session before sign-up (sign-in calls this too, for
 * the same reason). Supabase removes the local tokens even when its logout
 * endpoint reports that a deleted/revoked JWT user is missing, and local scope
 * avoids revoking unrelated sessions on other devices.
 */
export async function clearSessionBeforeSignUp(client: SupabaseClient): Promise<boolean> {
  let hasStoredSession = false;
  let sessionReadFailed = false;

  try {
    const { data, error } = await client.auth.getSession();
    hasStoredSession = Boolean(data.session);
    sessionReadFailed = Boolean(error);
  } catch {
    // A corrupt/unreadable stored session should be removed just like a stale one.
    sessionReadFailed = true;
  }

  if (!hasStoredSession && !sessionReadFailed) return false;

  markUserInitiatedSignOut();
  try {
    const { error } = await client.auth.signOut({ scope: 'local' });
    // Some client versions can still report the stale-session error after the
    // local state was cleared. That error is safe to ignore; anything else is a
    // real storage/client failure and must stop sign-up.
    if (error && !isSessionInvalidError(error)) throw error;
  } catch (error) {
    if (!isSessionInvalidError(error)) throw error;
  }

  return true;
}

function handleAuthEvent(event: AuthChangeEvent, session: Session | null) {
  switch (event) {
    case 'INITIAL_SESSION':
      // Resolves the pending session from storage; never treated as a failure.
      state.invalidSessionHandled = false;
      applySession(event, session);
      break;
    case 'SIGNED_IN':
    case 'USER_UPDATED':
      state.invalidSessionHandled = false;
      applySession(event, session);
      break;
    case 'TOKEN_REFRESHED':
      if (!session) {
        // A refresh that returns no session means the tokens are unusable.
        handleInvalidSession('Refreshed session is missing.');
        return;
      }
      state.invalidSessionHandled = false;
      applySession(event, session);
      break;
    case 'SIGNED_OUT': {
      const deliberate = wasDeliberateSignOut();
      if (!deliberate && state.snapshot.status === 'authenticated') {
        // The session vanished underneath the app (revoked, expired, or cleared).
        setSnapshot(
          {
            event,
            session: null,
            userId: null,
            status: 'unauthenticated',
            isInitialised: true,
            invalidated: true,
            invalidReason: state.snapshot.invalidReason ?? 'Your session expired. Please sign in again.',
          },
          event,
        );
        void redirectToLogin();
        return;
      }
      applySession(event, session);
      break;
    }
    default:
      applySession(event, session);
  }
}

function ensureSubscription(): void {
  if (state.subscription) return;
  if (!supabase) {
    // Demo mode: no auth backend, so resolve as signed-out exactly once.
    if (!state.snapshot.isInitialised) {
      setSnapshot({ status: 'unauthenticated', isInitialised: true }, null);
    }
    return;
  }

  state.subscription = supabase.auth.onAuthStateChange(handleAuthEvent).data.subscription;

  // Defensive hydration: supabase-js normally emits INITIAL_SESSION for new
  // subscribers, but resolving the session directly keeps the store correct even
  // when the first subscriber attaches after that emission.
  void supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      reportSessionError(error);
      return;
    }
    if (state.snapshot.isInitialised) return;
    applySession('INITIAL_SESSION', data.session);
  }).catch((error: unknown) => {
    reportSessionError(error);
  });
}

/**
 * Subscribe to auth events. The handler is invoked immediately with the current
 * snapshot, then on every Supabase auth event. Returns an unsubscribe function.
 *
 * HMR/react-strict safe: adding a handler never creates a second Supabase auth
 * listener because the underlying subscription is owned by the globalThis-backed
 * module state above.
 */
export function subscribeToAuthChanges(handler: AuthSessionHandler): () => void {
  handlers.add(handler);
  ensureSubscription();
  handler(state.snapshot.event, state.snapshot.session, state.snapshot);
  return () => {
    handlers.delete(handler);
  };
}

export function getAuthSnapshot(): AuthSessionSnapshot {
  return state.snapshot;
}

/**
 * Classifies a failure from any Supabase call. Invalid/expired sessions clear the
 * stored tokens once and send the user to the login route; everything else (offline,
 * RLS denials, validation errors) leaves the session untouched.
 */
export function reportSessionError(error: unknown): boolean {
  if (!isSessionInvalidError(error)) return false;
  const reason = error instanceof Error && error.message ? error.message : 'Your session expired. Please sign in again.';
  handleInvalidSession(reason);
  return true;
}

function handleInvalidSession(reason: string): void {
  if (state.invalidSessionHandled) return;
  state.invalidSessionHandled = true;

  setSnapshot(
    {
      session: null,
      userId: null,
      status: 'unauthenticated',
      isInitialised: true,
      invalidated: true,
      invalidReason: reason,
    },
    'SIGNED_OUT',
  );

  // Remove the unusable token from this browser without revoking sessions on
  // other devices. Supabase tolerates a 401/403/404 from its logout endpoint and
  // still removes local state, so this also works after the auth user is deleted.
  markUserInitiatedSignOut();
  if (supabase) void supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  void redirectToLogin();
}

/**
 * SPA redirect to the login route. Guarded by the current pathname so repeated
 * invalid-session signals can never produce a redirect loop.
 */
export function redirectToLogin(): boolean {
  if (typeof window === 'undefined') return false;
  const target = loginPath();
  if (window.location.pathname === target) return false;

  window.history.replaceState({}, document.title, target);
  window.dispatchEvent(new PopStateEvent('popstate'));
  return true;
}

/**
 * Test/teardown helper: drop the retained subscription so a fresh module
 * instance in unit tests can re-register cleanly. Not used at runtime.
 */
export function __resetAuthSessionForTests(): void {
  if (state.subscription) {
    try { state.subscription.unsubscribe(); } catch { /* noop */ }
  }
  state.subscription = null;
  state.handlers.clear();
  state.snapshot = { ...EMPTY_SNAPSHOT };
  state.deliberateSignOutAt = 0;
  state.invalidSessionHandled = false;
}

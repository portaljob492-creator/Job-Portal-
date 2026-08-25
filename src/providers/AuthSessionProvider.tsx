import { createContext, useContext, type ReactNode } from 'react';
import { useAuthSession } from '../hooks/useAuthSession';
import { useLocationSync } from '../hooks/useLocationSync';
import type { AuthSessionSnapshot } from '../lib/authSession';

/**
 * Authenticated root of the job portal.
 *
 * It owns the one shared auth snapshot (single `onAuthStateChange` listener) and
 * mounts authenticated location synchronization exactly once, so no screen has to
 * wire either concern up by itself.
 */
const AuthSessionContext = createContext<AuthSessionSnapshot | null>(null);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const snapshot = useAuthSession();
  // Location sync is bound to the authenticated root: it starts only for a signed
  // in user, and its watcher is released on sign-out or session invalidation.
  useLocationSync();

  return <AuthSessionContext.Provider value={snapshot}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSessionContext(): AuthSessionSnapshot {
  const snapshot = useContext(AuthSessionContext);
  if (!snapshot) {
    throw new Error('useAuthSessionContext must be used inside <AuthSessionProvider>.');
  }
  return snapshot;
}

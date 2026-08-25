import { useEffect, useState } from 'react';
import {
  getAuthSnapshot,
  subscribeToAuthChanges,
  type AuthSessionSnapshot,
} from '../lib/authSession';

/**
 * React binding for the shared auth store. Every consumer that calls this hook
 * shares the single `onAuthStateChange` listener owned by `src/lib/authSession.ts`,
 * so adding a feature never adds another Supabase auth listener.
 */
export function useAuthSession(): AuthSessionSnapshot {
  const [snapshot, setSnapshot] = useState<AuthSessionSnapshot>(getAuthSnapshot);

  useEffect(
    () =>
      subscribeToAuthChanges((_event, _session, next) => {
        setSnapshot(next);
      }),
    [],
  );

  return snapshot;
}

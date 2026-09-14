import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { supabase } from '../lib/supabase';
import { getAuthSnapshot, subscribeToAuthChanges } from '../lib/authSession';
import {
  createLocationSyncEngine,
  LOCATION_CLEAR_RPC,
  type LocationSyncClient,
  type LocationSyncEngine,
  type LocationSyncState,
} from '../services/locationSync';

/**
 * Authenticated Nexora location synchronization for the job portal.
 *
 * Lifecycle (mounted once from `AuthSessionProvider`, the authenticated root):
 *  - INITIAL_SESSION  → start only when it resolves to a real session
 *  - SIGNED_IN        → start watching for that user id
 *  - TOKEN_REFRESHED  → re-assert the watcher (idempotent, never a second watcher)
 *  - SIGNED_OUT       → stop the watcher and drop the cached fix (logout cleanup)
 *
 * The engine is a module singleton, so several components can call this hook
 * without creating duplicate watchers or duplicate auth listeners.
 */

export const LOCATION_SYNC_PREFERENCE_KEY = 'nexora.jobs.location-sync';
export type LocationSyncPreference = 'on' | 'off';

const IDLE_STATE: LocationSyncState = {
  status: 'idle',
  error: null,
  activeUserId: null,
  lastFix: null,
  lastSyncedAt: null,
  syncCount: 0,
};

let engine: LocationSyncEngine | null = null;
let lifecycleStarted = false;
let preference: LocationSyncPreference | null = null;

const viewListeners = new Set<() => void>();
let cachedView: LocationSyncView | null = null;
let cachedEngineState: LocationSyncState | null = null;
let cachedPreference: LocationSyncPreference | null = null;

export interface LocationSyncView {
  state: LocationSyncState;
  preference: LocationSyncPreference;
  /** User turned sharing on. */
  enabled: boolean;
  /** A watcher is live for the signed-in user. */
  active: boolean;
  /** Sharing is impossible in this browser/context. */
  unavailable: boolean;
}

export interface LocationSyncController extends LocationSyncView {
  /** Turn sharing on (the browser will ask for permission on the first fix). */
  enable(): void;
  /** Turn sharing off and delete the stored coordinates. */
  disable(): Promise<void>;
  /** Force one immediate high-accuracy sync. */
  syncNow(): void;
}

function emitViewChange() {
  cachedView = null;
  viewListeners.forEach((listener) => listener());
}

function readPreference(): LocationSyncPreference {
  if (preference) return preference;
  try {
    const stored = window.localStorage.getItem(LOCATION_SYNC_PREFERENCE_KEY);
    preference = stored === 'off' ? 'off' : 'on';
  } catch {
    preference = 'on';
  }
  return preference;
}

function writePreference(next: LocationSyncPreference) {
  preference = next;
  try {
    window.localStorage.setItem(LOCATION_SYNC_PREFERENCE_KEY, next);
  } catch {
    // Storage blocked: the in-memory preference still applies for this session.
  }
  emitViewChange();
}

function createRpcClient(): LocationSyncClient | null {
  if (!supabase) return null;
  return {
    rpc: async (fn, args) => {
      // supabase.rpc() resolves failures as { data: null, error } — a missing
      // RPC (live project without the location-sync migration) never throws
      // here, so the engine can classify it and drop the watch cleanly.
      const { data, error } = await supabase.rpc(fn, args as never);
      const rich = error as unknown as { code?: string; message?: string; status?: number; statusCode?: number } | null;
      return {
        data: data ?? null,
        error: error
          ? { code: rich?.code ?? undefined, message: rich?.message ?? error.message, status: rich?.status, statusCode: rich?.statusCode }
          : null,
      };
    },
  };
}

function getEngine(): LocationSyncEngine | null {
  if (engine) return engine;
  const client = createRpcClient();
  if (!client) return null;
  engine = createLocationSyncEngine({ client });
  engine.subscribe(() => emitViewChange());
  return engine;
}

/** Decides whether the watcher should be running right now. */
function reconcile() {
  const activeEngine = getEngine();
  if (!activeEngine) return;

  const snapshot = getAuthSnapshot();
  const shouldRun =
    readPreference() === 'on' &&
    snapshot.isInitialised &&
    snapshot.status === 'authenticated' &&
    Boolean(snapshot.userId);

  if (shouldRun) {
    activeEngine.start(snapshot.userId);
  } else {
    // Signed out, invalidated, not initialised yet, or sharing turned off.
    activeEngine.stop();
  }
}

/** Installs the single auth/preference driven lifecycle. Safe to call repeatedly. */
export function startLocationSyncLifecycle(): void {
  if (lifecycleStarted) return;
  lifecycleStarted = true;

  // One subscription to the shared auth store; no extra Supabase auth listener.
  subscribeToAuthChanges(() => reconcile());
  reconcile();
}

function getView(): LocationSyncView {
  const state = getEngine()?.getState() ?? IDLE_STATE;
  const currentPreference = readPreference();
  if (cachedView && cachedEngineState === state && cachedPreference === currentPreference) {
    return cachedView;
  }

  cachedEngineState = state;
  cachedPreference = currentPreference;
  cachedView = {
    state,
    preference: currentPreference,
    enabled: currentPreference === 'on',
    active: state.status === 'watching' || state.status === 'syncing' || state.status === 'synced',
    unavailable: state.status === 'unsupported' || state.status === 'denied',
  };
  return cachedView;
}

function subscribeToView(listener: () => void): () => void {
  viewListeners.add(listener);
  return () => {
    viewListeners.delete(listener);
  };
}

export function useLocationSync(): LocationSyncController {
  const view = useSyncExternalStore(subscribeToView, getView, getView);

  useEffect(() => {
    startLocationSyncLifecycle();
  }, []);

  const enable = useCallback(() => {
    writePreference('on');
    reconcile();
  }, []);

  const disable = useCallback(async () => {
    writePreference('off');
    reconcile();

    // Best-effort privacy cleanup: remove the stored coordinates while the
    // session is still valid. A missing RPC (unmigrated project) is ignored.
    if (!supabase) return;
    const snapshot = getAuthSnapshot();
    if (snapshot.status !== 'authenticated') return;
    try {
      await supabase.rpc(LOCATION_CLEAR_RPC, {});
    } catch {
      /* non-fatal: the watcher is already stopped */
    }
  }, []);

  const syncNow = useCallback(() => {
    getEngine()?.requestSync();
  }, []);

  return { ...view, enable, disable, syncNow };
}

/**
 * Nexora authenticated location synchronization engine.
 *
 * Framework-agnostic on purpose: no React, no Vite env, no module-level access to
 * `navigator`. The React wrapper in `src/hooks/useLocationSync.ts` injects the
 * shared Supabase client, which keeps this file unit-testable in plain Node
 * (`npm run test:location`) and guarantees there is exactly one watcher.
 *
 * Security model:
 *  - runs only while an authenticated user id is supplied by the caller
 *  - coordinates are written through the `sync_user_location` RPC, which is
 *    `security definer`, asserts `auth.uid()`, validates ranges and rate-limits
 *  - no service_role key and no direct table write, so RLS stays authoritative
 *  - `stop()` clears the watch and drops the cached fix (logout cleanup)
 */

export type LocationSyncStatus =
  | 'idle'
  | 'watching'
  | 'syncing'
  | 'synced'
  | 'denied'
  | 'unavailable'
  | 'unsupported'
  | 'unauthenticated'
  | 'error'
  | 'stopped';

export interface LocationFix {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  capturedAt: number;
}

export interface LocationSyncState {
  status: LocationSyncStatus;
  error: string | null;
  activeUserId: string | null;
  lastFix: LocationFix | null;
  lastSyncedAt: number | null;
  syncCount: number;
}

export interface GeolocationPositionLike {
  coords: { latitude: number; longitude: number; accuracy?: number | null };
}

export interface GeolocationPositionErrorLike {
  code: number;
  message?: string;
}

export interface GeolocationPositionOptionsLike {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

export interface GeolocationLike {
  watchPosition(
    success: (position: GeolocationPositionLike) => void,
    error?: (error: GeolocationPositionErrorLike) => void,
    options?: GeolocationPositionOptionsLike,
  ): number;
  clearWatch(watchId: number): void;
  getCurrentPosition?(
    success: (position: GeolocationPositionLike) => void,
    error?: (error: GeolocationPositionErrorLike) => void,
    options?: GeolocationPositionOptionsLike,
  ): void;
}

export interface LocationSyncRpcError {
  code?: string;
  message?: string;
  /** HTTP status when the transport exposes one (raw fetch wrappers do). */
  status?: number;
  statusCode?: number;
}

export interface LocationSyncClient {
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: LocationSyncRpcError | null }>;
}

export interface LocationSyncEngineOptions {
  client: LocationSyncClient;
  geolocation?: GeolocationLike | null;
  /** Wall clock, injectable for tests. */
  now?: () => number;
  /** Minimum gap between two writes for the same user. */
  minIntervalMs?: number;
  /** Minimum movement before an in-interval fix is worth writing. */
  minDistanceMeters?: number;
  /** Heartbeat: write even when stationary after this long. */
  forceIntervalMs?: number;
  /** RPC used for the write. Defaults to the Nexora location RPC. */
  rpcName?: string;
  onStateChange?: (state: LocationSyncState) => void;
}

export interface LocationSyncEngine {
  readonly state: LocationSyncState;
  start(userId: string | null | undefined): boolean;
  stop(status?: LocationSyncStatus): void;
  /** One-shot high-accuracy fix, bypassing the throttle. */
  requestSync(): void;
  subscribe(listener: (state: LocationSyncState) => void): () => void;
  getState(): LocationSyncState;
  /** Tear down permanently (app teardown / hot reload). */
  dispose(): void;
  /** Internal: deliver a position (exposed for tests and manual fixes). */
  handlePosition(position: GeolocationPositionLike, options?: { force?: boolean }): void;
  handlePositionError(error: GeolocationPositionErrorLike): void;
}

export const LOCATION_SYNC_RPC = 'sync_user_location';
export const LOCATION_CLEAR_RPC = 'clear_user_location';

const DEFAULT_MIN_INTERVAL_MS = 30_000;
const DEFAULT_MIN_DISTANCE_METERS = 75;
const DEFAULT_FORCE_INTERVAL_MS = 5 * 60_000;

const EARTH_RADIUS_M = 6_371_000;

export function distanceMeters(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(toLat - fromLat);
  const deltaLon = toRadians(toLon - fromLon);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

function isValidCoordinate(latitude: unknown, longitude: unknown): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function isSecureContext(): boolean {
  if (typeof window === 'undefined') return true;
  return window.isSecureContext !== false;
}

function resolveGeolocation(injected?: GeolocationLike | null): GeolocationLike | null {
  if (injected !== undefined) return injected;
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
  return navigator.geolocation as unknown as GeolocationLike;
}

function classifyRpcError(error: LocationSyncRpcError): LocationSyncStatus {
  const code = error.code ?? '';
  const message = error.message ?? '';
  const status = error.status ?? error.statusCode;
  if (code === '42883' || code === 'PGRST202' || code === 'PGRST205' || status === 404 || /does not exist|not in the schema cache|could not find/i.test(message)) {
    // Location sync migration has not been applied to this project yet.
    // The engine drops the watch (see push()) and the UI shows a clean
    // "unavailable on this project" state — no retry storm, no crash.
    return 'unsupported';
  }
  if (code === '28000' || /auth_?required/i.test(message) || /session/i.test(message)) {
    return 'unauthenticated';
  }
  return 'error';
}

export function createLocationSyncEngine(options: LocationSyncEngineOptions): LocationSyncEngine {
  const now = options.now ?? (() => Date.now());
  const minIntervalMs = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
  const minDistanceMeters = options.minDistanceMeters ?? DEFAULT_MIN_DISTANCE_METERS;
  const forceIntervalMs = options.forceIntervalMs ?? DEFAULT_FORCE_INTERVAL_MS;
  const rpcName = options.rpcName ?? LOCATION_SYNC_RPC;

  const listeners = new Set<(state: LocationSyncState) => void>();
  let state: LocationSyncState = {
    status: 'idle',
    error: null,
    activeUserId: null,
    lastFix: null,
    lastSyncedAt: null,
    syncCount: 0,
  };
  let watchId: number | null = null;
  let lastWrite: { at: number; fix: LocationFix } | null = null;
  let inFlight = false;
  let disposed = false;

  function setState(patch: Partial<LocationSyncState>) {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener(state));
    options.onStateChange?.(state);
  }

  function clearWatch() {
    if (watchId === null) return;
    const geolocation = resolveGeolocation(options.geolocation);
    geolocation?.clearWatch(watchId);
    watchId = null;
  }

  function shouldWrite(fix: LocationFix, force: boolean): boolean {
    if (force || !lastWrite) return true;
    const elapsed = fix.capturedAt - lastWrite.at;
    if (elapsed < minIntervalMs) return false;
    const moved = distanceMeters(lastWrite.fix.latitude, lastWrite.fix.longitude, fix.latitude, fix.longitude);
    return moved >= minDistanceMeters || elapsed >= forceIntervalMs;
  }

  async function push(fix: LocationFix) {
    const userId = state.activeUserId;
    if (!userId || inFlight || disposed) return;

    inFlight = true;
    setState({ status: 'syncing', error: null });
    try {
      const { error } = await options.client.rpc(rpcName, {
        p_latitude: fix.latitude,
        p_longitude: fix.longitude,
        p_accuracy_m: fix.accuracyMeters,
        p_source: 'device',
      });

      if (error) {
        const status = classifyRpcError(error);
        // Nothing to gain from keeping the watch alive without a usable backend.
        if (status === 'unsupported' || status === 'unauthenticated') {
          clearWatch();
          setState({
            status,
            error: error.message ?? 'Location sync is unavailable.',
            activeUserId: null,
            lastFix: null,
          });
        } else {
          setState({ status, error: error.message ?? 'Unable to sync your location.' });
        }
        return;
      }

      // The server also rate-limits; a `false` result means "ignored", not failed.
      lastWrite = { at: now(), fix };
      setState({
        status: 'synced',
        error: null,
        lastFix: fix,
        lastSyncedAt: now(),
        syncCount: state.syncCount + 1,
      });
    } catch (error) {
      setState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unable to sync your location.',
      });
    } finally {
      inFlight = false;
    }
  }

  function handlePosition(position: GeolocationPositionLike, positionOptions?: { force?: boolean }) {
    if (disposed || !state.activeUserId) return;
    const coords = position?.coords;
    if (!coords || !isValidCoordinate(coords.latitude, coords.longitude)) return;

    const fix: LocationFix = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracyMeters:
        typeof coords.accuracy === 'number' && Number.isFinite(coords.accuracy) ? coords.accuracy : null,
      capturedAt: now(),
    };

    const force = Boolean(positionOptions?.force);
    if (!shouldWrite(fix, force)) return;
    void push(fix);
  }

  function handlePositionError(error: GeolocationPositionErrorLike) {
    if (disposed) return;
    if (error?.code === 1) {
      // PERMISSION_DENIED: the browser will not ask again, so release the watch.
      clearWatch();
      setState({
        status: 'denied',
        error: 'Location permission was denied. Enable it in your browser settings to use nearby jobs.',
        activeUserId: null,
        lastFix: null,
      });
      return;
    }
    setState({
      status: 'unavailable',
      error: error?.code === 3 ? 'Timed out while locating you.' : 'Your location is temporarily unavailable.',
    });
  }

  return {
    get state() {
      return state;
    },

    start(userId: string | null | undefined) {
      if (disposed) return false;
      if (!userId) return false;

      // Already watching for this exact user: never create a second watcher.
      if (state.activeUserId === userId && watchId !== null) return true;

      // User switch (or stale watch): release the previous watcher first.
      clearWatch();
      lastWrite = null;

      if (!isSecureContext()) {
        setState({
          status: 'unsupported',
          error: 'Location sync requires a secure (HTTPS) connection.',
          activeUserId: null,
        });
        return false;
      }

      const geolocation = resolveGeolocation(options.geolocation);
      if (!geolocation) {
        setState({
          status: 'unsupported',
          error: 'This device does not provide location services.',
          activeUserId: null,
        });
        return false;
      }

      setState({ status: 'watching', error: null, activeUserId: userId });
      watchId = geolocation.watchPosition(
        (position) => handlePosition(position),
        (error) => handlePositionError(error),
        { enableHighAccuracy: false, timeout: 20_000, maximumAge: 60_000 },
      );
      return true;
    },

    stop(status: LocationSyncStatus = 'stopped') {
      clearWatch();
      lastWrite = null;
      // Logout cleanup: forget the user and the last known coordinates.
      setState({ status, error: null, activeUserId: null, lastFix: null });
    },

    requestSync() {
      if (disposed || !state.activeUserId) return;
      const geolocation = resolveGeolocation(options.geolocation);
      if (!geolocation?.getCurrentPosition) return;
      geolocation.getCurrentPosition(
        (position) => handlePosition(position, { force: true }),
        (error) => handlePositionError(error),
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
      );
    },

    subscribe(listener: (next: LocationSyncState) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getState() {
      return state;
    },

    dispose() {
      if (disposed) return;
      clearWatch();
      disposed = true;
      lastWrite = null;
      listeners.clear();
      setState({ status: 'stopped', error: null, activeUserId: null, lastFix: null });
    },

    handlePosition,
    handlePositionError,
  };
}

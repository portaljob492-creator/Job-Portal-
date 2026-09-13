
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { openDB } from 'idb';
import { logger } from './lib/logger';

const swLog = logger('sw');

/** Minimal shape of the worker global this file actually touches. */
interface BackgroundSyncEvent {
  readonly tag: string;
  waitUntil(promise: Promise<unknown>): void;
}

interface WorkerFetchEvent {
  readonly request: Request;
  respondWith(response: Promise<Response> | Response): void;
}

declare const self: {
  readonly __WB_MANIFEST: Array<string | { url: string; revision?: string | null }>;
  addEventListener(type: 'sync', listener: (event: BackgroundSyncEvent) => void): void;
  addEventListener(type: 'fetch', listener: (event: WorkerFetchEvent) => void): void;
};

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
clientsClaim();

const DB_NAME = 'nexora-offline-db';
const STORE_NAME = 'pending-actions';

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    },
  });
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-actions') {
    event.waitUntil(processPendingActions());
  }
});

/* ------------------------------------------------------------------ */
/* Runtime caching (this file is the injectManifest SW, so the caching  */
/* strategy lives here — the `workbox` block in vite.config.ts only     */
/* applies to the generateSW strategy and is intentionally absent).     */
/*                                                                      */
/* Cache discipline: ONLY public, unauthenticated content is ever       */
/* cached. Authenticated workflows (applications, offers, messages,     */
/* authed REST) always go to the network and are never stored.          */
/* ------------------------------------------------------------------ */

const PUBLIC_JOBS_CACHE = 'nexora-public-jobs-v1';
const PUBLIC_IMAGES_CACHE = 'nexora-public-images-v1';
const GOOGLE_FONTS_CACHE = 'nexora-google-fonts-v1';
const NETWORK_TIMEOUT_MS = 5000;

function isPublicJobListings(request: Request, url: URL): boolean {
  return (
    request.method === 'GET' &&
    !request.headers.has('authorization') &&
    url.hostname.endsWith('.supabase.co') &&
    url.pathname.includes('/rest/v1/public_job_listings')
  );
}

function isCacheableImage(request: Request, url: URL): boolean {
  return request.method === 'GET' && request.destination === 'image' && url.origin !== location.origin;
}

function isGoogleFont(url: URL): boolean {
  return /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i.test(url.href);
}

async function fetchWithTimeout(request: Request, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function networkFirst(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);
    if (response.ok) void cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error(`Offline and no cached response for ${new URL(request.url).pathname}`);
  }
}

async function staleWhileRevalidate(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) void cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  if (cached) {
    void refresh;
    return cached;
  }
  const response = await refresh;
  if (response) return response;
  throw new Error(`Offline and no cached response for ${new URL(request.url).pathname}`);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Offline SPA navigations fall back to the precached app shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match('index.html');
        if (cached) return cached;
        throw new Error('Offline and the app shell is not cached yet.');
      }),
    );
    return;
  }

  if (isPublicJobListings(request, url)) {
    event.respondWith(networkFirst(request, PUBLIC_JOBS_CACHE));
    return;
  }
  if (isCacheableImage(request, url)) {
    event.respondWith(staleWhileRevalidate(request, PUBLIC_IMAGES_CACHE));
    return;
  }
  if (isGoogleFont(url)) {
    event.respondWith(staleWhileRevalidate(request, GOOGLE_FONTS_CACHE));
  }
  // Everything else (authed Supabase REST, auth endpoints, API routes) always
  // bypasses the cache: no private data is ever stored by this worker.
});

async function processPendingActions() {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.store;
  const actions = await store.getAll();

  for (const action of actions) {
    try {
      // In a real app, you'd need a way to reliably call Supabase here.
      // Since this runs in a Service Worker, you might need to use fetch() directly
      // to hit your server routes that proxy to Supabase.
      await fetch(action.url, {
        method: action.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.payload),
      });
      await store.delete(action.id);
    } catch (error) {
      // Only the action id/method travel to the log — the payload may carry
      // user data and stays out of debugging history by default.
      swLog.error('failed to sync offline action', error, {
        actionId: action?.id,
        method: action?.method,
      });
    }
  }
}

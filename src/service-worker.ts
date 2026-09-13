
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { openDB } from 'idb';

declare let self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
clientsClaim();

// Runtime caching for public job listings
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    url.hostname.endsWith('.supabase.co') &&
    url.pathname.includes('/rest/v1/public_job_listings'),
  new NetworkFirst({
    cacheName: 'nexora-public-jobs-v1',
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 }),
    ],
  }),
);

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
      console.error('Failed to sync action:', action, error);
    }
  }
}

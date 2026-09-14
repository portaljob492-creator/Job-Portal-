import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import './pwa/installPrompt';
import App from './App.tsx';
import { AuthSessionProvider } from './providers/AuthSessionProvider';
import { logger } from './lib/logger';
import './index.css';

const EXPECTED_SW_URL = '/service-worker.js';

// Production previously shipped a broken SW (bare `import.meta` in a classic
// script) that fails with "ServiceWorker script evaluation failed" and leaves
// a redundant/broken registration controlling the page. The new SW (v2) must be
// able to replace it without manual user clearing.
async function cleanupBrokenServiceWorkers(reason: string) {
  if (!('serviceWorker' in navigator) || !('caches' in window)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs.map(async (reg) => {
        const urls = [reg.active?.scriptURL, reg.installing?.scriptURL, reg.waiting?.scriptURL]
          .filter(Boolean)
          .join(' ');
        const isExpected = urls.includes(EXPECTED_SW_URL);
        // Keep the expected worker if it is already active; otherwise remove
        // stale/broken ones (old `sw.js`, broken `service-worker.js` that never
        // reached activated, or workers from a different scope/base).
        const shouldRemove = !isExpected || regs.length > 1;
        if (shouldRemove) {
          await reg.unregister();
          logger('pwa').warn(`unregistered stale service worker (${reason})`, { urls: urls || reg.scope });
        }
      }),
    );
    // Also purge runtime caches from the previous CACHE_VERSION so a fixed
    // worker never serves stale hashed assets (e.g. the old 1.6 MB chunk).
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith('nexora-') && !key.includes('-v2'))
        .map((key) => caches.delete(key)),
    );
  } catch (error) {
    logger('pwa').warn('service worker cleanup failed', error);
  }
}

registerSW({
  immediate: true,
  onRegisteredSW(swUrl, registration) {
    logger('pwa').info('service worker registered', { swUrl, scope: registration?.scope });
    // Proactively check for updates when the page becomes visible again —
    // without this, a tab that stayed open through a deploy would keep the
    // previous worker until the next navigation.
    if (registration) {
      const scheduleUpdate = () => {
        if (document.visibilityState === 'visible') void registration.update();
      };
      document.addEventListener('visibilitychange', scheduleUpdate);
      // Also poll hourly while the tab is open (workbox's autoUpdate only
      // reloads on activated, not on a failed evaluation).
      window.setInterval(scheduleUpdate, 60 * 60 * 1000);
    }
  },
  onRegisterError(error) {
    logger('pwa').error('service worker registration failed', error);
    // The evaluation failure leaves a broken registration that blocks the
    // fixed worker from installing on every subsequent load. Remove it now
    // so a reload (or the next navigation) can install v2 cleanly.
    void cleanupBrokenServiceWorkers('registration failed — purging broken worker');
  },
  onOfflineReady() {
    logger('pwa').info('app ready for offline use');
  },
  onNeedReload() {
    // With `registerType: 'autoUpdate'` the new worker calls skipWaiting()
    // and clientsClaim(), so a reload is not strictly needed to activate v2.
    // We still log the event for visibility.
    logger('pwa').info('new service worker available — will activate on next navigation');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthSessionProvider>
      <App />
    </AuthSessionProvider>
  </StrictMode>,
);

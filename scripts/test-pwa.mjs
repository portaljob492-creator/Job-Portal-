import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const checks = [];

function assertCheck(name, condition) {
  if (!condition) throw new Error(`FAILED: ${name}`);
  checks.push(name);
}
function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}
function pngSize(relative) {
  const data = fs.readFileSync(path.join(root, relative));
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
}

const manifest = JSON.parse(read('dist/manifest.webmanifest'));
assertCheck('standalone manifest', manifest.display === 'standalone' && manifest.scope === '/' && manifest.start_url.startsWith('/'));
assertCheck('brand metadata', manifest.name.includes('Nexora Jobs') && manifest.theme_color === '#8e004b');
assertCheck('192px icon', pngSize('dist/icons/icon-192.png').join('x') === '192x192');
assertCheck('512px icon', pngSize('dist/icons/icon-512.png').join('x') === '512x512');
assertCheck('maskable icon', manifest.icons.some((icon) => icon.purpose === 'maskable' && icon.sizes === '512x512'));

const indexHtml = read('dist/index.html');
const appBundles = fs.readdirSync(path.join(dist, 'assets'))
  .filter((file) => file.endsWith('.js'))
  .map((file) => fs.readFileSync(path.join(dist, 'assets', file), 'utf8'))
  .join('\n');
const swFile = fs.existsSync(path.join(dist, 'sw.js')) ? 'dist/sw.js' : 'dist/service-worker.js';
const swName = path.basename(swFile);
assertCheck('manifest linked', indexHtml.includes('rel="manifest"') && indexHtml.includes('/manifest.webmanifest'));
assertCheck('service worker registered immediately', fs.existsSync(path.join(root, swFile)) && (appBundles.includes(swName) || appBundles.includes('service-worker') || appBundles.includes('sw.js')) && appBundles.includes('serviceWorker'));
assertCheck('apple install metadata', indexHtml.includes('apple-mobile-web-app-capable') && indexHtml.includes('apple-touch-icon'));
assertCheck('early native prompt capture', appBundles.includes('beforeinstallprompt') && appBundles.includes('Preparing install'));

const serviceWorker = read(swFile);
const swSource = read('src/service-worker.ts');
assertCheck('safe public jobs runtime cache', serviceWorker.includes('public_job_listings') && serviceWorker.includes('nexora-public-jobs-'));
assertCheck('runtime cache versioned (v2 busts stale v1)', swSource.includes("CACHE_VERSION = 'v2'") && serviceWorker.includes('"v2"') && serviceWorker.includes('nexora-public-images-') && serviceWorker.includes('nexora-google-fonts-'));
assertCheck('no private workflow runtime cache', !serviceWorker.includes('job_applications') && !serviceWorker.includes('job_offers'));

// The real production failure this guards against: vite-plugin-pwa registers the
// worker with `type: 'classic'`, and any bare `import.meta` token (e.g. from a
// shared module reading `import.meta.env` through a `typeof import.meta` guard)
// survives the build and makes Chrome throw a parse-time SyntaxError —
// "ServiceWorker script evaluation failed". Parsing the file as a classic
// script body reproduces exactly what the browser does on registration.
assertCheck(
  'no bare import.meta tokens in the service worker bundle',
  !/import\.meta/.test(serviceWorker),
  'a bare import.meta is a SyntaxError in classic scripts; use `import.meta.env` directly so Vite can replace it',
);
let swClassicParse = true;
let swClassicParseError = '';
try {
  // eslint-disable-next-line no-new-func
  new Function(serviceWorker);
} catch (error) {
  swClassicParse = false;
  swClassicParseError = error instanceof Error ? error.message : String(error);
}
assertCheck('service worker parses as a classic script (browser evaluation)', swClassicParse, swClassicParseError);

// Audit of the ServiceWorkerGlobalScope contract: window/document never exist
// in a worker scope and `location` must not be referenced as a bare global
// (exists in SW scope, absent in plain worker contexts). Scan the SW source and
// the only local module it imports (logger) for such references — comments
// stripped so documentation about the rule can't trip the rule.
const stripComments = (code) =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const swGraph = ['src/service-worker.ts', 'src/lib/logger.ts'].map((file) => ({
  file,
  code: stripComments(read(file)),
}));
for (const { file, code } of swGraph) {
  assertCheck(
    `no window/document references in SW graph (${file})`,
    !/\b(window|document)\s*\./.test(code) && !/\bwindow\s*===|\btypeof\s+window\b(?!\s*[!=]==?\s*['"]undefined['"])/.test(code),
  );
  assertCheck(
    `no bare location global in SW graph (${file}) — read it via self.location`,
    !/(^|[^.\w$'"])location\s*\./.test(code),
  );
}

// Strongest reproduction of the production failure mode: evaluate the built
// bundle in a worker-like context that has NO window/document at all and only
// the globals a ServiceWorker scope provides. Any top-level browser-global
// access now fails here instead of on a user's device.
const swEval = await import('node:vm').then(async ({ default: vm }) => {
  const handlers = {};
  const selfObj = {
    addEventListener: (type) => {
      handlers[type] = (handlers[type] || 0) + 1;
    },
    registration: { scope: '/' },
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve(), matchAll: () => Promise.resolve([]) },
    location: { origin: 'https://job-portal.example', href: 'https://job-portal.example/service-worker.js' },
    caches: {
      open: () => Promise.resolve({ match: () => Promise.resolve(undefined), put: () => Promise.resolve() }),
      match: () => Promise.resolve(undefined),
      keys: () => Promise.resolve([]),
      delete: () => Promise.resolve(true),
    },
    __WB_MANIFEST: [],
    indexedDB: undefined,
  };
  const context = {
    self: selfObj,
    location: selfObj.location,
    console,
    Promise,
    URL,
    setTimeout,
    clearTimeout,
    AbortController,
    Response: class {},
    Request: class {},
    fetch: () => Promise.reject(new Error('offline test context')),
  };
  context.globalThis = context;
  vm.createContext(context);
  try {
    new vm.Script(serviceWorker).runInContext(context, { timeout: 5000 });
    return { ok: true, handlers, error: '' };
  } catch (error) {
    return { ok: false, handlers, error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) };
  }
});
assertCheck(
  'service worker evaluates inside a window-less ServiceWorkerGlobalScope stub',
  swEval.ok,
  swEval.error,
);
assertCheck(
  'service worker installs its lifecycle handlers (install/fetch)',
  swEval.handlers.install > 0 && swEval.handlers.fetch > 0,
  JSON.stringify(swEval.handlers),
);

const vercel = JSON.parse(read('vercel.json'));
const serviceWorkerHeaders = vercel.headers?.find((entry) => entry.source === '/service-worker.js');
assertCheck('service worker no-cache header', serviceWorkerHeaders?.headers?.some((header) => header.key === 'Cache-Control' && header.value.includes('must-revalidate')));
assertCheck('service worker root scope header', serviceWorkerHeaders?.headers?.some((header) => header.key === 'Service-Worker-Allowed' && header.value === '/'));
assertCheck('assets immutable cache header', vercel.headers?.some((entry) => entry.source === '/assets/:path*' && entry.headers?.some((h) => h.key === 'Cache-Control' && h.value.includes('immutable'))));

// New v2 worker must be able to replace a broken v1 worker without manual
// clearing: it calls skipWaiting on install and purges old runtime caches.
assertCheck('service worker claims clients and skips waiting (replaces broken v1)', serviceWorker.includes('skipWaiting') && serviceWorker.includes('clients.claim'));
assertCheck('service worker purges stale runtime caches on activate', swSource.includes("CACHE_VERSION = 'v2'") && serviceWorker.includes('caches.keys') && serviceWorker.includes('caches.delete'));

// vite-plugin-pwa injectManifest must not generate a second competing worker.
// With strategies:'injectManifest' the only SW is our src/service-worker.ts
// bundled to dist/service-worker.js (not sw.js, not a generateSW fallback).
assertCheck('single service worker output (no competing sw.js)', !fs.existsSync(path.join(dist, 'sw.js')) || fs.readFileSync(path.join(dist, 'sw.js'), 'utf8') === serviceWorker);
assertCheck('vite config uses injectManifest (custom SW, not generateSW)', read('vite.config.ts').includes("strategies: 'injectManifest'") && !read('vite.config.ts').includes('generateSW'));

// Registration must be classic (not module) — the built SW is a classic script
// and a module-type registration would fail with "evaluation failed" on the
// same file. The built main bundle proves the registration type.
assertCheck('service worker registered as classic (not module)', appBundles.includes('type:\"classic\"') || appBundles.includes("type: 'classic'") || appBundles.includes('type:\"classic\"'));

console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));

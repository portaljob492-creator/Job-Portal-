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
assertCheck('safe public jobs runtime cache', serviceWorker.includes('public_job_listings') && serviceWorker.includes('nexora-public-jobs-v1'));
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

const vercel = JSON.parse(read('vercel.json'));
const serviceWorkerHeaders = vercel.headers?.find((entry) => entry.source === '/service-worker.js');
assertCheck('service worker no-cache header', serviceWorkerHeaders?.headers?.some((header) => header.key === 'Cache-Control' && header.value.includes('must-revalidate')));
assertCheck('service worker root scope header', serviceWorkerHeaders?.headers?.some((header) => header.key === 'Service-Worker-Allowed' && header.value === '/'));

console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));

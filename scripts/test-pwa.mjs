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
assertCheck('manifest linked', indexHtml.includes('rel="manifest"') && indexHtml.includes('/manifest.webmanifest'));
assertCheck('service worker registered immediately', fs.existsSync(path.join(dist, 'sw.js')) && appBundles.includes('sw.js') && appBundles.includes('serviceWorker'));
assertCheck('apple install metadata', indexHtml.includes('apple-mobile-web-app-capable') && indexHtml.includes('apple-touch-icon'));
assertCheck('early native prompt capture', appBundles.includes('beforeinstallprompt') && appBundles.includes('Preparing install'));

const serviceWorker = read('dist/sw.js');
assertCheck('safe public jobs runtime cache', serviceWorker.includes('public_job_listings') && serviceWorker.includes('nexora-public-jobs-v1'));
assertCheck('no private workflow runtime cache', !serviceWorker.includes('job_applications') && !serviceWorker.includes('job_offers'));

const vercel = JSON.parse(read('vercel.json'));
const serviceWorkerHeaders = vercel.headers?.find((entry) => entry.source === '/sw.js');
assertCheck('service worker no-cache header', serviceWorkerHeaders?.headers?.some((header) => header.key === 'Cache-Control' && header.value.includes('must-revalidate')));
assertCheck('service worker root scope header', serviceWorkerHeaders?.headers?.some((header) => header.key === 'Service-Worker-Allowed' && header.value === '/'));

console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));

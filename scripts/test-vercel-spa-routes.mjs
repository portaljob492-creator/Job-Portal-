/**
 * Deployment guard for Vercel static hosting: emulate Vercel's route
 * resolution order against the real build output and assert that every
 * client-side route in `src/routing.ts` (notably `/login`) resolves to the
 * SPA shell via `vercel.json` rewrites — instead of the platform-level
 * `404: NOT_FOUND` that a deep link or refresh used to hit.
 *
 * Vercel resolves requests as: filesystem matches first (files built into
 * `dist/`), then the `rewrites` from `vercel.json`, then a platform 404.
 * This script replays exactly that pipeline so the catch-all SPA rewrite can
 * be verified before pushing, without needing a live Vercel deploy.
 *
 * Run after `npm run build` (registered as `npm run test:vercel`).
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/index.html not found — run `npm run build` first (or use `npm run test:vercel`).');
  process.exit(1);
}

const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const checks = [];

function assertCheck(name, condition) {
  if (!condition) {
    console.error(`FAILED: ${name}`);
    process.exitCode = 1;
    return false;
  }
  checks.push(name);
  return true;
}

/* ------------------------------------------------------------------ */
/* Vercel routing emulation                                            */
/* ------------------------------------------------------------------ */

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compile the small subset of Vercel `source` syntax this repo uses:
 * `:path*` wildcards and full `(.*)`/`*` wildcards between literal parts.
 */
function compileSource(source) {
  const normalized = source.replace(/\/:path\*/g, '/(.*)');
  const body = normalized
    .split(/(\(\.\*\)|\*)/)
    .map((part) => (part === '(.*)' || part === '*' ? '.*' : escapeRegex(part)))
    .join('');
  return new RegExp(`^${body}$`);
}

function statFile(base, requestPath) {
  // Strip leading slashes so the request path joins onto `base` instead of
  // being treated as an absolute path by path.resolve.
  const file = path.resolve(base, requestPath.replace(/^\/+/, ''));
  // Never let a request escape the dist directory (path traversal guard).
  if (file !== dist && !file.startsWith(dist + path.sep)) return null;
  return fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
}

/**
 * Resolve one request pathname the way Vercel would:
 *   1. filesystem match in `dist` (exact file, then `index.html` for `/`),
 *   2. first matching `rewrites` entry from `vercel.json`,
 *   3. platform `404 NOT_FOUND`.
 */
function resolveVercelPath(pathname, rewrites = vercel.rewrites || []) {
  const clean = pathname.split('?')[0].split('#')[0] || '/';
  const exact = statFile(dist, clean);
  if (exact) return { status: 200, served: path.relative(dist, exact) || 'index.html' };
  if (clean === '/' && statFile(dist, 'index.html')) return { status: 200, served: 'index.html' };
  for (const rewrite of rewrites) {
    if (!compileSource(rewrite.source).test(clean)) continue;
    const target = statFile(dist, String(rewrite.destination).replace(/^\/+/, ''));
    if (target) return { status: 200, served: path.relative(dist, target) || 'index.html', rewritten: rewrite.destination };
    return { status: 500, served: null, error: `rewrite "${rewrite.source}" targets missing file "${rewrite.destination}"` };
  }
  return { status: 404, served: null, error: 'NOT_FOUND' };
}

/* ------------------------------------------------------------------ */
/* Route inventory — must mirror src/routing.ts                        */
/* ------------------------------------------------------------------ */

// Representative path for every route family in `resolveJobPortalRoute()`.
const SPA_ROUTES = [
  '/',
  '/login',
  '/auth/login',
  '/auth',
  '/signup',
  '/signup/seeker',
  '/signup/employer',
  '/signup/confirm',
  '/forgot-password',
  '/reset-password',
  '/dashboard/seeker',
  '/dashboard/employer',
  '/employer/jobs',
  '/profile',
  '/applications',
  '/messages',
  '/saved',
  '/portfolio',
  '/interviews',
  '/offers',
  '/support',
  '/settings',
  '/jobs',
  '/jobs/42',
  '/jobs/search',
  '/jobs/profile',
  '/jobs/applications',
  '/jobs/post-a-job',
  '/jobs/posted-jobs',
  '/jobs/employer-applications',
  '/jobs/apply',
  '/admin',
  '/admin/jobs',
  '/app/jobs', // legacy deep link kept working by the catch-all
];

// Real build outputs must keep winning over the catch-all rewrite.
const STATIC_ASSETS = [
  '/index.html',
  '/manifest.webmanifest',
  '/service-worker.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/favicon-64.png',
  '/icons/apple-touch-icon.png',
];

/* ------------------------------------------------------------------ */
/* Assertions                                                          */
/* ------------------------------------------------------------------ */

assertCheck(
  'vercel.json defines a catch-all SPA rewrite to /index.html',
  (vercel.rewrites || []).some(
    (r) => r.source === '/(.*)' && r.destination === '/index.html',
  ),
);

const loginResults = SPA_ROUTES.map((route) => ({ route, ...resolveVercelPath(route) }));
for (const { route, status, served, error } of loginResults) {
  assertCheck(`route ${route} serves the app shell (not Vercel 404)`, status === 200 && served === 'index.html');
  if (status !== 200) console.error(`  ↳ ${route} → ${status} ${error ?? ''}`);
}

// The exact user-reported bug: /login must never be a platform 404.
const login = resolveVercelPath('/login');
assertCheck('/login returns 200 with index.html content', login.status === 200 && login.served === 'index.html');
assertCheck(
  'rewritten /login shell references the built entry script',
  login.status === 200 && /<script[^>]+src="\/[^"]+\.(js|tsx|jsx)/.test(fs.readFileSync(path.join(dist, 'index.html'), 'utf8')),
);

for (const asset of STATIC_ASSETS) {
  const result = resolveVercelPath(asset);
  // `rewritten` is only set when the catch-all handled the request; a
  // filesystem hit serves the exact file (including /index.html itself).
  assertCheck(`static file ${asset} still served from filesystem (not swallowed by rewrite)`, result.status === 200 && !result.rewritten);
}

// Hashed JS/CSS chunks from the actual build must be filesystem-served too.
const hashedChunks = fs.readdirSync(path.join(dist, 'assets')).filter((f) => /\.(js|css)$/.test(f));
assertCheck('build emitted hashed JS/CSS chunks', hashedChunks.length > 0);
for (const chunk of hashedChunks.slice(0, 5)) {
  const result = resolveVercelPath(`/assets/${chunk}`);
  assertCheck(`asset /assets/${chunk} served directly`, result.status === 200 && !result.rewritten);
}

// Regression guard: the previous narrow config (only /app/jobs*) must 404 on
// /login — proving the catch-all is what fixes the bug, and alerting anyone
// who narrows the rewrite again.
const legacyRewrites = [
  { source: '/app/jobs', destination: '/index.html' },
  { source: '/app/jobs/:path*', destination: '/index.html' },
];
assertCheck('legacy narrow /app/jobs-only rewrites still 404 on /login (catch-all is load-bearing)',
  resolveVercelPath('/login', legacyRewrites).status === 404,
);
assertCheck('legacy /app/jobs route covered by new config as well',
  resolveVercelPath('/app/jobs').status === 200,
);

// Case sensitivity (requirement for Vercel's case-sensitive filesystem): every
// route literal in the client router must be lowercase, and no auth component
// path may rely on differently-cased file names.
const routerSource = fs.readFileSync(path.join(root, 'src/routing.ts'), 'utf8');
const routeLiterals = [...routerSource.matchAll(/relative(?: === |\.startsWith\()\s*'([^']+)'/g)].map((m) => m[1]);
assertCheck('router literals found', routeLiterals.length >= 15);
for (const literal of routeLiterals) {
  assertCheck(`route literal ${literal} is lowercase`, literal === literal.toLowerCase());
}
assertCheck('canonical login route handled by router', routeLiterals.includes('/login'));
assertCheck(
  'LoginScreen component file name matches its import casing',
  fs.existsSync(path.join(root, 'src/components/auth/LoginScreen.tsx')) &&
    /import \{ LoginScreen \} from '\.\/components\/auth\/LoginScreen'/.test(
      fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8'),
    ),
);

// There is intentionally no middleware/Next config that could guard /login;
// fail if a `middleware.ts` or `next.config.*` ever sneaks into this Vite SPA.
assertCheck(
  'no stray middleware/next configs shadowing the Vite deploy',
  !fs.existsSync(path.join(root, 'middleware.ts')) &&
    !fs.existsSync(path.join(root, 'middleware.js')) &&
    !fs.existsSync(path.join(root, 'next.config.js')) &&
    !fs.existsSync(path.join(root, 'next.config.mjs')),
);

console.log(JSON.stringify({ passed: checks.length, failed: process.exitCode ? 'see FAILED lines above' : 0, routes: loginResults.length }, null, 2));
if (process.exitCode) process.exit(process.exitCode);

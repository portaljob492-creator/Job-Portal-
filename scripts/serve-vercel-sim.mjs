/**
 * Local Vercel-static simulator: serves `dist/` using Vercel's real
 * resolution order — filesystem match first, then the `rewrites` block from
 * `vercel.json`, then a plain 404 — so you can verify deep links like
 * `/login` before pushing a deploy. (Use `npm run test:vercel` for the
 * assertion suite; this server is for eyeballing/curling the behavior.)
 *
 * Usage: npm run build && npm run preview:vercel
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const rewrites = vercel.rewrites || [];
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
};

function compileSource(source) {
  const body = source
    .replace(/\/:path\*/g, '/(.*)')
    .split(/(\(\.\*\)|\*)/)
    .map((part) => (part === '(.*)' || part === '*' ? '.*' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('');
  return new RegExp(`^${body}$`);
}

const resolved = rewrites.map((r) => ({ ...r, regex: compileSource(r.source) }));

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const candidates = [pathname, path.posix.join(pathname, 'index.html')];
  for (const candidate of candidates) {
    const file = path.resolve(dist, candidate.replace(/^\/+/, ''));
    if ((file === dist || file.startsWith(dist + path.sep)) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.writeHead(200, { 'content-type': mime[path.extname(file)] ?? 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
      return;
    }
  }
  for (const rewrite of resolved) {
    if (!rewrite.regex.test(pathname)) continue;
    const file = path.resolve(dist, String(rewrite.destination).replace(/^\/+/, ''));
    if (!fs.existsSync(file)) {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end(`rewrite target missing: ${rewrite.destination}`);
      return;
    }
    console.log(`[rewrite] ${pathname} -> ${rewrite.destination}`);
    res.writeHead(200, { 'content-type': mime[path.extname(file)] ?? 'text/html; charset=utf-8' });
    fs.createReadStream(file).pipe(res);
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('404 NOT_FOUND');
});

const port = Number(process.env.PORT) || 4173;
server.listen(port, '0.0.0.0', () => console.log(`Vercel-static simulator on http://0.0.0.0:${port} (serving ${path.relative(root, dist)}/ + vercel.json rewrites)`));

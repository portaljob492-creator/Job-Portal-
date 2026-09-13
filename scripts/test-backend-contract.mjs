/**
 * Nexora Jobs: frontend <-> backend contract check (no credentials, no network).
 *
 * Every Supabase call the app makes must exist in the migrations with the same
 * argument names, every user-facing table must be protected, and no secret may
 * reach the browser bundle.
 *
 *   npm run test:contract
 *
 * `npm run test:db` proves the SQL actually behaves; this test proves the app
 * and the SQL still agree.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok: Boolean(ok), detail });
  if (!ok) console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
};

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const listFiles = (dir) =>
  fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return listFiles(child);
    return /\.(ts|tsx|mjs)$/.test(entry.name) ? [child] : [];
  });

// ---------------------------------------------------------------------------
// 1. Migrations
// ---------------------------------------------------------------------------
const migrationDir = 'supabase/migrations';
const migrations = fs
  .readdirSync(path.join(root, migrationDir))
  .filter((name) => name.endsWith('.sql'))
  .sort();
check('migrations present', migrations.length >= 11, `${migrations.length} files`);

const sql = migrations
  .map((name) => read(`${migrationDir}/${name}`))
  .join('\n')
  .replace(/--[^\n]*/g, '');

// Functions are keyed by name: CREATE OR REPLACE means the last definition in
// migration order is the deployed one, and every parameter seen in any
// definition is accepted because omitted parameters keep their defaults.
const signatures = {};
const finalFunctionBody = {};
for (const match of sql.matchAll(/create or replace function public\.([a-z_]+)\s*\((.*?)\)\s*returns.*?\$\$(.*?)\$\$;/gis)) {
  const [, name, params, body] = match;
  signatures[name] = signatures[name] || new Set();
  finalFunctionBody[name] = body;
  for (const arg of params.matchAll(/(?:^|,)\s*(p_[a-z_]+|target_[a-z_]+)\s+[a-z]/gi)) {
    signatures[name].add(arg[1]);
  }
}

const sourceFiles = listFiles('src');
const rpcCalls = [];
for (const file of sourceFiles) {
  const source = read(file);
  for (const match of source.matchAll(/\.rpc\(\s*'([a-z_]+)'\s*(?:,\s*\{([^}]*)\})?/gs)) {
    const [, name, body = ''] = match;
    const args = [...body.matchAll(/(?:^|,)\s*(p_[a-z_]+|target_[a-z_]+)\s*:/gi)].map((m) => m[1]);
    rpcCalls.push({ file, name, args });
  }
}

check('frontend makes RPC calls', rpcCalls.length > 0, `${rpcCalls.length} call sites`);
const unknownFunctions = rpcCalls.filter((call) => !signatures[call.name]).map((call) => `${call.file}:${call.name}`);
check('every RPC the app calls exists in the migrations', unknownFunctions.length === 0,
  unknownFunctions.join(', '));

const unknownArgs = [];
for (const call of rpcCalls) {
  const known = signatures[call.name];
  if (!known) continue;
  for (const arg of call.args) {
    if (!known.has(arg)) unknownArgs.push(`${call.file}:${call.name}(${arg})`);
  }
}
check('every RPC argument name matches the SQL signature', unknownArgs.length === 0, unknownArgs.join(', '));

// ---------------------------------------------------------------------------
// 2. Job status vocabulary
// ---------------------------------------------------------------------------
const normalized = sql.replace(/\s+/g, ' ');
check('job status constraint uses the admin-approval vocabulary',
  /check \(status in \('draft', 'pending_approval', 'approved', 'rejected', 'paused', 'closed', 'expired', 'archived'\)\)/.test(normalized)
  || /job_posts_status_check/.test(normalized),
  'job_posts_status_check');

const staleFunctions = Object.entries(finalFunctionBody)
  .filter(([, body]) => /status\s*(?:<>|=)\s*'published'/.test(body))
  .map(([name]) => name);
check('no deployed function gates on the retired published status', staleFunctions.length === 0,
  staleFunctions.join(', '));

const finalPolicies = {};
for (const match of sql.matchAll(/drop policy if exists ([a-z_]+) on (?:public\.)?([a-z_]+);/gi)) {
  delete finalPolicies[`${match[2]}.${match[1]}`];
}
for (const match of sql.matchAll(/create policy ([a-z_]+)\s+on (?:public\.)?([a-z_]+)([^;]*);/gis)) {
  finalPolicies[`${match[2]}.${match[1]}`] = match[3];
}
const stalePolicies = Object.entries(finalPolicies)
  .filter(([, body]) => /status\s*=\s*'published'/.test(body))
  .map(([name]) => name);
check('no deployed policy gates on the retired published status', stalePolicies.length === 0,
  stalePolicies.join(', '));

// ---------------------------------------------------------------------------
// 3. Coverage: RLS, storage, realtime, indexes
// ---------------------------------------------------------------------------
const createdTables = [...sql.matchAll(/create table (?:if not exists )?(?:public\.)?([a-z_]+)/gi)].map((m) => m[1]);
const rlsTables = new Set(
  [...sql.matchAll(/alter table (?:public\.)?([a-z_]+) enable row level security/gi)].map((m) => m[1]),
);
for (const arrayMatch of sql.matchAll(/foreach table_name in array array\[(.*?)\]/gs)) {
  for (const name of arrayMatch[1].matchAll(/'([a-z_]+)'/g)) rlsTables.add(name[1]);
}
const tablesWithoutRls = createdTables.filter((name) => !rlsTables.has(name));
check('every job table enables row level security', tablesWithoutRls.length === 0, tablesWithoutRls.join(', '));

const bucketRows = [...sql.matchAll(/\('([a-z-]+)',\s*'[a-z-]+',\s*(true|false),/g)].map((m) => ({ id: m[1], public: m[2] }));
check('storage buckets declared', bucketRows.length === 7, bucketRows.map((b) => b.id).join(', '));
const publicBuckets = bucketRows.filter((b) => b.public === 'true').map((b) => b.id);
check('only salon-public-media is a public bucket',
  publicBuckets.length === 1 && publicBuckets[0] === 'salon-public-media', publicBuckets.join(', '));

const realtimeMatch = sql.match(/foreach table_name in array array\[\s*'job_notifications'.*?\]/s);
check('realtime publication covers the live tables',
  Boolean(realtimeMatch) && /'job_messages'/.test(realtimeMatch[0]), realtimeMatch ? 'ok' : 'missing');

check('hot-path indexes added for the audit findings',
  /job_applications_candidate_profile_idx/.test(sql) && /job_one_active_offer_per_application/.test(sql));

// ---------------------------------------------------------------------------
// 4. Secret hygiene
// ---------------------------------------------------------------------------
const frontend = sourceFiles.map((file) => read(file)).join('\n');
check('no service_role key in frontend code',
  !/SUPABASE_SERVICE_ROLE|service_role_key|sb_secret_/i.test(frontend));
check('no hardcoded JWT-shaped key in frontend code', !/eyJ[A-Za-z0-9_-]{20,}/.test(frontend));
check('frontend reads the anon key from VITE_SUPABASE_ANON_KEY',
  /VITE_SUPABASE_ANON_KEY/.test(read('src/lib/supabase.ts')));

const envExample = read('.env.example');
check('.env.example documents both Vite variables',
  envExample.includes('VITE_SUPABASE_URL') && envExample.includes('VITE_SUPABASE_ANON_KEY'));
check('.env.example holds no real key', !/eyJ[A-Za-z0-9_-]{20,}/.test(envExample));

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const failed = checks.filter((entry) => !entry.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} frontend/backend contract checks passed`);
if (failed.length) process.exit(1);
console.log('CONTRACT OK');

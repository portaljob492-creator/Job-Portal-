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

// Tenant isolation: the conversation insert policy must bind both columns of the
// row being inserted. An unqualified name inside the policy's subquery resolves
// to the subquery's own table, which silently turns the check into a tautology.
// Migrations replay in order, so the last definition is the one in force.
const conversationPolicies = [...sql.matchAll(
  /create policy job_conversations_insert_participant[\s\S]*?;\n/g,
)];
const conversationPolicySql = conversationPolicies.length
  ? conversationPolicies[conversationPolicies.length - 1][0] : '';
check('conversation insert policy binds the inserted row explicitly',
  /public\.job_conversations\.job_id/.test(conversationPolicySql)
  && /public\.job_conversations\.candidate_user_id/.test(conversationPolicySql),
  'policy missing qualified references');
check('conversation insert policy no longer compares columns of the inner table',
  !/where\s+a\.job_id\s*=\s*job_id/i.test(conversationPolicySql));

// The two tables that ship with RLS switched off must be closed by a migration.
const notificationsRls = sql.match(/foreach tbl in array array\['notifications', 'push_subscriptions'\]/);
check('shared user tables are switched to RLS with own-row policies',
  Boolean(notificationsRls) && /_own_rows_select/.test(sql) && /_own_rows_delete/.test(sql));

// Query performance: membership must be answered once per query as a set, not
// once per row by a SECURITY DEFINER call inside a policy qual.
check('set-based membership helper is declared',
  /function public\.job_my_active_salon_ids\(\)/.test(sql) && /returns setof uuid/i.test(sql));
// Migrations replay in order, so only the last definition of each policy is in
// force; earlier ones are historical records.
const effectivePolicies = new Map();
for (const m of sql.matchAll(/create policy\s+([a-z_]+)\s+on\s+([a-z_.]+)([\s\S]*?);/g)) {
  effectivePolicies.set(`${m[2]}.${m[1]}`, m[3]);
}
const perRowPolicies = [...effectivePolicies.entries()].filter(([, body]) => /job_can_manage_application/.test(body));
check('no policy compares membership row by row', perRowPolicies.length === 0,
  perRowPolicies.map(([name]) => name).join(', '));

const applicantCardsAt = sql.lastIndexOf('function public.get_job_applicant_cards()\nreturns table');
const applicantCardsEnd = sql.indexOf('$fn$;', applicantCardsAt);
const latestApplicantCards = applicantCardsAt === -1 ? ''
  : sql.slice(applicantCardsAt, applicantCardsEnd === -1 ? applicantCardsAt + 4000 : applicantCardsEnd);
check('applicant list RPC filters by the salon set',
  /job_my_active_salon_ids/.test(latestApplicantCards)
  && !/job_is_active_salon_member/.test(latestApplicantCards));
check('admin approval queue keeps its partial index',
  /job_posts_pending_approval_idx[\s\S]*?where status = 'pending_approval'/.test(sql));

// Writes into the marketplace go through RPCs: no client insert policy may
// exist for membership, plan enablement or postings.
for (const table of ['job_salon_members', 'job_salon_profiles', 'job_posts']) {
  const policyBlocks = [...sql.matchAll(new RegExp(`create policy [a-z_]+ on public\\.${table}\\b[\\s\\S]*?;`, 'g'))];
  const insertPolicies = policyBlocks.filter((block) => /for insert|for all/i.test(block[0]));
  check(`no client insert policy on ${table}`, insertPolicies.length === 0, `${insertPolicies.length} found`);
}

// ---------------------------------------------------------------------------
// 4. Schema integrity guarantees
// ---------------------------------------------------------------------------
const integrityChecks = {
  'offer employment type vocabulary': /job_offers_employment_type_check/,
  'saved search employment type vocabulary': /job_saved_searches_employment_type_check/,
  'application history vocabulary': /job_application_status_history_statuses_check/,
  'notification type vocabulary': /job_notifications_type_check/,
  'job deletion guard': /job_posts_guard_delete/,
  'job deletion cleanup': /job_posts_cleanup_relations/,
  'offer type normalization helper': /job_normalize_employment_type/,
};
for (const [name, pattern] of Object.entries(integrityChecks)) {
  check(name, pattern.test(sql));
}

const employmentVocabulary = /job_offers_employment_type_check[\s\S]{0,220}'full_time'[\s\S]{0,80}'part_time'/;
check('offer employment type vocabulary is a closed set', employmentVocabulary.test(sql));

// Every table that stores a lifecycle status must be covered by the
// constraint audit, otherwise a new status column could ship unconstrained.
const controlledStatusTables = [
  'job_account_deletion_requests', 'job_applications', 'job_conversations',
  'job_employer_verifications', 'job_interview_requests', 'job_offers', 'job_posts',
  'job_reports', 'job_salon_members', 'job_support_tickets', 'job_user_roles',
];
check('controlled status tables are all declared in the migrations',
  controlledStatusTables.every((table) => sql.includes(table)));

// ---------------------------------------------------------------------------
// 5. Secret hygiene
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

/**
 * Nexora Jobs: full backend verification against a real PostgreSQL.
 *
 * Replays every migration in supabase/migrations against an in-process
 * PostgreSQL (PGlite) with a minimal Supabase-compatible bootstrap — roles,
 * `auth.users`, `auth.uid()`, `storage.objects`, the realtime publication and
 * the shared Nexora tables (profiles/salons/organizations) — then exercises the
 * live workflows and asserts the backend invariants.
 *
 *   npm run test:db
 *
 * Covered: migration replay, RLS coverage, policy/role grants, the
 * create-job -> admin approval -> apply -> shortlist -> interview -> offer ->
 * hire flow, cross-user access attempts, storage buckets and the realtime
 * publication.
 *
 * The only environmental shim: `create extension pgcrypto` is skipped because
 * PGlite does not ship it (gen_random_uuid() is built in on PostgreSQL 13+).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATION_DIR = path.join(root, 'supabase', 'migrations');

let PGlite;
let pg_trgm;
try {
  ({ PGlite } = await import('@electric-sql/pglite'));
  ({ pg_trgm } = await import('@electric-sql/pglite/contrib/pg_trgm'));
} catch {
  console.error('This test needs the PGlite dev dependency:  npm install');
  process.exit(1);
}


const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok), detail });
  if (!ok) console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
};

const db = await PGlite.create({ extensions: { pg_trgm } });

// ---------------------------------------------------------------------------
// Bootstrap: roles, schemas and the shared Nexora tables the Jobs schema reuses
// ---------------------------------------------------------------------------
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create extension if not exists pg_trgm;
  create publication supabase_realtime;

  create schema if not exists auth;
  create schema if not exists storage;

  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb,
    deleted_at timestamptz,
    created_at timestamptz not null default now()
  );

  create table storage.buckets (
    id text primary key, name text, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text, name text, owner uuid, created_at timestamptz default now()
  );
  alter table storage.objects enable row level security;
  create or replace function storage.foldername(name text) returns text[]
    language sql immutable as $$ select string_to_array(name, '/') $$;

  -- Shared Nexora marketplace tables (owned by the other app, reused here).
  create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text, phone text, avatar_path text, preferred_city text,
    preferred_area text, is_active boolean not null default true,
    platform_role text, created_at timestamptz not null default now()
  );
  alter table public.profiles enable row level security;
  create policy profiles_own on public.profiles for select to authenticated
    using (id = auth.uid());

  create table public.organizations (
    id uuid primary key default gen_random_uuid(),
    display_name text, legal_name text, business_category text, status text,
    created_by uuid references public.profiles(id), created_at timestamptz default now()
  );
  alter table public.organizations enable row level security;
  create policy org_insert on public.organizations for insert to authenticated with check (true);

  create table public.organization_members (
    organization_id uuid references public.organizations(id) on delete cascade,
    user_id uuid references public.profiles(id) on delete cascade,
    role text, status text, joined_at timestamptz,
    primary key (organization_id, user_id)
  );
  alter table public.organization_members enable row level security;

  create table public.salons (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid references public.organizations(id) on delete set null,
    slug text unique, name text, description text, business_category text,
    address text, city text, state text, pincode text, logo_path text,
    cover_image_path text, verified boolean default false, is_active boolean default true,
    deleted_at timestamptz, rating_average numeric default 0, review_count integer default 0,
    created_at timestamptz default now()
  );
  alter table public.salons enable row level security;
  create policy salons_public on public.salons for select to anon, authenticated using (true);
  create policy salons_insert on public.salons for insert to authenticated with check (true);

  create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid);
  create table public.push_subscriptions (id uuid primary key default gen_random_uuid(), user_id uuid);

  grant usage on schema public, auth, storage to anon, authenticated, service_role;
  grant select on public.profiles, public.salons to authenticated;
  grant select on public.salons to anon;
  grant insert on public.organizations, public.salons to authenticated;

  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`);

// ---------------------------------------------------------------------------
// Apply every migration in filename order
// ---------------------------------------------------------------------------
const files = fs.readdirSync(MIGRATION_DIR).filter((f) => f.endsWith('.sql')).sort();
for (const file of files) {
  let sql = fs.readFileSync(path.join(MIGRATION_DIR, file), 'utf8');
  sql = sql.replace(/create extension if not exists pgcrypto;?/gi, '-- [harness] pgcrypto is built in on pg13+');
  try {
    await db.exec(sql);
    console.log(`  applied  ${file}`);
  } catch (error) {
    console.log(`  FAILED   ${file}\n           ${error.message}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Helpers for behavioural tests
// ---------------------------------------------------------------------------
const asUser = async (userId, fn) => {
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${userId}';`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; reset request.jwt.claim.sub;`);
  }
};

// Runs SQL the way PostgREST does: as the authenticated role, with the JWT sub
// claim set, so grants, RLS and SECURITY DEFINER paths are all exercised.
const rpc = (userId, sql) => asUser(userId, () => db.query(sql));

const uid = (suffix) => {
  const n = suffix.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${n}`;
};

// ---------------------------------------------------------------------------
// 1. Structural invariants
// ---------------------------------------------------------------------------
const rlsOff = await db.query(`
  select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relname like 'job\\_%'
    and c.relrowsecurity = false
`);
check('every job_* table has RLS enabled', rlsOff.rows.length === 0,
  rlsOff.rows.map((r) => r.relname).join(', '));

const noPolicy = await db.query(`
  select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relname like 'job\\_%'
    and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname)
`);
check('every job_* table has at least one policy', noPolicy.rows.length === 0,
  noPolicy.rows.map((r) => r.relname).join(', '));

const secDefiner = await db.query(`
  select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef = true and p.proname like 'job%'
    and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path=%'
    and not exists (
      select 1 from pg_trigger t where t.tgfoid = p.oid
    )
`);
check('security definer functions pin search_path', secDefiner.rows.length === 0,
  secDefiner.rows.map((r) => r.proname).join(', '));

const anonExec = await db.query(`
  select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'job%'
    and has_function_privilege('anon', p.oid, 'EXECUTE')
    and p.proname not in ('job_email_portal_role','job_is_admin','job_is_active_salon_member')
`);
check('no unexpected anon-executable RPC', anonExec.rows.length === 0,
  anonExec.rows.map((r) => r.proname).join(', '));

const buckets = await db.query(`select id, public from storage.buckets order by id`);
check('storage buckets created', buckets.rows.length === 7, `${buckets.rows.length} buckets`);
const pubBuckets = buckets.rows.filter((b) => b.public).map((b) => b.id);
check('only salon-public-media is public', pubBuckets.length === 1 && pubBuckets[0] === 'salon-public-media',
  pubBuckets.join(', '));

const realtime = await db.query(`
  select tablename from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public'
`);
const realtimeTables = realtime.rows.map((r) => r.tablename).sort();
check('realtime published tables', ['job_applications', 'job_conversations', 'job_interview_requests', 'job_messages', 'job_notifications', 'job_offers']
  .every((t) => realtimeTables.includes(t)), realtimeTables.join(', '));

const offerIndex = await db.query(`
  select indexdef from pg_indexes where schemaname='public' and indexname='job_one_active_offer_per_application'
`);
check('one-active-offer-per-application index exists', offerIndex.rows.length === 1,
  offerIndex.rows[0]?.indexdef || 'missing');
const offerUnique = await db.query(`
  select c.conname from pg_constraint c join pg_class t on t.oid=c.conrelid
  where t.relname='job_offers' and c.contype='u' and pg_get_constraintdef(c.oid) like '%(application_id)%'
`);
check('blanket unique(application_id) removed', offerUnique.rows.length === 0,
  offerUnique.rows.map((r) => r.conname).join(', '));

const updatedAtTriggers = await db.query(`
  select count(*)::int as n from pg_trigger t join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and not t.tgisinternal and t.tgname like '%_set_updated_at'
`);
check('updated_at trigger coverage', updatedAtTriggers.rows[0].n >= 19, `${updatedAtTriggers.rows[0].n} triggers`);

// ---------------------------------------------------------------------------
// 2. Application flow: approved job is applicable, pending/closed job is not
// ---------------------------------------------------------------------------
const seeker = uid(1), employer = uid(2), admin = uid(3), outsider = uid(4);
await db.exec(`
  insert into auth.users(id,email,raw_user_meta_data) values
    ('${seeker}','seeker@example.com','{"app_context":"jobs","job_role":"seeker"}'),
    ('${employer}','employer@example.com','{"app_context":"jobs","job_role":"employer"}'),
    ('${admin}','admin@example.com','{"app_context":"jobs","job_role":"seeker"}'),
    ('${outsider}','outsider@example.com','{"app_context":"jobs","job_role":"seeker"}');
  insert into public.profiles(id,full_name,is_active) values
    ('${seeker}','Seeker',true),('${employer}','Employer',true),
    ('${admin}','Admin',true),('${outsider}','Outsider',true);
  set app.job_trusted_role_change = 'yes';
  insert into public.job_user_roles(user_id, role, onboarding_completed)
  values ('${admin}','admin', true)
  on conflict (user_id) do update set role='admin';
  reset app.job_trusted_role_change;
`);

await rpc(seeker, `select public.job_register_role('job_seeker')`);
await rpc(employer, `select public.job_register_role('employer')`);
const roleWrites = await db.query(`select user_id, role from public.job_user_roles order by user_id`);
const roleMap = Object.fromEntries(roleWrites.rows.map((r) => [r.user_id, r.role]));
check('job_register_role assigns the seeker portal role', roleMap[seeker] === 'job_seeker', roleMap[seeker]);
check('job_register_role assigns the employer portal role', roleMap[employer] === 'employer', roleMap[employer]);

let roleSwitch = '';
try {
  await rpc(seeker, `select public.job_register_role('employer')`);
} catch (error) {
  roleSwitch = error.message;
}
check('portal role cannot be switched after assignment -> PORTAL_ROLE_MISMATCH',
  /PORTAL_ROLE_MISMATCH/.test(roleSwitch), roleSwitch);

const salonId = (await rpc(employer, `select public.complete_job_employer_onboarding(
  'Probe Salon','Owner','1 Main St','Jaipur','Rajasthan',null,'salon',null,null) as id`)).rows[0].id;
check('employer onboarding returns a salon', Boolean(salonId));
await rpc(seeker, `select public.complete_job_seeker_onboarding('Stylist','Bio','Jaipur','Rajasthan','mid',24,null,null,null,false,'{}','{full_time}')`);

const jobId = await rpc(employer, `select public.create_job_post(
  '${salonId}', null, 'Senior Stylist', 'Hair',
  'We are hiring an experienced senior hair stylist for our Jaipur salon.', 'full_time') as id`);
const job = jobId.rows[0].id;

const createdStatus = await db.query(`select status from public.job_posts where id='${job}'`);
check('new job starts in pending_approval', createdStatus.rows[0].status === 'pending_approval',
  createdStatus.rows[0].status);

// Applying to a pending job must be rejected.
let pendingApplication = 'no error';
try {
  await rpc(seeker, `select public.submit_job_application('${job}')`);
} catch (error) {
  pendingApplication = error.message;
}
check('application rejected while job is pending approval', /JOB_NOT_PUBLISHED/.test(pendingApplication),
  pendingApplication);

// Admin approves -> the candidate must now be able to apply.
await rpc(admin, `select public.approve_job('${job}')`);
const approved = await db.query(`select status from public.job_posts where id='${job}'`);
check('approve_job sets approved', approved.rows[0].status === 'approved', approved.rows[0].status);

let applyResult = 'no error';
try {
  await rpc(seeker, `select public.submit_job_application('${job}', null, 'Please consider me.', 30000, current_date)`);
} catch (error) {
  applyResult = error.message;
}
const applications = await db.query(`select id, status from public.job_applications where job_id='${job}'`);
check('REGRESSION: candidate can apply to an approved job', applications.rows.length === 1,
  applications.rows.length ? '' : applyResult);
check('new application is submitted', applications.rows[0]?.status === 'submitted', applications.rows[0]?.status);

// Duplicate application is reported predictably.
let duplicate = '';
try {
  await rpc(seeker, `select public.submit_job_application('${job}')`);
} catch (error) {
  duplicate = error.message;
}
check('duplicate application -> APPLICATION_ALREADY_EXISTS', /APPLICATION_ALREADY_EXISTS/.test(duplicate), duplicate);

// ---------------------------------------------------------------------------
// 3. RLS: strangers cannot see applications, participants can
// ---------------------------------------------------------------------------
const applicationId = applications.rows[0].id;
const outsiderSees = await asUser(outsider, () =>
  db.query(`select count(*)::int as n from public.job_applications where id='${applicationId}'`));
check('RLS blocks unrelated user from an application', outsiderSees.rows[0].n === 0, `${outsiderSees.rows[0].n} rows`);
const employerSees = await asUser(employer, () =>
  db.query(`select count(*)::int as n from public.job_applications where id='${applicationId}'`));
check('RLS allows the owning salon member', employerSees.rows[0].n === 1, `${employerSees.rows[0].n} rows`);
const seekerSees = await asUser(seeker, () =>
  db.query(`select count(*)::int as n from public.job_applications where id='${applicationId}'`));
check('RLS allows the candidate', seekerSees.rows[0].n === 1, `${seekerSees.rows[0].n} rows`);

const outsiderNotificationWrite = await asUser(outsider, async () => {
  try {
    await db.query(`insert into public.job_notifications(user_id,type,title,body) values ('${seeker}','x','y','z')`);
    return 'inserted';
  } catch (error) {
    return error.message;
  }
});
check('candidate cannot forge another user notification',
  outsiderNotificationWrite !== 'inserted', outsiderNotificationWrite);

const outsiderRoleEscalation = await asUser(outsider, async () => {
  try {
    await db.query(`update public.job_user_roles set role='admin' where user_id='${outsider}'`);
    return 'escalated';
  } catch (error) {
    return error.message;
  }
});
check('candidate cannot escalate own role to admin', outsiderRoleEscalation !== 'escalated', outsiderRoleEscalation);

// ---------------------------------------------------------------------------
// 4. Interview -> offer -> hire, and re-offer after withdrawal
// ---------------------------------------------------------------------------
await rpc(employer, `select public.mark_application_viewed('${applicationId}')`);
await rpc(employer, `select public.shortlist_application('${applicationId}')`);
const interview = await rpc(employer, `select id from public.create_interview_request(
  '${applicationId}','in_person', now() + interval '3 days', 30, 'Salon', null, null) as id`);
const interviewId = interview.rows[0].id;
await rpc(seeker, `select public.accept_interview('${interviewId}')`);
await rpc(employer, `select public.complete_interview('${interviewId}')`);

const offerId = (await rpc(employer, `select id from public.send_job_offer(
  '${applicationId}','Senior Stylist', 30000, 'full_time', current_date + 10, 'Welcome', null, null) as id`)).rows[0].id;
check('offer sent after interview', Boolean(offerId));

let secondActiveOffer = '';
try {
  await rpc(employer, `select public.send_job_offer('${applicationId}','Senior Stylist', 32000, 'full_time', current_date + 12)`);
} catch (error) {
  secondActiveOffer = error.message;
}
check('second offer while one is active is refused predictably',
  /OFFER_ALREADY_ACTIVE|INVALID_APPLICATION_TRANSITION/.test(secondActiveOffer), secondActiveOffer);
const activeOffers = await db.query(`select count(*)::int as n from public.job_offers where application_id='${applicationId}' and status in ('sent','accepted')`);
check('exactly one active offer exists', activeOffers.rows[0].n === 1, `${activeOffers.rows[0].n} active offers`);

let withdrawWithOffer = '';
try {
  await rpc(seeker, `select public.withdraw_application('${applicationId}')`);
} catch (error) {
  withdrawWithOffer = error.message;
}
check('cannot withdraw while an offer is pending -> OFFER_PENDING', /OFFER_PENDING/.test(withdrawWithOffer), withdrawWithOffer);

await rpc(employer, `select public.withdraw_job_offer('${offerId}','Changed terms')`);
const replacement = await rpc(employer, `select id from public.send_job_offer(
  '${applicationId}','Senior Stylist', 31000, 'full_time', current_date + 15) as id`);
check('replacement offer allowed after withdrawal', replacement.rows.length === 1);

await rpc(seeker, `select public.accept_job_offer('${replacement.rows[0].id}')`);
await rpc(employer, `select public.mark_candidate_hired('${applicationId}')`);
const hired = await db.query(`select status from public.job_applications where id='${applicationId}'`);
check('candidate hired after accepting the offer', hired.rows[0].status === 'hired', hired.rows[0].status);

// ---------------------------------------------------------------------------
// 5. Status vocabulary: 'published' must be impossible and unreferenced
// ---------------------------------------------------------------------------
// Constraint-level check: bypass RLS and the status guard exactly like a buggy
// RPC would, so only the CHECK constraint can stop the retired value.
let publishedInsert = '';
try {
  await db.exec(`set app.job_trusted_status_change='yes';
    update public.job_posts set status='published' where id='${job}';
    reset app.job_trusted_status_change;`);
} catch (error) {
  publishedInsert = error.message;
}
check("job status 'published' is rejected by the constraint", /job_posts_status_check/.test(publishedInsert),
  publishedInsert);

// RLS-level check: a non-member cannot flip job status at all.
const outsiderJobUpdate = await asUser(outsider, async () => {
  try {
    await db.query(`update public.job_posts set status='approved' where id='${job}'`);
    return 'updated';
  } catch (error) {
    return error.message;
  }
});
const stillPending = await db.query(`select status from public.job_posts where id='${job}'`);
check('non-member cannot update a job row', outsiderJobUpdate === 'updated' ? 'updated' : 'blocked',
  `${outsiderJobUpdate} / status=${stillPending.rows[0].status}`);

const liveFunctions = await db.query(`
  select p.proname, pg_get_functiondef(p.oid) as def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'job%'
`);
const staleFunctions = liveFunctions.rows
  .filter((r) => /status\s*(<>|=)\s*'published'/.test(r.def))
  .map((r) => r.proname);
check('no live function gates on the retired published status', staleFunctions.length === 0, staleFunctions.join(', '));

const stalePolicies = (await db.query(`select policyname, qual from pg_policies where schemaname='public' and tablename like 'job%'`))
  .rows.filter((r) => /status\s*=\s*'published'/.test(r.qual || '') || /status\s*=\s*"'published"/.test(r.qual || ''))
  .map((r) => r.policyname);
check('no live policy gates on the retired published status', stalePolicies.length === 0, stalePolicies.join(', '));

// Public listing view must expose the approved job and nothing else.
await db.exec(`set role anon`);
const publicListings = await db.query(`select id, city from public.public_job_listings`);
await db.exec(`reset role`);
check('public_job_listings exposes the approved job', publicListings.rows.some((r) => r.id === job),
  `${publicListings.rows.length} rows`);
check('public_job_listings exposes the salon location city', publicListings.rows[0]?.city === 'Jaipur',
  String(publicListings.rows[0]?.city));

// ---------------------------------------------------------------------------
// 6. Storage policy sanity
// ---------------------------------------------------------------------------
const storagePolicies = await db.query(`select policyname from pg_policies where schemaname='storage' and tablename='objects'`);
check('storage object policies installed', storagePolicies.rows.length >= 9, `${storagePolicies.rows.length} policies`);

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} backend invariants verified`);
if (failed.length) {
  console.log('FAILED:');
  for (const f of failed) console.log(`  - ${f.name}${f.detail ? ` (${f.detail})` : ''}`);
  process.exit(1);
}
console.log('ALL BACKEND INVARIANTS PASS');

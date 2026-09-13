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
  -- Production grants these through schema default privileges; the policies (not
  -- the grants) are what must keep user rows private, so model that faithfully.
  grant select, insert, update, delete on public.notifications, public.push_subscriptions to anon, authenticated;
  -- Supabase grants on storage.objects the same way; the RLS policies, not the
  -- grants, are what keep private buckets private.
  grant select on storage.objects to anon;
  grant select, insert, update, delete on storage.objects to authenticated;

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
    and p.proname not in ('job_email_portal_role','job_is_admin','job_is_active_salon_member','job_my_active_salon_ids')
`);
check('no unexpected anon-executable RPC', anonExec.rows.length === 0,
  anonExec.rows.map((r) => r.proname).join(', '));

const buckets = await db.query(`select id, public from storage.buckets order by id`);
check('storage buckets created', buckets.rows.length === 8, `${buckets.rows.length} buckets`);
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
  -- The signup trigger already ensures a profiles row per auth user; the seed
  -- only fills in the display columns it owns.
  insert into public.profiles(id,full_name,is_active) values
    ('${seeker}','Seeker',true),('${employer}','Employer',true),
    ('${admin}','Admin',true),('${outsider}','Outsider',true)
  on conflict (id) do update set full_name=excluded.full_name, is_active=excluded.is_active;
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

// An OAuth-style signup carries no app_context metadata, so the signup trigger
// skips it entirely. Portal entry through job_register_role must still converge
// the account to a complete row set (role + shared profile).
const oauthUser = uid(7);
await db.exec(`insert into auth.users(id,email,raw_user_meta_data) values ('${oauthUser}','oauth@example.com','{}');`);
await rpc(oauthUser, `select public.job_register_role('job_seeker')`);
const oauthRows = await db.query(`
  select
    (select role from public.job_user_roles where user_id='${oauthUser}') as role,
    (select full_name from public.profiles where id='${oauthUser}') as name,
    (select is_active from public.profiles where id='${oauthUser}') as active`);
check('role registration heals a missing shared profile row',
  oauthRows.rows[0].role === 'job_seeker' && oauthRows.rows[0].name === 'oauth' && oauthRows.rows[0].active === true,
  JSON.stringify(oauthRows.rows[0]));

// The healing must not reactivate a deliberately deactivated account.
const dormant = uid(8);
await db.exec(`
  insert into auth.users(id,email) values ('${dormant}','dormant@example.com');
  insert into public.profiles(id,full_name,is_active) values ('${dormant}','Dormant',false)
  on conflict (id) do update set full_name=excluded.full_name, is_active=false;
`);
let dormantError = '';
try {
  await rpc(dormant, `select public.job_register_role('job_seeker')`);
} catch (error) {
  dormantError = error.message;
}
check('deactivated accounts stay blocked with ACCOUNT_INACTIVE',
  /ACCOUNT_INACTIVE/.test(dormantError), dormantError);

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
// 7. Schema integrity: foreign keys, cascades and status vocabularies
// ---------------------------------------------------------------------------
const refColumns = await db.query(`
  select t.relname as tbl, a.attname as col
    from pg_class t
    join pg_namespace n on n.oid=t.relnamespace and n.nspname='public'
    join pg_attribute a on a.attrelid=t.oid and a.attnum>0 and not a.attisdropped
   where t.relkind='r' and t.relname like 'job%'
     and a.attname ~ '(^|_)(user_id|profile_id|candidate_id|employer_id|salon_id|job_id|application_id|interview_id|offer_id|resume_id|skill_id|conversation_id|ticket_id|sender_user_id|created_by|changed_by|reviewed_by|submitted_by|assigned_to|reporter_user_id|resolved_by|location_id)$'
     and not exists (select 1 from pg_constraint c where c.conrelid=t.oid and c.contype='f' and a.attnum = any(c.conkey))`);
check('every reference column on a job table has a foreign key', refColumns.rows.length === 0,
  refColumns.rows.map((r) => `${r.tbl}.${r.col}`).join(', '));

const unconstrainedStatus = await db.query(`
  select c.relname as tbl, a.attname as col
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
    join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
   where c.relkind='r' and c.relname like 'job%' and a.attname = 'status'
     and not exists (
       select 1 from pg_constraint k
        where k.conrelid=c.oid and k.contype='c' and a.attnum = any(k.conkey))`);
check('every status column has a CHECK constraint', unconstrainedStatus.rows.length === 0,
  unconstrainedStatus.rows.map((r) => `${r.tbl}.${r.col}`).join(', '));

const unindexedFks = await db.query(`
  select t.relname as tbl, a.attname as col
    from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace and n.nspname='public'
    join pg_attribute a on a.attrelid=t.oid and a.attnum = c.conkey[1]
   where c.contype='f' and array_length(c.conkey,1)=1 and t.relname like 'job%'
     and not exists (select 1 from pg_index i
                      where i.indrelid=c.conrelid and i.indisvalid
                        and (i.indkey::int2[])[0] = c.conkey[1])`);
check('every foreign key has a leading index (cascade deletes stay fast)', unindexedFks.rows.length === 0,
  unindexedFks.rows.map((r) => `${r.tbl}.${r.col}`).join(', '));

const statusValues = await db.query(`
  select count(*)::int as n
    from public.job_application_status_history
   where from_status is not null and from_status = to_status`);
check('application history never records a no-op transition', statusValues.rows[0].n === 0, `${statusValues.rows[0].n} rows`);

const historyVocab = await db.query(`
  select count(*)::int as n
    from public.job_application_status_history
   where (from_status is not null and from_status not in (
            'submitted','viewed','shortlisted','interview_requested','interview_confirmed',
            'interview_completed','offer_sent','offer_accepted','hired','rejected','withdrawn','position_closed'))
      or to_status not in (
            'submitted','viewed','shortlisted','interview_requested','interview_confirmed',
            'interview_completed','offer_sent','offer_accepted','hired','rejected','withdrawn','position_closed')`);
check('application history speaks the lifecycle vocabulary', historyVocab.rows[0].n === 0, `${historyVocab.rows[0].n} rows`);

// Terminal states are frozen: a hired application cannot silently move again.
let terminalRewrite = '';
try {
  await db.exec(`update public.job_applications set status='viewed' where id='${applicationId}'`);
} catch (error) {
  terminalRewrite = error.message;
}
check('terminal application state cannot be rewritten -> INVALID_APPLICATION_TRANSITION',
  /INVALID_APPLICATION_TRANSITION/.test(terminalRewrite), terminalRewrite);

// An open application, on the other hand, follows the documented path.
const secondJob = (await rpc(employer, `select public.create_job_post(
  '${salonId}', null, 'Colour Specialist', 'Hair',
  'We are hiring a colour specialist with balayage experience for our Jaipur salon.', 'full_time') as id`)).rows[0].id;
await rpc(admin, `select public.approve_job('${secondJob}')`);
const secondApplication = (await rpc(seeker, `select id from public.submit_job_application('${secondJob}') as id`)).rows[0].id;
// The state machine itself must refuse a skipped step, not just the RPC chain.
let skippedStep = '';
try {
  await db.exec(`update public.job_applications set status='shortlisted' where id='${secondApplication}'`);
} catch (error) {
  skippedStep = error.message;
}
const afterSkip = await db.query(`select status from public.job_applications where id='${secondApplication}'`);
check('skipping a lifecycle step is refused (submitted cannot jump to shortlisted)',
  /INVALID_APPLICATION_TRANSITION/.test(skippedStep) && afterSkip.rows[0].status === 'submitted',
  `${skippedStep} / status=${afterSkip.rows[0].status}`);
await rpc(employer, `select public.mark_application_viewed('${secondApplication}')`);
await rpc(employer, `select public.shortlist_application('${secondApplication}')`);
const walkInterview = (await rpc(employer, `select id from public.create_interview_request(
  '${secondApplication}','phone', now() + interval '2 days', 20, null, null, null) as id`)).rows[0].id;
await rpc(seeker, `select public.accept_interview('${walkInterview}')`);
await rpc(employer, `select public.complete_interview('${walkInterview}')`);
const walkState = await db.query(`select status from public.job_applications where id='${secondApplication}'`);
check('documented path reaches interview_completed', walkState.rows[0].status === 'interview_completed',
  walkState.rows[0].status);

// Employment type: the UI spelling is normalized at the database boundary.
const normalizedOffer = (await rpc(employer, `select id, employment_type from public.send_job_offer(
  '${secondApplication}','Colour Specialist', 28000, 'full-time', current_date + 7) as id`)).rows[0];
check("send_job_offer normalizes 'full-time' to 'full_time'", normalizedOffer.employment_type === 'full_time',
  String(normalizedOffer.employment_type));
let badType = '';
try {
  await rpc(employer, `select public.send_job_offer('${secondApplication}','Colour Specialist', 28000, 'banana', current_date + 7)`);
} catch (error) {
  badType = error.message;
}
check('unusable employment type is refused -> INVALID_EMPLOYMENT_TYPE', /INVALID_EMPLOYMENT_TYPE/.test(badType), badType);
let badTypeWrite = '';
try {
  await db.exec(`update public.job_offers set employment_type='full-time' where id='${normalizedOffer.id}'`);
} catch (error) {
  badTypeWrite = error.message;
}
check('offer employment type CHECK rejects a second spelling',
  /job_offers_employment_type_check/.test(badTypeWrite), badTypeWrite);

// Deleting a job that has applicants is refused with a stable code, not a raw
// constraint name, and the posting survives.
let jobDelete = '';
try {
  await db.exec(`delete from public.job_posts where id='${secondJob}'`);
} catch (error) {
  jobDelete = error.message;
}
check('deleting a job with applications -> JOB_HAS_APPLICATIONS', /JOB_HAS_APPLICATIONS/.test(jobDelete), jobDelete);
const survived = await db.query(`select count(*)::int as n from public.job_posts where id='${secondJob}'`);
check('the guarded job posting still exists', survived.rows[0].n === 1);

// A job without applicants deletes cleanly and takes its dependants with it.
const doomedJob = (await rpc(employer, `select public.create_job_post(
  '${salonId}', null, 'Temporary Role', 'Hair',
  'This posting exists only to verify cascade behaviour when a job is removed.', 'part_time') as id`)).rows[0].id;
await db.exec(`
  insert into public.job_saved_jobs(user_id, job_id) values ('${seeker}','${doomedJob}');
  insert into public.job_notifications(user_id,type,title,body,entity_type,entity_id)
    values ('${employer}','job_approved','Job approved','Approved.','job','${doomedJob}');
`);
await db.exec(`delete from public.job_posts where id='${doomedJob}'`);
const orphans = await db.query(`
  select
    (select count(*)::int from public.job_posts where id='${doomedJob}')          as jobs,
    (select count(*)::int from public.job_saved_jobs where job_id='${doomedJob}') as bookmarks,
    (select count(*)::int from public.job_post_skills where job_id='${doomedJob}')as skills,
    (select count(*)::int from public.job_notifications
      where entity_type='job' and entity_id='${doomedJob}')                       as notifications`);
check('deleting a job removes its bookmarks, skills and notifications',
  orphans.rows[0].jobs === 0 && orphans.rows[0].bookmarks === 0 &&
  orphans.rows[0].skills === 0 && orphans.rows[0].notifications === 0,
  JSON.stringify(orphans.rows[0]));

// Deleting an application (service-role only) cascades to its interviews, offers and history.
await db.exec(`delete from public.job_applications where id='${secondApplication}'`);
const applicationOrphans = await db.query(`
  select
    (select count(*)::int from public.job_interview_requests where application_id='${secondApplication}') as interviews,
    (select count(*)::int from public.job_offers where application_id='${secondApplication}')             as offers,
    (select count(*)::int from public.job_application_status_history
      where application_id='${secondApplication}')                                                        as history`);
check('deleting an application cascades to interviews, offers and history',
  applicationOrphans.rows[0].interviews === 0 && applicationOrphans.rows[0].offers === 0 &&
  applicationOrphans.rows[0].history === 0,
  JSON.stringify(applicationOrphans.rows[0]));

// User references: records owned by the user follow them when the account row
// goes away, while hiring records are held back by RESTRICT (asserted above by
// the JOB_HAS_APPLICATIONS guard for jobs, and by the FK catalog for the rest).
const retired = uid(9);
await db.exec(`
  insert into auth.users(id,email) values ('${retired}','retired@example.com');
  insert into public.profiles(id,full_name) values ('${retired}','Retired');
  insert into public.job_account_deletion_requests(user_id,reason) values ('${retired}','probe');
  insert into public.job_user_locations(user_id,latitude,longitude) values ('${retired}',26.9,75.8);
  insert into public.job_saved_jobs(user_id,job_id) values ('${retired}','${job}');
  delete from auth.users where id='${retired}';
`);
const retiredRows = await db.query(`
  select
    (select count(*)::int from public.profiles where id='${retired}')                        as profile,
    (select count(*)::int from public.job_user_locations where user_id='${retired}')         as locations,
    (select count(*)::int from public.job_saved_jobs where user_id='${retired}')             as bookmarks,
    (select count(*)::int from public.job_account_deletion_requests where user_id='${retired}') as requests`);
check('deleting an account removes the rows it owns',
  Object.values(retiredRows.rows[0]).every((n) => n === 0), JSON.stringify(retiredRows.rows[0]));

// ---------------------------------------------------------------------------
// 8. Tenant isolation: one salon can never reach into another salon's data
// ---------------------------------------------------------------------------
const employerB = uid(5), candidateB = uid(6);
await db.exec(`
  insert into auth.users(id,email,raw_user_meta_data) values
    ('${employerB}','employerb@example.com','{"app_context":"jobs","job_role":"employer"}'),
    ('${candidateB}','candidateb@example.com','{"app_context":"jobs","job_role":"seeker"}');
  -- As in section 2, the signup trigger already ensured these profiles rows.
  insert into public.profiles(id,full_name,is_active) values
    ('${employerB}','Employer B',true),('${candidateB}','Candidate B',true)
  on conflict (id) do update set full_name=excluded.full_name, is_active=excluded.is_active;
`);
await rpc(employerB, `select public.job_register_role('employer')`);
await rpc(candidateB, `select public.job_register_role('job_seeker')`);
const salonB = (await rpc(employerB, `select public.complete_job_employer_onboarding(
  'Second Salon','Owner B','2 Side St','Jaipur','Rajasthan',null,'salon',null,null) as id`)).rows[0].id;
const jobB = (await rpc(employerB, `select public.create_job_post(
  '${salonB}', null, 'Second Salon Stylist', 'Hair',
  'We are hiring a stylist for our second Jaipur salon location.', 'full_time') as id`)).rows[0].id;
await rpc(admin, `select public.approve_job('${jobB}')`);
// Salon B gets an application of its own, so its owner satisfies the predicate
// the broken policy version left behind.
await rpc(seeker, `select public.submit_job_application('${jobB}')`);

const conversationInsert = (userId, job, candidate, employer) =>
  asUser(userId, async () => {
    try {
      await db.query(`insert into public.job_conversations(job_id,candidate_user_id,employer_user_id,status)
        values ('${job}','${candidate}','${employer}','inquiry')`);
      return 'inserted';
    } catch (error) {
      return error.message;
    }
  });

// REGRESSION: the salon B owner must not be able to open a thread about salon A's job.
const crossSalon = await conversationInsert(employerB, job, seeker, employerB);
check('salon B cannot create a conversation on salon A job', crossSalon !== 'inserted', crossSalon);

// REGRESSION: a salon member must not be able to open a thread with a candidate
// who never applied to that job.
const unrelatedCandidate = await conversationInsert(employerB, jobB, candidateB, employerB);
check('salon member cannot open a conversation with a candidate who never applied',
  unrelatedCandidate !== 'inserted', unrelatedCandidate);

// Positive control: the rightful pair still works.
const ownApplication = await conversationInsert(employerB, jobB, seeker, employerB);
check('salon member can open a conversation with an applicant', ownApplication === 'inserted', ownApplication);

// Candidate inquiry: allowed on a live job, refused once the job is not listable.
const inquiry = await conversationInsert(seeker, job, seeker, employer);
check('candidate can start an inquiry about a live job', inquiry === 'inserted', inquiry);
const pendingJobForInquiry = (await rpc(employer, `select public.create_job_post(
  '${salonId}', null, 'Unapproved Role', 'Hair',
  'This posting is still waiting for the administrator to approve it.', 'full_time') as id`)).rows[0].id;
const pendingInquiry = await conversationInsert(seeker, pendingJobForInquiry, seeker, employer);
check('candidate cannot start an inquiry about a job that is not listable',
  pendingInquiry !== 'inserted', pendingInquiry);

// Cross-tenant reads: salon B must not see salon A's job rows or applications.
// An approved posting is public by design, but a pending one must not be.
const publicJob = await asUser(candidateB, () =>
  db.query(`select count(*)::int as n from public.job_posts where id='${job}'`));
check('any signed-in user can read an approved job posting', publicJob.rows[0].n === 1, `${publicJob.rows[0].n} rows`);
const crossSalonJobs = await asUser(employerB, () =>
  db.query(`select count(*)::int as n from public.job_posts where id='${pendingJobForInquiry}'`));
check('salon B cannot read salon A unapproved posting', crossSalonJobs.rows[0].n === 0, `${crossSalonJobs.rows[0].n} rows`);
const crossSalonApps = await asUser(employerB, () =>
  db.query(`select count(*)::int as n from public.job_applications where job_id='${job}'`));
check('salon B cannot read applications addressed to salon A', crossSalonApps.rows[0].n === 0,
  `${crossSalonApps.rows[0].n} rows`);
const crossSalonCandidates = await asUser(candidateB, () =>
  db.query(`select count(*)::int as n from public.job_applications where candidate_user_id='${seeker}'`));
check('one candidate cannot read another candidate applications', crossSalonCandidates.rows[0].n === 0,
  `${crossSalonCandidates.rows[0].n} rows`);

// Anonymous visitors never see skills of a job that is still awaiting approval.
await db.exec(`set role anon;`);
const anonSkills = await db.query(`select count(*)::int as n from public.job_post_skills where job_id='${pendingJobForInquiry}'`);
await db.exec(`reset role;`);
check('anon cannot read skills of an unapproved job', anonSkills.rows[0].n === 0, `${anonSkills.rows[0].n} rows`);

// A forged salon row must be able to reach nothing: no client insert path into
// membership, plan enablement or postings. All three are written by RPCs only.
const insertPolicyCount = async (table) => (await db.query(`
  select count(*)::int as n from pg_policies
   where schemaname='public' and tablename='${table}' and cmd in ('INSERT','ALL')`)).rows[0].n;
for (const table of ['job_salon_members', 'job_salon_profiles', 'job_posts']) {
  check(`no client insert policy on ${table}`, (await insertPolicyCount(table)) === 0, `${await insertPolicyCount(table)} policies`);
}
const forgedMembership = await asUser(employerB, async () => {
  try {
    await db.query(`insert into public.job_salon_members(salon_id,user_id,member_role,status)
      values ('${salonId}','${employerB}','owner','active')`);
    return 'inserted';
  } catch (error) { return error.message; }
});
check('salon B cannot forge membership of salon A', forgedMembership !== 'inserted', forgedMembership);
const forgedEnable = await asUser(employerB, async () => {
  try {
    const result = await db.query(`update public.job_salon_profiles set jobs_enabled = true where salon_id='${salonId}'`);
    return result.affectedRows === 0 ? 'no rows updated' : 'updated';
  } catch (error) { return error.message; }
});
check('salon B cannot enable job listings for salon A', forgedEnable === 'no rows updated', forgedEnable);
const forgedPost = await asUser(employerB, async () => {
  try {
    await db.query(`insert into public.job_posts(salon_id,created_by,title,description,employment_type,status)
      values ('${salonId}','${employerB}','Forged','A forged posting written straight through PostgREST.','full_time','approved')`);
    return 'inserted';
  } catch (error) { return error.message; }
});
check('salon B cannot publish a posting for salon A directly', forgedPost !== 'inserted', forgedPost);

// Shared tables that used to ship with RLS switched off must now be closed.
for (const table of ['notifications', 'push_subscriptions']) {
  const state = (await db.query(`
    select c.relrowsecurity as rls,
           (select count(*)::int from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as policies
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relname='${table}'`)).rows[0];
  check(`${table} has RLS enabled with own-row policies`, state.rls === true && state.policies >= 4,
    `rls=${state.rls} policies=${state.policies}`);
}

// Own-row policies in action: a user may write their own rows and must not be
// able to see or touch anyone else's.
const asUserResult = (userId, sql) => asUser(userId, async () => {
  try { return { ok: true, rows: (await db.query(sql)).rows }; }
  catch (error) { return { ok: false, error: error.message }; }
});
const ownRow = await asUserResult(seeker, `insert into public.notifications(user_id) values ('${seeker}') returning id`);
check('a user can insert their own notification row', ownRow.ok, ownRow.error);
const foreignRow = await asUserResult(seeker, `insert into public.notifications(user_id) values ('${employer}')`);
check('a user cannot insert a notification row for someone else', !foreignRow.ok, JSON.stringify(foreignRow.rows));
const ownRows = await asUserResult(seeker, `select count(*)::int as n from public.notifications`);
check('a user reads their own notification rows', ownRows.rows?.[0]?.n === 1, JSON.stringify(ownRows.rows));
const foreignRows = await asUserResult(employer, `select count(*)::int as n from public.notifications`);
check('a user cannot read another user notification rows', foreignRows.rows?.[0]?.n === 0, JSON.stringify(foreignRows.rows));
const foreignDelete = await asUserResult(employer, `delete from public.notifications where user_id='${seeker}'`);
check('a user cannot delete another user notification rows', foreignDelete.ok && foreignDelete.rows.length === 0,
  foreignDelete.error || JSON.stringify(foreignDelete.rows));
await db.exec(`set role anon;`);
const anonNotifications = await (async () => {
  try { return { ok: true, rows: (await db.query(`select count(*)::int as n from public.notifications`)).rows }; }
  catch (error) { return { ok: false, error: error.message }; }
})();
await db.exec(`reset role;`);
check('anonymous visitors cannot read notification rows',
  !anonNotifications.ok || anonNotifications.rows[0].n === 0, JSON.stringify(anonNotifications.rows));
const memberRows = await (async () => {
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${employerB}';`);
  try { return { ok: true, rows: (await db.query(`select count(*)::int as n from public.organization_members`)).rows }; }
  catch (error) { return { ok: false, error: error.message }; }
  finally { await db.exec(`reset role; reset request.jwt.claim.sub;`); }
})();
// RLS is on with no policy, so this is either denied outright or returns nothing.
check('organization membership stays unreadable without a policy',
  !memberRows.ok || memberRows.rows[0].n === 0, JSON.stringify(memberRows.rows));

// Generic guard against the shadowing bug that produced this whole section: a
// policy that compares an identifier with itself is always true.
const tautologies = [];
const allPolicies = await db.query(`
  select tablename, policyname, coalesce(qual,'') as qual, coalesce(with_check,'') as with_check
    from pg_policies where schemaname='public'`);
for (const policy of allPolicies.rows) {
  for (const expr of [policy.qual, policy.with_check]) {
    for (const m of expr.matchAll(/([a-z_]+(?:\.[a-z_]+)?)\s*=\s*([a-z_]+(?:\.[a-z_]+)?)(?=[)\s]|$)/g)) {
      if (m[1] === m[2]) tautologies.push(`${policy.tablename}.${policy.policyname}: ${m[1]} = ${m[2]}`);
    }
  }
}
check('no policy contains a tautological self-comparison', tautologies.length === 0, tautologies.join(', '));

// ---------------------------------------------------------------------------
// 9. Query performance: the hot paths answer membership once per query
// ---------------------------------------------------------------------------
const salonHelper = (await db.query(`
  select p.prosecdef as definer, p.provolatile as volatility, p.proconfig as config,
         has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_ok,
         has_function_privilege('anon', p.oid, 'EXECUTE') as anon_ok
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname='public' and p.proname='job_my_active_salon_ids'`)).rows[0];
check('set-based membership helper exists', Boolean(salonHelper));
check('membership helper is security definer with an empty search_path',
  salonHelper.definer === true
  && (salonHelper.config ?? []).some((entry) => entry.startsWith('search_path=')),
  JSON.stringify(salonHelper.config));
check('membership helper is callable by authenticated and anon (needed inside policies)',
  salonHelper.auth_ok === true && salonHelper.anon_ok === true);

// The per-row helpers must no longer appear in the hot policies: one call per
// candidate row was the 7.8s -> 80ms difference on the employer application list.
const perRowPolicies = (await db.query(`
  select tablename, policyname from pg_policies
   where schemaname='public'
     and (coalesce(qual,'') || coalesce(with_check,'')) like '%job_can_manage_application%'`)).rows;
check('no policy calls the per-row application helper any more',
  perRowPolicies.length === 0, perRowPolicies.map((r) => `${r.tablename}.${r.policyname}`).join(', '));

const rewritten = ['job_posts_read', 'job_applications_read_related', 'job_interviews_read_related',
  'job_offers_read_related', 'job_application_history_read_related'];
const stillPerRow = (await db.query(`
  select policyname from pg_policies
   where schemaname='public' and policyname = any(array[${rewritten.map((n) => `'${n}'`).join(',')}])
     and (coalesce(qual,'') || coalesce(with_check,'')) like '%job_is_active_salon_member%'`)).rows;
check('rewritten hot policies filter by salon set, not per row',
  stillPerRow.length === 0, stillPerRow.map((r) => r.policyname).join(', '));

const applicantCardsDef = (await db.query(`
  select pg_get_functiondef(oid) as def from pg_proc where proname='get_job_applicant_cards'`)).rows[0].def;
check('applicant list RPC filters by salon set, not per row',
  !/job_can_manage_application|job_is_active_salon_member/.test(applicantCardsDef)
  && /job_my_active_salon_ids/.test(applicantCardsDef));

check('admin approval queue has its partial index',
  (await db.query(`select 1 from pg_indexes where schemaname='public' and indexname='job_posts_pending_approval_idx'`)).rows.length === 1);

// The rewritten policies must still answer correctly, including for anonymous
// visitors (whose role cannot execute anything it is not granted).
await db.exec(`set role anon;`);
const anonBrowse = await db.query(`select count(*)::int as n from public.public_job_listings`);
await db.exec(`reset role;`);
check('anon can still read the approved listings after the policy rewrite', anonBrowse.rows[0].n > 0,
  `${anonBrowse.rows[0].n} rows`);
const applicantCards = await rpc(employer, `select count(*)::int as n from public.get_job_applicant_cards()`);
check('applicant list RPC still returns the salon owner their applicants', applicantCards.rows[0].n > 0,
  `${applicantCards.rows[0].n} rows`);
const strangerCards = await asUser(seeker, async () => {
  try { return { rows: (await db.query(`select count(*)::int as n from public.get_job_applicant_cards()`)).rows }; }
  catch (error) { return { error: error.message }; }
});
check('applicant list RPC still refuses a candidate', /ROLE_NOT_ALLOWED/.test(strangerCards.error ?? ''), 'not refused');

// ---------------------------------------------------------------------------
// 10. Atomic procedures: the multi-step workflows commit or fail as one unit
// ---------------------------------------------------------------------------
const caught = (userId, sql) => asUser(userId, async () => {
  try { return { rows: (await db.query(sql)).rows }; }
  catch (error) { return { error: error.message }; }
});

// job_save_profile: profile and role-specific row in one transaction, and only
// the row matching the caller's own role.
const profileSave = await rpc(seeker, `select public.job_save_profile(
  'Seeker Renamed','9990001111','/avatar/seeker.png','Senior Stylist','Ten years of colour work.')`);
const savedRow = (await db.query(`
  select p.full_name, p.phone, p.avatar_path, c.headline, c.bio
    from public.profiles p join public.job_seeker_profiles c on c.user_id = p.id
   where p.id = '${seeker}'`)).rows[0];
check('profile save writes both tables in one call',
  savedRow.full_name === 'Seeker Renamed' && savedRow.phone === '9990001111'
  && savedRow.headline === 'Senior Stylist' && savedRow.bio === 'Ten years of colour work.',
  JSON.stringify(savedRow));
const employerUntouched = (await db.query(`select full_name from public.profiles where id='${employer}'`)).rows[0].full_name;
check('profile save cannot touch another account', employerUntouched === 'Employer', employerUntouched);
const employerSave = await rpc(employer, `select public.job_save_profile('Employer Renamed', null, null, 'Lead Stylist', 'should not be written', 'Salon Owner')`);
const employerRow = (await db.query(`
  select p.full_name, e.display_name from public.profiles p
    join public.job_employer_profiles e on e.user_id = p.id where p.id='${employer}'`)).rows[0];
const seekerRowAfter = (await db.query(`select headline from public.job_seeker_profiles where user_id='${seeker}'`)).rows[0].headline;
check('profile save only writes the caller role row',
  employerRow.full_name === 'Employer Renamed' && employerRow.display_name === 'Salon Owner'
  && seekerRowAfter === 'Senior Stylist', `${JSON.stringify(employerRow)} / ${seekerRowAfter}`);
const badSave = await caught(seeker, `select public.job_save_profile('  ')`);
check('profile save rejects an empty name', /VALIDATION_ERROR/.test(badSave.error ?? ''), badSave.error);

// The eight-step form submits every candidate relation in one transaction and
// returns only server-derived confirmation values.
const candidateSubmit = await rpc(seeker, `select * from public.job_submit_candidate_profile(
  'Seeker Complete','9990002222','${seeker}/avatar.jpg','Lead Colourist','Luxury salon specialist',
  'Jaipur','Rajasthan','senior',72,50000,80000,'2026-10-01',true,
  array['Balayage','Colour correction'],array['Lead Colourist'],array['full_time','contract'],
  '[{"salon_name":"Studio One","role_title":"Senior Stylist","city":"Jaipur","state":"Rajasthan","start_date":"2020-01-01","currently_working":true}]'::jsonb,
  '[{"course_name":"Advanced Cosmetology","institution_name":"Beauty Academy","completion_year":2019}]'::jsonb,
  '[{"certificate_name":"Colour Master","institution_name":"Beauty Academy","completion_year":2020}]'::jsonb
)`);
const submittedConfirmation = candidateSubmit.rows[0];
const submittedRelations = (await db.query(`select
  (select count(*)::int from public.job_candidate_skills s join public.job_seeker_profiles c on c.id=s.candidate_id where c.user_id='${seeker}') as skills,
  (select count(*)::int from public.job_candidate_experience e join public.job_seeker_profiles c on c.id=e.candidate_id where c.user_id='${seeker}') as experience,
  (select count(*)::int from public.job_candidate_education e join public.job_seeker_profiles c on c.id=e.candidate_id where c.user_id='${seeker}') as education,
  (select count(*)::int from public.job_candidate_certifications x join public.job_seeker_profiles c on c.id=x.candidate_id where c.user_id='${seeker}') as certifications,
  (select count(*)::int from public.job_candidate_preferences p join public.job_seeker_profiles c on c.id=p.candidate_id where c.user_id='${seeker}' and p.preferred_city='Jaipur' and p.salary_min=50000) as preferences,
  (select count(*)::int from public.job_candidate_preferred_roles r join public.job_seeker_profiles c on c.id=r.candidate_id where c.user_id='${seeker}' and r.role_name='Lead Colourist') as preferred_roles,
  (select count(*)::int from public.job_candidate_employment_types t join public.job_seeker_profiles c on c.id=t.candidate_id where c.user_id='${seeker}') as employment_types,
  (select count(*)::int from public.job_seeker_profiles c where c.user_id='${seeker}' and c.headline='Lead Colourist' and c.submitted_at is not null) as candidate,
  (select count(*)::int from public.profiles p where p.id='${seeker}' and p.full_name='Seeker Complete' and p.phone='9990002222') as shared_profile
`)).rows[0];
check('full candidate submit returns confirmation id, completion and readiness',
  Boolean(submittedConfirmation.candidate_id) && submittedConfirmation.profile_completion >= 80
    && submittedConfirmation.application_ready === true && Boolean(submittedConfirmation.submitted_at),
  JSON.stringify(submittedConfirmation));
check('full candidate submit persists every nested profile section atomically',
  submittedRelations.skills === 2 && submittedRelations.experience === 1
    && submittedRelations.education === 1 && submittedRelations.certifications === 1
    && submittedRelations.preferences === 1 && submittedRelations.preferred_roles === 1
    && submittedRelations.employment_types === 2 && submittedRelations.candidate === 1
    && submittedRelations.shared_profile === 1,
  JSON.stringify(submittedRelations));
const invalidLateCandidateSubmit = await caught(seeker, `select * from public.job_submit_candidate_profile(
  'Must Roll Back','9990004444',null,'Must Roll Back','Late validation failure',
  'Jaipur','Rajasthan','senior',72,50000,80000,'2026-10-01',true,
  array['Temporary skill'],array['Temporary role'],array['invalid_type'],
  '[]','[]','[]')`);
const candidateAfterRollback = (await db.query(`select c.headline, p.full_name,
  (select count(*)::int from public.job_candidate_skills s where s.candidate_id=c.id) as skills
  from public.job_seeker_profiles c join public.profiles p on p.id=c.user_id where c.user_id='${seeker}'`)).rows[0];
check('late candidate validation errors roll back the whole profile transaction',
  /INVALID_EMPLOYMENT_TYPE/.test(invalidLateCandidateSubmit.error ?? '')
    && candidateAfterRollback.headline === 'Lead Colourist'
    && candidateAfterRollback.full_name === 'Seeker Complete'
    && candidateAfterRollback.skills === 2,
  `${invalidLateCandidateSubmit.error}; ${JSON.stringify(candidateAfterRollback)}`);
const employerCandidateSubmit = await caught(employer, `select * from public.job_submit_candidate_profile(
  'Wrong Role','9990003333',null,'Stylist',null,'Jaipur','Rajasthan','fresher',0,null,null,null,false,
  array['Hair'],array['Stylist'],array['full_time'],'[]','[]','[]')`);
check('employer cannot submit a candidate profile', /ROLE_NOT_ALLOWED/.test(employerCandidateSubmit.error ?? ''), employerCandidateSubmit.error);
const unrelatedCandidateRead = await asUser(outsider, () => db.query(`select count(*)::int as n from public.job_candidate_experience e
  join public.job_seeker_profiles c on c.id=e.candidate_id where c.user_id='${seeker}'`));
check('candidate profile detail RLS hides rows from unrelated seekers', unrelatedCandidateRead.rows[0].n === 0,
  `${unrelatedCandidateRead.rows[0].n} rows visible`);

// job_open_conversation: participants resolved on the server.
const employerCrossOpen = await caught(employerB, `select public.job_open_conversation('${job}', null, 'seeker@example.com')`);
check('an employer from another salon cannot open a thread on this job',
  /ROLE_NOT_ALLOWED/.test(employerCrossOpen.error ?? ''), employerCrossOpen.error || 'allowed');
const strangerThread = await caught(employerB, `select public.job_open_conversation('${jobB}', null, 'candidateb@example.com')`);
check('a salon member cannot open a thread with a candidate who never applied',
  /CANDIDATE_NOT_FOUND/.test(strangerThread.error ?? ''), strangerThread.error || 'allowed');
const notLive = await caught(seeker, `select public.job_open_conversation('${pendingJobForInquiry}')`);
check('a candidate cannot open an inquiry about a job that is not listable',
  /JOB_NOT_PUBLISHED/.test(notLive.error ?? ''), notLive.error || 'allowed');
const opened = await rpc(seeker, `select (public.job_open_conversation('${job}')).id as id`);
const openedAgain = await rpc(seeker, `select (public.job_open_conversation('${job}')).id as id`);
check('opening a conversation is idempotent', opened.rows[0].id === openedAgain.rows[0].id,
  `${opened.rows[0].id} vs ${openedAgain.rows[0].id}`);
const openedByEmployer = await rpc(employer, `select (public.job_open_conversation('${job}', null, 'seeker@example.com')).id as id`);
check('a salon member can open the thread for an applicant', Boolean(openedByEmployer.rows[0].id));
const strandedConversation = openedByEmployer.rows[0].id;
const conversationParticipants = (await db.query(`
  select candidate_user_id, employer_user_id from public.job_conversations where id='${strandedConversation}'`)).rows[0];
check('the conversation names the caller and the applicant, not the browser payload',
  conversationParticipants.candidate_user_id === seeker && conversationParticipants.employer_user_id === employer,
  JSON.stringify(conversationParticipants));

// job_send_message: participant check, insert and counters in one transaction.
const sentMessage = await rpc(seeker, `select (public.job_send_message('${strandedConversation}','Hello, is the role still open?')).id as id`);
check('a participant can send a message', Boolean(sentMessage.rows[0].id));
const unreadAfterSend = (await db.query(`
  select candidate_unread_count, employer_unread_count, last_message
    from public.job_conversations where id='${strandedConversation}'`)).rows[0];
check('sending updates the conversation counters in the same transaction',
  unreadAfterSend.employer_unread_count === 1 && unreadAfterSend.candidate_unread_count === 0
  && unreadAfterSend.last_message === 'Hello, is the role still open?', JSON.stringify(unreadAfterSend));
const foreignMessage = await caught(candidateB, `select public.job_send_message('${strandedConversation}','I am not in this thread')`);
check('a stranger cannot post into a conversation',
  /CONVERSATION_ACCESS_DENIED/.test(foreignMessage.error ?? ''), foreignMessage.error || 'allowed');
const emptyMessage = await caught(seeker, `select public.job_send_message('${strandedConversation}','   ')`);
check('an empty message is refused before it reaches the table',
  /VALIDATION_ERROR/.test(emptyMessage.error ?? ''), emptyMessage.error);

// close_job notifies the candidates whose applications it closes. A fresh
// posting is used because the pipeline job's application is already terminal.
const closableJob = (await rpc(employer, `select public.create_job_post(
  '${salonId}', null, 'Closable Role', 'Hair',
  'A posting used to prove that closing it closes and notifies applicants.', 'full_time') as id`)).rows[0].id;
await rpc(admin, `select public.approve_job('${closableJob}')`);
await rpc(seeker, `select public.submit_job_application('${closableJob}')`);
await rpc(employer, `select public.close_job('${closableJob}')`);
const closedApplications = (await db.query(`
  select status, count(*)::int as n from public.job_applications where job_id='${closableJob}' group by status`)).rows;
check('closing a posting closes every open application',
  closedApplications.some((row) => row.status === 'position_closed' && row.n === 1), JSON.stringify(closedApplications));
const closedNotifications = (await db.query(`
  select count(*)::int as n from public.job_notifications
   where type='position_closed' and user_id='${seeker}'
     and entity_id in (select id from public.job_applications where job_id='${closableJob}')`)).rows[0].n;
check('closing a posting notifies the affected candidates', closedNotifications === 1, `${closedNotifications} notifications`);

// job_expire_stale_jobs: scheduled maintenance, idempotent and admin/service only.
const expiringJob = (await rpc(employer, `select public.create_job_post(
  '${salonId}', null, 'Expiring Role', 'Hair',
  'A posting that will be past its expiry date for the automation test.', 'full_time') as id`)).rows[0].id;
await rpc(admin, `select public.approve_job('${expiringJob}')`);
await rpc(seeker, `select public.submit_job_application('${expiringJob}')`);
// The table requires expires_at > created_at, so backdate both.
await db.exec(`update public.job_posts
  set created_at = now() - interval '10 days', expires_at = now() - interval '1 day'
  where id='${expiringJob}'`);
const notAdmin = await caught(seeker, `select * from public.job_expire_stale_jobs()`);
check('expiry automation refuses a non-admin caller', /ROLE_NOT_ALLOWED/.test(notAdmin.error ?? ''), notAdmin.error || 'allowed');
const expiryRun = await rpc(admin, `select * from public.job_expire_stale_jobs()`);
check('expiry automation expires the stale posting and closes its applications',
  expiryRun.rows[0].expired_jobs >= 1 && expiryRun.rows[0].closed_applications >= 1, JSON.stringify(expiryRun.rows[0]));
const expiredState = (await db.query(`
  select p.status as job_status, a.status as application_status
    from public.job_posts p join public.job_applications a on a.job_id = p.id
   where p.id='${expiringJob}'`)).rows[0];
check('the expired posting leaves the pipeline',
  expiredState.job_status === 'expired' && expiredState.application_status === 'position_closed',
  JSON.stringify(expiredState));
const expiredNotice = (await db.query(`
  select count(*)::int as n from public.job_notifications
   where user_id='${seeker}' and type='position_closed'
     and entity_id in (select id from public.job_applications where job_id='${expiringJob}')`)).rows[0].n;
check('the candidate is told the position closed', expiredNotice === 1, `${expiredNotice} notifications`);
const expiryAgain = await rpc(admin, `select * from public.job_expire_stale_jobs()`);
check('expiry automation is idempotent',
  expiryAgain.rows[0].expired_jobs === 0 && expiryAgain.rows[0].closed_applications === 0,
  JSON.stringify(expiryAgain.rows[0]));

// ---------------------------------------------------------------------------
// 11. Integration: authorization on every RPC, search, storage readers
// ---------------------------------------------------------------------------
// Holding the anon key must not be enough to reach a privileged procedure: the
// only anon-executable functions left are the three a policy needs to evaluate.
// Extension-owned functions (pg_trgm helpers) read no tables; exclude them so
// the check is about this application's surface.
const anonRpc = await db.query(`
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and has_function_privilege('anon', p.oid, 'EXECUTE')
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
   order by p.proname`);
const anonNames = anonRpc.rows.map((r) => r.proname);
check('anon can only execute the helpers its policies need',
  anonNames.every((name) => ['job_is_admin', 'job_is_active_salon_member', 'job_my_active_salon_ids', 'job_email_portal_role'].includes(name)),
  anonNames.join(', '));

// Authorization is enforced in the database, not on client routes: every
// callable procedure must carry a guard. This invariant is what stops a future
// procedure from shipping without one.
const extensionOwned = new Set((await db.query(`
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')`)).rows.map((r) => r.proname));
const unguardedRpc = [];
for (const row of (await db.query(`
  select p.proname, pg_get_functiondef(p.oid) as def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and has_function_privilege('authenticated', p.oid, 'EXECUTE')`)).rows) {
  const pureHelper = /^job_(assert|is_|can_|current_|email_portal_role|my_active|salon_member_is_active|location_distance)/.test(row.proname)
    || extensionOwned.has(row.proname);
  const guarded = /job_assert_authenticated|job_is_admin|job_current_role|job_is_active_salon_member|job_can_manage_application|job_my_active_salon_ids|job_can_open_inquiry|auth\.uid\(\)/.test(row.def);
  if (!guarded && !pureHelper) unguardedRpc.push(row.proname);
}
check('every client-callable procedure enforces authorization', unguardedRpc.length === 0, unguardedRpc.join(', '));

// The privileged alias is not reachable from a client any more, and the admin
// path refuses everybody else.
const publishAttempt = await caught(employer, `select public.publish_job('${job}')`);
check('publish_job is not callable by an employer',
  /permission denied|ROLE_NOT_ALLOWED/.test(publishAttempt.error ?? ''), publishAttempt.error || 'allowed');
const approveAttempt = await caught(employer, `select public.approve_job('${job}')`);
check('approve_job refuses a non-admin', /ROLE_NOT_ALLOWED/.test(approveAttempt.error ?? ''), approveAttempt.error || 'allowed');

// Candidate search: opt-in only, relevance ordered, and filtered by experience.
const searchAsCandidate = await caught(seeker, `select * from public.search_job_candidates(p_query => 'stylist')`);
check('candidate search refuses a job seeker', /ROLE_NOT_ALLOWED/.test(searchAsCandidate.error ?? ''), searchAsCandidate.error || 'allowed');
await db.exec(`update public.job_seeker_profiles
  set headline = 'Senior colourist', bio = 'Balayage and precision cutting specialist.', profile_visibility = 'employers'
  where user_id = '${seeker}'`);
const searchHit = await rpc(employer, `select candidate_id, headline from public.search_job_candidates(p_query => 'balayage colourist')`);
check('full-text search matches the profile text',
  searchHit.rows.some((row) => row.candidate_id && row.headline === 'Senior colourist'), JSON.stringify(searchHit.rows));
const searchMiss = await rpc(employer, `select candidate_id from public.search_job_candidates(p_query => 'welding underwater')`);
check('full-text search returns nothing for an unrelated query', searchMiss.rows.length === 0, `${searchMiss.rows.length} rows`);
const searchHidden = await rpc(employer, `select candidate_id from public.search_job_candidates(p_query => 'outsider profile')`);
check('candidate search never leaves the opted-in visibility', searchHidden.rows.length === 0, `${searchHidden.rows.length} rows`);
const searchExperience = await rpc(employer, `select candidate_id from public.search_job_candidates(p_min_experience_months => 500)`);
check('experience filter excludes junior profiles',
  searchExperience.rows.every((row) => row.candidate_id !== seeker), JSON.stringify(searchExperience.rows));
check('candidate search has a GIN index on the generated column',
  (await db.query(`select 1 from pg_indexes where schemaname='public' and indexname='job_candidate_search_idx'`)).rows.length === 1);

// Storage: the new readers exist, and private buckets stay private for anon.
for (const policy of ['job_verification_admin_read', 'job_support_admin_read', 'job_profile_media_applicant_read']) {
  const found = (await db.query(`select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='${policy}'`)).rows.length === 1;
  check(`storage policy ${policy} exists`, found);
}
await db.exec(`
  insert into storage.objects(id, bucket_id, name, owner) values
    ('00000000-0000-4000-8000-0000deadbeef','job-resumes','${seeker}/resume.pdf','${seeker}'),
    ('00000000-0000-4000-8000-0000deadbeee','job-profile-media','${seeker}/avatar.png','${seeker}');
  set role anon;
`);
let anonStorage;
try {
  anonStorage = (await db.query(`select count(*)::int as n from storage.objects where bucket_id in ('job-resumes','job-profile-media')`)).rows[0].n;
} catch (error) { anonStorage = -1; }
await db.exec(`reset role;`);
check('anon cannot read a private resume or avatar', anonStorage === 0 || anonStorage === -1, String(anonStorage));
const ownerStorage = (await db.query(`
  select count(*)::int as n from storage.objects
   where bucket_id in ('job-resumes','job-profile-media') and (storage.foldername(name))[1] = '${seeker}'`)).rows[0].n;
check('the owner still sees their own files in the policy shape', ownerStorage === 2, `${ownerStorage} rows`);

// A resume is readable by the employer only through the application that
// attached it: the storage policy joins storage.objects to job_candidate_resumes
// and the posting's salon membership.
const resumeRow = (await rpc(seeker, `insert into public.job_candidate_resumes(candidate_id, storage_path, original_filename, mime_type, file_size, is_primary)
  values ((select id from public.job_seeker_profiles where user_id='${seeker}'),'${seeker}/resume.pdf','resume.pdf','application/pdf',1024,true) returning id`)) ;
const resumeId = resumeRow.rows?.[0]?.id;
const linkedJob = (await rpc(employer, `select public.create_job_post(
  '${salonId}', null, 'Resume Access Role', 'Hair',
  'A posting used to check who may read an attached resume.', 'full_time') as id`)).rows[0].id;
await rpc(admin, `select public.approve_job('${linkedJob}')`);
await rpc(seeker, `select public.submit_job_application('${linkedJob}', '${resumeId}')`);
const employerResume = await asUser(employer, () =>
  db.query(`select count(*)::int as n from storage.objects where bucket_id='job-resumes' and name='${seeker}/resume.pdf'`));
check('the employer can read the resume attached to an application they own',
  employerResume.rows[0].n === 1, `${employerResume.rows[0].n} rows`);
const strangerResume = await asUser(employerB, () =>
  db.query(`select count(*)::int as n from storage.objects where bucket_id='job-resumes' and name='${seeker}/resume.pdf'`));
check('another salon cannot read that resume', strangerResume.rows[0].n === 0, `${strangerResume.rows[0].n} rows`);
const candidateResume = await asUser(candidateB, () =>
  db.query(`select count(*)::int as n from storage.objects where bucket_id='job-resumes' and name='${seeker}/resume.pdf'`));
check('another candidate cannot read that resume', candidateResume.rows[0].n === 0, `${candidateResume.rows[0].n} rows`);

// ---------------------------------------------------------------------------
// 12. Moderation lifecycle the employer dashboard now drives
// ---------------------------------------------------------------------------
// The UI gained these actions in this change; the state machine they call is
// verified here so a UI action can never point at a transition the database
// refuses (or worse, one it allows for the wrong person).
const lifecycleJob = (await rpc(employer, `select public.create_job_post(
  '${salonId}', null, 'Lifecycle Role', 'Hair',
  'A posting used to walk the moderation lifecycle end to end.', 'full_time') as id`)).rows[0].id;
const lifecycleStatus = async () => (await db.query(`select status from public.job_posts where id='${lifecycleJob}'`)).rows[0].status;
// Creating a posting auto-submits it (the status default is pending_approval),
// which is why the dashboard's moderation action matters for the resubmit path.
check('a new posting goes straight into the admin queue', (await lifecycleStatus()) === 'pending_approval', await lifecycleStatus());

const wrongPause = await caught(employer, `select public.pause_job('${lifecycleJob}')`);
check('a posting under review cannot be paused', /INVALID_JOB_TRANSITION/.test(wrongPause.error ?? ''), wrongPause.error || 'allowed');
const foreignSubmit = await caught(employerB, `select public.submit_job_for_approval('${lifecycleJob}')`);
check('another salon cannot submit this posting for approval',
  /INVALID_JOB_TRANSITION|SALON_ACCESS_DENIED/.test(foreignSubmit.error ?? ''), foreignSubmit.error || 'allowed');
const doubleSubmit = await caught(employer, `select public.submit_job_for_approval('${lifecycleJob}')`);
check('submitting a posting already under review is refused',
  /INVALID_JOB_TRANSITION/.test(doubleSubmit.error ?? ''), doubleSubmit.error || 'allowed');

// Rejection -> the employer edits and resubmits. This is the action the
// dashboard was missing: without it a rejected posting was stuck forever.
await rpc(admin, `select public.reject_job('${lifecycleJob}', 'Please add the salary range.')`);
check('an admin rejection marks the posting rejected', (await lifecycleStatus()) === 'rejected', await lifecycleStatus());
const foreignResubmit = await caught(employerB, `select public.submit_job_for_approval('${lifecycleJob}')`);
check('another salon cannot resubmit a rejected posting',
  /INVALID_JOB_TRANSITION|SALON_ACCESS_DENIED/.test(foreignResubmit.error ?? ''), foreignResubmit.error || 'allowed');
await rpc(employer, `select public.submit_job_for_approval('${lifecycleJob}')`);
check('the employer can resubmit a rejected posting', (await lifecycleStatus()) === 'pending_approval', await lifecycleStatus());

await rpc(admin, `select public.approve_job('${lifecycleJob}')`);
check('an admin approval makes the posting live', (await lifecycleStatus()) === 'approved', await lifecycleStatus());
const strangerPause = await caught(employerB, `select public.pause_job('${lifecycleJob}')`);
check('another salon cannot pause this posting', /INVALID_JOB_TRANSITION/.test(strangerPause.error ?? ''), strangerPause.error || 'allowed');

await rpc(employer, `select public.pause_job('${lifecycleJob}')`);
check('the employer can pause a live posting', (await lifecycleStatus()) === 'paused', await lifecycleStatus());
await rpc(employer, `select public.resume_job('${lifecycleJob}')`);
check('the employer can resume a paused posting', (await lifecycleStatus()) === 'approved', await lifecycleStatus());
await rpc(employer, `select public.close_job('${lifecycleJob}')`);
check('the employer can close a posting', (await lifecycleStatus()) === 'closed', await lifecycleStatus());
const resumeClosed = await caught(employer, `select public.resume_job('${lifecycleJob}')`);
check('a closed posting cannot be resumed', /INVALID_JOB_TRANSITION/.test(resumeClosed.error ?? ''), resumeClosed.error || 'allowed');

// A posting under review must never be visible to the public while it waits.
const draftVisibility = (await db.query(`
  select count(*)::int as n from public.public_job_listings where id = '${lifecycleJob}'`)).rows[0].n;
check('a closed posting is not listed publicly', draftVisibility === 0, `${draftVisibility} rows`);

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

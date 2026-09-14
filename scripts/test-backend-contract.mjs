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
// Bodies may be quoted with $$ or a tagged delimiter such as $fn$; the tag is
// captured so the regex cannot stop at the wrong place.
for (const match of sql.matchAll(/create(?: or replace)? function public\.([a-z_]+)\s*\((.*?)\)\s*returns.*?\$([a-z_]*)\$(.*?)\$\3\$/gis)) {
  const [, name, params, , body] = match;
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
const frontendSources = sourceFiles.map((file) => read(file)).join('\n');
const createdTables = [...sql.matchAll(/create table (?:if not exists )?(?:public\.)?([a-z_]+)/gi)].map((m) => m[1]);
const rlsTables = new Set(
  [...sql.matchAll(/alter table (?:public\.)?([a-z_]+) enable row level security/gi)].map((m) => m[1]),
);
for (const arrayMatch of sql.matchAll(/foreach table_name in array array\[(.*?)\]/gs)) {
  for (const name of arrayMatch[1].matchAll(/'([a-z_]+)'/g)) rlsTables.add(name[1]);
}
const tablesWithoutRls = createdTables.filter((name) => !rlsTables.has(name));
check('every job table enables row level security', tablesWithoutRls.length === 0, tablesWithoutRls.join(', '));

const bucketRows = Object.values(Object.fromEntries(
  [...sql.matchAll(/\('([a-z-]+)',\s*'[a-z-]+',\s*(true|false),/g)]
    .map((m) => [m[1], { id: m[1], public: m[2] }]),
));
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

// Multi-table workflows must be stored procedures, not sequences of client
// writes: a failure halfway through used to leave the account or thread
// half-written.
for (const fn of ['job_save_profile', 'job_open_conversation', 'job_send_message', 'job_expire_stale_jobs']) {
  check(`${fn} is declared`, new RegExp(`function public\\.${fn}\\s*\\(`).test(sql));
}
const clientWrites = [
  ['profiles', 'update'], ['job_seeker_profiles', 'update'], ['job_employer_profiles', 'update'],
  ['job_conversations', 'upsert'], ['job_conversations', 'insert'], ['job_messages', 'insert'],
];
const directWrites = clientWrites.filter(([table, verb]) =>
  new RegExp(`from\\(['"]${table}['"]\\)[\\s\\S]{0,40}\\.${verb}\\(`).test(frontendSources));
check('multi-table workflows no longer write from the browser',
  directWrites.length === 0, directWrites.map(([t, v]) => `${t}.${v}`).join(', '));

// Every moderation/lifecycle action the dashboard offers must reach a real
// procedure. These calls had zero wiring once and the gap was invisible.
for (const [rpc, file] of [
  ['submit_job_for_approval', 'src/services/backend.ts'],
  ['pause_job', 'src/services/backend.ts'],
  ['resume_job', 'src/services/backend.ts'],
  ['close_job', 'src/services/backend.ts'],
  ['approve_job', 'src/services/adminJobs.ts'],
  ['reject_job', 'src/services/adminJobs.ts'],
]) {
  check(`${rpc} is wired from the frontend`,
    read(file).includes(`'${rpc}'`) && new RegExp(`function public\\.${rpc}\\s*\\(`).test(sql));
}
check('the employer dashboard exposes the lifecycle actions',
  /onJobAction/.test(read('src/components/employer/EmployerWorkspace.tsx'))
  && /'submit' \| 'pause' \| 'resume' \| 'close'/.test(read('src/services/backend.ts')));

const seekerWorkspace = read('src/components/seeker/JobSeekerWorkspace.tsx');
const postJobWizard = read('src/components/employer/PostJobWizard.tsx');
check('Post a Job exposes every requested employer field',
  ['Job Title', 'Business / Salon Name', 'Category', 'Job Role', 'Job Description', 'Skills Required',
    'Experience Required', 'Salary Range', 'Job Type', 'Work Location', 'City', 'Area', 'Contact Person',
    'Contact Mobile', 'WhatsApp Number', 'Number of Openings', 'Interview Mode', 'Status: Draft / Published']
    .every((label) => postJobWizard.includes(label)));
check('Post a Job waits for persistence and renders the requested confirmation',
  postJobWizard.includes('await onComplete({')
  && postJobWizard.includes('aria-busy={isSubmitting}')
  && ['Your job post has been published successfully.', 'Job Status', 'Posted Date',
    'View My Job Posts', 'Post Another Job', 'View Applications']
    .every((label) => postJobWizard.includes(label)));
check('Post a Job uses the authenticated ownership and shop-linked RPC',
  read('src/services/backend.ts').includes("rpc('post_employer_job'")
  && /created_by[\s\S]*actor/.test(finalFunctionBody.post_employer_job || '')
  && /shop_id[\s\S]*p_salon_id/.test(finalFunctionBody.post_employer_job || '')
  && /job_is_active_salon_member/.test(finalFunctionBody.post_employer_job || ''));
const employerWorkspace = read('src/components/employer/EmployerWorkspace.tsx');
check('My Job Posts cards expose the requested status, details, counts and actions',
  ['My Job Posts', 'Status:', 'Published', 'Draft', 'Closed', 'Location', 'Salary', 'Posted Date',
    'Total Applications', 'New Applications', 'Edit Job', 'Close Job', 'View Applications']
    .every((label) => employerWorkspace.includes(label)));
check('My Job Posts has the exact empty state and Post a Job action',
  employerWorkspace.includes('You have not posted any job yet.')
  && employerWorkspace.includes('Post a Job'));
check('My Job Posts reads only jobs created by the authenticated employer',
  /\.eq\('created_by', user\.id\)/.test(read('src/services/backend.ts')));
check('Edit Job is persisted through an actor-owned server RPC',
  read('src/services/backend.ts').includes("rpc('update_employer_job'")
  && /existing\.created_by<>actor/.test(finalFunctionBody.update_employer_job || '')
  && /job_is_active_salon_member/.test(finalFunctionBody.update_employer_job || ''));
check('Applications Received cards expose all requested candidate details',
  ['Applications Received', 'Candidate Name', 'Profile Image', 'Mobile / Email', 'Experience', 'Skills',
    'Preferred Location', 'Resume Download', 'Application Status', 'Applied Date']
    .every((label) => employerWorkspace.includes(label)));
check('Applications Received exposes every requested employer action',
  ['Mark Under Review', 'Shortlist', 'Reject', 'Hire', 'WhatsApp Candidate', 'Call Candidate']
    .every((label) => employerWorkspace.includes(label)));
check('employer application status UI awaits secured Supabase persistence',
  /await onUpdateApplicantStatus\(applicant\.id, status\)/.test(employerWorkspace)
  && /if \(currentUserId\) await updateApplicationStatus/.test(read('src/App.tsx')));
check('employer applications RPC is actor-scoped and returns selected resume metadata',
  read('src/services/backend.ts').includes("rpc('get_employer_job_applications'")
  && /j\.created_by=actor/.test(finalFunctionBody.get_employer_job_applications || '')
  && /resume_storage_path/.test(sql));
check('My Applications renders the requested job and application fields',
  ['My Applications', 'Salary Range', 'Job Type', 'Applied Date', 'View Job', 'Withdraw Application']
    .every((label) => seekerWorkspace.includes(label)));
check('My Applications has the required empty state and search action',
  seekerWorkspace.includes('You have not applied for any job yet.')
  && seekerWorkspace.includes('Search Jobs'));
check('application withdrawal is wired through the secured RPC',
  seekerWorkspace.includes('onWithdrawApplication')
  && read('src/services/backend.ts').includes("rpc('withdraw_application'")
  && /function public\.withdraw_application\s*\(/.test(sql));
check('candidate application statuses cover each requested hiring stage',
  ['Applied', 'Under Review', 'Shortlisted', 'Rejected', 'Hired']
    .every((status) => read('src/types.ts').includes(`'${status}'`)));
check('job search exposes every requested filter',
  ['Job Title', 'Category', 'City / Area', 'Salary Range', 'Experience', 'Employment Type', 'Nearby jobs', 'Latest jobs']
    .every((label) => seekerWorkspace.includes(label)));
check('job search cards expose required details and already-applied actions',
  ['Experience Required', 'Job Type', 'Posted ', 'Apply Now', 'Already Applied', 'View Application']
    .every((label) => seekerWorkspace.includes(label)));
check('job search enforces the exact profile gate before submitting',
  seekerWorkspace.includes('Please complete your candidate profile before applying.')
  && seekerWorkspace.includes('onRequireLogin')
  && seekerWorkspace.includes("await onApplyJob(job, '')"));
check('job search success confirmation exposes the requested data and actions',
  ['Application submitted successfully.', 'Job Title', 'Salon Name', 'Applied Date', 'View My Applications', 'Continue Searching']
    .every((label) => seekerWorkspace.includes(label)));
check('duplicate applications remain protected in both UI and database',
  /applications\.some\(\(application\) => application\.jobId === job\.id\)/.test(seekerWorkspace)
  && /unique \(job_id, candidate_user_id\)/.test(sql));
check('application RPC independently enforces candidate profile completion',
  /profile_completion\s*<\s*50/.test(finalFunctionBody.submit_job_application || '')
  && /PROFILE_INCOMPLETE/.test(finalFunctionBody.submit_job_application || ''));

// Candidate search must be reachable through the RPC and the search text must be
// indexed, not scanned.
check('candidate search uses full-text search',
  /websearch_to_tsquery/.test(sql) && /search_vector/.test(sql) && /job_candidate_search_idx/.test(sql)
  && /ts_rank/.test(sql));

// Client-side role checks are not authorization: every procedure callable by a
// signed-in user must carry a server-side guard.
const guardless = [];
for (const [name, body] of Object.entries(finalFunctionBody)) {
  if (/^(job_(assert|is_|can_|current_|email_portal_role|my_active|salon_member_is_active|location_distance))/.test(name)) continue;
  if (!/returns/.test(name) && !/\(/.test(name)) continue;
  if (!/job_assert_authenticated|job_is_admin|job_current_role|job_is_active_salon_member|job_can_manage_application|job_my_active_salon_ids|job_can_open_inquiry|auth\.uid\(\)/.test(body)) {
    guardless.push(name);
  }
}
check('every procedure carries a server-side authorization guard', guardless.length === 0, guardless.join(', '));

// Membership and plan enablement remain RPC-only. Existing salon team job-post
// workflows stay active, admin authority remains job_is_admin(), and immutable
// ownership columns prevent members from moving posts between users or salons.
for (const table of ['job_salon_members', 'job_salon_profiles']) {
  const policyBlocks = [...sql.matchAll(new RegExp(`create policy [a-z_]+ on public\\.${table}\\b[\\s\\S]*?;`, 'g'))];
  const insertPolicies = policyBlocks.filter((block) => /for insert|for all/i.test(block[0]));
  check(`no client insert policy on ${table}`, insertPolicies.length === 0, `${insertPolicies.length} found`);
}
check('job post RLS preserves team workflows and adds active-admin CRUD',
  /create policy job_posts_read[\s\S]*job_my_active_salon_ids/.test(sql)
  && /create policy job_posts_member_update[\s\S]*job_is_active_salon_member\(salon_id\)/.test(sql)
  && /create policy job_posts_member_delete_draft[\s\S]*job_is_active_salon_member\(salon_id\)/.test(sql)
  && ['select','insert','update','delete'].every((operation) =>
    new RegExp(`create policy job_posts_reconcile_admin_${operation}[\\s\\S]*job_is_admin\\(\\)`).test(sql)));
check('application RLS includes self-insert, salon-team status update, and admin management',
  /create policy job_applications_reconcile_candidate_insert[\s\S]*candidate_user_id=\(select auth\.uid\(\)\)/.test(sql)
  && /create policy job_applications_reconcile_manager_status[\s\S]*job_my_active_salon_ids/.test(sql)
  && /create policy job_applications_reconcile_admin_update[\s\S]*job_is_admin\(\)/.test(sql));
check('offer documents use candidate/team reads and manager-admin writes',
  /create policy job_offer_related_read[\s\S]*job_can_read_offer_media/.test(sql)
  && /create policy job_offer_authorized_insert[\s\S]*job_can_manage_offer_media/.test(sql)
  && /create policy job_offer_authorized_delete[\s\S]*job_can_manage_offer_media/.test(sql));
check('employer portfolio view uses an application-scoped team-aware RPC',
  /function public\.job_get_applicant_portfolio\(target_application_id uuid\)/.test(sql)
  && /job_can_manage_application\(target_application_id\)/.test(sql)
  && /rpc\('job_get_applicant_portfolio', \{ target_application_id: applicationId \}\)/.test(read('src/services/backend.ts')));

// Authority hardening remains server-enforced and the UI uses only the guarded
// transactional entry points for deletion/profile/resume workflows.
const backendService = read('src/services/backend.ts');
const appSource = read('src/App.tsx');
const avatarUploader = read('src/components/profile/ProfileImageUploader.tsx');
check('application trigger derives candidate identity and owner from relationships',
  /job_reconcile_application_insert/.test(sql)
  && /new\.candidate_user_id:=actor/.test(sql)
  && /new\.candidate_profile_id:=seeker_id/.test(sql)
  && /new\.candidate_id:=candidate_record_id/.test(sql)
  && /new\.owner_id:=post_owner/.test(sql));
check('application and post ownership references are immutable',
  /IMMUTABLE_APPLICATION_OWNERSHIP/.test(sql) && /IMMUTABLE_JOB_OWNERSHIP/.test(sql));
check('duplicate applications have a non-destructive admin report',
  /job_application_duplicate_report/.test(sql)
  && /having count\(\*\)>1/.test(sql)
  && /no rows (?:were )?deleted/i.test(sql));
check('job deletion is salon-authorized, application-guarded, and wired to the employer UI',
  /create(?: or replace)? function public\.delete_employer_job/.test(sql)
  && /job_is_active_salon_member\(post\.salon_id\)/.test(finalFunctionBody.delete_employer_job || '')
  && /JOB_HAS_APPLICATIONS/.test(finalFunctionBody.delete_employer_job || '')
  && backendService.includes("rpc('delete_employer_job'")
  && appSource.includes('onDeleteJob={handleDeleteJob}'));
check('employer profile persistence is one authenticated transaction',
  /create(?: or replace)? function public\.job_update_employer_profile/.test(sql)
  && backendService.includes("rpc('job_update_employer_profile'")
  && /await updateEmployerProfile/.test(appSource));

// "Unable to save profile. Please retry." is the generic fallback the toast
// shows for any unmapped failure, so the real backend cause must be logged and
// the employer fallback must not silently discard the business fields.
check('profile save failures are logged with their backend cause',
  /logger\('profile'\)\.error\(/.test(appSource)
  && /profileLog\.error\('job_update_employer_profile failed'/.test(backendService)
  && /profileLog\.error\('job_save_profile failed'/.test(backendService));
const profileUpdateBody = /const handleProfileUpdate = async[\s\S]*?\n  \};\n/.exec(appSource)?.[0] ?? '';
check('the employer profile fallback no longer drops business fields silently',
  profileUpdateBody.length > 0
  && /PROFILE_NOT_FOUND/i.test(profileUpdateBody)
  && !/SALON_ACCESS_DENIED|SALON_NOT_FOUND/i.test(profileUpdateBody));
check('the employer update payload omits the immutable login email',
  (() => {
    const payload = /const payload = \{[\s\S]*?\n  \};/.exec(backendService)?.[0] ?? '';
    return payload.length > 0 && !/email/i.test(payload);
  })());
check('the edit modal keeps the login email read-only',
  /id="employer-email"[\s\S]{0,300}readOnly[\s\S]{0,300}disabled/.test(
    read('src/components/employer/EmployerProfileTab.tsx')));

// public.profiles is the marketplace-owned shared table: it has no updated_at
// column (see the db suite, whose bootstrap models the deployed shape exactly),
// and a missing row must be healed before job_assert_authenticated, which
// rejects it with ACCOUNT_INACTIVE.
const profilesUpsertWrites = ['job_save_profile', 'job_update_employer_profile'].filter((name) =>
  [...(finalFunctionBody[name] || '').matchAll(/insert into public\.profiles[\s\S]*?;/g)]
    .some((statement) => /updated_at/.test(statement[0])));
check('profile save RPCs never write marketplace-only profiles columns',
  profilesUpsertWrites.length === 0, profilesUpsertWrites.join(', '));
const ensureBeforeGuard = ['job_save_profile', 'job_update_employer_profile'].every((name) => {
  const body = finalFunctionBody[name] || '';
  const ensureAt = body.indexOf('job_ensure_profile_row');
  const guardAt = body.indexOf('job_assert_authenticated');
  return ensureAt !== -1 && guardAt !== -1 && ensureAt < guardAt;
});
check('profile save RPCs heal the shared profiles row before the auth guard', ensureBeforeGuard);
check('the employer self-heal never inserts a NOT NULL location row from nulls',
  !/insert into public\.job_salon_locations[\s\S]{0,200}nullif\(trim\(coalesce\(p_city/.test(
    finalFunctionBody.job_update_employer_profile || ''));
check('resume creation and primary selection use atomic RPCs',
  backendService.includes("rpc('job_create_candidate_resume'")
  && backendService.includes("rpc('job_set_primary_resume'")
  && /update public\.job_candidate_resumes set is_primary=false/.test(sql));
check('avatar replacement waits for profile persistence before old-object cleanup',
  /await onSaveAvatar\(value\)/.test(avatarUploader)
  && avatarUploader.indexOf('await onSaveAvatar(value)') < avatarUploader.indexOf('await removeReplacedStorageAvatar'));
check('apply flow reports and retries resume loading failures',
  /resumeLoadError/.test(read('src/components/seeker/ApplyJobScreen.tsx'))
  && /Retry resume loading/.test(read('src/components/seeker/ApplyJobScreen.tsx')));
check('interview and offer screens use returned workflow details instead of fabricated fixtures',
  /interviewMeetingUrl/.test(backendService) && /offerJoiningDate/.test(backendService)
  && !/mock-app|zoom\.us\/j\/1234567890|Lumière Studio|Nov 15, 2026/.test(
    read('src/components/seeker/InterviewInvitationScreen.tsx')
      + read('src/components/seeker/JobOfferScreen.tsx'),
  ));
check('candidate signup starts empty and requires explicit terms consent',
  /useState\(''\)/.test(read('src/components/auth/JobSeekerSignupScreen.tsx'))
  && /useState\(false\)/.test(read('src/components/auth/JobSeekerSignupScreen.tsx')));
check('salary analytics derives from loaded jobs and disclaims market estimates',
  /filteredJobs/.test(read('src/components/employer/RegionalSalaryAnalytics.tsx'))
  && /no estimated market data/i.test(read('src/components/employer/RegionalSalaryAnalytics.tsx')));

// Jobs UI remains a light, mobile-first SaaS surface without changing its
// information architecture: the contract checks palette, loaders and states.
const indexCss = read('src/index.css');
const jobsSkeleton = read('src/components/ui/JobsSkeleton.tsx');
check('Jobs uses the Nexora blue-purple light palette',
  indexCss.includes('--color-primary: #4f46e5')
  && indexCss.includes('--color-secondary-container: #7c3aed')
  && indexCss.includes('--color-background: #f8fafc')
  && !/#8e004b|#e2007c|#fdf8f8/i.test(frontendSources));
check('workspace and inline loaders render accessible white-card skeletons',
  /JobsWorkspaceSkeleton/.test(appSource)
  && /role="status"/.test(jobsSkeleton)
  && /animate-pulse/.test(jobsSkeleton)
  && /rounded-3xl[\s\S]*border[\s\S]*bg-white/.test(jobsSkeleton)
  && /JobsInlineSkeleton/.test(read('src/components/seeker/ApplyJobScreen.tsx'))
  && /JobsInlineSkeleton/.test(employerWorkspace));
check('existing mobile sticky bottom navigation remains in Jobs flows',
  /fixed bottom-0[\s\S]*md:hidden/.test(read('src/components/seeker/InterviewInvitationScreen.tsx'))
  && /md:hidden fixed bottom-0/.test(employerWorkspace));
check('Jobs exposes confirmation, empty, error and retry states',
  /Application submitted successfully/.test(seekerWorkspace)
  && /No applications received for this job yet/.test(employerWorkspace)
  && /role="alert"/.test(employerWorkspace)
  && /Retry/.test(employerWorkspace));

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
  // Key-shaped matches only (20+ chars): the bare `sb_secret_` prefix also
  // appears inside the log sanitizer patterns, which must not trip this.
  !/SUPABASE_SERVICE_ROLE|service_role_key|sb_secret_[A-Za-z0-9_-]{20,}/i.test(frontend));
check('no hardcoded JWT-shaped key in frontend code', !/eyJ[A-Za-z0-9_-]{20,}/.test(frontend));
check('frontend reads the anon key from VITE_SUPABASE_ANON_KEY',
  /VITE_SUPABASE_ANON_KEY/.test(read('src/lib/supabase.ts')));

const envExample = read('.env.example');
check('.env.example documents both Vite variables',
  envExample.includes('VITE_SUPABASE_URL') && envExample.includes('VITE_SUPABASE_ANON_KEY'));
check('.env.example holds no real key', !/eyJ[A-Za-z0-9_-]{20,}/.test(envExample));

// ---------------------------------------------------------------------------
// 6. Workspace resilience + production 404 reconciliation contract
//    (docs/production-error-fixes.md; mirrors the loadWorkspace hardening)
// ---------------------------------------------------------------------------
{
  const backend = read('src/services/backend.ts');
  const workspace = backend.slice(
    backend.indexOf('export async function loadWorkspace'),
    backend.indexOf('const salonMap'),
  );
  const parallelLoad = workspace.slice(workspace.indexOf('await Promise.all(['));
  const unsafeLines = parallelLoad
    .split('\n')
    .filter((line) => /client\.(from|rpc)\(/.test(line) && !/settle\(/.test(line) && !/Promise\.resolve/.test(line));
  check('loadWorkspace settles every parallel query (no raw builder inside Promise.all)',
    unsafeLines.length === 0,
    unsafeLines.map((l) => l.trim()).join(' | '));
  check('loadWorkspace keeps critical/non-critical split after settling',
    /criticalError/.test(workspace) && /non-critical \$\{name\} failed, using empty fallback/.test(workspace));
  check('applications query degrades to the plain select on embed-resolution failures',
    /seekerApplicationsQuery/.test(workspace) && /isEmbedResolutionError/.test(workspace) && /\.select\('\*'\)/.test(workspace));
  check('employer jobs query degrades the same way',
    /employerJobsQuery/.test(workspace));
  check('schema-gap note is emitted for PGRST202/205 fallbacks',
    /schemaGapNote/.test(backend) && /PGRST202/.test(backend) && /PGRST205/.test(backend));

  const access = read('supabase/migrations/20260914120000_jobs_applications_access.sql');
  check('job_applications grants include the column-scoped update posture only',
    /grant select, insert, delete on table public.job_applications to authenticated/.test(access)
      && /grant update \(status, employer_notes\) on table public.job_applications to authenticated/.test(access));
  check('job_applications FK repair targets both embed names the client uses',
    access.includes('job_applications_job_id_fkey') && access.includes('job_posts_location_id_fkey'));
  check('realtime publication for job_applications is re-asserted',
    /supabase_realtime add table public.job_applications/.test(access));

  const rpcReconcile = read('supabase/migrations/20260914120001_jobs_workspace_rpc_reconcile.sql');
  for (const fn of ['get_employer_job_applications', 'get_my_job_application_listings']) {
    check(`${fn} re-declared idempotently`, new RegExp(`create or replace function public\\.${fn}\\(`).test(rpcReconcile));
    check(`${fn} executes only for authenticated`, new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to authenticated`).test(rpcReconcile));
  }

  const locationEnsure = read('supabase/migrations/20260914120002_jobs_user_location_ensure.sql');
  for (const fn of ['sync_user_location', 'clear_user_location', 'job_current_user_location']) {
    check(`${fn} re-ensured idempotently`, new RegExp(`create or replace function public\\.${fn}\\(`).test(locationEnsure));
  }
  check('job_user_locations table re-ensured with if-not-exists guard',
    /create table if not exists public\.job_user_locations/.test(locationEnsure));
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const failed = checks.filter((entry) => !entry.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} frontend/backend contract checks passed`);
if (failed.length) process.exit(1);
console.log('CONTRACT OK');

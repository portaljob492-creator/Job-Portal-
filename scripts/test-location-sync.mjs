/**
 * Nexora auth + location synchronization checks.
 *
 * Runs offline with no credentials: it executes the real modules (auth client
 * options, routing alias, session-invalid classification and the location sync
 * engine) against injected fakes, plus repository-wide security invariants.
 *
 *   npm run test:location
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildAuthClientOptions,
  supabaseStorageKey,
  projectRefFromUrl,
  NEXORA_SUPABASE_URL,
} from '../src/lib/supabase.ts';
import { pathForScreen, resolveJobPortalRoute, loginPath } from '../src/routing.ts';
import { isSessionInvalidError } from '../src/lib/authErrors.ts';
import { clearSessionBeforeSignUp } from '../src/lib/authSession.ts';
import { createLocationSyncEngine, distanceMeters } from '../src/services/locationSync.ts';
import { isEmailNotConfirmedError, resolveSignUpResult } from '../src/lib/signUpOutcome.ts';
import {
  isActionableAuthScreenError,
  isPasswordSignInBlockedError,
  PasswordSignInBlockedError,
  PortalRoleMismatchError,
} from '../src/lib/authErrors.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];

function assertCheck(name, condition, detail) {
  if (!condition) {
    throw new Error(`FAILED: ${name}${detail ? ` (${detail})` : ''}`);
  }
  checks.push(name);
}

const tick = async () => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

function createFakeGeolocation() {
  const watchers = [];
  let nextId = 1;
  return {
    watchers,
    watchPosition(success, error) {
      const entry = { id: nextId, success, error, cleared: false };
      nextId += 1;
      watchers.push(entry);
      return entry.id;
    },
    clearWatch(watchId) {
      const entry = watchers.find((item) => item.id === watchId);
      if (entry) entry.cleared = true;
    },
    getCurrentPosition(success) {
      success({ coords: { latitude: 19.076, longitude: 72.8777, accuracy: 12 } });
    },
    activeWatchers() {
      return watchers.filter((entry) => !entry.cleared);
    },
  };
}

function createFakeClient(responder) {
  const calls = [];
  return {
    calls,
    async rpc(fn, args) {
      calls.push({ fn, args });
      return responder ? responder(fn, args) : { data: true, error: null };
    },
  };
}

const position = (latitude, longitude, accuracy = 25) => ({
  coords: { latitude, longitude, accuracy },
});

// ---------------------------------------------------------------------------
// 1. Shared client + PKCE configuration
// ---------------------------------------------------------------------------

const authOptions = buildAuthClientOptions();
assertCheck('single shared client PKCE flow', authOptions.flowType === 'pkce');
assertCheck('persistSession enabled', authOptions.persistSession === true);
assertCheck('autoRefreshToken enabled', authOptions.autoRefreshToken === true);
assertCheck('detectSessionInUrl enabled', authOptions.detectSessionInUrl === true);
assertCheck('universal Nexora storage key', authOptions.storageKey === 'nexora.auth.qwaehqsmodekbgvnaavz', authOptions.storageKey);
assertCheck('storage key derived from project ref', supabaseStorageKey === `nexora.auth.${projectRefFromUrl(NEXORA_SUPABASE_URL)}`);
assertCheck('canonical project url', NEXORA_SUPABASE_URL === 'https://qwaehqsmodekbgvnaavz.supabase.co');
assertCheck('storage key override honoured', buildAuthClientOptions('custom.key').storageKey === 'custom.key');

// ---------------------------------------------------------------------------
// 2. Auth routing (login redirect target + universal alias)
// ---------------------------------------------------------------------------

assertCheck('login route resolves', resolveJobPortalRoute(loginPath()).screen === 'login');
assertCheck('universal /auth/login alias resolves to login', resolveJobPortalRoute('/auth/login').screen === 'login');
assertCheck('/auth/login is not a protected route', resolveJobPortalRoute('/auth/login').protected === false);
assertCheck('protected route still protected', resolveJobPortalRoute('/dashboard/seeker').protected === true);
assertCheck('/jobs/profile opens the candidate profile', resolveJobPortalRoute('/jobs/profile').seekerTab === 'profile');
assertCheck('/jobs/search opens protected candidate job search', resolveJobPortalRoute('/jobs/search').seekerTab === 'feed' && resolveJobPortalRoute('/jobs/search').protected === true && resolveJobPortalRoute('/jobs/search').requiredRole === 'seeker');
assertCheck('/jobs/applications alias opens submitted applications', resolveJobPortalRoute('/jobs/applications').seekerTab === 'applications');
assertCheck('/jobs/my-applications opens submitted applications', resolveJobPortalRoute('/jobs/my-applications').seekerTab === 'applications');
assertCheck('My Applications uses its canonical URL', pathForScreen('main_app', 'seeker', 'applications') === '/jobs/my-applications');
assertCheck('/jobs/post-a-job opens the employer wizard', resolveJobPortalRoute('/jobs/post-a-job').requiredRole === 'employer' && resolveJobPortalRoute('/jobs/post-a-job').openPostJob === true);
assertCheck('/jobs/posted-jobs opens employer jobs', resolveJobPortalRoute('/jobs/posted-jobs').employerTab === 'jobs');
assertCheck('/jobs/my-posts opens employer jobs', resolveJobPortalRoute('/jobs/my-posts').employerTab === 'jobs');
assertCheck('My Job Posts uses its canonical URL', pathForScreen('main_app', 'employer', undefined, 'jobs') === '/jobs/my-posts');
const employerJobApplicationsRoute = resolveJobPortalRoute('/jobs/applications/job-123');
assertCheck('/jobs/applications/:jobId opens employer applications', employerJobApplicationsRoute.requiredRole === 'employer'
  && employerJobApplicationsRoute.employerTab === 'candidates' && employerJobApplicationsRoute.employerJobId === 'job-123');
assertCheck('job applications uses its canonical employer URL',
  pathForScreen('main_app', 'employer', undefined, 'candidates', false, 'job-123') === '/jobs/applications/job-123');
assertCheck('/jobs/employer-applications opens employer candidates', resolveJobPortalRoute('/jobs/employer-applications').requiredRole === 'employer' && resolveJobPortalRoute('/jobs/employer-applications').employerTab === 'candidates');

// ---------------------------------------------------------------------------
// 3. Session validity classification
// ---------------------------------------------------------------------------

const invalidSamples = [
  Object.assign(new Error('Auth session missing!'), { name: 'AuthSessionMissingError' }),
  new Error('Session not found'),
  new Error('Invalid login credentials'),
  new Error('Invalid Refresh Token: Refresh Token Not Found'),
  new Error('Token has expired'),
  { code: '28000', message: 'AUTH_REQUIRED' },
  { code: 'PGRST301', message: 'JWT expired' },
  { code: 'user_not_found', message: 'User not found' },
  { status: 403, message: 'User from sub claim in JWT does not exist' },
  { status: 401, message: 'invalid token' },
];
const validSamples = [
  new Error('Failed to fetch'),
  new Error('new row violates row-level security policy'),
  new Error('Email not confirmed'),
  { status: 500, message: 'internal server error' },
  null,
];
assertCheck('invalid sessions detected', invalidSamples.every((error) => isSessionInvalidError(error)));
assertCheck('recoverable failures kept', validSamples.every((error) => !isSessionInvalidError(error)));

// A stale JWT must be removed locally before the anonymous role lookup used by
// sign-up. This reproduces the deleted-user case without a network or real token.
{
  const signOutCalls = [];
  const staleClient = {
    auth: {
      async getSession() {
        return { data: { session: { access_token: 'stale-jwt' } }, error: null };
      },
      async signOut(options) {
        signOutCalls.push(options);
        return { error: null };
      },
    },
  };
  assertCheck('stored session cleared before signup', await clearSessionBeforeSignUp(staleClient) === true);
  assertCheck(
    'signup cleanup is local only',
    signOutCalls.length === 1 && signOutCalls[0]?.scope === 'local',
  );

  const anonymousCalls = [];
  const anonymousClient = {
    auth: {
      async getSession() {
        return { data: { session: null }, error: null };
      },
      async signOut(options) {
        anonymousCalls.push(options);
        return { error: null };
      },
    },
  };
  assertCheck('anonymous signup needs no cleanup', await clearSessionBeforeSignUp(anonymousClient) === false);
  assertCheck('anonymous signup does not emit signout', anonymousCalls.length === 0);
}

// ---------------------------------------------------------------------------
// 4. Location sync engine
// ---------------------------------------------------------------------------

function createHarness(clientResponder) {
  let clock = 0;
  const geolocation = createFakeGeolocation();
  const client = createFakeClient(clientResponder);
  const engine = createLocationSyncEngine({
    client,
    geolocation,
    now: () => clock,
    minIntervalMs: 30_000,
    minDistanceMeters: 75,
    forceIntervalMs: 300_000,
  });
  return {
    engine,
    geolocation,
    client,
    advance: (ms) => {
      clock += ms;
    },
  };
}

{
  // Authenticated users only.
  const harness = createHarness();
  assertCheck('anonymous start refused', harness.engine.start(null) === false);
  assertCheck('anonymous start creates no watcher', harness.geolocation.watchers.length === 0);
}

{
  // No geolocation available (unsupported device).
  let clock = 0;
  const client = createFakeClient();
  const engine = createLocationSyncEngine({ client, geolocation: null, now: () => clock });
  assertCheck('missing geolocation is unsupported', engine.start('user-1') === false);
  assertCheck('missing geolocation status', engine.state.status === 'unsupported', engine.state.status);
}

{
  // Exactly one watcher per user, throttled writes, logout cleanup.
  const harness = createHarness();
  const { engine, geolocation, client } = harness;

  assertCheck('authenticated start succeeds', engine.start('user-1') === true);
  assertCheck('watcher created', geolocation.activeWatchers().length === 1);
  engine.start('user-1');
  engine.start('user-1');
  assertCheck('no duplicate watcher', geolocation.activeWatchers().length === 1, String(geolocation.watchers.length));
  assertCheck('watching status', engine.state.status === 'watching');

  geolocation.activeWatchers()[0].success(position(19.076, 72.8777));
  await tick();
  assertCheck('rpc invoked once', client.calls.length === 1, String(client.calls.length));
  assertCheck('rpc name', client.calls[0].fn === 'sync_user_location');
  assertCheck('rpc payload', client.calls[0].args.p_latitude === 19.076
    && client.calls[0].args.p_longitude === 72.8777
    && client.calls[0].args.p_accuracy_m === 25
    && client.calls[0].args.p_source === 'device');
  assertCheck('synced status', engine.state.status === 'synced', engine.state.status);
  assertCheck('last fix recorded', engine.state.lastFix?.latitude === 19.076);

  // Immediate repeat at the same spot must not write again.
  geolocation.activeWatchers()[0].success(position(19.076001, 72.877701));
  await tick();
  assertCheck('stationary repeat throttled', client.calls.length === 1, String(client.calls.length));

  // Out-of-range coordinates are dropped client side.
  geolocation.activeWatchers()[0].success(position(999, 72.8777));
  await tick();
  assertCheck('invalid coordinates dropped', client.calls.length === 1, String(client.calls.length));

  // Movement after the minimum interval writes again.
  harness.advance(31_000);
  geolocation.activeWatchers()[0].success(position(19.078, 72.8777));
  await tick();
  assertCheck('movement synced', client.calls.length === 2, String(client.calls.length));
  assertCheck('sync counter', engine.state.syncCount === 2, String(engine.state.syncCount));

  // Heartbeat: stationary but stale enough to refresh.
  harness.advance(301_000);
  geolocation.activeWatchers()[0].success(position(19.078, 72.8777));
  await tick();
  assertCheck('heartbeat synced', client.calls.length === 3, String(client.calls.length));

  // User switch releases the previous watcher.
  assertCheck('second user start succeeds', engine.start('user-2') === true);
  assertCheck('exactly one watcher after user switch', geolocation.activeWatchers().length === 1);
  assertCheck('active user switched', engine.state.activeUserId === 'user-2');

  // Logout cleanup.
  engine.stop();
  assertCheck('watcher released on stop', geolocation.activeWatchers().length === 0);
  assertCheck('user cleared on stop', engine.state.activeUserId === null);
  assertCheck('cached fix cleared on stop', engine.state.lastFix === null);
  assertCheck('stopped status', engine.state.status === 'stopped');
}

{
  // Forced manual sync bypasses the throttle.
  const harness = createHarness();
  const { engine, client } = harness;
  engine.start('user-1');
  engine.requestSync();
  await tick();
  engine.requestSync();
  await tick();
  assertCheck('manual sync writes each time', client.calls.length === 2, String(client.calls.length));
}

{
  // Missing RPC (project without the location migration) degrades gracefully.
  const harness = createHarness(() => ({ data: null, error: { code: '42883', message: 'function public.sync_user_location does not exist' } }));
  const { engine, geolocation } = harness;
  engine.start('user-1');
  geolocation.activeWatchers()[0].success(position(19.076, 72.8777));
  await tick();
  assertCheck('missing rpc marks unsupported', engine.state.status === 'unsupported', engine.state.status);
  assertCheck('missing rpc releases watcher', geolocation.activeWatchers().length === 0);
}

{
  // An RPC that rejects the session stops syncing for that user.
  const harness = createHarness(() => ({ data: null, error: { code: '28000', message: 'AUTH_REQUIRED' } }));
  const { engine, geolocation } = harness;
  engine.start('user-1');
  geolocation.activeWatchers()[0].success(position(19.076, 72.8777));
  await tick();
  assertCheck('auth-required marks unauthenticated', engine.state.status === 'unauthenticated', engine.state.status);
  assertCheck('auth-required releases watcher', geolocation.activeWatchers().length === 0);
}

{
  // Permission denied is terminal for this session.
  const harness = createHarness();
  const { engine, geolocation, client } = harness;
  engine.start('user-1');
  geolocation.activeWatchers()[0].error({ code: 1, message: 'User denied Geolocation' });
  await tick();
  assertCheck('denied status', engine.state.status === 'denied', engine.state.status);
  assertCheck('denied releases watcher', geolocation.activeWatchers().length === 0);
  assertCheck('denied performs no write', client.calls.length === 0);
}

{
  // Position unavailable keeps the watcher alive for the next fix.
  const harness = createHarness();
  const { engine, geolocation } = harness;
  engine.start('user-1');
  geolocation.activeWatchers()[0].error({ code: 2, message: 'Position unavailable' });
  await tick();
  assertCheck('unavailable status', engine.state.status === 'unavailable', engine.state.status);
  assertCheck('unavailable keeps watcher', geolocation.activeWatchers().length === 1);
}

{
  // Haversine helper sanity (used by the client-side throttle).
  const moved = distanceMeters(19.076, 72.8777, 19.078, 72.8777);
  assertCheck('distance helper measures movement', moved > 150 && moved < 300, String(moved));
  assertCheck('distance helper zero for same point', distanceMeters(19.076, 72.8777, 19.076, 72.8777) === 0);
}

// ---------------------------------------------------------------------------
// 5. Repository invariants (single client, single auth listener, no secrets)
// ---------------------------------------------------------------------------

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const sources = walk(path.join(root, 'src')).map((file) => ({
  file: path.relative(root, file),
  text: fs.readFileSync(file, 'utf8'),
}));

const clientFactories = sources.filter((source) => /createClient\s*\(/.test(source.text));
assertCheck(
  'exactly one supabase client factory',
  clientFactories.length === 1 && clientFactories[0].file === 'src/lib/supabase.ts',
  clientFactories.map((source) => source.file).join(','),
);

// …and inside that factory, exactly ONE `createClient(...)` call site. Diagnostics
// used to build a throwaway second client "to prove initialization", which makes
// supabase-js log "Multiple GoTrueClient instances detected … under the same
// storage key" on every page load (a second GoTrueClient under the same key
// increments the instance counter and races the persisted PKCE session).
{
  const supaSrc = fs
    .readFileSync(path.join(root, 'src/lib/supabase.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '') // strip block comments
    .replace(/^\s*\/\/.*$/gm, ''); // strip line comments
  const callSites = supaSrc.match(/(?<![.\w])createClient\s*\(/g) ?? [];
  assertCheck(
    'single GoTrueClient instance: one createClient call site in src/lib/supabase.ts',
    callSites.length === 1,
    `found ${callSites.length}`,
  );
}

const authListeners = sources.filter((source) => /onAuthStateChange\s*\(/.test(source.text));
assertCheck(
  'exactly one auth listener owner',
  authListeners.length === 1 && authListeners[0].file === 'src/lib/authSession.ts',
  authListeners.map((source) => source.file).join(','),
);

const geolocationWatchers = sources.filter((source) => /navigator\.geolocation/.test(source.text));
assertCheck(
  'location watcher confined to the engine',
  geolocationWatchers.every((source) => source.file === 'src/services/locationSync.ts'),
  geolocationWatchers.map((source) => source.file).join(','),
);

// Matches real key material/usage, not prose that warns against it.
const secretHits = sources.filter((source) =>
  /SUPABASE_SERVICE_ROLE_KEY|service_role\s*[:=]|['"]service_role['"]|eyJ[A-Za-z0-9_-]{30,}/.test(source.text),
);
assertCheck('no service_role secret in frontend', secretHits.length === 0, secretHits.map((s) => s.file).join(','));

const trackedFiles = fs.readdirSync(root).concat([]);
assertCheck('env example shipped', trackedFiles.includes('.env.example'));
const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
assertCheck('env example documents storage key', envExample.includes('VITE_SUPABASE_STORAGE_KEY'));
assertCheck('env example holds no real key', !/eyJ[A-Za-z0-9_-]{20,}/.test(envExample));

const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260810090000_jobs_location_sync.sql'),
  'utf8',
);
assertCheck('location table has rls', /alter table public\.job_user_locations enable row level security/.test(migration));
assertCheck('location writes go through rpc', /create or replace function public\.sync_user_location/.test(migration));
assertCheck('location rpc asserts auth', /job_assert_authenticated\(\)/.test(migration));
assertCheck('location rpc is not anon executable', /revoke execute on function public\.sync_user_location\(numeric,numeric,numeric,text\) from public,anon/.test(migration));
assertCheck('location rpc granted to authenticated', /grant execute on function public\.sync_user_location\(numeric,numeric,numeric,text\) to authenticated/.test(migration));
assertCheck('rls not forced (definer write path intact)', !/force row level security/.test(migration));
assertCheck('no insert policy for authenticated writers', !/for insert to authenticated/.test(migration));
assertCheck('location cleanup rpc exists', /create or replace function public\.clear_user_location\(\)/.test(migration));

// ---------------------------------------------------------------------------
// 6. Sign-up / sign-in flow (email confirmation)
// ---------------------------------------------------------------------------
// Supabase returns a user with no session while the address is unconfirmed. The
// signup screens used to call that a failure ("Account activation did not
// complete"), which made every sign-up look broken while the account and the
// confirmation email were created correctly.
assertCheck(
  'a session means the user is signed in',
  resolveSignUpResult({ user: { id: 'u1' }, session: { access_token: 't' } }).status === 'signed_in',
);
assertCheck(
  'a user without a session means the email must be confirmed',
  resolveSignUpResult({ user: { id: 'u1' }, session: null }).status === 'confirmation_required',
);
assertCheck(
  'a missing user is a failure',
  resolveSignUpResult({ user: null, session: null }).status === 'failed'
  && resolveSignUpResult(undefined).status === 'failed',
);
assertCheck(
  'the confirmation branch keeps the created user id',
  resolveSignUpResult({ user: { id: 'u9' }, session: null }).userId === 'u9',
);

const backendSource = sources.find((source) => source.file === 'src/services/backend.ts').text;
assertCheck(
  'sign-up sends the confirmation link back to this app',
  /emailRedirectTo:\s*confirmationRedirectUrl\(\)/.test(backendSource)
  && /confirmationRedirectUrl = \(\) => appCallbackUrl\('\?confirmed=1'\)/.test(backendSource),
);
assertCheck(
  'the confirmation email can be re-sent with the same redirect',
  /async resendConfirmationEmail/.test(backendSource)
  && /type:\s*'signup'/.test(backendSource),
);

const appSource = sources.find((source) => source.file === 'src/App.tsx').text;
assertCheck(
  'sign-up no longer reports a confirmation-required account as a failure',
  !/Account activation did not complete/.test(appSource)
  && /outcome\.status === 'confirmation_required'/.test(appSource)
  && /setScreen\('signup_confirmation'\)/.test(appSource),
);
assertCheck(
  'the confirmation screen is rendered with the address and role',
  /<ConfirmEmailScreen/.test(appSource)
  && /email=\{pendingConfirmationEmail\?\.email/.test(appSource),
);
assertCheck(
  'the confirmation screen can resend the email',
  /onResend=\{async \(email\) => \{ await authBackend\.resendConfirmationEmail\(email\); \}\}/.test(appSource),
);
assertCheck(
  'the app handles the return from the confirmation link',
  /isConfirmationReturn/.test(appSource) && /params\.delete\('confirmed'\)/.test(appSource),
);
assertCheck(
  'a session arriving from the email link still opens the portal',
  /event === 'SIGNED_IN' && session\?\.user/.test(appSource)
  && /enteredPortalUserId/.test(appSource),
);

const confirmScreen = sources.find((source) => source.file === 'src/components/auth/ConfirmEmailScreen.tsx');
assertCheck('the confirmation screen exists', Boolean(confirmScreen));
// Comments explain the old failure wording, so the check looks at the copy: strip
// comments, then assert the screen still claims the account was created and
// never uses failure language.
const confirmScreenCopy = confirmScreen.text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
assertCheck(
  'the confirmation screen talks about the created account, not a failure',
  /account has been created/.test(confirmScreenCopy) && !/fail/i.test(confirmScreenCopy),
  'unexpected wording in the rendered copy',
);
assertCheck(
  'the confirmation screen rate-limits resends',
  /cooldown/.test(confirmScreen.text) && /formatRetryCountdown/.test(confirmScreen.text),
);

// The auth screens render structured failures as cards with the next step in
// them. The app handlers therefore must NOT swallow those errors: swallowing
// them was why the portal-switch, reset-link and re-send cards never appeared.
assertCheck(
  'structured auth errors are marked as screen-actionable',
  isActionableAuthScreenError(new PortalRoleMismatchError({ email: 'a@b.com', requestedRole: 'seeker', existingRole: 'employer' }))
  && isActionableAuthScreenError(new PasswordSignInBlockedError({ email: 'a@b.com', role: 'seeker', reason: 'wrong_password' }))
  && !isActionableAuthScreenError(new Error('Invalid email or password.')),
);
const rethrowCount = (appSource.match(/if \(isActionableAuthScreenError\(error\)\) throw error;/g) || []).length;
assertCheck(
  'the app lets those errors reach the screen instead of a banner',
  rethrowCount === 3,
  `${rethrowCount} rethrow sites (login + both signups)`,
);

// Signing in before confirming must reach the user as an actionable state, not a
// sentence: the login screen offers a re-send for exactly this reason.
assertCheck(
  'an unconfirmed sign-in is recognised',
  isEmailNotConfirmedError(new Error('Email not confirmed'))
  && isEmailNotConfirmedError({ message: 'email_not_confirmed' })
  && !isEmailNotConfirmedError(new Error('Invalid login credentials')),
);
const unconfirmed = new PasswordSignInBlockedError({ email: 'a@b.com', role: 'seeker', reason: 'unconfirmed' });
assertCheck(
  'the unconfirmed state is structured and distinguishable',
  isPasswordSignInBlockedError(unconfirmed)
  && unconfirmed.reason === 'unconfirmed'
  && /never confirmed/i.test(unconfirmed.message),
);
const loginSource = sources.find((source) => source.file === 'src/components/auth/LoginScreen.tsx').text;
assertCheck(
  'the login screen offers a resend for an unconfirmed account',
  /onResendConfirmation/.test(loginSource)
  && /signInBlocked\.reason === 'unconfirmed'/.test(loginSource)
  && /handleResendConfirmation/.test(loginSource),
);
assertCheck(
  'the login screen keeps the password and social path for the other reasons',
  // The screen branches on the reason: the unconfirmed banner offers a resend,
  // every other reason keeps the password-reset/social path in the else branch.
  /signInBlocked\.reason === 'unconfirmed' \?[\s\S]*?\) : \(/.test(loginSource),
);
assertCheck(
  'the backend raises the unconfirmed state before the generic mapper',
  /isEmailNotConfirmedError\(error\)/.test(backendSource) && /reason: 'unconfirmed'/.test(backendSource),
);

assertCheck(
  'the confirmation screen has a real route',
  resolveJobPortalRoute(pathForScreen('signup_confirmation')).screen === 'signup_confirmation',
  pathForScreen('signup_confirmation'),
);

console.log(`\n✅ ${checks.length} auth + location sync checks passed\n`);
checks.forEach((name) => console.log(`  ✓ ${name}`));
console.log('');

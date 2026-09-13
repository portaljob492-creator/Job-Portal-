/**
 * Auth-hardening checks: mid-session death copy, rate-limit passthrough and the
 * login cooldown wiring.
 *
 * Runs offline with no credentials (tsx). It executes the real modules the app
 * ships (`mapBackendError` from `src/services/backend.ts`, the classifiers in
 * `src/lib/authErrors.ts`) and statically renders the real `LoginScreen`, with
 * file-text checks only for the interactive wiring a static render cannot drive.
 *
 *   npm run test:auth
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  AuthRateLimitError,
  isActionableAuthScreenError,
  parsePortalRoleMismatch,
  portalRoleLabel,
  PortalRoleMismatchError,
  roleMismatchMessage,
} from '../src/lib/authErrors.ts';
import { buildAuthClientOptions, isValidSupabaseAnonKey } from '../src/lib/supabase.ts';
import { mapBackendError } from '../src/services/backend.ts';
import { LoginScreen } from '../src/components/auth/LoginScreen.tsx';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];
const SESSION_COPY = 'Your session expired. Please sign in again.';

async function check(name, fn) {
  await fn();
  checks.push(name);
}

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

// ---------------------------------------------------------------------------
// 1. A dead session reads as a session problem on every data path
// ---------------------------------------------------------------------------

await check('sub-claim error maps to the session copy', () => {
  assert.equal(mapBackendError(new Error('User from sub claim in JWT does not exist')), SESSION_COPY);
});

await check('postgrest jwt error maps to the session copy', () => {
  assert.equal(mapBackendError({ code: 'PGRST301', message: 'JWT expired' }), SESSION_COPY);
});

await check('dead refresh token maps to the session copy', () => {
  assert.equal(mapBackendError({ code: 'refresh_token_not_found', message: 'not found' }), SESSION_COPY);
});

await check('domain error codes still win over the fallback', () => {
  assert.equal(
    mapBackendError(new Error('JOB_EXPIRED: posting closed')),
    'This posting has expired and is no longer accepting applications.',
  );
});

await check('raw sql is still hidden', () => {
  assert.equal(
    mapBackendError(new Error('insert violates foreign key constraint "x"'), 'Try again.'),
    'Try again.',
  );
});

await check('safe short text still passes through', () => {
  assert.equal(mapBackendError(new Error('Name is required.'), 'Try again.'), 'Name is required.');
});

// ---------------------------------------------------------------------------
// 2. Throttling reaches the auth screens instead of dying in a toast
// ---------------------------------------------------------------------------

await check('rate-limit errors are actionable screen errors', () => {
  assert.equal(isActionableAuthScreenError(new AuthRateLimitError('request', 60)), true);
});

await check('mismatch errors stay actionable, generic errors do not', () => {
  assert.equal(
    isActionableAuthScreenError(
      new PortalRoleMismatchError({ email: 'a@b.c', requestedRole: 'seeker', existingRole: 'employer' }),
    ),
    true,
  );
  assert.equal(isActionableAuthScreenError(new Error('boom')), false);
});

await check('app handlers let actionable screen errors through', () => {
  const app = read('src/App.tsx');
  const passthroughs = app.match(/if \(isActionableAuthScreenError\(error\)\) throw error;/g) || [];
  assert.ok(passthroughs.length >= 3, `login + both signup handlers (${passthroughs.length})`);
});

// ---------------------------------------------------------------------------
// 3. Login screen: renders, and wires the throttle countdown
// ---------------------------------------------------------------------------

await check('login screen renders the portal switch and submit', () => {
  const noop = () => undefined;
  const html = renderToStaticMarkup(
    React.createElement(LoginScreen, {
      onLoginSuccess: noop,
      onSignUp: noop,
      onForgotPassword: noop,
    }),
  );
  assert.ok(html.includes('Job Seeker'), 'seeker portal tab');
  assert.ok(html.includes('Employer'), 'employer portal tab');
  assert.ok(html.includes('>Login</span>'), 'submit starts idle, not cooling down');
});

await check('login screen wires the throttle countdown', () => {
  const screen = read('src/components/auth/LoginScreen.tsx');
  assert.ok(screen.includes('isAuthRateLimitError(loginError)'), 'classifies throttled sign-ins');
  assert.ok(screen.includes('setCooldown(loginError.retryAfterSeconds)'), 'counts down from the server wait');
  assert.ok(screen.includes('Try again in ${formatRetryCountdown(cooldown)}'), 'countdown on the button');
  assert.ok(screen.includes('disabled={isLoading || cooldown > 0}'), 'submit blocked while cooling down');
});

// ---------------------------------------------------------------------------
// 4. Option 1: admin mismatch routing, client config, signup cooldowns
// ---------------------------------------------------------------------------

await check('admin mismatch parses to the admin portal', () => {
  const parsed = parsePortalRoleMismatch(new Error('PORTAL_ROLE_MISMATCH:admin'), 'seeker', 'a@b.c');
  assert.ok(parsed, 'parsed');
  assert.equal(parsed.existingRole, 'admin');
  assert.equal(parsed.requestedRole, 'seeker');
  assert.equal(parsed.email, 'a@b.c');
});

await check('unknown mismatch suffix stays unparsed', () => {
  assert.equal(parsePortalRoleMismatch(new Error('PORTAL_ROLE_MISMATCH:superuser'), 'seeker', ''), null);
  assert.equal(parsePortalRoleMismatch(new Error('boom'), 'seeker', ''), null);
});

await check('mismatch copy names each portal with the right article', () => {
  assert.equal(
    roleMismatchMessage('admin'),
    'This email is already registered as an Admin. Please sign in through the Admin portal.',
  );
  assert.ok(roleMismatchMessage('seeker').includes('as a Job Seeker'));
  assert.ok(roleMismatchMessage('employer').includes('as an Employer'));
  assert.equal(portalRoleLabel('admin'), 'Admin');
});

await check('browser Supabase key validation accepts only publishable or role-anon credentials', () => {
  const jwt = (role) => [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify({ role })).toString('base64url'),
    'signature',
  ].join('.');
  assert.equal(isValidSupabaseAnonKey('sb_publishable_browser-safe-key'), true);
  assert.equal(isValidSupabaseAnonKey('sb_secret_server-only-key'), false);
  assert.equal(isValidSupabaseAnonKey(jwt('anon')), true);
  assert.equal(isValidSupabaseAnonKey(jwt('service_role')), false);
  assert.equal(isValidSupabaseAnonKey(jwt('authenticated')), false);
});

await check('supabase client enables persistence and auto-refresh', () => {
  const options = buildAuthClientOptions('test-key');
  assert.equal(options.storageKey, 'test-key');
  assert.equal(options.persistSession, true);
  assert.equal(options.autoRefreshToken, true);
  assert.equal(options.detectSessionInUrl, true);
  assert.equal(options.flowType, 'pkce');
});

await check('login screen routes admin mismatches to the admin sign-in', () => {
  const screen = read('src/components/auth/LoginScreen.tsx');
  assert.ok(screen.includes("jobPortalPath('admin')"), 'admin path navigation');
  assert.ok(screen.includes('Go to Admin Sign In'), 'admin switch label');
  assert.ok(screen.includes('new PopStateEvent'), 'event-driven navigation');
});

await check('admin login pre-fills the carried-over email', () => {
  const screen = read('src/components/admin/AdminLoginScreen.tsx');
  assert.ok(screen.includes("get('email')"), 'reads the email prefill param');
});

await check('both signup screens wire the throttle countdown', () => {
  for (const file of [
    'src/components/auth/JobSeekerSignupScreen.tsx',
    'src/components/auth/EmployerSignupScreen.tsx',
  ]) {
    const screen = read(file);
    assert.ok(screen.includes('isAuthRateLimitError(signupError)'), `${file}: classifies throttling`);
    assert.ok(screen.includes('setCooldown(signupError.retryAfterSeconds)'), `${file}: counts down`);
    assert.ok(screen.includes('cooldown > 0'), `${file}: gates submit`);
  }
});

// ---------------------------------------------------------------------------
// 5. A wrong portal tab routes to the account's portal instead of failing
// ---------------------------------------------------------------------------

await check('login screen follows the account instead of the clicked tab', () => {
  const screen = read('src/components/auth/LoginScreen.tsx');
  assert.ok(screen.includes('onResolvePortalRole'), 'accepts the portal lookup');
  assert.ok(screen.includes('isLikelyEmail(candidate)'), 'only looks up plausible addresses');
  assert.ok(screen.includes('setActiveRole(resolved)'), 'moves the tab onto the resolved portal');
  assert.ok(screen.includes('is registered as'), 'explains the switch instead of doing it silently');
  assert.ok(screen.includes("resolved === 'admin'"), 'admin emails get the admin sign-in card');
});

await check('the app routes sign-in to the portal the backend resolved', () => {
  const app = read('src/App.tsx');
  assert.ok(app.includes('const { user, portalRole } = await authBackend.signIn'), 'reads the resolved portal');
  assert.ok(app.includes('enterAuthenticatedPortal(user.id, portalRole ?? selectedRole)'), 'routes on it');
  assert.ok(app.includes('onResolvePortalRole={handleResolvePortalRole}'), 'wires the login screen lookup');
});

await check('sign-up still refuses to reassign an email to the other portal', () => {
  const backend = read('src/services/backend.ts');
  const signUp = backend.slice(backend.indexOf('async signUp(input: SignUpInput)'), backend.indexOf('async signIn(email'));
  assert.ok(signUp.includes('throw new PortalRoleMismatchError'), 'signup keeps the structured mismatch');
  const signIn = backend.slice(backend.indexOf('async signIn(email'), backend.indexOf('async signInAdmin(email'));
  assert.ok(!/existingRole !== requestedBackendRole/.test(signIn), 'sign-in no longer gates on the clicked tab');
});

console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));

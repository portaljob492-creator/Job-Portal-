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
  PortalRoleMismatchError,
} from '../src/lib/authErrors.ts';
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

console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));

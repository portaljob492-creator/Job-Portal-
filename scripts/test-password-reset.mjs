/**
 * Password-reset checks: shared policy, recovery-token parsing, rate-limit
 * classification and the admin reset CLI.
 *
 * Runs offline with no credentials. It executes the real modules the app ships
 * (`src/lib/passwordPolicy.ts`, `src/lib/recoveryLink.ts`, `src/lib/authErrors.ts`,
 * `mapAuthError` from `src/services/backend.ts`) and drives the real
 * `scripts/reset-user-password.mjs` against a mock GoTrue admin API on
 * 127.0.0.1, asserting the exact request it sends.
 *
 *   npm run test:reset
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_RULES,
  isPasswordAcceptable,
  passwordRuleFailures,
  passwordStrength,
  validateNewPassword,
} from '../src/lib/passwordPolicy.ts';
import {
  describeRecoveryInput,
  parseRecoveryTokenInput,
  recoveryInputNeedsEmail,
} from '../src/lib/recoveryLink.ts';
import {
  AuthRateLimitError,
  EMAIL_HOURLY_COOLDOWN_SECONDS,
  formatRetryCountdown,
  isPasswordSignInBlockedError,
  isRecoveryLinkRejectedError,
  parseRateLimitError,
  PasswordSignInBlockedError,
} from '../src/lib/authErrors.ts';
import { normalizeEmail, isLikelyEmail } from '../src/lib/email.ts';
import { mapAuthError, RecoverySessionLostError } from '../src/services/backend.ts';
import { ForgotPasswordScreen } from '../src/components/auth/ForgotPasswordScreen.tsx';
import { LoginScreen } from '../src/components/auth/LoginScreen.tsx';
import { ResetPasswordScreen } from '../src/components/auth/ResetPasswordScreen.tsx';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(root, 'scripts', 'reset-user-password.mjs');
const checks = [];

async function check(name, fn) {
  await fn();
  checks.push(name);
}

// ---------------------------------------------------------------------------
// 1. Shared password policy (reset form + admin CLI must agree)
// ---------------------------------------------------------------------------

await check('policy accepts a compliant password', () => {
  assert.equal(validateNewPassword('Nexora-2026'), null);
  assert.equal(isPasswordAcceptable('Nexora-2026'), true);
  assert.equal(passwordRuleFailures('Nexora-2026').length, 0);
  assert.equal(MIN_PASSWORD_LENGTH, 8);
  assert.deepEqual(PASSWORD_RULES.map((rule) => rule.code), ['length', 'lowercase', 'uppercase', 'number']);
});

await check('policy rejects each weak password with the reset-form wording', () => {
  assert.equal(validateNewPassword('Short1'), 'New password must be at least 8 characters long.');
  assert.equal(validateNewPassword('ALLCAPS123'), 'New password must contain at least one lowercase letter.');
  assert.equal(validateNewPassword('alllowercase1'), 'New password must contain at least one uppercase letter.');
  assert.equal(validateNewPassword('NoNumbersHere'), 'New password must contain at least one number.');
  assert.equal(validateNewPassword(''), 'New password must be at least 8 characters long.');
});

await check('policy reports every unmet rule for the CLI summary', () => {
  assert.deepEqual(passwordRuleFailures('abc').map((rule) => rule.code), ['length', 'uppercase', 'number']);
});

await check('strength meter keeps the existing scores and classes', () => {
  assert.deepEqual(passwordStrength(''), { score: 0, label: '', color: '' });
  assert.equal(passwordStrength('abcdefgh').score, 1);
  assert.equal(passwordStrength('Abcdefgh').score, 2);
  assert.equal(passwordStrength('Abcdefg1').score, 3);
  assert.equal(passwordStrength('Abcdefg1').label, 'Strong');
  assert.equal(passwordStrength('Abcdefg1').color, 'bg-emerald-500 text-emerald-700');
});

await check('email normalisation matches how GoTrue stores identities', () => {
  assert.equal(normalizeEmail('  Jane@Example.COM '), 'jane@example.com');
  assert.equal(isLikelyEmail('jane@example.com'), true);
  assert.equal(isLikelyEmail('jane@example'), false);
  assert.equal(isLikelyEmail('not-an-email'), false);
});

// ---------------------------------------------------------------------------
// 2. Recovery token parsing (the "I already have the email" path)
// ---------------------------------------------------------------------------

const REAL_TOKEN = 'V1StGXR8_Z5jdHi6B-myT0-aBcDeFgHiJkLmNoPqRsT';

await check('parses the full reset link Supabase emails', () => {
  const link = `https://qwaehqsmodekbgvnaavz.supabase.co/auth/v1/verify?token=${REAL_TOKEN}&type=recovery&redirect_to=https%3A%2F%2Fapp.example.com%2F%3Frecovery%3D1`;
  const parsed = parseRecoveryTokenInput(link);
  assert.deepEqual(parsed, { kind: 'token_hash', value: REAL_TOKEN });
  assert.equal(recoveryInputNeedsEmail(parsed), false);
  assert.equal(describeRecoveryInput(parsed), 'reset link token');
});

await check('parses a link pasted with surrounding whitespace or without a scheme', () => {
  assert.deepEqual(
    parseRecoveryTokenInput(`  qwaehqsmodekbgvnaavz.supabase.co/auth/v1/verify?token=${REAL_TOKEN}&type=recovery  `),
    { kind: 'token_hash', value: REAL_TOKEN },
  );
});

await check('parses a bare token hash and a bare 6-digit code', () => {
  assert.deepEqual(parseRecoveryTokenInput(REAL_TOKEN), { kind: 'token_hash', value: REAL_TOKEN });
  assert.deepEqual(parseRecoveryTokenInput(' 481902 '), { kind: 'otp', value: '481902' });
  assert.equal(recoveryInputNeedsEmail({ kind: 'otp', value: '481902' }), true);
});

await check('rejects input that holds no usable token', () => {
  assert.equal(parseRecoveryTokenInput(''), null);
  assert.equal(parseRecoveryTokenInput('please help me'), null);
  assert.equal(parseRecoveryTokenInput('https://app.example.com/login'), null);
  assert.equal(parseRecoveryTokenInput('12345'), null);
  assert.equal(parseRecoveryTokenInput('abc!def'), null);
});

// ---------------------------------------------------------------------------
// 3. Rate-limit classification (the error the user actually hit)
// ---------------------------------------------------------------------------

await check('classifies the hourly email cap and keeps the wait time', () => {
  const rateLimit = parseRateLimitError({
    name: 'AuthApiError',
    message: 'Email rate limit exceeded',
    status: 429,
    code: 'over_email_send_rate_limit',
  });
  assert.ok(rateLimit instanceof AuthRateLimitError);
  assert.equal(rateLimit.scope, 'email');
  assert.equal(rateLimit.retryAfterSeconds, EMAIL_HOURLY_COOLDOWN_SECONDS);
});

await check('reads the wait out of the resend-interval message', () => {
  const rateLimit = parseRateLimitError({
    message: 'For security purposes, you can only request this after 30 seconds.',
    status: 429,
  });
  assert.ok(rateLimit instanceof AuthRateLimitError);
  assert.equal(rateLimit.scope, 'email');
  assert.equal(rateLimit.retryAfterSeconds, 30);
});

await check('classifies generic throttling and leaves other errors alone', () => {
  const generic = parseRateLimitError({ message: 'Too Many Requests', status: 429 });
  assert.equal(generic?.scope, 'request');
  assert.equal(generic?.retryAfterSeconds, 60);
  assert.equal(parseRateLimitError({ message: 'Invalid login credentials', status: 400 }), null);
  assert.equal(parseRateLimitError(new Error('network down')), null);
});

await check('formats the countdown the screen shows', () => {
  assert.equal(formatRetryCountdown(30), '30s');
  assert.equal(formatRetryCountdown(60), '1:00');
  assert.equal(formatRetryCountdown(3600), '60:00');
  assert.equal(formatRetryCountdown(90), '1:30');
  assert.equal(formatRetryCountdown(0), '0s');
});

// ---------------------------------------------------------------------------
// 4. The exact strings the screens show
// ---------------------------------------------------------------------------

await check('maps the hourly email cap to the recovery-aware message', () => {
  const mapped = mapAuthError({ message: 'Email rate limit exceeded', status: 429, code: 'over_email_send_rate_limit' });
  assert.match(mapped.message, /email provider limit has been reached/i);
  assert.match(mapped.message, /newest reset email/i);
  assert.ok(mapped instanceof AuthRateLimitError, 'the countdown UI needs retryAfterSeconds');
  assert.equal(mapped.retryAfterSeconds, 3600);
});

await check('maps bad credentials to the login message', () => {
  const mapped = mapAuthError({ message: 'Invalid login credentials', status: 400, code: 'invalid_credentials' });
  assert.equal(mapped.message, 'Invalid email or password. Check your credentials and selected portal.');
  assert.equal(mapped instanceof AuthRateLimitError, false);
});

await check('maps a dead recovery session onto the "request a new email" path', () => {
  for (const failure of [
    { message: 'Auth Session Missing', code: 'session_not_found' },
    { message: 'Token has expired', code: 'otp_expired' },
    { message: 'The otp has expired or has already been used', code: 'otp_expired' },
  ]) {
    const mapped = mapAuthError(failure);
    assert.ok(mapped instanceof RecoverySessionLostError, `${failure.message} should map to RecoverySessionLostError`);
    assert.ok(isRecoveryLinkRejectedError(failure));
  }
  assert.equal(isRecoveryLinkRejectedError({ message: 'Invalid login credentials' }), false);
});

await check('maps rejected new passwords onto the portal policy wording', () => {
  assert.equal(
    mapAuthError({ message: 'New password should be different from the old password.', code: 'same_password' }).message,
    'Choose a password you have not used on this account before.',
  );
  assert.match(
    mapAuthError({ message: 'Password should be at least 6 characters.', code: 'weak_password' }).message,
    /at least 8 characters/i,
  );
});

// ---------------------------------------------------------------------------
// 4b. A wrong password on an account that exists must be actionable
// ---------------------------------------------------------------------------

await check('marks a failed password sign-in on a known account as recoverable', () => {
  const wrongPassword = new PasswordSignInBlockedError({ email: 'Jane@Example.com ', role: 'seeker', reason: 'wrong_password' });
  assert.ok(isPasswordSignInBlockedError(wrongPassword));
  assert.equal(wrongPassword.reason, 'wrong_password');
  assert.equal(wrongPassword.role, 'seeker');
  assert.match(wrongPassword.message, /Job Seeker account/);
  assert.match(wrongPassword.message, /Reset the password/i);
  // Only used for display and for the reset screen's prefill, never for lookup.
  assert.equal(wrongPassword.email, 'Jane@Example.com ');

  const unassigned = new PasswordSignInBlockedError({ email: 'jane@example.com', role: 'employer', reason: 'unassigned' });
  assert.equal(unassigned.reason, 'unassigned');
  assert.match(unassigned.message, /not been linked to a Jobs portal/i);

  assert.equal(isPasswordSignInBlockedError(new Error('Invalid login credentials')), false);
  assert.equal(isPasswordSignInBlockedError(null), false);
});

// ---------------------------------------------------------------------------
// 5. The admin CLI, end to end against a mock GoTrue admin API
// ---------------------------------------------------------------------------

const FIXTURE_USER = {
  id: '6a1e2b3c-4d5e-4f60-8a7b-9c8d7e6f5a4b',
  email: 'stuck.user@example.com',
  email_confirmed_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  user_metadata: { job_role: 'job_seeker', role: 'seeker' },
};

function startMockGoTrue() {
  const requests = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      requests.push({ method: req.method, url: req.url, body, auth: req.headers.authorization });
      const json = (payload) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      };
      if (req.method === 'GET' && req.url.startsWith('/auth/v1/admin/users?')) {
        json({ users: [FIXTURE_USER], aud: 'authenticated' });
        return;
      }
      if (req.method === 'PUT' && req.url === `/auth/v1/admin/users/${FIXTURE_USER.id}`) {
        json({ ...FIXTURE_USER, ...JSON.parse(body) });
        return;
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ msg: 'not found' }));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, requests, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

/**
 * Runs the CLI as a real child process. Deliberately async: `spawnSync` would
 * block this process's event loop and the mock GoTrue could never answer the
 * child's request (a deadlock, not a CLI bug).
 */
function runCli(url, args, env = {}) {
  // Same loader the test file runs under, so the CLI's `.ts` imports resolve.
  const child = spawn(process.execPath, ['--import', 'tsx', CLI, ...args], {
    env: {
      ...process.env,
      SUPABASE_URL: url,
      SUPABASE_SERVICE_ROLE_KEY: 'mock-service-role-key',
      ...env,
    },
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`CLI timed out: ${args.join(' ')}`)), 30_000);
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (status) => { clearTimeout(timer); resolve({ status, stdout, stderr }); });
  });
}

const mock = await startMockGoTrue();

try {
  await check('CLI sets a new password without sending any email', async () => {
    const result = await runCli(mock.url, ['--email', 'Stuck.User@Example.com', '--password', 'Nexora-2026']);
    assert.equal(result.status, 0, `stderr: ${result.stderr}\nstdout: ${result.stdout}`);
    assert.match(result.stdout, /Password updated for stuck\.user@example\.com/);
    assert.ok(!/Nexora-2026/.test(result.stdout), 'the password must never be echoed back');

    const put = mock.requests.find((entry) => entry.method === 'PUT');
    assert.ok(put, 'expected a PUT to the admin user endpoint');
    assert.deepEqual(JSON.parse(put.body), { password: 'Nexora-2026' });
    assert.equal(put.auth, 'Bearer mock-service-role-key');
    assert.equal(mock.requests.some((entry) => entry.url.includes('/mail') || entry.url.includes('/recover')), false);
    assert.equal(mock.requests.filter((entry) => entry.method === 'PUT').length, 1);
  });

  await check('CLI refuses a weak password before touching the API', async () => {
    const before = mock.requests.length;
    const result = await runCli(mock.url, ['--email', FIXTURE_USER.email, '--password', 'weakpass']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /at least one uppercase letter/);
    assert.match(result.stderr, /Unmet rules/);
    assert.equal(mock.requests.length, before, 'a rejected password must not reach the API at all');
  });

  await check('CLI exits 2 when the account does not exist', async () => {
    const result = await runCli(mock.url, ['--email', 'nobody@example.com', '--password', 'Nexora-2026']);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /No account for nobody@example\.com/);
  });

  await check('CLI dry run validates without writing', async () => {
    const result = await runCli(mock.url, ['--user-id', FIXTURE_USER.id, '--password', 'Nexora-2026', '--dry-run']);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /Dry run/);
    assert.equal(mock.requests.filter((entry) => entry.method === 'PUT').length, 1, 'no second write');
  });

  await check('CLI demands credentials and an account selector', async () => {
    const noEnv = await runCli(mock.url, ['--email', 'a@b.com', '--password', 'Nexora-2026'], {
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
    });
    assert.equal(noEnv.status, 1);
    assert.match(noEnv.stderr, /Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/);

    const noTarget = await runCli(mock.url, ['--password', 'Nexora-2026']);
    assert.equal(noTarget.status, 1);
    assert.match(noTarget.stderr, /--email or --user-id/);
  });

  await check('CLI lists accounts for the owner', async () => {
    const result = await runCli(mock.url, ['--list']);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /stuck\.user@example\.com/);
    assert.match(result.stdout, /job_seeker/);
  });
} finally {
  mock.server.close();
  mock.server.closeAllConnections?.();
}

// ---------------------------------------------------------------------------
// 6. The two recovery screens render with the new paths wired in
// ---------------------------------------------------------------------------

const noop = async () => {};
const render = (element) => renderToStaticMarkup(element);

await check('forgot-password screen offers both the email and the token path', () => {
  const html = render(
    React.createElement(ForgotPasswordScreen, {
      onBackToLogin: noop,
      onSendResetLink: noop,
      onVerifyRecoveryToken: noop,
    }),
  );
  assert.ok(html.includes('Send Reset Link'), 'email path present');
  assert.ok(html.includes('Already received the email?'), 'token escape hatch present');
  assert.ok(html.includes('Continue with this link'), 'token submit present');
});

await check('reset screen lists the shared policy and swaps to a new email when the link dies', () => {
  const valid = render(
    React.createElement(ResetPasswordScreen, {
      recoveryState: 'valid',
      onBackToLogin: noop,
      onRequestNewLink: noop,
      onUpdatePassword: noop,
      onSuccessLogin: noop,
    }),
  );
  assert.ok(valid.includes('Create New Password'));
  for (const label of ['At least 8 characters long', 'Contains at least 1 lowercase letter', 'Contains at least 1 uppercase letter', 'Contains at least 1 number']) {
    assert.ok(valid.includes(label), `checklist shows "${label}"`);
  }

  const invalid = render(
    React.createElement(ResetPasswordScreen, {
      recoveryState: 'invalid',
      onBackToLogin: noop,
      onRequestNewLink: noop,
      onUpdatePassword: noop,
      onSuccessLogin: noop,
    }),
  );
  assert.ok(invalid.includes('Request New Reset Link'), 'expired link offers a new email');
  assert.ok(!invalid.includes('Update Password'), 'no dead form on an invalid link');
});

await check('login screen pre-fills the email it is handed', () => {
  const html = render(
    React.createElement(LoginScreen, {
      initialEmail: 'jane@example.com',
      onLoginSuccess: noop,
      onSignUp: noop,
      onForgotPassword: noop,
    }),
  );
  assert.ok(html.includes('Welcome Back'));
  assert.ok(html.includes('value="jane@example.com"'), 'email carried over from the reset flow');
  assert.ok(html.includes('Forgot Password?'), 'the escape hatch is always visible, not only after an error');
});

console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));

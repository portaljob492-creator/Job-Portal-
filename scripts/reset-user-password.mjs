/**
 * Owner-only password reset that bypasses email entirely.
 *
 * Supabase's built-in mailer only sends a couple of auth emails per hour, so a
 * user who requests a reset link twice is locked out of self-service recovery
 * until the quota resets — and the owner cannot help them through the UI. This
 * script sets a new password directly through the GoTrue admin API using the
 * service_role key, so no email is sent and no rate limit applies.
 *
 *   SUPABASE_URL=https://<project>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role key> \
 *     npm run admin:reset-password -- --email user@example.com --password 'New-Pass1'
 *
 * Never commit the service_role key and never paste it into the app bundle: it
 * bypasses RLS. Exit codes: 0 ok · 1 usage/policy · 2 account not found · 3 API.
 */
import process from 'node:process';

import { isLikelyEmail, normalizeEmail } from '../src/lib/email.ts';
import { passwordRuleFailures, validateNewPassword } from '../src/lib/passwordPolicy.ts';

const PER_PAGE = 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const USAGE = `Nexora Jobs — admin password reset (no email is sent)

Usage:
  npm run admin:reset-password -- --email <email> --password '<new password>'

Options:
  --email <email>         Account to reset (or --user-id)
  --user-id <uuid>        Reset by Supabase user id instead of email
  --password <password>   New password (8+ chars, upper + lower + digit)
  --password-stdin        Read the password from stdin instead of the command line
  --confirm-email         Also mark the email as confirmed
  --list                  List accounts (email, role metadata, created) and exit
  --dry-run               Find and validate only; write nothing
  --url <url>             Supabase project URL  (default: $SUPABASE_URL)
  --key <key>             service_role key      (default: $SUPABASE_SERVICE_ROLE_KEY)
  -h, --help              Show this help

Environment:
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_URL)
`;

function fail(message, code = 1) {
  console.error(`\n✖ ${message}`);
  process.exit(code);
}

function parseArgs(argv) {
  const options = {
    email: null,
    userId: null,
    password: null,
    passwordFromStdin: false,
    confirmEmail: false,
    dryRun: false,
    list: false,
    help: false,
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) fail(`Missing value for ${arg}`);
      i += 1;
      return value;
    };
    switch (arg) {
      case '--email': options.email = next(); break;
      case '--user-id': options.userId = next(); break;
      case '--password': options.password = next(); break;
      case '--password-stdin': options.passwordFromStdin = true; break;
      case '--confirm-email': options.confirmEmail = true; break;
      case '--dry-run': options.dryRun = true; break;
      case '--list': options.list = true; break;
      case '--url': options.url = next(); break;
      case '--key': options.key = next(); break;
      case '-h': case '--help': options.help = true; break;
      default: fail(`Unknown option: ${arg}\n\n${USAGE}`);
    }
  }
  return options;
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function adminHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

async function adminFetch(url, key, path, init = {}) {
  let response;
  try {
    response = await fetch(`${url}${path}`, { ...init, headers: adminHeaders(key) });
  } catch (networkError) {
    fail(`Could not reach ${url}: ${networkError.message}`, 3);
  }
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { message: text.slice(0, 300) };
  }
  if (!response.ok) {
    const detail = body?.msg || body?.message || body?.error_description || text.slice(0, 300);
    fail(`GoTrue admin API returned ${response.status}: ${detail}`, 3);
  }
  return body;
}

/** Walks the admin user pages until it finds the account (GoTrue has no by-email lookup). */
async function findUser(url, key, predicate) {
  for (let page = 1; page <= 50; page += 1) {
    const body = await adminFetch(url, key, `/auth/v1/admin/users?page=${page}&per_page=${PER_PAGE}`);
    const users = Array.isArray(body?.users) ? body.users : [];
    const match = users.find(predicate);
    if (match) return match;
    if (users.length < PER_PAGE) return null;
  }
  return null;
}

async function listUsers(url, key) {
  const rows = [];
  for (let page = 1; page <= 50; page += 1) {
    const body = await adminFetch(url, key, `/auth/v1/admin/users?page=${page}&per_page=${PER_PAGE}`);
    const users = Array.isArray(body?.users) ? body.users : [];
    rows.push(...users);
    if (users.length < PER_PAGE) break;
  }
  if (rows.length === 0) {
    console.log('No users found in this project.');
    return;
  }
  console.log(`\n${rows.length} user(s):\n`);
  for (const user of rows) {
    const role = user.user_metadata?.job_role || user.user_metadata?.role || '—';
    const confirmed = user.email_confirmed_at ? 'confirmed' : 'unconfirmed';
    const created = (user.created_at || '').slice(0, 10);
    console.log(`  ${user.email || '(no email)'}  ·  ${role}  ·  ${confirmed}  ·  ${created}  ·  ${user.id}`);
  }
  console.log('');
}

function maskPassword(password) {
  return password ? `${password[0]}${'•'.repeat(Math.max(0, password.length - 1))} (${password.length} chars)` : '(empty)';
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(USAGE);
    return;
  }
  if (!options.url || !options.key) {
    fail(`Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see --help).\n\n${USAGE}`);
  }
  const url = options.url.replace(/\/+$/, '');

  if (options.list) {
    await listUsers(url, options.key);
    return;
  }

  if (!options.email && !options.userId) fail(`Pass --email or --user-id.\n\n${USAGE}`);
  if (options.userId && !UUID_PATTERN.test(options.userId)) fail(`--user-id must be a UUID, got "${options.userId}"`);
  const email = options.email ? normalizeEmail(options.email) : '';
  if (email && !isLikelyEmail(email)) fail(`"${options.email}" does not look like an email address.`);

  let password = options.password;
  if (options.passwordFromStdin) {
    password = (await readStdin()).trim();
  }
  if (!password) fail(`Pass --password or --password-stdin.\n\n${USAGE}`);

  // Same policy as the reset form (src/lib/passwordPolicy.ts), enforced before
  // any request so a rejected password is explained up front.
  const policyError = validateNewPassword(password);
  if (policyError) {
    const failures = passwordRuleFailures(password).map((rule) => rule.label);
    fail(`${policyError}\n  Unmet rules: ${failures.join('; ')}`);
  }

  const target = options.userId
    ? await findUser(url, options.key, (user) => user.id === options.userId)
    : await findUser(url, options.key, (user) => normalizeEmail(user.email || '') === email);

  if (!target) {
    fail(
      options.userId
        ? `No user with id ${options.userId} in this project. Run with --list to see the accounts.`
        : `No account for ${email} in this project. Run with --list to see the accounts.`,
      2,
    );
  }

  console.log(`\nAccount : ${target.email || '(no email)'}`);
  console.log(`User id : ${target.id}`);
  console.log(`New pass: ${maskPassword(password)}`);

  if (options.dryRun) {
    console.log('\n✔ Dry run — nothing was changed.\n');
    return;
  }

  const updated = await adminFetch(url, options.key, `/auth/v1/admin/users/${target.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      password,
      ...(options.confirmEmail ? { email_confirm: true } : {}),
    }),
  });

  console.log(`\n✔ Password updated for ${updated?.email || target.email}.`);
  console.log('  Existing sessions stay signed in until their refresh token expires;');
  console.log('  ask the user to sign out everywhere and log in with the new password.\n');
}

main().catch((error) => fail(error?.message || String(error), 3));

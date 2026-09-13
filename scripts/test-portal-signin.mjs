/**
 * Portal-role sign-in checks: a login on the "wrong" portal tab must sign the
 * user in and open the portal their account actually belongs to, instead of
 * failing with PORTAL_ROLE_MISMATCH.
 *
 * Runs offline with no credentials (tsx). It exercises the real shipped code —
 * `authBackend.signIn`, `authBackend.resolvePortalRole`,
 * `authBackend.lookupPortalRole` from `src/services/backend.ts` — against a stub
 * Supabase client injected through the shared-client seam in `src/lib/supabase.ts`
 * (`globalThis.__nexoraJobPortalSupabase`), so no network and no credentials are
 * needed. The stub's `job_register_role` answers exactly like the migrated
 * database does (verified separately by `npm run test:db`): the stored role is
 * returned, anything else raises `PORTAL_ROLE_MISMATCH:<stored role>`.
 *
 *   npm run test:signin
 */
import assert from 'node:assert/strict';

// The shared client is created once, when `src/lib/supabase.ts` is first
// evaluated, and cached on globalThis. Seeding it with a delegating holder
// before the dynamic import below is what makes `requireSupabase()` hand the
// stub to the real backend — no network, no credentials.
let activeClient = null;
const clientSeam = {};
Object.defineProperties(clientSeam, {
  auth: { get: () => activeClient.auth, configurable: true },
  rpc: { get: () => activeClient.rpc, configurable: true },
  from: { get: () => activeClient.from, configurable: true },
});
globalThis.__nexoraJobPortalSupabase = clientSeam;

const {
  authBackend,
  applyPendingOAuthRole,
} = await import('../src/services/backend.ts');
const {
  PortalRoleMismatchError,
  isPortalRoleMismatchError,
  isPasswordSignInBlockedError,
} = await import('../src/lib/authErrors.ts');
const { decideSignInPortal, normalizeStoredPortalRole } = await import('../src/lib/portalRole.ts');

const PASSWORD = 'correct horse battery staple';
const checks = [];

async function check(name, fn) {
  await fn();
  checks.push(name);
}

/**
 * Stub Supabase client.
 *
 * @param storedRole    value `job_email_portal_role` returns ('employer',
 *                      'job_seeker', 'admin', 'unassigned', null) — or an Error
 *                      to simulate the lookup being unavailable.
 * @param accountRole   the role `job_register_role` grants; anything else raises
 *                      PORTAL_ROLE_MISMATCH:<accountRole>, like the database.
 * @param registerError replaces that behaviour with an unconditional refusal
 *                      (e.g. ACCOUNT_INACTIVE).
 */
function makeClient({ storedRole = 'employer', accountRole = 'employer', registerError = null }) {
  const calls = [];
  return {
    calls,
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      signOut: async () => {
        calls.push('auth.signOut');
        return { error: null };
      },
      getUser: async () => ({ data: { user: { id: 'user-1', email: 'employer@example.com' } }, error: null }),
      signInWithPassword: async ({ email, password }) => {
        calls.push(`auth.signInWithPassword:${email}`);
        if (password !== PASSWORD) {
          return {
            data: { user: null, session: null },
            error: { name: 'AuthApiError', message: 'Invalid login credentials', status: 400 },
          };
        }
        return {
          data: { user: { id: 'user-1', email }, session: { user: { id: 'user-1', email } } },
          error: null,
        };
      },
    },
    rpc: async (fn, params = {}) => {
      calls.push(`${fn}:${JSON.stringify(params)}`);
      if (fn === 'job_email_portal_role') {
        if (storedRole instanceof Error) return { data: null, error: { message: storedRole.message } };
        return { data: storedRole, error: null };
      }
      if (fn === 'job_register_role') {
        if (registerError) return { data: null, error: registerError };
        if (params.requested_role === accountRole) return { data: accountRole, error: null };
        return {
          data: null,
          error: { code: '42501', message: `PORTAL_ROLE_MISMATCH:${accountRole}` },
        };
      }
      throw new Error(`unexpected rpc: ${fn}`);
    },
  };
}

/** Points `requireSupabase()` at a fresh stub and returns it. */
function useClient(options) {
  activeClient = makeClient(options);
  return activeClient;
}

// ---------------------------------------------------------------------------
// 1. Pure decision logic: the clicked tab is a hint, the stored role wins
// ---------------------------------------------------------------------------

await check('stored portal role normalises from backend values', () => {
  assert.equal(normalizeStoredPortalRole('job_seeker'), 'seeker');
  assert.equal(normalizeStoredPortalRole('employer'), 'employer');
  assert.equal(normalizeStoredPortalRole('admin'), 'admin');
  assert.equal(normalizeStoredPortalRole('unassigned'), null);
  assert.equal(normalizeStoredPortalRole(null), null);
});

await check('a wrong tab enters the stored portal instead of failing', () => {
  assert.deepEqual(decideSignInPortal('employer', 'seeker'), {
    kind: 'enter',
    role: 'employer',
    corrected: true,
  });
  assert.deepEqual(decideSignInPortal('seeker', 'employer'), {
    kind: 'enter',
    role: 'seeker',
    corrected: true,
  });
});

await check('the matching tab is not marked as corrected', () => {
  assert.deepEqual(decideSignInPortal('employer', 'employer'), {
    kind: 'enter',
    role: 'employer',
    corrected: false,
  });
});

await check('unknown/unassigned accounts keep the clicked tab', () => {
  assert.deepEqual(decideSignInPortal(null, 'employer'), {
    kind: 'enter',
    role: 'employer',
    corrected: false,
  });
});

await check('admin emails are routed to the admin sign-in', () => {
  assert.deepEqual(decideSignInPortal('admin', 'seeker'), { kind: 'admin_portal' });
});

// ---------------------------------------------------------------------------
// 2. The shipped sign-in: seeker tab + employer email signs in as an employer
// ---------------------------------------------------------------------------

await check('seeker tab with an employer email signs in and resolves employer', async () => {
  const client = useClient({ storedRole: 'employer', accountRole: 'employer' });
  const result = await authBackend.signIn('employer@example.com', PASSWORD, 'seeker');
  assert.equal(result.portalRole, 'employer');
  assert.equal(result.user?.email, 'employer@example.com');
  assert.ok(
    client.calls.includes('job_register_role:{"requested_role":"employer"}'),
    `registered the account's own portal: ${client.calls.join(', ')}`,
  );
  assert.ok(
    !client.calls.some((call) => call.includes('"requested_role":"job_seeker"')),
    'never asks the backend for the tab that was clicked',
  );
});

await check('employer tab with a seeker email signs in and resolves seeker', async () => {
  useClient({ storedRole: 'job_seeker', accountRole: 'job_seeker' });
  const result = await authBackend.signIn('seeker@example.com', PASSWORD, 'employer');
  assert.equal(result.portalRole, 'seeker');
});

await check('the matching tab still signs in normally', async () => {
  useClient({ storedRole: 'employer', accountRole: 'employer' });
  const result = await authBackend.signIn('employer@example.com', PASSWORD, 'employer');
  assert.equal(result.portalRole, 'employer');
});

await check('an unavailable role lookup self-heals from the register mismatch', async () => {
  const client = useClient({ storedRole: new Error('function not deployed'), accountRole: 'employer' });
  const result = await authBackend.signIn('employer@example.com', PASSWORD, 'seeker');
  assert.equal(result.portalRole, 'employer');
  assert.ok(
    client.calls.includes('job_register_role:{"requested_role":"job_seeker"}'),
    'first attempt uses the clicked tab',
  );
  assert.ok(
    client.calls.includes('job_register_role:{"requested_role":"employer"}'),
    'the reported role is retried instead of failing the sign-in',
  );
});

await check('an unassigned account is registered to the clicked portal', async () => {
  useClient({ storedRole: 'unassigned', accountRole: 'job_seeker' });
  const result = await authBackend.signIn('new@example.com', PASSWORD, 'seeker');
  assert.equal(result.portalRole, 'seeker');
});

// ---------------------------------------------------------------------------
// 3. Failures still fail — with the account's real portal named
// ---------------------------------------------------------------------------

await check('a wrong password on the wrong tab names the real portal', async () => {
  useClient({ storedRole: 'employer', accountRole: 'employer' });
  await assert.rejects(
    () => authBackend.signIn('employer@example.com', 'not-the-password', 'seeker'),
    (error) => {
      assert.ok(isPasswordSignInBlockedError(error), `structured error, got ${error?.name}`);
      assert.equal(error.reason, 'wrong_password');
      assert.equal(error.role, 'employer');
      assert.ok(error.message.includes('Employer account'), error.message);
      assert.ok(!error.message.includes('already registered'), 'not reported as a role mismatch');
      return true;
    },
  );
});

await check('an admin email is refused after the password matches', async () => {
  const client = useClient({ storedRole: 'admin', accountRole: 'admin' });
  await assert.rejects(
    () => authBackend.signIn('admin@example.com', PASSWORD, 'seeker'),
    (error) => {
      assert.ok(isPortalRoleMismatchError(error), `structured mismatch, got ${error?.name}`);
      assert.equal(error.existingRole, 'admin');
      assert.equal(error.requestedRole, 'seeker');
      assert.ok(error.message.includes('Admin portal'), error.message);
      return true;
    },
  );
  assert.ok(client.calls.includes('auth.signOut'), 'the unusable session is cleared');
  assert.ok(
    !client.calls.some((call) => call.startsWith('job_register_role')),
    'no Jobs portal role is registered for an admin',
  );
});

await check('an unusable portal role clears the session and surfaces the error', async () => {
  // job_register_role refuses the account outright (e.g. ACCOUNT_INACTIVE).
  const client = useClient({
    storedRole: null,
    registerError: { code: '28000', message: 'ACCOUNT_INACTIVE' },
  });
  await assert.rejects(
    () => authBackend.signIn('dormant@example.com', PASSWORD, 'seeker'),
    (error) => {
      assert.ok(!(error instanceof PortalRoleMismatchError), 'not reported as a role mismatch');
      assert.ok(/ACCOUNT_INACTIVE/i.test(error.message), error.message);
      return true;
    },
  );
  assert.ok(client.calls.includes('auth.signOut'), 'the partial session is cleared');
});

// ---------------------------------------------------------------------------
// 4. Lookup + OAuth helpers used by the login screen and the provider return
// ---------------------------------------------------------------------------

await check('lookupPortalRole reports the portal behind an email', async () => {
  useClient({ storedRole: 'employer', accountRole: 'employer' });
  assert.equal(await authBackend.lookupPortalRole('  Employer@Example.com '), 'employer');
  useClient({ storedRole: 'unassigned', accountRole: 'employer' });
  assert.equal(await authBackend.lookupPortalRole('new@example.com'), null);
  useClient({ storedRole: new Error('offline'), accountRole: 'employer' });
  assert.equal(await authBackend.lookupPortalRole('new@example.com'), null);
  assert.equal(await authBackend.lookupPortalRole('   '), null);
});

await check('an OAuth return enters the stored portal, not the pressed button', async () => {
  const client = useClient({ storedRole: 'employer', accountRole: 'employer' });
  globalThis.window = {
    localStorage: {
      getItem: (key) => (key === 'nexora_pending_role' ? 'seeker' : null),
      removeItem: () => undefined,
    },
  };
  const resolved = await applyPendingOAuthRole('user-1');
  assert.equal(resolved, 'employer');
  assert.ok(
    client.calls.includes('job_register_role:{"requested_role":"employer"}'),
    `registered the account's own portal: ${client.calls.join(', ')}`,
  );
  delete globalThis.window;
});

console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));

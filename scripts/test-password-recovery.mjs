import WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';

globalThis.WebSocket = WebSocket;

const url = process.env.SUPABASE_URL;
const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !publicKey || !serviceKey) {
  throw new Error('Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY.');
}
if (!process.env.ALLOW_JOB_BACKEND_TEST) {
  throw new Error('Set ALLOW_JOB_BACKEND_TEST=1. The test creates and removes an isolated user.');
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, options);
const stamp = Date.now();
const email = `arena-recovery-${stamp}@example.com`;
const oldPassword = `Old-Arena-${stamp}!`;
const newPassword = `New-Arena-${stamp}!`;
let userId;
const checks = [];

function assertCheck(name, condition) {
  if (!condition) throw new Error(`FAILED: ${name}`);
  checks.push(name);
}
function dataOrThrow(result) {
  if (result.error) throw result.error;
  return result.data;
}

try {
  userId = dataOrThrow(await admin.auth.admin.createUser({
    email,
    password: oldPassword,
    email_confirm: true,
    user_metadata: {
      app_context: 'jobs',
      job_role: 'job_seeker',
      role: 'seeker',
      full_name: 'Recovery Test',
    },
  })).user.id;

  const generated = dataOrThrow(await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: 'https://job-portal-nexora.vercel.app/?recovery=1' },
  }));
  assertCheck('recovery link generated',
    Boolean(generated.properties.action_link) && generated.properties.action_link.includes('job-portal-nexora.vercel.app'));

  const recoveryClient = createClient(url, publicKey, options);
  const verified = dataOrThrow(await recoveryClient.auth.verifyOtp({
    type: 'recovery',
    token_hash: generated.properties.hashed_token,
  }));
  assertCheck('recovery session created', Boolean(verified.session?.access_token));

  const weakPassword = await recoveryClient.auth.updateUser({ password: 'lowercaseonly' });
  assertCheck('backend password policy enforced', Boolean(weakPassword.error));

  dataOrThrow(await recoveryClient.auth.updateUser({ password: newPassword }));
  dataOrThrow(await recoveryClient.auth.signOut());

  const oldLoginClient = createClient(url, publicKey, options);
  const oldLogin = await oldLoginClient.auth.signInWithPassword({ email, password: oldPassword });
  assertCheck('old password rejected', Boolean(oldLogin.error));

  const newLoginClient = createClient(url, publicKey, options);
  const newLogin = dataOrThrow(await newLoginClient.auth.signInWithPassword({ email, password: newPassword }));
  assertCheck('new password accepted', Boolean(newLogin.session?.access_token));

  const reusedToken = await createClient(url, publicKey, options).auth.verifyOtp({
    type: 'recovery',
    token_hash: generated.properties.hashed_token,
  });
  assertCheck('recovery token is one-time', Boolean(reusedToken.error));

  const role = dataOrThrow(await admin.from('job_user_roles').select('role').eq('user_id', userId).single());
  assertCheck('portal role preserved', role.role === 'job_seeker');

  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId);
}

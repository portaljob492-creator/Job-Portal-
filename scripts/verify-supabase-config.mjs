import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Load .env files if present (without requiring external dependencies)
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const fileEnv = {
  ...loadEnvFile(path.resolve(process.cwd(), '.env')),
  ...loadEnvFile(path.resolve(process.cwd(), '.env.local')),
  ...loadEnvFile(path.resolve(process.cwd(), '.env.production')),
};

const supabaseUrl = (
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  fileEnv.VITE_SUPABASE_URL ||
  fileEnv.SUPABASE_URL ||
  'https://qwaehqsmodekbgvnaavz.supabase.co'
).trim().replace(/\/+$/, '');

const supabaseAnonKey = (
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  fileEnv.VITE_SUPABASE_ANON_KEY ||
  fileEnv.SUPABASE_ANON_KEY ||
  fileEnv.SUPABASE_PUBLISHABLE_KEY ||
  ''
).trim();

const supabaseStorageKey = (
  process.env.VITE_SUPABASE_STORAGE_KEY ||
  fileEnv.VITE_SUPABASE_STORAGE_KEY ||
  ''
).trim();

console.log('='.repeat(65));
console.log('  NEXORA JOBS - SUPABASE CONFIGURATION & LIVE STATUS CHECK  ');
console.log('='.repeat(65));

const checks = [];

function recordCheck(name, pass, details = '') {
  checks.push({ name, pass, details });
  const symbol = pass ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m';
  console.log(`${symbol} ${name}`);
  if (details) {
    console.log(`       -> ${details}`);
  }
}

// 1. Check URL
const urlValid = Boolean(supabaseUrl && supabaseUrl.startsWith('https://'));
recordCheck('VITE_SUPABASE_URL presence and format', urlValid, `URL: ${supabaseUrl}`);

// 2. Check Anon Key
const keyPresent = Boolean(supabaseAnonKey);
const isPlaceholder =
  supabaseAnonKey === 'YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY' ||
  supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY' ||
  supabaseAnonKey === 'your-anon-key';

let jwtDecoded = null;
let keyValid = false;
let keyError = '';

if (!keyPresent) {
  keyError = 'VITE_SUPABASE_ANON_KEY is not set in process.env or .env';
} else if (isPlaceholder) {
  keyError = 'VITE_SUPABASE_ANON_KEY is still set to placeholder text';
} else {
  const parts = supabaseAnonKey.split('.');
  if (parts.length !== 3 || !supabaseAnonKey.startsWith('eyJ')) {
    keyError = 'VITE_SUPABASE_ANON_KEY is not a valid 3-part JWT token';
  } else {
    try {
      const payloadBuf = Buffer.from(parts[1], 'base64');
      jwtDecoded = JSON.parse(payloadBuf.toString('utf8'));
      keyValid = true;
    } catch (e) {
      keyError = `Failed to decode JWT payload: ${e.message}`;
    }
  }
}

recordCheck('VITE_SUPABASE_ANON_KEY validation', keyValid, keyValid
  ? `Role: ${jwtDecoded.role} | Ref: ${jwtDecoded.ref} | Exp: ${new Date(jwtDecoded.exp * 1000).toISOString()}`
  : keyError
);

// 3. Project Ref Match
let refMatch = false;
try {
  const hostnameRef = new URL(supabaseUrl).hostname.split('.')[0];
  if (jwtDecoded && jwtDecoded.ref) {
    refMatch = hostnameRef === jwtDecoded.ref;
    recordCheck('URL and Anon Key Project Ref consistency', refMatch,
      refMatch
        ? `Both point to project: ${hostnameRef}`
        : `URL points to "${hostnameRef}" but key is for "${jwtDecoded.ref}"`
    );
  }
} catch (e) {
  recordCheck('URL and Anon Key Project Ref consistency', false, e.message);
}

// 4. Client Initialization
let client = null;
let clientInitPass = false;
if (urlValid && keyValid) {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    clientInitPass = Boolean(client && client.auth && client.from);
    recordCheck('Supabase Client initialization', clientInitPass, 'Client created with auth and query interfaces');
  } catch (e) {
    recordCheck('Supabase Client initialization', false, e.message);
  }
} else {
  recordCheck('Supabase Client initialization', false, 'Skipped due to invalid URL or Key');
}

// 5. Live Network Checks
if (client) {
  const startAuth = Date.now();
  try {
    const sessionRes = await client.auth.getSession();
    const authLatency = Date.now() - startAuth;
    const authOk = !sessionRes.error;
    recordCheck(
      'Live Auth Service Check (client.auth.getSession)',
      authOk,
      authOk ? `Responded in ${authLatency}ms (Session: ${sessionRes.data.session ? 'Active' : 'Empty'})` : sessionRes.error.message
    );
  } catch (e) {
    recordCheck('Live Auth Service Check (client.auth.getSession)', false, e.message);
  }

  const startDb = Date.now();
  try {
    const dbRes = await client.from('public_job_listings').select('id').limit(1);
    const dbLatency = Date.now() - startDb;
    const dbOk = !dbRes.error;
    recordCheck(
      'Live REST API Check (public_job_listings view)',
      dbOk,
      dbOk ? `Responded in ${dbLatency}ms (${dbRes.data.length} records returned)` : dbRes.error.message
    );
  } catch (e) {
    recordCheck('Live REST API Check (public_job_listings view)', false, e.message);
  }
}

// 6. Production Build Environment Verification
console.log('\n' + '-'.repeat(65));
console.log('  PRODUCTION BUILD BUNDLE VERIFICATION  ');
console.log('-'.repeat(65));

const distDir = path.resolve(process.cwd(), 'dist');
if (!fs.existsSync(distDir)) {
  console.log('  [NOTE] dist/ directory not found. Run "npm run build" to test the production bundle.');
} else {
  const assetsDir = path.join(distDir, 'assets');
  let foundInBundle = false;
  let bundleUrlFound = false;
  let bundleKeyFound = false;

  if (fs.existsSync(assetsDir)) {
    const jsFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js'));
    for (const file of jsFiles) {
      const code = fs.readFileSync(path.join(assetsDir, file), 'utf8');
      if (supabaseUrl && code.includes(supabaseUrl)) {
        bundleUrlFound = true;
      }
      if (supabaseAnonKey && code.includes(supabaseAnonKey)) {
        bundleKeyFound = true;
      }
    }
  }

  foundInBundle = bundleUrlFound && bundleKeyFound;
  recordCheck(
    'Production Bundle (dist/assets/*.js) includes Supabase URL',
    bundleUrlFound,
    bundleUrlFound ? `URL "${supabaseUrl}" statically bundled into production assets` : 'URL not found in dist/assets/'
  );
  recordCheck(
    'Production Bundle (dist/assets/*.js) includes Supabase Anon Key',
    bundleKeyFound,
    bundleKeyFound ? 'Anon Key statically embedded in production bundle' : 'Anon key not found in dist/assets/'
  );
}

// Summary
console.log('\n' + '='.repeat(65));
const allPassed = checks.every(c => c.pass);
console.log(`RESULT: ${allPassed ? '\x1b[32mALL CHECKS PASSED\x1b[0m' : '\x1b[31mSOME CHECKS FAILED\x1b[0m'}`);
console.log('='.repeat(65));

if (!allPassed) {
  process.exit(1);
} else {
  process.exit(0);
}

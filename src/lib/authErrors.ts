/**
 * Session-validity classification shared by the auth store, the app bootstrap and
 * the location sync lifecycle.
 *
 * This module is intentionally dependency-free (no Supabase client, no Vite env)
 * so it can be exercised directly by `npm run test:location`.
 */

export const SESSION_INVALID_PATTERNS: readonly RegExp[] = [
  /auth session missing/i,
  /session not found/i,
  /session_not_found/i,
  /session expired/i,
  /session_expired/i,
  /invalid login credentials/i,
  /invalid credentials/i,
  /invalid_credentials/i,
  /invalid refresh token/i,
  /refresh token not found/i,
  /refresh_token_not_found/i,
  /token has expired/i,
  /token is expired/i,
  /jwt expired/i,
  /auth[_ ]?required/i,
];

/** Postgres / PostgREST error codes that always mean "this session cannot be used". */
export const SESSION_INVALID_CODES: readonly string[] = [
  '28000', // AUTH_REQUIRED raised by the Jobs RPC guards
  'PGRST301', // expired/invalid JWT at the PostgREST layer
  'session_not_found',
  'session_expired',
  'invalid_credentials',
  'refresh_token_not_found',
];

function collectSignals(error: unknown): { text: string; code: string | undefined; status: number | undefined } {
  if (!error) return { text: '', code: undefined, status: undefined };
  if (typeof error === 'string') return { text: error, code: undefined, status: undefined };

  const candidate = error as Record<string, unknown>;
  const text = [candidate.message, candidate.name, candidate.error, candidate.error_description, candidate.hint, candidate.details]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' | ');
  const code = typeof candidate.code === 'string' ? candidate.code : undefined;
  const status = typeof candidate.status === 'number' ? candidate.status : undefined;
  return { text, code, status };
}

/**
 * True when the failure means the stored session is unusable and the user must
 * authenticate again. Network failures and offline launches are deliberately
 * excluded so a flaky connection never destroys a valid session.
 */
export function isSessionInvalidError(error: unknown): boolean {
  const { text, code, status } = collectSignals(error);
  if (code && SESSION_INVALID_CODES.includes(code)) return true;
  if (SESSION_INVALID_PATTERNS.some((pattern) => pattern.test(text))) return true;
  // A bare 401 only counts when it is clearly about auth, not about RLS.
  if (status === 401 && /auth|token|session|credential|jwt|expired/i.test(text)) return true;
  return false;
}

/**
 * Session-validity classification shared by the auth store, the app bootstrap and
 * the location sync lifecycle.
 *
 * This module is intentionally dependency-free (no Supabase client, no Vite env)
 * so it can be exercised directly by `npm run test:location`.
 */

import type { UserRole } from '../types';

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

/** Human-readable portal name used in mismatch messages and switch buttons. */
export function portalRoleLabel(role: UserRole): string {
  return role === 'employer' ? 'Employer' : 'Job Seeker';
}

/**
 * Friendly message for a portal role conflict. Mirrors the copy used by the
 * backend (`job_register_role` raising `PORTAL_ROLE_MISMATCH:<role>`).
 */
export function roleMismatchMessage(existingRole: UserRole): string {
  const label = portalRoleLabel(existingRole);
  const article = existingRole === 'employer' ? 'an' : 'a';
  return `This email is already registered as ${article} ${label}. Please sign in through the ${label} portal.`;
}

export interface PortalRoleMismatchDetails {
  /** Email the user attempted to sign in / sign up with. */
  email: string;
  /** Portal role the user attempted to use. */
  requestedRole: UserRole;
  /** Permanent portal role the backend reports for this email. */
  existingRole: UserRole;
}

/**
 * Structured error thrown whenever an email is permanently registered to the
 * other portal. Carries the roles and the email so the UI can prefill the
 * correct portal login (`/login?role=…&email=…`) and render a switch button.
 */
export class PortalRoleMismatchError extends Error {
  readonly email: string;
  readonly requestedRole: UserRole;
  readonly existingRole: UserRole;

  constructor(details: PortalRoleMismatchDetails) {
    super(roleMismatchMessage(details.existingRole));
    this.name = 'PortalRoleMismatchError';
    this.email = details.email;
    this.requestedRole = details.requestedRole;
    this.existingRole = details.existingRole;
  }
}

export function isPortalRoleMismatchError(error: unknown): error is PortalRoleMismatchError {
  return error instanceof PortalRoleMismatchError;
}

/** Extracts a searchable text fingerprint from any error shape. */
export function errorSignalText(error: unknown): string {
  return collectSignals(error).text;
}

const PORTAL_ROLE_MISMATCH_PATTERN = /PORTAL_ROLE_MISMATCH:(job_seeker|employer)/i;

/**
 * Parses a backend role-rejection signal (`PORTAL_ROLE_MISMATCH:<role>` raised
 * by `job_register_role`) into a structured `PortalRoleMismatchError`, or null
 * when the error is unrelated so callers keep their normal error handling.
 */
export function parsePortalRoleMismatch(
  error: unknown,
  requestedRole: UserRole,
  email: string,
): PortalRoleMismatchError | null {
  const match = errorSignalText(error).match(PORTAL_ROLE_MISMATCH_PATTERN);
  if (!match) return null;
  return new PortalRoleMismatchError({
    email,
    requestedRole,
    existingRole: match[1] === 'employer' ? 'employer' : 'seeker',
  });
}

const UNASSIGNED_PORTAL_ROLE_PATTERN = /no jobs portal role is assigned/i;

/**
 * True when the account has a valid session but no portal role row yet (e.g. it
 * was created by another Nexora app). Such a session must be cleared before the
 * user is invited to sign in through a Jobs portal, which assigns the role.
 */
export function isUnassignedPortalRoleError(error: unknown): boolean {
  return UNASSIGNED_PORTAL_ROLE_PATTERN.test(errorSignalText(error));
}

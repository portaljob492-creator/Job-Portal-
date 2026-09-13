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
  // GoTrue returns this when a still-cached token belongs to an auth user that
  // has since been deleted. It is an invalid session, not a sign-up failure.
  /user from sub claim in jwt does not exist/i,
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
  'user_not_found',
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
  return `You are registered as ${article} ${label}. Please switch to the correct tab.`;
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

/**
 * Why an email/password sign-in was refused even though the account exists.
 *
 * - `wrong_password`: the email is registered to this exact portal, so the
 *   account is real and only the credential is wrong (or was never set because
 *   the account was created through Google/Apple).
 * - `unassigned`: the email exists in Nexora but has no permanent Jobs portal
 *   role yet, so the user has to come back through a portal that assigns one.
 */
export type PasswordSignInBlockedReason = 'wrong_password' | 'unassigned' | 'unconfirmed';

/**
 * Thrown when a password sign-in fails for an account that definitely exists.
 *
 * Carrying the email and role lets the login screen turn a dead-end sentence
 * into actions: send a reset link without retyping the email, or continue with
 * the social provider the account may have been created with.
 */
export class PasswordSignInBlockedError extends Error {
  readonly email: string;
  readonly role: UserRole;
  readonly reason: PasswordSignInBlockedReason;

  constructor(details: { email: string; role: UserRole; reason: PasswordSignInBlockedReason }) {
    super(
      details.reason === 'unconfirmed'
        ? 'Your account exists but its email address was never confirmed. Open the confirmation email we sent, or send a fresh one below.'
        : details.reason === 'unassigned'
          ? 'This email exists in Nexora, but it has not been linked to a Jobs portal yet. Use the same password or social sign-in method you used when creating it, then select the correct Jobs portal.'
          : `We found your ${portalRoleLabel(details.role)} account, but that password does not match it. Reset the password, or continue with Google/Apple if that is how the account was created.`,
    );
    this.name = 'PasswordSignInBlockedError';
    this.email = details.email;
    this.role = details.role;
    this.reason = details.reason;
  }
}

export function isPasswordSignInBlockedError(error: unknown): error is PasswordSignInBlockedError {
  return error instanceof PasswordSignInBlockedError;
}

/**
 * Errors the auth screens render as an actionable card (portal switch, password
 * recovery, confirmation re-send) instead of the generic banner. The app-level
 * handlers must let these through: swallowing them leaves the user on a sentence
 * with no way forward, because the card that offers the next step never renders.
 */
export function isActionableAuthScreenError(error: unknown): boolean {
  return isPortalRoleMismatchError(error)
    || isPasswordSignInBlockedError(error)
    || isUnassignedPortalRoleError(error);
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

/**
 * GoTrue / Supabase error codes that mean "too many requests". The email ones
 * matter most: the built-in mailer only sends a couple of auth emails per hour,
 * so a user who keeps pressing "Send reset link" locks themselves out of
 * recovery by email and needs the token path instead.
 */
export const RATE_LIMIT_CODES: readonly string[] = [
  'over_email_send_rate_limit',
  'over_sms_send_rate_limit',
  'over_request_rate_limit',
  'rate_limit_exceeded',
];

const RATE_LIMIT_PATTERNS: readonly RegExp[] = [
  /rate limit/i,
  /too many requests/i,
  /only request this after \d+ seconds?/i,
];

/** GoTrue's resend interval message, e.g. "…you can only request this after 30 seconds." */
const RESEND_INTERVAL_PATTERN = /only request this after (\d+) seconds?/i;

/** Fallback wait for the hourly email cap (built-in provider: 2 emails/hour). */
export const EMAIL_HOURLY_COOLDOWN_SECONDS = 3600;
/** Fallback wait for generic IP/request throttling. */
export const REQUEST_COOLDOWN_SECONDS = 60;

export type RateLimitScope = 'email' | 'request';

/**
 * A throttled auth request. `retryAfterSeconds` drives the on-screen countdown
 * so the UI can stop the user from burning more attempts, and `scope`
 * distinguishes "wait for the hourly email quota" from "wait a few seconds".
 */
export class AuthRateLimitError extends Error {
  readonly retryAfterSeconds: number;
  readonly scope: RateLimitScope;

  constructor(scope: RateLimitScope, retryAfterSeconds: number, message?: string) {
    super(
      message ??
        (scope === 'email'
          ? `Too many reset emails requested. Try again in ${formatRetryCountdown(retryAfterSeconds)}.`
          : `Too many requests. Try again in ${formatRetryCountdown(retryAfterSeconds)}.`),
    );
    this.name = 'AuthRateLimitError';
    this.scope = scope;
    this.retryAfterSeconds = Math.max(1, Math.round(retryAfterSeconds));
  }
}

export function isAuthRateLimitError(error: unknown): error is AuthRateLimitError {
  return error instanceof AuthRateLimitError;
}

/** Renders a wait as `m:ss` (or plain seconds below a minute) for countdowns. */
export function formatRetryCountdown(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function retryAfterSecondsFor(scope: RateLimitScope, text: string): number {
  const interval = text.match(RESEND_INTERVAL_PATTERN);
  if (interval) return Number(interval[1]);
  return scope === 'email' ? EMAIL_HOURLY_COOLDOWN_SECONDS : REQUEST_COOLDOWN_SECONDS;
}

/**
 * Classifies a throttled auth request, or returns `null` when the failure is
 * something else. Detects the 429 status, GoTrue's rate-limit error codes and
 * the resend-interval message (which does not contain the words "rate limit").
 */
export function parseRateLimitError(error: unknown): AuthRateLimitError | null {
  if (isAuthRateLimitError(error)) return error;
  const { text, code, status } = collectSignals(error);
  const isRateLimited =
    status === 429 ||
    (code ? RATE_LIMIT_CODES.includes(code) : false) ||
    RATE_LIMIT_PATTERNS.some((pattern) => pattern.test(text));
  if (!isRateLimited) return null;

  const scope: RateLimitScope = /email|sms|resend|only request this after/i.test(text) ? 'email' : 'request';
  return new AuthRateLimitError(scope, retryAfterSecondsFor(scope, text), text.trim() || undefined);
}

const RECOVERY_LINK_REJECTED_PATTERNS: readonly RegExp[] = [
  /otp_expired/i,
  /otp has expired/i,
  /token (has )?expired/i,
  /token is not valid/i,
  /invalid token/i,
  /otp is invalid/i,
  /flow_state_expired/i,
  /bad_code_verifier/i,
  /auth session missing/i,
  /session not found/i,
  /session_expired/i,
  /link has (already )?been used/i,
];

/**
 * True when a recovery token/session can no longer be used, so the UI should
 * stop offering the password form and ask for a fresh reset email instead of
 * leaving the user on a form that can never succeed.
 */
export function isRecoveryLinkRejectedError(error: unknown): boolean {
  const { text, code } = collectSignals(error);
  if (code && ['otp_expired', 'flow_state_expired', 'bad_code_verifier', 'session_expired', 'session_not_found'].includes(code)) {
    return true;
  }
  return RECOVERY_LINK_REJECTED_PATTERNS.some((pattern) => pattern.test(text));
}

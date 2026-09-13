/**
 * Portal-role resolution for the auth flows.
 *
 * One email is permanently linked to one portal role (`public.job_user_roles`,
 * enforced by `job_register_role`). That makes the portal a property of the
 * *account*, never of the tab somebody happened to click — so a Job Seeker tab
 * filled in with an Employer email is a routing detail, not an invalid request.
 *
 * These helpers turn the backend's stored role into the decision the auth flows
 * act on: enter the account's own portal, or hand admin emails to the admin
 * sign-in. They are dependency-free so `npm run test:auth` can exercise them
 * directly.
 */

import type { UserRole } from '../types';

/** Portal roles a Jobs sign-in can open. Admins sign in on their own screen. */
export type EnterablePortalRole = Exclude<UserRole, 'admin'>;

/** True for the two portals the login screen can enter directly. */
export function isEnterablePortalRole(role: unknown): role is EnterablePortalRole {
  return role === 'seeker' || role === 'employer';
}

/**
 * Maps a backend role value (`job_seeker` / `employer` / `admin` /
 * `unassigned` / null) onto the app's role union. Unknown or missing values
 * become null: "this account has no portal role we can act on".
 */
export function normalizeStoredPortalRole(raw: unknown): UserRole | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toLowerCase();
  if (value === 'job_seeker') return 'seeker';
  if (value === 'employer') return 'employer';
  if (value === 'admin') return 'admin';
  return null;
}

/**
 * Outcome of matching a clicked portal tab against the account behind an email.
 *
 * - `enter`: sign in and open `role`. `corrected` is true when that differs
 *   from the clicked tab, i.e. the user picked the "wrong" portal and is being
 *   routed to the right one instead of being refused.
 * - `admin_portal`: the email belongs to an administrator; Jobs portal entry is
 *   closed to it and the admin sign-in is the way in.
 */
export type SignInPortalDecision =
  | { kind: 'enter'; role: EnterablePortalRole; corrected: boolean }
  | { kind: 'admin_portal' };

/**
 * Decides which portal a password/OAuth sign-in opens.
 *
 * `storedRole` is the account's permanent role as reported by the backend
 * (null when the address is unknown, unassigned, or the lookup failed) and
 * `requestedRole` is the tab that was clicked. The stored role always wins when
 * it is a Jobs portal; otherwise the clicked tab is the best available guess and
 * `job_register_role` either assigns it or reports the real role on entry.
 */
export function decideSignInPortal(
  storedRole: UserRole | null,
  requestedRole: UserRole,
): SignInPortalDecision {
  if (storedRole === 'admin') return { kind: 'admin_portal' };
  if (isEnterablePortalRole(storedRole)) {
    return { kind: 'enter', role: storedRole, corrected: storedRole !== requestedRole };
  }
  return {
    kind: 'enter',
    role: isEnterablePortalRole(requestedRole) ? requestedRole : 'seeker',
    corrected: false,
  };
}

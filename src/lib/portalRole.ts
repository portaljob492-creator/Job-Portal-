/**
 * Portal-role validation for the auth flows.
 *
 * One email is permanently linked to one portal role (`public.job_user_roles`,
 * enforced by `job_register_role`). The requested portal tab is therefore
 * validated against that stored role before anything else happens: a Job Seeker
 * tab filled in with an Employer email is refused up front, with the portal the
 * account really belongs to, and the login form turns that refusal into the
 * inline "Switch to … Portal" action.
 *
 * These helpers are dependency-free so `npm run test:signin` can exercise the
 * decision directly, without Supabase.
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
 * - `enter`: the tab matches the account, or the account has no portal role
 *   yet, so authentication may proceed.
 * - `mismatch`: the email is permanently registered to a different portal. The
 *   sign-in is refused *before the password is checked*, with `existingRole`
 *   naming the portal the user has to come back through.
 */
export type SignInPortalDecision =
  | { kind: 'enter'; role: EnterablePortalRole }
  | { kind: 'mismatch'; existingRole: UserRole };

/**
 * Validates the requested portal tab against the account's stored role.
 *
 * `storedRole` is the permanent role the backend reports for the email (null
 * when the address is unknown, has no Jobs portal role yet, or the lookup
 * failed) and `requestedRole` is the tab that was clicked. A stored role — any
 * stored role, admin included — that differs from the tab is a refusal: one
 * email belongs to exactly one portal, and the login form offers the switch.
 * With nothing stored yet the clicked tab is what `job_register_role` assigns.
 */
export function decideSignInPortal(
  storedRole: UserRole | null,
  requestedRole: UserRole,
): SignInPortalDecision {
  if (storedRole && storedRole !== requestedRole) {
    return { kind: 'mismatch', existingRole: storedRole };
  }
  return {
    kind: 'enter',
    role: isEnterablePortalRole(requestedRole) ? requestedRole : 'seeker',
  };
}

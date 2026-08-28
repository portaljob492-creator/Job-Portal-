/**
 * Email normalisation shared by every auth entry point.
 *
 * GoTrue stores and looks up identities lower-cased (`job_email_portal_role`
 * matches with `lower(u.email)=lower(trim(p_email))`), so the client sends the
 * same shape everywhere: signup, login, recovery request and OTP verification.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Light shape check used before spending a request on an obviously bad value. */
export function isLikelyEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email.trim());
}

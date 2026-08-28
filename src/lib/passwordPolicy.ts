/**
 * Single source of truth for the portal's password rules.
 *
 * The reset form, the signup screens and the admin CLI (`scripts/
 * reset-user-password.mjs`) all validate against this module, so a password can
 * never be accepted by one entry point and rejected by the next. Dependency
 * free so it can be imported by Node scripts and unit tests.
 */

export const MIN_PASSWORD_LENGTH = 8;

export type PasswordRuleCode = 'length' | 'lowercase' | 'uppercase' | 'number';

export interface PasswordRule {
  code: PasswordRuleCode;
  /** Requirement text shown in the reset form's checklist. */
  label: string;
  /** Message used when this is the first rule the password breaks. */
  message: string;
  test(password: string): boolean;
}

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    code: 'length',
    label: `At least ${MIN_PASSWORD_LENGTH} characters long`,
    message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
    test: (password) => password.length >= MIN_PASSWORD_LENGTH,
  },
  {
    code: 'lowercase',
    label: 'Contains at least 1 lowercase letter',
    message: 'New password must contain at least one lowercase letter.',
    test: (password) => /[a-z]/.test(password),
  },
  {
    code: 'uppercase',
    label: 'Contains at least 1 uppercase letter',
    message: 'New password must contain at least one uppercase letter.',
    test: (password) => /[A-Z]/.test(password),
  },
  {
    code: 'number',
    label: 'Contains at least 1 number',
    message: 'New password must contain at least one number.',
    test: (password) => /[0-9]/.test(password),
  },
];

/** Every rule the password currently breaks, in display order. */
export function passwordRuleFailures(password: string): PasswordRule[] {
  return PASSWORD_RULES.filter((rule) => !rule.test(password));
}

/**
 * Human-readable reason the password is not acceptable, or `null` when it is.
 * Returns the first broken rule so the message matches the checklist order.
 */
export function validateNewPassword(password: string): string | null {
  const [firstFailure] = passwordRuleFailures(password);
  return firstFailure ? firstFailure.message : null;
}

export function isPasswordAcceptable(password: string): boolean {
  return validateNewPassword(password) === null;
}

export interface PasswordStrength {
  /** 0 = empty, 1 = weak, 2 = medium, 3 = strong. */
  score: 0 | 1 | 2 | 3;
  label: '' | 'Weak' | 'Medium' | 'Strong';
  /** Tailwind classes for the strength badge. */
  color: string;
}

/** Strength meter used by the reset form (length + letter case + a digit). */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= MIN_PASSWORD_LENGTH) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;

  if (score === 1) return { score: 1, label: 'Weak', color: 'bg-rose-500 text-rose-700' };
  if (score === 2) return { score: 2, label: 'Medium', color: 'bg-amber-500 text-amber-700' };
  return { score: 3, label: 'Strong', color: 'bg-emerald-500 text-emerald-700' };
}

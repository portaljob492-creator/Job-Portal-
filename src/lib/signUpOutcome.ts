/**
 * The one decision sign-up has to make, kept dependency-free so the flow can be
 * exercised directly by `npm run test:location`.
 *
 * Supabase returns a `user` and no `session` when the project requires the email
 * address to be confirmed before a session is issued. That is a successful
 * sign-up: the account exists and a confirmation email is on its way. Treating
 * it as a failure — which is what the signup screens used to do — makes every
 * sign-up look broken while the account was created correctly.
 */

export interface SignUpResponseLike {
  user?: { id?: string | null } | null;
  session?: { access_token?: string | null } | null;
}

export type SignUpResult =
  /** Supabase issued a session: continue straight into the portal. */
  | { status: 'signed_in'; userId: string }
  /** The account exists but the email must be confirmed before signing in. */
  | { status: 'confirmation_required'; userId: string }
  /** No account was created (the caller has already surfaced the API error). */
  | { status: 'failed' };

export function resolveSignUpResult(data: SignUpResponseLike | null | undefined): SignUpResult {
  const userId = data?.user?.id;
  if (!userId) return { status: 'failed' };
  if (data?.session) return { status: 'signed_in', userId };
  return { status: 'confirmation_required', userId };
}

/**
 * True when a sign-in attempt failed only because the address was never
 * confirmed, so the UI can offer a re-send instead of a bare credential error.
 */
export function isEmailNotConfirmedError(error: unknown): boolean {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : typeof error === 'object' && error && 'message' in error
        ? String((error as { message: unknown }).message)
        : '';
  return /email not confirmed|email_not_confirmed/i.test(message);
}

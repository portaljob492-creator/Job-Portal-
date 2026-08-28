/**
 * Parsing for the "I already have the email" recovery path.
 *
 * Supabase caps how many auth emails a project can send per hour (the built-in
 * provider allows only a couple), and a reset link is single-use. When that
 * limit is hit, or when the link is opened on a different device than the one
 * holding the inbox, the user still has a perfectly good token in their mailbox
 * — they just have no way to hand it to the app. This module turns whatever the
 * user pastes (full reset link, bare token hash, or 6-digit code) into the exact
 * shape `supabase.auth.verifyOtp({ type: 'recovery' })` needs, so recovery never
 * depends on sending another email.
 */

export type RecoveryTokenInput =
  | { kind: 'token_hash'; value: string }
  | { kind: 'otp'; value: string };

/** Supabase puts the verification token in `token=` on the email link. */
const TOKEN_PARAMS = ['token', 'token_hash', 'otp', 'code'] as const;

const OTP_PATTERN = /^\d{6}$/;
/** Base64url (SHA-256 hashed tokens are 43 chars); tolerant of `=` padding. */
const TOKEN_HASH_PATTERN = /^[A-Za-z0-9_-]{20,}={0,2}$/;

function classify(value: string): RecoveryTokenInput {
  return OTP_PATTERN.test(value) ? { kind: 'otp', value } : { kind: 'token_hash', value };
}

/** Reads a token from the query string or the hash fragment of a pasted URL. */
function tokenFromUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const hashQuery = url.hash.startsWith('#') ? url.hash.slice(1) : '';
  const sources = [url.searchParams, ...(hashQuery ? [new URLSearchParams(hashQuery)] : [])];
  for (const params of sources) {
    for (const key of TOKEN_PARAMS) {
      const value = params.get(key)?.trim();
      if (value) return value;
    }
  }
  return null;
}

/**
 * Normalises pasted user input into a recovery token, or `null` when it holds
 * nothing usable. Accepts, in order:
 *   1. the full reset link from the email (`…/auth/v1/verify?token=…`),
 *   2. the bare token / token hash,
 *   3. a 6-digit one-time code.
 */
export function parseRecoveryTokenInput(raw: string): RecoveryTokenInput | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const looksLikeUrl = /^https?:\/\//i.test(trimmed) || trimmed.includes('/auth/v1/') || trimmed.includes('?token');
  if (looksLikeUrl) {
    const fromUrl = tokenFromUrl(trimmed);
    if (!fromUrl) return null;
    return classify(fromUrl);
  }

  if (OTP_PATTERN.test(trimmed)) return { kind: 'otp', value: trimmed };
  if (TOKEN_HASH_PATTERN.test(trimmed)) return { kind: 'token_hash', value: trimmed };
  return null;
}

/** An OTP is verified against an account, so it needs the email; a token hash does not. */
export function recoveryInputNeedsEmail(input: RecoveryTokenInput): boolean {
  return input.kind === 'otp';
}

export function describeRecoveryInput(input: RecoveryTokenInput): string {
  return input.kind === 'otp' ? '6-digit code' : 'reset link token';
}

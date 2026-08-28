import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, KeyRound, Mail, RefreshCw } from 'lucide-react';

import { formatRetryCountdown, isAuthRateLimitError } from '../../lib/authErrors';
import { isLikelyEmail } from '../../lib/email';
import {
  parseRecoveryTokenInput,
  type RecoveryTokenInput,
} from '../../lib/recoveryLink';

interface ForgotPasswordScreenProps {
  onBackToLogin: () => void;
  onSendResetLink: (email: string) => Promise<void> | void;
  /**
   * Verifies a token the user already holds (the newest reset email in their
   * inbox). This sends no email, so it works while the provider's hourly quota
   * is exhausted — the main escape hatch out of a rate-limit lockout.
   */
  onVerifyRecoveryToken: (token: RecoveryTokenInput, email: string) => Promise<void> | void;
}

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  onBackToLogin,
  onSendResetLink,
  onVerifyRecoveryToken,
}) => {
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSending || cooldown > 0) return;
    setError(null);
    setIsSending(true);
    try {
      await onSendResetLink(email);
      setSubmitted(true);
      setCooldown(60);
    } catch (resetError) {
      const message = messageOf(resetError, 'Unable to send the reset link.');
      setError(message);
      // Throttled: count down instead of letting the user burn more of the
      // provider's quota, and point them at the token path below.
      if (isAuthRateLimitError(resetError)) {
        setSubmitted(false);
        setCooldown(resetError.retryAfterSeconds);
      }
    } finally {
      setIsSending(false);
    }
  };

  const resendDisabled = cooldown > 0;

  return (
    <div className="bg-[#fcf9f8] text-[#1c1b1b] min-h-screen flex flex-col font-sans antialiased">
      {/* TopAppBar Header */}
      <header className="sticky top-0 bg-white shadow-[0_4px_12px_rgba(90,63,71,0.05)] flex justify-between items-center px-5 h-16 w-full z-50 border-b border-[#e6e1e1]">
        <button
          type="button"
          onClick={onBackToLogin}
          aria-label="Go back"
          className="text-[#8e004b] hover:bg-[#e6e1e1] transition-colors p-2 rounded-full flex items-center justify-center cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-xl text-[#8e004b] tracking-tight">Nexora Jobs</h1>
        <div className="w-10" />
      </header>

      {/* Main Content Canvas */}
      <main className="flex-grow flex items-center justify-center px-5 py-8">
        <div className="w-full max-w-md bg-white border border-[#e8e8e8] rounded-2xl p-6 sm:p-8 shadow-[0_8px_24px_rgba(90,63,71,0.08)]">
          
          {/* Header & Supporting Text */}
          <div className="flex flex-col gap-2 mb-6 text-center">
            <h2 className="text-2xl font-extrabold text-[#1c1b1b]">Forgot Password?</h2>
            <p className="text-sm text-[#594047] leading-relaxed">
              Enter your registered email and we'll send you a reset link.
            </p>
          </div>

          {/* Success State */}
          {submitted ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-14 h-14 rounded-full bg-[#ffd9e2] text-[#8e004b] flex items-center justify-center shadow-xs">
                <CheckCircle2 className="w-8 h-8 text-[#e2007c]" />
              </div>
              <div className="space-y-1">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold uppercase tracking-wider mb-1">
                  Success
                </span>
                <h3 className="font-extrabold text-xl text-[#1c1b1b]">Reset link sent</h3>
                <p className="text-xs text-[#594047] leading-relaxed max-w-xs mx-auto">
                  If an account exists for <span className="font-bold text-[#8e004b]">{email}</span>, a one-time reset link has been sent. Check spam too, and use only the newest email.
                </p>
                <p className="text-[11px] font-semibold text-[#8c7077]">The link expires after 60 minutes and works only once.</p>
              </div>

              <div className="w-full pt-4 border-t border-[#e6e1e1] flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={onBackToLogin}
                  className="w-full h-10 bg-[#f1edec] hover:bg-[#ffd9e2] text-[#8e004b] rounded-full text-xs font-bold transition-all cursor-pointer"
                >
                  Return to Login
                </button>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  disabled={resendDisabled}
                  className="text-xs font-semibold text-[#8c7077] hover:text-[#8e004b] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {resendDisabled ? `Resend available in ${formatRetryCountdown(cooldown)}` : "Didn't get the email? Try again"}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {/* Field: Email Address */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#594047]" htmlFor="email">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8c7077]">
                    <Mail className="w-5 h-5" />
                  </span>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full h-12 pl-10 pr-4 bg-[#fdf8f8] border border-[#e0bec6] rounded-xl text-sm text-[#1c1b1b] placeholder:text-[#8c7077]/60 focus:bg-white focus:border-[#8e004b] focus:ring-2 focus:ring-[#8e004b] transition-all outline-none"
                  />
                </div>
              </div>

              {error && (
                <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 border border-rose-200">
                  {error}
                </p>
              )}

              {cooldown > 0 && (
                <div role="status" className="rounded-xl bg-amber-50 px-3 py-2.5 text-[11px] font-semibold text-amber-900 border border-amber-200 flex flex-col gap-1">
                  <span>
                    Email sending is paused for <strong>{formatRetryCountdown(cooldown)}</strong>. Requesting again
                    before then only extends the wait.
                  </span>
                  <span className="font-medium text-amber-800">
                    Already received a reset email? Use its link or code below — that sends no new email.
                  </span>
                </div>
              )}

              {/* CTA: Send Reset Link */}
              <div className="mt-1">
                <button
                  type="submit"
                  disabled={isSending || resendDisabled}
                  className="w-full h-12 bg-[#e2007c] hover:bg-[#8e004b] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full text-sm font-extrabold tracking-wide active:scale-[0.98] transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Sending reset link...</span>
                    </>
                  ) : resendDisabled ? (
                    <span>Send Reset Link in {formatRetryCountdown(cooldown)}</span>
                  ) : (
                    <span>Send Reset Link</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Escape hatch: verify a token from an email already in the inbox */}
          <RecoveryTokenPanel email={email} onVerifyRecoveryToken={onVerifyRecoveryToken} />

          {!submitted && (
            <div className="mt-6 text-center pt-4 border-t border-[#e6e1e1]">
              <button
                type="button"
                onClick={onBackToLogin}
                className="text-xs font-bold text-[#8e004b] hover:underline underline-offset-4 cursor-pointer"
              >
                Back to Login
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

interface RecoveryTokenPanelProps {
  email: string;
  onVerifyRecoveryToken: (token: RecoveryTokenInput, email: string) => Promise<void> | void;
}

/**
 * Lets the user finish recovery with the reset link (or 6-digit code) from the
 * newest email they already hold. Nothing is sent, so the email provider's
 * hourly limit cannot block it, and it works when the link is opened on a
 * different device than the inbox.
 */
const RecoveryTokenPanel: React.FC<RecoveryTokenPanelProps> = ({ email, onVerifyRecoveryToken }) => {
  const [token, setToken] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isVerifying) return;
    setPanelError(null);

    const parsed = parseRecoveryTokenInput(token);
    if (!parsed) {
      setPanelError('Paste the full reset link from the email, or the 6-digit code it contains.');
      return;
    }
    if (parsed.kind === 'otp' && !isLikelyEmail(email)) {
      setPanelError('Enter your registered email above so the 6-digit code can be matched to your account.');
      return;
    }

    setIsVerifying(true);
    try {
      await onVerifyRecoveryToken(parsed, email);
    } catch (verifyError) {
      setPanelError(messageOf(verifyError, 'That link or code is not valid. Use the newest reset email you received.'));
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="mt-6 pt-5 border-t border-[#e6e1e1]">
      <div className="flex items-start gap-2.5 mb-3">
        <KeyRound className="w-4 h-4 text-[#8e004b] mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="text-xs font-extrabold text-[#1c1b1b]">Already received the email?</h3>
          <p className="text-[11px] font-medium text-[#8c7077] leading-relaxed">
            Paste the reset link — or the 6-digit code inside it — from the newest reset email. No new email is sent.
          </p>
        </div>
      </div>

      <form onSubmit={handleVerify} className="flex flex-col gap-2.5">
        <textarea
          aria-label="Reset link or 6-digit code from your email"
          rows={3}
          value={token}
          onChange={(e) => {
            setToken(e.target.value);
            if (panelError) setPanelError(null);
          }}
          placeholder="https://…/auth/v1/verify?token=…"
          className="w-full px-3 py-2.5 bg-[#fdf8f8] border border-[#e0bec6] rounded-xl text-[11px] font-mono text-[#1c1b1b] placeholder:text-[#8c7077]/60 focus:bg-white focus:border-[#8e004b] focus:ring-2 focus:ring-[#8e004b] transition-all outline-none resize-y break-all"
        />

        {panelError && (
          <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 border border-rose-200">
            {panelError}
          </p>
        )}

        <button
          type="submit"
          disabled={isVerifying || !token.trim()}
          className="w-full h-11 bg-[#f1edec] hover:bg-[#ffd9e2] disabled:opacity-50 disabled:cursor-not-allowed text-[#8e004b] rounded-full text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          {isVerifying ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Verifying…</span>
            </>
          ) : (
            <span>Continue with this link</span>
          )}
        </button>
      </form>
    </div>
  );
};

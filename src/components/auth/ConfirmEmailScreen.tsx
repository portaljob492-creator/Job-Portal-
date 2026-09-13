import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, MailCheck, RefreshCw } from 'lucide-react';

import { formatRetryCountdown, isAuthRateLimitError } from '../../lib/authErrors';

interface ConfirmEmailScreenProps {
  /** The address the confirmation email was sent to. */
  email: string;
  /** 'seeker' | 'employer' — only used for the wording. */
  role: 'seeker' | 'employer';
  /** Re-sends the sign-up confirmation email through Supabase. */
  onResend: (email: string) => Promise<void> | void;
  onBackToLogin: () => void;
}

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

/**
 * Shown when sign-up succeeded but Supabase requires the email to be confirmed
 * before a session exists. The account already exists at this point, so the
 * screen never implies the sign-up failed: it explains the one remaining step,
 * offers a re-send with a cooldown, and keeps the way back to sign-in obvious.
 */
export const ConfirmEmailScreen: React.FC<ConfirmEmailScreenProps> = ({
  email,
  role,
  onResend,
  onBackToLogin,
}) => {
  const [isResending, setIsResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = typeof window !== 'undefined'
      ? window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000)
      : 0;
    return () => { if (typeof window !== 'undefined') window.clearInterval(timer); };
  }, [cooldown]);

  const handleResend = async () => {
    if (isResending || cooldown > 0) return;
    setError(null);
    setIsResending(true);
    try {
      await onResend(email);
      setResent(true);
      setCooldown(60);
    } catch (resendError) {
      setError(messageOf(resendError, 'Unable to resend the confirmation email.'));
      setResent(false);
      if (isAuthRateLimitError(resendError)) setCooldown(resendError.retryAfterSeconds);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="bg-[#fcf9f8] text-[#1c1b1b] min-h-screen flex flex-col font-sans antialiased">
      <header className="sticky top-0 bg-white shadow-[0_4px_12px_rgba(90,63,71,0.05)] flex justify-between items-center px-5 h-16 w-full z-50 border-b border-[#e6e1e1]">
        <button
          type="button"
          onClick={onBackToLogin}
          aria-label="Back to sign in"
          className="text-[#8e004b] hover:bg-[#e6e1e1] transition-colors p-2 rounded-full flex items-center justify-center cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-[13px] font-semibold text-[#594047]">Confirm your email</span>
        <span className="w-9" />
      </header>

      <main className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md bg-white rounded-2xl border border-[#e6e1e1] shadow-[0_4px_12px_rgba(90,63,71,0.05)] p-6 md:p-8">
          <div className="w-14 h-14 rounded-full bg-[#f2dde9] flex items-center justify-center mb-5">
            <MailCheck className="w-7 h-7 text-[#8e004b]" />
          </div>

          <h1 className="text-[22px] font-semibold tracking-tight text-[#1c1b1b] mb-2">
            Check your inbox
          </h1>
          <p className="text-[14px] text-[#594047] leading-relaxed mb-1">
            Your {role === 'seeker' ? 'job seeker' : 'employer'} account has been created. We sent a
            confirmation link to
          </p>
          <p className="text-[14px] font-semibold text-[#8e004b] break-all mb-4">{email}</p>
          <p className="text-[13px] text-[#594047] leading-relaxed mb-6">
            Open that link in this browser to finish signing in and continue your setup. The link
            expires after a while, so request a new one if it stops working.
          </p>

          {error && (
            <p className="mb-4 text-[13px] font-medium text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {resent && !error && (
            <p className="mb-4 text-[13px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Confirmation email sent again.
            </p>
          )}

          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={isResending || cooldown > 0}
            className="w-full bg-[#e2007c] text-white py-3 rounded-full text-[14px] font-semibold hover:bg-[#b50062] transition-colors shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isResending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {cooldown > 0
              ? `Resend available in ${formatRetryCountdown(cooldown)}`
              : 'Resend confirmation email'}
          </button>

          <button
            type="button"
            onClick={onBackToLogin}
            className="w-full mt-3 text-[#8e004b] py-3 rounded-full text-[14px] font-semibold hover:bg-[#f7f2f2] transition-colors cursor-pointer"
          >
            Back to sign in
          </button>

          <p className="mt-5 text-[12px] text-[#594047] leading-relaxed">
            Already confirmed on another device? Sign in with your email and password — no
            confirmation is needed twice.
          </p>
        </div>
      </main>
    </div>
  );
};

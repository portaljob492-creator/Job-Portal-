import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, AlertCircle, RefreshCw, Mail, Edit2, ExternalLink } from 'lucide-react';

interface OtpVerifyScreenProps {
  email: string;
  onCheckVerified: () => Promise<void> | void;
  onResend?: () => Promise<void> | void;
  onBack: () => void;
  onChangeContact?: () => void;
}

export const OtpVerifyScreen: React.FC<OtpVerifyScreenProps> = ({
  email,
  onCheckVerified,
  onResend,
  onBack,
  onChangeContact,
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(() => {
    const sentAt = Number(window.localStorage.getItem('nexora_verification_email_sent_at') || 0);
    return Math.max(0, Math.ceil((sentAt + 60000 - Date.now()) / 1000));
  });

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => setResendCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const maskEmail = () => {
    if (!email.includes('@')) return email;
    const [name, domain] = email.split('@');
    return `${name.slice(0, Math.min(2, name.length))}****@${domain}`;
  };

  const handleResend = async () => {
    if (!onResend || isResending || resendCooldown > 0) return;
    setIsResending(true);
    setErrorMessage(null);
    setResendMessage(null);
    try {
      await onResend();
      setResendCooldown(60);
      setResendMessage(`A fresh verification link was sent to ${maskEmail()}. Use only the newest email.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to resend the verification email.');
    } finally {
      setIsResending(false);
    }
  };

  const handleCheck = async () => {
    if (isChecking) return;
    setIsChecking(true);
    setErrorMessage(null);
    try {
      await onCheckVerified();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Your email is not verified yet. Open the newest verification email and click its link.',
      );
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="bg-[#fdf8f8] text-[#1c1b1b] min-h-screen flex flex-col antialiased">
      <header className="bg-white shadow-[0_4px_12px_rgba(90,63,71,0.05)] sticky top-0 z-50 flex justify-between items-center px-5 h-16 w-full border-b border-[#e6e1e1]">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="text-[#8e004b] hover:bg-[#e6e1e1] transition-colors p-2 rounded-full cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Back</span>
        </button>
        <h1 className="font-bold text-xl text-[#8e004b]">Nexora Jobs</h1>
        <div className="w-16" />
      </header>

      <main className="flex-grow flex flex-col justify-center items-center px-4 py-8">
        <div className="w-full max-w-md bg-white border border-[#e0bec6] rounded-2xl shadow-[0_4px_20px_rgba(90,63,71,0.08)] p-6 sm:p-8">
          <div className="text-center mb-7">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#ffd9e2] text-[#8e004b]">
              <Mail className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-extrabold text-[#1c1b1b] mb-2 tracking-tight">
              Verify your email
            </h2>
            <p className="text-sm text-[#594047] leading-relaxed">
              We sent a secure verification link to{' '}
              <span className="font-bold text-[#8e004b] underline decoration-[#e2007c]/30">
                {maskEmail()}
              </span>
            </p>
          </div>

          <div className="rounded-xl border border-[#e0bec6] bg-[#fdf8f8] p-4 text-sm text-[#594047]">
            <ol className="space-y-3">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#8e004b] text-xs font-bold text-white">1</span>
                <span>Open the <strong>newest</strong> email from Supabase/Nexora Jobs.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#8e004b] text-xs font-bold text-white">2</span>
                <span>Click <strong>Confirm email address</strong>. The link works once and expires after 60 minutes.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#8e004b] text-xs font-bold text-white">3</span>
                <span>You will return here automatically to finish onboarding.</span>
              </li>
            </ol>
          </div>

          {resendMessage && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{resendMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => { window.location.href = 'mailto:'; }}
              className="w-full h-12 rounded-full bg-[#e2007c] hover:bg-[#8e004b] text-white text-base font-extrabold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <ExternalLink className="h-4 w-4" />
              Open email app
            </button>
            <button
              type="button"
              onClick={handleCheck}
              disabled={isChecking}
              className="w-full h-11 rounded-full border border-[#8e004b] text-[#8e004b] hover:bg-[#ffd9e2]/40 text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {isChecking && <RefreshCw className="h-4 w-4 animate-spin" />}
              {isChecking ? 'Checking verification…' : 'I have verified — Continue'}
            </button>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-[#e6e1e1] pt-4 text-xs font-bold">
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending || resendCooldown > 0}
              className="text-[#8e004b] hover:text-[#e2007c] hover:underline transition-colors cursor-pointer flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isResending ? 'animate-spin' : ''}`} />
              <span>{isResending ? 'Sending…' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend verification link'}</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeContact ? onChangeContact() : onBack()}
              className="text-[#594047] hover:text-[#1c1b1b] hover:underline transition-colors cursor-pointer flex items-center gap-1"
            >
              <Edit2 className="h-3.5 w-3.5 text-[#8e004b]" />
              <span>Change email</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

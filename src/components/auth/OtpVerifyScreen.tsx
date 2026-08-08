import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, AlertCircle, RefreshCw, Mail, Phone, Edit2 } from 'lucide-react';

interface OtpVerifyScreenProps {
  email?: string;
  phone?: string;
  onVerify: (code: string) => Promise<void> | void;
  onResend?: () => Promise<void> | void;
  onBack: () => void;
  onChangeContact?: () => void;
}

export type VerificationState = 'idle' | 'sending' | 'resent' | 'wrong_code' | 'expired_code' | 'success' | 'failed';

export const OtpVerifyScreen: React.FC<OtpVerifyScreenProps> = ({
  email = 'jane@example.com',
  phone = '(555) 000-1234',
  onVerify,
  onResend,
  onBack,
  onChangeContact,
}) => {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [statusState, setStatusState] = useState<VerificationState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [activeDestination, setActiveDestination] = useState<'email' | 'phone'>('email');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Mask email or mobile number helper
  const maskDestination = () => {
    if (activeDestination === 'email') {
      if (!email.includes('@')) return email;
      const [name, domain] = email.split('@');
      const visibleChars = Math.min(2, name.length);
      const maskedName = name.slice(0, visibleChars) + '****';
      return `${maskedName}@${domain}`;
    } else {
      // Phone masking
      const cleaned = phone.replace(/\D/g, '');
      if (cleaned.length >= 10) {
        const last4 = cleaned.slice(-4);
        return `(${cleaned.slice(0, 3)}) ***-**${last4.slice(-2)}`;
      }
      return phone;
    }
  };

  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleChange = (index: number, value: string) => {
    // Handle pasting a 6-digit code
    if (value.length > 1) {
      const pastedDigits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newDigits = [...digits];
      pastedDigits.forEach((d, i) => {
        if (i < 6) newDigits[i] = d;
      });
      setDigits(newDigits);
      const nextFocus = Math.min(pastedDigits.length, 5);
      inputRefs.current[nextFocus]?.focus();
      return;
    }

    const cleanValue = value.replace(/\D/g, '');
    const newDigits = [...digits];
    newDigits[index] = cleanValue;
    setDigits(newDigits);

    // Reset error when user edits
    if (statusState === 'wrong_code' || statusState === 'expired_code' || statusState === 'failed') {
      setStatusState('idle');
      setErrorMessage(null);
    }

    // Auto advance focus
    if (cleanValue && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    if (!onResend) return;
    setStatusState('sending');
    setErrorMessage(null);
    try {
      await onResend();
      setStatusState('resent');
      setResendMessage(`A new verification code has been sent to ${maskDestination()}`);
      window.setTimeout(() => setResendMessage(null), 5000);
    } catch (resendError) {
      setStatusState('failed');
      setErrorMessage(resendError instanceof Error ? resendError.message : 'Unable to resend the verification code.');
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = digits.join('');

    if (code.length < 6) {
      setStatusState('wrong_code');
      setErrorMessage('Please enter all 6 digits of your verification code.');
      return;
    }

    setStatusState('sending');
    setErrorMessage(null);
    try {
      await onVerify(code);
      setStatusState('success');
    } catch (verifyError) {
      const message = verifyError instanceof Error ? verifyError.message : 'Verification failed. Please try again.';
      setStatusState(message.toLowerCase().includes('expired') ? 'expired_code' : 'wrong_code');
      setErrorMessage(message);
    }
  };

  return (
    <div className="bg-[#fdf8f8] text-[#1c1b1b] min-h-screen flex flex-col antialiased">
      {/* Header */}
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
        <div className="flex items-center gap-2">
          <h1 className="font-bold text-xl text-[#8e004b]">Nexora Jobs</h1>
          <span className="text-[10px] font-extrabold uppercase tracking-wider bg-[#ffd9e2] text-[#8e004b] px-2 py-0.5 rounded-full">
            Route: /app/jobs/verify
          </span>
        </div>
        <div className="w-16" />
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col justify-center items-center px-4 py-8">
        <div className="w-full max-w-md bg-white border border-[#e0bec6] rounded-2xl shadow-[0_4px_20px_rgba(90,63,71,0.08)] p-6 sm:p-8">
          
          {/* Title & Masked Destination */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-extrabold text-[#1c1b1b] mb-2 tracking-tight">
              Verify your account
            </h2>
            <p className="text-sm text-[#594047] leading-relaxed">
              We sent a verification code to{' '}
              <span className="font-bold text-[#8e004b] underline decoration-[#e2007c]/30">
                {maskDestination()}
              </span>
            </p>

            {/* Toggle destination channel (Email / Mobile) */}
            <div className="mt-3 inline-flex items-center gap-1.5 p-1 bg-[#f1edec] rounded-xl border border-[#e0bec6]/60 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveDestination('email')}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  activeDestination === 'email'
                    ? 'bg-white text-[#8e004b] shadow-xs font-bold'
                    : 'text-[#8c7077] hover:text-[#1c1b1b]'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Email</span>
              </button>
              <button
                type="button"
                disabled
                title="Phone verification is not enabled for this project"
                className="px-3 py-1 rounded-lg flex items-center gap-1 cursor-not-allowed text-[#8c7077] opacity-50"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Mobile</span>
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleVerifySubmit} className="flex flex-col gap-6">
            {/* 6-Digit Code Input UI */}
            <div>
              <label className="block text-center text-xs font-bold text-[#8c7077] uppercase tracking-wider mb-2">
                Enter 6-Digit Code
              </label>
              <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digits[index]}
                    disabled={statusState === 'sending' || statusState === 'success'}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    aria-label={`Digit ${index + 1}`}
                    className={`w-full h-13 sm:h-14 text-center text-xl font-extrabold rounded-xl border transition-all outline-none ${
                      statusState === 'wrong_code' || statusState === 'expired_code' || statusState === 'failed'
                        ? 'bg-rose-50 border-rose-400 text-rose-700 ring-1 ring-rose-300'
                        : statusState === 'success'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-1 ring-emerald-300'
                        : 'bg-[#fdf8f8] border-[#e0bec6] text-[#1c1b1b] focus:ring-2 focus:ring-[#8e004b] focus:bg-white'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Error / Status Alert State Messages */}
            {statusState === 'wrong_code' && (
              <div className="flex items-start gap-2.5 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium animate-shake">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Wrong Code</span>
                  <span>{errorMessage || 'The code you entered is incorrect. Please try again.'}</span>
                </div>
              </div>
            )}

            {statusState === 'expired_code' && (
              <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-medium">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold block">Expired Code</span>
                  <span>{errorMessage}</span>
                  <button
                    type="button"
                    onClick={handleResend}
                    className="mt-1 text-xs font-bold text-[#8e004b] underline block hover:text-[#e2007c] cursor-pointer"
                  >
                    Resend Code Now
                  </button>
                </div>
              </div>
            )}

            {statusState === 'failed' && (
              <div className="flex items-start gap-2.5 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Verification Failed</span>
                  <span>{errorMessage}</span>
                </div>
              </div>
            )}

            {resendMessage && (
              <div className="flex items-center gap-2 p-3 bg-[#ffd9e2] text-[#8e004b] rounded-xl text-xs font-semibold justify-center border border-[#8e004b]/20">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-[#e2007c]" />
                <span>{resendMessage}</span>
              </div>
            )}

            {statusState === 'success' && (
              <div className="flex items-center gap-2 p-3 bg-emerald-100 text-emerald-900 rounded-xl text-xs font-extrabold justify-center border border-emerald-300">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span>Verification Success! Redirecting...</span>
              </div>
            )}

            {/* CTA Button */}
            <button
              type="submit"
              disabled={statusState === 'sending' || statusState === 'success'}
              className={`w-full h-12 rounded-full text-base font-extrabold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                statusState === 'sending'
                  ? 'bg-[#8e004b]/70 text-white cursor-wait'
                  : statusState === 'success'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#e2007c] hover:bg-[#8e004b] text-white active:scale-95'
              }`}
            >
              {statusState === 'sending' ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin text-white" />
                  <span>Verifying...</span>
                </>
              ) : statusState === 'success' ? (
                <span>Verified ✓</span>
              ) : (
                <span>Verify</span>
              )}
            </button>

            {/* Links */}
            <div className="flex items-center justify-between pt-2 border-t border-[#e6e1e1] text-xs font-bold">
              <button
                type="button"
                onClick={handleResend}
                disabled={statusState === 'sending'}
                className="text-[#8e004b] hover:text-[#e2007c] hover:underline transition-colors cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Resend Code</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onChangeContact) onChangeContact();
                  else onBack();
                }}
                className="text-[#594047] hover:text-[#1c1b1b] hover:underline transition-colors cursor-pointer flex items-center gap-1"
              >
                <Edit2 className="w-3.5 h-3.5 text-[#8e004b]" />
                <span>Change Email / Mobile</span>
              </button>
            </div>
          </form>

        </div>
      </main>
    </div>
  );
};

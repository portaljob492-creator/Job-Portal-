import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

interface OtpVerifyScreenProps {
  email?: string;
  onVerify: () => void;
  onBack: () => void;
}

export const OtpVerifyScreen: React.FC<OtpVerifyScreenProps> = ({
  email = 'your email',
  onVerify,
  onBack,
}) => {
  const [digits, setDigits] = useState<string[]>(['1', '2', '3', '4']);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.slice(-1);
    }

    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);

    // Auto advance focus
    if (value && index < 3 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = () => {
    setResendMessage('Verification code resent! Please check your inbox.');
    setTimeout(() => setResendMessage(null), 4000);
  };

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onVerify();
  };

  return (
    <div className="bg-[#fdf8f8] text-[#1c1b1b] min-h-screen flex flex-col antialiased">
      {/* Header */}
      <header className="bg-white shadow-[0_4px_12px_rgba(90,63,71,0.05)] sticky top-0 z-50 flex justify-between items-center px-5 h-16 w-full">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="text-[#8e004b] hover:bg-[#e6e1e1] transition-colors p-2 rounded-full cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-xl text-[#8e004b]">Nexora Jobs</h1>
        <div className="w-9" />
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col justify-center items-center px-5 py-8">
        <div className="w-full max-w-md bg-white border border-[#e8e8e8] rounded-2xl shadow-[0_4px_16px_rgba(90,63,71,0.06)] p-6 md:p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-[#1c1b1b] mb-2">
              Verify Account
            </h2>
            <p className="text-sm text-[#594047]">
              We sent a 4-digit code to <span className="font-medium text-[#1c1b1b]">{email}</span>.
            </p>
          </div>

          <form onSubmit={handleVerifySubmit} className="flex flex-col gap-8">
            {/* OTP Inputs */}
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  maxLength={1}
                  value={digits[index]}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  aria-label={`Digit ${index + 1}`}
                  className="w-14 h-16 text-center text-2xl font-bold bg-[#fdf8f8] border-0 ring-1 ring-[#e0bec6] rounded-xl focus:ring-2 focus:ring-[#8e004b] focus:bg-white transition-all outline-none"
                />
              ))}
            </div>

            {resendMessage && (
              <div className="flex items-center gap-2 p-3 bg-[#ffd9e2]/50 text-[#8e004b] rounded-lg text-xs font-medium justify-center animate-fade-in">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{resendMessage}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                type="submit"
                className="w-full h-12 bg-[#e2007c] text-white rounded-full text-base font-semibold hover:bg-[#8e004b] transition-all active:scale-95 shadow-md cursor-pointer"
              >
                Verify
              </button>

              <button
                type="button"
                onClick={handleResend}
                className="text-xs font-medium text-[#8e004b] hover:text-[#b50062] transition-colors text-center py-1 cursor-pointer"
              >
                Resend Code
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

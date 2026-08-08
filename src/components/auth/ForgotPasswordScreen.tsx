import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

interface ForgotPasswordScreenProps {
  onBackToLogin: () => void;
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  onBackToLogin,
}) => {
  const [email, setEmail] = useState('you@example.com');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="bg-[#fcf9f8] text-[#1c1b1b] min-h-screen flex flex-col font-sans antialiased">
      {/* TopAppBar */}
      <header className="sticky top-0 bg-white shadow-[0_4px_12px_rgba(90,63,71,0.05)] flex justify-between items-center px-5 h-16 w-full z-50">
        <button
          type="button"
          onClick={onBackToLogin}
          aria-label="Go back"
          className="text-[#8e004b] hover:bg-[#e6e1e1] transition-colors p-2 rounded-full flex items-center justify-center cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-xl text-[#8e004b] tracking-tight">Nexora Jobs</h1>
        <div className="w-9" />
      </header>

      {/* Main Content Canvas */}
      <main className="flex-grow flex items-center justify-center px-5 py-8">
        <div className="w-full max-w-md bg-white border border-[#e8e8e8] rounded-2xl p-6 sm:p-8 shadow-[0_8px_24px_rgba(90,63,71,0.08)]">
          <div className="flex flex-col gap-2 mb-6 text-center">
            <h2 className="text-2xl font-bold text-[#1c1b1b]">Forgot Password?</h2>
            <p className="text-sm text-[#594047]">
              Enter your email to receive a password reset link.
            </p>
          </div>

          {submitted ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-12 h-12 rounded-full bg-[#ffd9e2] text-[#8e004b] flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-base text-[#1c1b1b] mb-1">Reset Link Sent!</h3>
                <p className="text-xs text-[#594047]">
                  We sent a password reset link to <span className="font-medium text-[#1c1b1b]">{email}</span>. Please check your inbox.
                </p>
              </div>
              <button
                type="button"
                onClick={onBackToLogin}
                className="mt-2 text-xs font-semibold text-[#8e004b] hover:underline cursor-pointer"
              >
                Back to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#1c1b1b]" htmlFor="email">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full h-12 bg-[#f1edec] rounded-lg px-4 text-sm text-[#1c1b1b] placeholder:text-[#594047]/50 border border-transparent focus:bg-white focus:border-[#8e004b] focus:ring-1 focus:ring-[#8e004b] transition-colors outline-none"
                />
              </div>

              <div className="mt-2">
                <button
                  type="submit"
                  className="w-full h-12 bg-[#e2007c] text-white rounded-full text-sm font-bold tracking-wide hover:opacity-90 active:scale-[0.98] transition-all shadow-sm cursor-pointer"
                >
                  Send Link
                </button>
              </div>
            </form>
          )}

          {!submitted && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={onBackToLogin}
                className="text-xs font-semibold text-[#8e004b] hover:underline underline-offset-4 cursor-pointer"
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

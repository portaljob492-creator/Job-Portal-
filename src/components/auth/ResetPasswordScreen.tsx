import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Lock, Eye, EyeOff, RefreshCw, ShieldCheck, AlertCircle } from 'lucide-react';

interface ResetPasswordScreenProps {
  onBackToLogin: () => void;
  onUpdatePassword: (password: string) => Promise<void> | void;
  onSuccessLogin: () => void;
}

export const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({
  onBackToLogin,
  onUpdatePassword,
  onSuccessLogin,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Password strength calculation
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score++;

    if (score === 1) return { score: 1, label: 'Weak', color: 'bg-rose-500 text-rose-700' };
    if (score === 2) return { score: 2, label: 'Medium', color: 'bg-amber-500 text-amber-700' };
    return { score: 3, label: 'Strong', color: 'bg-emerald-500 text-emerald-700' };
  };

  const strength = getPasswordStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (newPassword.length < 8) {
      setErrorMsg('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify both fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onUpdatePassword(newPassword);
      setIsSuccess(true);
    } catch (updateError) {
      setErrorMsg(updateError instanceof Error ? updateError.message : 'Unable to update the password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#fdf8f8] text-[#1c1b1b] min-h-screen flex flex-col font-sans antialiased">
      {/* TopAppBar Header */}
      <header className="sticky top-0 bg-white shadow-[0_4px_12px_rgba(90,63,71,0.05)] flex justify-between items-center px-5 h-16 w-full z-50 border-b border-[#e6e1e1]">
        <button
          type="button"
          onClick={onBackToLogin}
          aria-label="Go back to login"
          className="text-[#8e004b] hover:bg-[#e6e1e1] transition-colors p-2 rounded-full cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Back</span>
        </button>
        <div className="flex items-center gap-2">
          <h1 className="font-bold text-xl text-[#8e004b] tracking-tight">Nexora Jobs</h1>
          <span className="text-[10px] font-extrabold uppercase tracking-wider bg-[#ffd9e2] text-[#8e004b] px-2 py-0.5 rounded-full">
            Route: /app/jobs/reset-password
          </span>
        </div>
        <div className="w-12" />
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md bg-white border border-[#e0bec6] rounded-2xl p-6 sm:p-8 shadow-[0_8px_24px_rgba(90,63,71,0.08)]">
          
          {/* Header Title & Subtext */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-extrabold text-[#1c1b1b] mb-1 tracking-tight">
              Create New Password
            </h2>
            <p className="text-sm text-[#594047] leading-relaxed">
              Your new password must be different from previously used passwords.
            </p>
          </div>

          {/* Success State */}
          {isSuccess ? (
            <div className="flex flex-col items-center gap-5 py-4 text-center animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-[#ffd9e2] text-[#8e004b] flex items-center justify-center shadow-xs ring-4 ring-[#ffd9e2]/50">
                <CheckCircle2 className="w-10 h-10 text-[#e2007c]" />
              </div>

              <div className="space-y-1.5">
                <span className="inline-block px-3 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold uppercase tracking-wider mb-1">
                  Success
                </span>
                <h3 className="font-extrabold text-xl text-[#1c1b1b]">
                  Password updated successfully
                </h3>
                <p className="text-xs text-[#594047] leading-relaxed max-w-xs mx-auto">
                  Your password has been changed successfully. You can now log in to your account with your new credentials.
                </p>
              </div>

              <div className="w-full pt-4 border-t border-[#e6e1e1] mt-2">
                <button
                  type="button"
                  onClick={onSuccessLogin}
                  className="w-full h-12 bg-[#e2007c] hover:bg-[#8e004b] text-white rounded-full text-base font-extrabold tracking-wide transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Log In</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              
              {/* Field 1: New Password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#594047]" htmlFor="newPassword">
                  New Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8c7077]">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="Enter at least 8 characters"
                    className="w-full h-12 pl-10 pr-10 bg-[#fdf8f8] border border-[#e0bec6] rounded-xl text-sm text-[#1c1b1b] placeholder:text-[#8c7077]/60 focus:bg-white focus:border-[#8e004b] focus:ring-2 focus:ring-[#8e004b] transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8c7077] hover:text-[#1c1b1b] cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {newPassword.length > 0 && (
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden flex gap-1">
                      <div className={`h-full transition-all duration-300 ${strength.score >= 1 ? 'w-1/3 bg-rose-500' : 'w-0'}`} />
                      <div className={`h-full transition-all duration-300 ${strength.score >= 2 ? 'w-1/3 bg-amber-500' : 'w-0'}`} />
                      <div className={`h-full transition-all duration-300 ${strength.score >= 3 ? 'w-1/3 bg-emerald-500' : 'w-0'}`} />
                    </div>
                    <span className="font-bold text-[11px] text-[#594047]">
                      Strength: <strong className="capitalize">{strength.label}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Field 2: Confirm Password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#594047]" htmlFor="confirmPassword">
                  Confirm Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8c7077]">
                    <ShieldCheck className="w-4 h-4" />
                  </span>
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="Re-enter your new password"
                    className={`w-full h-12 pl-10 pr-10 bg-[#fdf8f8] border rounded-xl text-sm text-[#1c1b1b] placeholder:text-[#8c7077]/60 focus:bg-white focus:ring-2 transition-all outline-none ${
                      confirmPassword.length > 0 && newPassword !== confirmPassword
                        ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
                        : confirmPassword.length > 0 && newPassword === confirmPassword
                        ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-200'
                        : 'border-[#e0bec6] focus:border-[#8e004b] focus:ring-[#8e004b]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8c7077] hover:text-[#1c1b1b] cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password match notice */}
                {confirmPassword.length > 0 && (
                  <p className={`text-[11px] font-semibold flex items-center gap-1 ${
                    newPassword === confirmPassword ? 'text-emerald-700' : 'text-rose-600'
                  }`}>
                    {newPassword === confirmPassword ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Passwords match</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                        <span>Passwords do not match</span>
                      </>
                    )}
                  </p>
                )}
              </div>

              {/* Error Message Alert */}
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-start gap-2 animate-shake">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Requirements List */}
              <div className="p-3 bg-[#f8f4f4] rounded-xl border border-[#e0bec6]/60 text-[11px] text-[#594047] space-y-1">
                <span className="font-bold text-[#1c1b1b] block">Password requirements:</span>
                <ul className="list-disc list-inside space-y-0.5 text-[#594047]">
                  <li className={newPassword.length >= 8 ? 'text-emerald-700 font-bold' : ''}>
                    At least 8 characters long
                  </li>
                  <li className={/[A-Z]/.test(newPassword) ? 'text-emerald-700 font-bold' : ''}>
                    Contains at least 1 uppercase letter
                  </li>
                  <li className={(/[0-9]/.test(newPassword) || /[^A-Za-z0-9]/.test(newPassword)) ? 'text-emerald-700 font-bold' : ''}>
                    Contains at least 1 number or special character
                  </li>
                </ul>
              </div>

              {/* CTA: Update Password */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 bg-[#e2007c] hover:bg-[#8e004b] text-white rounded-full text-base font-extrabold tracking-wide active:scale-[0.98] transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <span>Update Password</span>
                )}
              </button>
            </form>
          )}

          {!isSuccess && (
            <div className="mt-6 text-center pt-4 border-t border-[#e6e1e1]">
              <button
                type="button"
                onClick={onBackToLogin}
                className="text-xs font-bold text-[#8e004b] hover:underline cursor-pointer"
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

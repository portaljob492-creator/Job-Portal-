import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, UserCheck } from 'lucide-react';
import type { UserRole } from '../../types';
import {
  formatRetryCountdown,
  isAuthRateLimitError,
  isPortalRoleMismatchError,
  portalRoleLabel,
  type PortalRoleMismatchError,
} from '../../lib/authErrors';

interface EmployerSignupScreenProps {
  onSubmit: (formData: { businessName: string; contactPerson: string; email: string; password: string }) => Promise<void> | void;
  onBack: () => void;
  onLogin: () => void;
  /** Called when the email belongs to the other portal; forwards to login prefilled. */
  onSwitchPortal?: (role: UserRole, email: string) => void;
}

export const EmployerSignupScreen: React.FC<EmployerSignupScreenProps> = ({
  onSubmit,
  onBack,
  onLogin,
  onSwitchPortal,
}) => {
  const [businessName, setBusinessName] = useState('Nexora Beauty Group');
  const [contactPerson, setContactPerson] = useState('Sarah Jenkins');
  const [businessEmail, setBusinessEmail] = useState('hello@nexorabeauty.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleMismatch, setRoleMismatch] = useState<PortalRoleMismatchError | null>(null);
  /** Seconds left on a signup throttle. Submit stays disabled so attempts are not burned. */
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = typeof window !== 'undefined' ? window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000) : 0;
    return () => { if (typeof window !== 'undefined') window.clearInterval(timer); };
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || cooldown > 0) return;
    setError(null);
    setRoleMismatch(null);
    if (!agreeTerms) {
      setError('Please accept the Terms & Conditions and Privacy Policy.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must include lowercase and uppercase letters plus a number.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({ businessName, contactPerson, email: businessEmail, password });
    } catch (signupError) {
      if (isPortalRoleMismatchError(signupError)) {
        // The email is permanently registered to the other portal: show the
        // explainer + switch action instead of a generic sign-up error.
        setError(null);
        setRoleMismatch(signupError);
      } else if (isAuthRateLimitError(signupError)) {
        // Throttled (usually the email quota): count down instead of letting
        // the user burn more attempts while the quota recovers.
        setRoleMismatch(null);
        setCooldown(signupError.retryAfterSeconds);
        setError(signupError.message);
      } else {
        setRoleMismatch(null);
        setError(signupError instanceof Error ? signupError.message : 'Unable to create employer account.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#eef2ff] text-[#0f172a] min-h-screen flex flex-col font-sans antialiased selection:bg-[#ede9fe] selection:text-[#4f46e5] relative overflow-hidden">
      {/* TopAppBar */}
      <header className="flex justify-between items-center px-5 h-16 w-full z-50 bg-[#f8fafc] shadow-[0_4px_12px_rgba(15,23,42,0.05)] sticky top-0">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="text-[#4f46e5] hover:bg-[#e2e8f0] transition-colors p-2 rounded-full flex items-center justify-center cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-[#4f46e5]">Nexora Jobs</h1>
        <div className="w-9" />
      </header>

      {/* Main Content Area */}
      <main className="flex-grow px-5 py-8 flex flex-col items-center justify-center relative z-10">
        {/* Animated Background Accents */}
        <div className="absolute inset-0 z-[-1] overflow-hidden opacity-30 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#c4b5fd] blur-[100px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-[#ede9fe] blur-[120px]" />
        </div>

        <div className="w-full max-w-md glass-card rounded-2xl p-6 sm:p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-[#0f172a] mb-1">
              Register Business
            </h2>
            <p className="text-sm text-[#475569]">
              Find top talent for your salon or spa.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Business Name Field */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0f172a]" htmlFor="businessName">
                Business Name
              </label>
              <input
                id="businessName"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Nexora Beauty Group"
                required
                className="bg-[#f1f5f9] border-transparent focus:bg-white focus:border-[#4f46e5] focus:ring-1 focus:ring-[#4f46e5] rounded-lg px-4 py-3 text-sm text-[#0f172a] transition-colors outline-none placeholder:text-[#475569]/60"
              />
            </div>

            {/* Contact Person Field */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0f172a]" htmlFor="contactPerson">
                Contact Person
              </label>
              <input
                id="contactPerson"
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Full Name"
                required
                className="bg-[#f1f5f9] border-transparent focus:bg-white focus:border-[#4f46e5] focus:ring-1 focus:ring-[#4f46e5] rounded-lg px-4 py-3 text-sm text-[#0f172a] transition-colors outline-none placeholder:text-[#475569]/60"
              />
            </div>

            {/* Business Email Field */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0f172a]" htmlFor="businessEmail">
                Business Email
              </label>
              <input
                id="businessEmail"
                type="email"
                value={businessEmail}
                onChange={(e) => setBusinessEmail(e.target.value)}
                placeholder="hello@nexorabeauty.com"
                required
                className="bg-[#f1f5f9] border-transparent focus:bg-white focus:border-[#4f46e5] focus:ring-1 focus:ring-[#4f46e5] rounded-lg px-4 py-3 text-sm text-[#0f172a] transition-colors outline-none placeholder:text-[#475569]/60"
              />
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0f172a]" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nexora@123"
                  aria-describedby="employer-password-hint"
                  autoComplete="new-password"
                  required
                  className="w-full bg-[#f1f5f9] border-transparent focus:bg-white focus:border-[#4f46e5] focus:ring-1 focus:ring-[#4f46e5] rounded-lg px-4 py-3 text-sm text-[#0f172a] transition-colors outline-none placeholder:text-[#475569]/60 pr-10"
                />
                <button
                  type="button"
                  aria-label="Toggle password visibility"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#4f46e5] transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p id="employer-password-hint" className="text-[11px] leading-relaxed text-[#475569]">
                Example: <strong className="text-[#4f46e5]">Nexora@123</strong> — use 8+ characters with uppercase, lowercase and a number. Create your own unique password.
              </p>
            </div>

            {/* Terms Checkbox */}
            <div className="flex items-start gap-2.5 py-1">
              <input
                id="terms"
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-[#4f46e5] bg-white border-[#64748b] rounded focus:ring-[#4f46e5]"
              />
              <label className="text-xs text-[#475569] leading-tight" htmlFor="terms">
                I agree to the <a href="#" className="text-[#4f46e5] hover:underline font-medium">Terms & Conditions</a> and <a href="#" className="text-[#4f46e5] hover:underline font-medium">Privacy Policy</a>.
              </label>
            </div>

            {error && (
              <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 border border-rose-200">
                {error}
              </p>
            )}

            {roleMismatch && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 flex flex-col gap-2.5">
                <p className="text-xs font-medium text-rose-700 leading-relaxed">{roleMismatch.message}</p>
                <button
                  type="button"
                  onClick={() => onSwitchPortal?.(roleMismatch.existingRole, roleMismatch.email || businessEmail)}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-[#4f46e5] hover:bg-[#6d28d9] text-white text-xs font-bold py-2 px-3 transition-colors cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Switch to {portalRoleLabel(roleMismatch.existingRole)} Portal
                </button>
              </div>
            )}

            {/* CTA */}
            <button
              type="submit"
              disabled={!agreeTerms || isSubmitting || cooldown > 0}
              className={`w-full h-12 rounded-full font-bold text-sm tracking-wide transition-all duration-200 mt-2 flex items-center justify-center gap-2 shadow-md cursor-pointer ${
                agreeTerms && !isSubmitting && cooldown <= 0
                  ? 'bg-[#7c3aed] text-white hover:bg-[#6d28d9] active:scale-[0.98]'
                  : 'bg-[#e2e8f0] text-[#475569] opacity-60 cursor-not-allowed'
              }`}
            >
              <span>{isSubmitting ? 'Creating account…' : cooldown > 0 ? `Try again in ${formatRetryCountdown(cooldown)}` : 'Create Employer Account'}</span>
              {!isSubmitting && cooldown <= 0 && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-[#475569]">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onLogin}
                className="text-[#4f46e5] font-bold hover:underline cursor-pointer"
              >
                Log In
              </button>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

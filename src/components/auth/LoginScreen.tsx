import React, { useEffect, useState } from 'react';
import { UserRole } from '../../types';
import { Eye, EyeOff, UserCheck, Building2, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import {
  asPortalRoleMismatch,
  formatRetryCountdown,
  isAuthRateLimitError,
  isPasswordSignInBlockedError,
  portalRoleLabel,
  PortalRoleMismatchError,
  type PasswordSignInBlockedError,
} from '../../lib/authErrors';
import { isLikelyEmail, normalizeEmail } from '../../lib/email';
import { jobPortalPath } from '../../routing';

interface LoginScreenProps {
  onLoginSuccess: (role: UserRole, email: string, password: string) => Promise<void> | void;
  onSocialLogin?: (provider: 'google' | 'apple', role: UserRole) => Promise<void> | void;
  onSignUp: () => void;
  onForgotPassword: (email: string) => void;
  onResolvePortalRole?: (email: string) => Promise<UserRole | null>;
  onSendResetLink?: (email: string) => Promise<void> | void;
  initialEmail?: string;
  onResendConfirmation?: (email: string) => Promise<void> | void;
}

function readLoginPrefill(): { role: UserRole | null; email: string } {
  if (typeof window === 'undefined') return { role: null, email: '' };
  const params = new URLSearchParams(window.location.search);
  const roleParam = params.get('role');
  return {
    role: roleParam === 'seeker' || roleParam === 'employer' ? roleParam : null,
    email: params.get('email') ?? '',
  };
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  onResendConfirmation,
  onSignUp,
  onForgotPassword,
  onSendResetLink,
  onResolvePortalRole,
  initialEmail = '',
}) => {
  const prefill = readLoginPrefill();
  const [email, setEmail] = useState(initialEmail || prefill.email);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // activeRole is kept for fallback when email has no stored role yet.
  // User does NOT need to pick it – it auto-detects from email.
  const [activeRole, setActiveRole] = useState<UserRole>(prefill.role ?? 'seeker');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleMismatch, setRoleMismatch] = useState<PortalRoleMismatchError | null>(null);
  const [signInBlocked, setSignInBlocked] = useState<PasswordSignInBlockedError | null>(null);
  const [confirmResend, setConfirmResend] = useState<{ email: string; state: 'idle' | 'sending' | 'sent' } | null>(null);
  const [resetLink, setResetLink] = useState<{ email: string; state: 'idle' | 'sending' | 'sent' | 'error'; message?: string } | null>(null);
  const [cooldown, setCooldown] = useState(0);
  // Portal auto-detected from email – this is what makes login role-free
  const [detectedRole, setDetectedRole] = useState<UserRole | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = typeof window !== 'undefined' ? window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000) : 0;
    return () => { if (typeof window !== 'undefined') window.clearInterval(timer); };
  }, [cooldown]);

  // Auto-detect role from email – debounced lookup
  useEffect(() => {
    if (!onResolvePortalRole) return;
    const candidate = normalizeEmail(email);
    if (!isLikelyEmail(candidate)) {
      setDetectedRole(null);
      setIsDetecting(false);
      return;
    }
    let cancelled = false;
    setIsDetecting(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        let resolved: UserRole | null = null;
        try {
          resolved = await onResolvePortalRole(candidate);
        } catch {
          resolved = null;
        }
        if (cancelled) return;
        const valid = resolved === 'seeker' || resolved === 'employer' || resolved === 'admin' ? resolved : null;
        setDetectedRole(valid);
        setIsDetecting(false);
        // Auto-switch internal activeRole so submit uses correct portal without user action
        if (valid && (valid === 'seeker' || valid === 'employer')) {
          setActiveRole(valid);
        }
      })();
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [email, onResolvePortalRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || cooldown > 0) return;
    setError(null);
    setRoleMismatch(null);
    setSignInBlocked(null);
    setConfirmResend(null);
    setResetLink(null);
    setIsLoading(true);

    // Determine effective role: detected > prefill > activeRole
    // If still unknown, try one immediate lookup for auto-login
    let effectiveRole: UserRole = detectedRole || activeRole;
    if (!detectedRole && onResolvePortalRole && isLikelyEmail(normalizeEmail(email))) {
      try {
        const immediate = await onResolvePortalRole(normalizeEmail(email));
        if (immediate === 'seeker' || immediate === 'employer' || immediate === 'admin') {
          effectiveRole = immediate;
          setDetectedRole(immediate);
          if (immediate === 'seeker' || immediate === 'employer') setActiveRole(immediate);
        }
      } catch {
        // keep fallback
      }
    }

    try {
      await onLoginSuccess(effectiveRole, email, password);
    } catch (loginError) {
      const mismatch = asPortalRoleMismatch(loginError, effectiveRole, email);
      if (mismatch) {
        // Backend still says different portal (admin case or race) – auto-correct UI
        if (mismatch.existingRole === 'seeker' || mismatch.existingRole === 'employer') {
          setDetectedRole(mismatch.existingRole);
          setActiveRole(mismatch.existingRole);
          setError(`Auto-switching to ${portalRoleLabel(mismatch.existingRole)} portal. Please tap Login again.`);
        } else {
          setRoleMismatch(mismatch);
        }
        setError(null);
      } else if (isAuthRateLimitError(loginError)) {
        setCooldown(loginError.retryAfterSeconds);
        setError(loginError.message);
      } else if (isPasswordSignInBlockedError(loginError)) {
        setSignInBlocked(loginError);
        setError(null);
      } else {
        setRoleMismatch(null);
        setError(loginError instanceof Error ? loginError.message : 'Unable to sign in. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!onResendConfirmation || !signInBlocked) return;
    const target = signInBlocked.email || email;
    setConfirmResend({ email: target, state: 'sending' });
    try {
      await onResendConfirmation(target);
      setConfirmResend({ email: target, state: 'sent' });
    } catch (resendError) {
      setConfirmResend(null);
      setError(resendError instanceof Error ? resendError.message : 'Unable to resend the confirmation email.');
    }
  };

  const handleInlineReset = async () => {
    if (!onSendResetLink) {
      handleResetPassword();
      return;
    }
    const target = (signInBlocked?.email || email).trim();
    if (!target) return;
    setResetLink({ email: target, state: 'sending' });
    try {
      await onSendResetLink(target);
      setResetLink({ email: target, state: 'sent' });
    } catch (resetError) {
      const message = resetError instanceof Error ? resetError.message : 'Unable to send the reset link. Try again.';
      setResetLink({ email: target, state: 'error', message });
    }
  };

  const handleResetPassword = () => {
    const target = (signInBlocked?.email || email).trim();
    setSignInBlocked(null);
    setError(null);
    onForgotPassword(target);
  };

  const handleSwitchPortal = (card: PortalRoleMismatchError | null = roleMismatch) => {
    if (!card) return;
    const target = card.existingRole;
    const prefilledEmail = card.email || email;
    setRoleMismatch(null);
    setSignInBlocked(null);
    setError(null);
    if (target === 'admin') {
      setEmail(prefilledEmail);
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams();
        if (prefilledEmail.trim()) params.set('email', prefilledEmail.trim());
        const query = params.toString();
        window.history.replaceState({}, document.title, `${jobPortalPath('admin')}${query ? `?${query}` : ''}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
      return;
    }
    setActiveRole(target);
    setDetectedRole(target);
    setEmail(prefilledEmail);
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen flex flex-col justify-center items-center px-5 py-8 font-sans text-[#0f172a] antialiased">
      <main className="w-full max-w-[400px] flex flex-col gap-6">
        <header className="text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-[#6d28d9] text-white flex items-center justify-center mb-4 shadow-[0_4px_12px_rgba(15,23,42,0.08)]">
            <span className="material-symbols-outlined text-3xl filled-icon">spa</span>
          </div>
          <h1 className="text-2xl font-bold text-[#0f172a] mb-1">Welcome Back</h1>
          <p className="text-sm text-[#475569]">Just enter your email & password — we’ll open your correct portal automatically.</p>
        </header>

        {/* Auto-detect badge – replaces manual role tabs */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] px-3.5 py-2.5 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#eef2ff] flex items-center justify-center flex-shrink-0">
            {isDetecting ? (
              <span className="w-3.5 h-3.5 border-2 border-[#4f46e5] border-t-transparent rounded-full animate-spin" />
            ) : detectedRole === 'employer' ? (
              <Building2 className="w-3.5 h-3.5 text-[#4f46e5]" />
            ) : detectedRole === 'seeker' ? (
              <UserCheck className="w-3.5 h-3.5 text-[#4f46e5]" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-[#94a3b8]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            {isDetecting ? (
              <p className="text-[11px] font-medium text-[#475569]">Checking your account…</p>
            ) : detectedRole ? (
              <p className="text-[11px] font-semibold text-[#0f172a]">
                Detected: <span className="text-[#4f46e5]">{portalRoleLabel(detectedRole)}</span> account — auto login enabled
              </p>
            ) : email && isLikelyEmail(normalizeEmail(email)) ? (
              <p className="text-[11px] font-medium text-[#475569]">New email? We’ll create your session in the right portal after signup.</p>
            ) : (
              <p className="text-[11px] font-medium text-[#475569]">No need to remember Job Seeker / Employer — we detect it from your email.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-[0_4px_16px_rgba(15,23,42,0.06)] border border-[#cbd5e1]/40 p-5 flex flex-col gap-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#0f172a]" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full bg-[#f8fafc] text-[#0f172a] text-sm px-4 py-3 rounded-lg border-0 ring-1 ring-[#cbd5e1] focus:ring-2 focus:ring-[#4f46e5] focus:bg-white transition-all outline-none placeholder:text-[#475569]/50"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-[#0f172a]" htmlFor="password">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => onForgotPassword(email)}
                  className="text-xs text-[#475569] hover:text-[#7c3aed] transition-colors cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative w-full">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#f8fafc] text-[#0f172a] text-sm px-4 py-3 rounded-lg border-0 ring-1 ring-[#cbd5e1] focus:ring-2 focus:ring-[#4f46e5] focus:bg-white transition-all outline-none placeholder:text-[#475569]/50 pr-10"
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
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 border border-rose-200">
                {error}
              </p>
            )}

            {roleMismatch && (
              <div role="alert" className="rounded-xl border border-[#cbd5e1]/70 bg-[#eef2ff] px-3.5 py-3 flex flex-col gap-2.5">
                <p className="text-xs font-medium text-[#4f46e5] leading-relaxed">{roleMismatch.message}</p>
                <button
                  type="button"
                  onClick={() => handleSwitchPortal(roleMismatch)}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-[#4f46e5] hover:bg-[#6d28d9] text-white text-xs font-bold py-2 px-3 transition-colors cursor-pointer"
                >
                  {roleMismatch.existingRole === 'employer'
                    ? <Building2 className="w-3.5 h-3.5" />
                    : roleMismatch.existingRole === 'admin'
                      ? <ShieldCheck className="w-3.5 h-3.5" />
                      : <UserCheck className="w-3.5 h-3.5" />}
                  {roleMismatch.existingRole === 'admin'
                    ? 'Go to Admin Sign In'
                    : `Switch to ${portalRoleLabel(roleMismatch.existingRole)} Portal`}
                </button>
              </div>
            )}

            {signInBlocked && (
              <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 flex flex-col gap-2.5">
                <p className="text-xs font-medium leading-relaxed text-amber-900">{signInBlocked.message}</p>
                {signInBlocked.reason === 'unconfirmed' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleResendConfirmation()}
                      disabled={!onResendConfirmation || confirmResend?.state === 'sending' || confirmResend?.state === 'sent'}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-[#4f46e5] hover:bg-[#6d28d9] text-white text-xs font-bold py-2 px-3 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      {confirmResend?.state === 'sent'
                        ? 'Confirmation email sent'
                        : confirmResend?.state === 'sending'
                          ? 'Sending…'
                          : `Resend the confirmation email to ${signInBlocked.email || 'my address'}`}
                    </button>
                    {confirmResend?.state === 'sent' && (
                      <p className="text-[11px] font-medium text-emerald-700">
                        Check {confirmResend.email} and open the newest link — this page is where it returns to.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    {resetLink?.state === 'sent' ? (
                      <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5 flex flex-col gap-1">
                        <p className="text-[11px] font-bold text-emerald-800">
                          ✓ Password reset link sent to {resetLink.email}
                        </p>
                        <p className="text-[11px] font-medium text-emerald-700">
                          Check your inbox and spam folder. The link expires after 60 minutes.
                        </p>
                      </div>
                    ) : resetLink?.state === 'error' ? (
                      <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 flex flex-col gap-1.5">
                        <p className="text-[11px] font-bold text-rose-800">
                          {resetLink.message || 'Unable to send the reset link.'}
                        </p>
                        <button
                          type="button"
                          onClick={handleInlineReset}
                          className="text-[11px] font-bold text-[#4f46e5] hover:text-[#7c3aed] transition-colors cursor-pointer underline underline-offset-2 self-start"
                        >
                          Try again
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleInlineReset()}
                        disabled={resetLink?.state === 'sending'}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-[#4f46e5] hover:bg-[#6d28d9] text-white text-xs font-bold py-2 px-3 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        {resetLink?.state === 'sending'
                          ? 'Sending reset link…'
                          : `Email a reset link to ${signInBlocked.email || 'my address'}`}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      className="text-[11px] font-bold text-[#4f46e5] hover:text-[#7c3aed] transition-colors cursor-pointer underline underline-offset-2 self-start"
                    >
                      Go to Forgot Password page
                    </button>
                  </>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || cooldown > 0}
              aria-disabled={isLoading || cooldown > 0}
              className="w-full bg-[#7c3aed] disabled:opacity-60 text-white font-semibold text-base py-3 px-6 rounded-full mt-1 hover:bg-[#6d28d9] active:scale-95 transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:cursor-wait"
            >
              <span>{isLoading ? 'Signing in…' : cooldown > 0 ? `Try again in ${formatRetryCountdown(cooldown)}` : 'Login'}</span>
            </button>
          </form>
        </div>

        <footer className="text-center mt-2">
          <p className="text-sm text-[#475569]">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onSignUp}
              className="text-[#4f46e5] font-semibold hover:text-[#7c3aed] transition-colors cursor-pointer"
            >
              Sign Up
            </button>
          </p>
        </footer>
      </main>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { UserRole } from '../../types';
import { Eye, EyeOff, Sparkles, UserCheck, Building2, Apple, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import {
  formatRetryCountdown,
  isAuthRateLimitError,
  isPasswordSignInBlockedError,
  isPortalRoleMismatchError,
  portalRoleLabel,
  type PasswordSignInBlockedError,
  type PortalRoleMismatchError,
} from '../../lib/authErrors';
import { jobPortalPath, loginPathWithPrefill } from '../../routing';

interface LoginScreenProps {
  onLoginSuccess: (role: UserRole, email: string, password: string) => Promise<void> | void;
  onSocialLogin?: (provider: 'google' | 'apple', role: UserRole) => Promise<void> | void;
  onSignUp: () => void;
  /** Receives the email already typed so the reset screen starts pre-filled. */
  onForgotPassword: (email: string) => void;
  /**
   * Sends a password-reset email directly from the inline recovery card
   * (no navigation). Called when the user taps "Email a reset link to …".
   */
  onSendResetLink?: (email: string) => Promise<void> | void;
  /** Email carried over from a previous screen (reset flow, portal switch). */
  initialEmail?: string;
  /**
   * Re-sends the sign-up confirmation email. Offered when sign-in fails because
   * the address was never confirmed — the account exists, only the link is missing.
   */
  onResendConfirmation?: (email: string) => Promise<void> | void;
}

/**
 * Reads `/login?role=…&email=…` prefill params. Role-mismatch redirects use this
 * so the correct portal tab is active and the email is already filled in.
 */
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
  onSocialLogin,
  onSignUp,
  onForgotPassword,
  onSendResetLink,
  initialEmail = '',
}) => {
  const prefill = readLoginPrefill();
  const [email, setEmail] = useState(initialEmail || prefill.email);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [activeRole, setActiveRole] = useState<UserRole>(prefill.role ?? 'seeker');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleMismatch, setRoleMismatch] = useState<PortalRoleMismatchError | null>(null);
  const [signInBlocked, setSignInBlocked] = useState<PasswordSignInBlockedError | null>(null);
  const [confirmResend, setConfirmResend] = useState<{ email: string; state: 'idle' | 'sending' | 'sent' } | null>(null);
  /** Inline password-reset feedback (sent / sending / error). */
  const [resetLink, setResetLink] = useState<{ email: string; state: 'idle' | 'sending' | 'sent' | 'error'; message?: string } | null>(null);
  /** Seconds left on a sign-in throttle. The submit stays disabled so attempts are not burned. */
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = typeof window !== 'undefined' ? window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000) : 0;
    return () => { if (typeof window !== 'undefined') window.clearInterval(timer); };
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || cooldown > 0) return;
    setError(null);
    setRoleMismatch(null);
    setSignInBlocked(null);
    setConfirmResend(null);
    setResetLink(null);
    setIsLoading(true);
    try {
      await onLoginSuccess(activeRole, email, password);
    } catch (loginError) {
      if (isPortalRoleMismatchError(loginError)) {
        // Role conflict: surface the explainer + portal switch instead of a
        // generic error toast.
        setRoleMismatch(loginError);
        setError(null);
      } else if (isAuthRateLimitError(loginError)) {
        // Throttled: count down on the button instead of letting the user burn
        // more attempts. Social sign-in stays available as the way back in.
        setCooldown(loginError.retryAfterSeconds);
        setError(loginError.message);
      } else if (isPasswordSignInBlockedError(loginError)) {
        // The account is real, only the credential failed. Offer the way back in
        // right here instead of leaving the user on a sentence with no action.
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

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    if (!onSocialLogin) return;
    setError(null);
    setRoleMismatch(null);
    setSignInBlocked(null);
    setIsLoading(true);
    try {
      await onSocialLogin(provider, activeRole);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to start social sign-in.');
      setIsLoading(false);
    }
  };

  /**
   * Sends the password-reset email directly from the inline recovery card
   * (no navigation). Shows inline feedback so the user knows the email is on
   * the way without leaving the login screen.
   */
  const handleInlineReset = async () => {
    if (!onSendResetLink) {
      // Fallback: navigate to the forgot-password screen when no inline
      // handler is available.
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

  /**
   * Sends the user to the reset screen with the email they already typed, so a
   * failed sign-in turns into a recovery in one tap.
   */
  const handleResetPassword = () => {
    const target = (signInBlocked?.email || email).trim();
    setSignInBlocked(null);
    setError(null);
    onForgotPassword(target);
  };

  /**
   * Switches the active portal tab and clears all sensitive / error state so
   * nothing leaks across roles. Toggling tabs is a deliberate navigation and
   * should always leave the user on a clean form.
   */
  const handleTabSwitch = (role: UserRole) => {
    setActiveRole(role);
    setError(null);
    setRoleMismatch(null);
    setSignInBlocked(null);
    setConfirmResend(null);
    setResetLink(null);
  };

  /**
   * Switches the login screen to the email's permanent portal: flips the role
   * tab, pre-fills the email and mirrors the state into the URL so the screen
   * is deep-linkable and survives reloads.
   */
  const handleSwitchPortal = () => {
    if (!roleMismatch) return;
    const target = roleMismatch.existingRole;
    const prefilledEmail = roleMismatch.email || email;
    setRoleMismatch(null);
    setSignInBlocked(null);
    setError(null);
    if (target === 'admin') {
      // Admins have no tab on this screen: route to the admin sign-in with the
      // email carried over, mirroring the app's event-driven navigation.
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
    setEmail(prefilledEmail);
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, document.title, loginPathWithPrefill(target, prefilledEmail));
    }
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen flex flex-col justify-center items-center px-5 py-8 font-sans text-[#0f172a] antialiased">
      <main className="w-full max-w-[400px] flex flex-col gap-6">
        {/* Header */}
        <header className="text-center flex flex-col items-center">
          {/* Brand Spa Icon Placeholder */}
          <div className="w-16 h-16 rounded-full bg-[#6d28d9] text-white flex items-center justify-center mb-4 shadow-[0_4px_12px_rgba(15,23,42,0.08)]">
            <span className="material-symbols-outlined text-3xl filled-icon">spa</span>
          </div>
          <h1 className="text-2xl font-bold text-[#0f172a] mb-1">Welcome Back</h1>
          <p className="text-sm text-[#475569]">Sign in to continue your journey.</p>
        </header>

        {/* Portal selector — the backend validates this against the email's permanent account type. */}
        <div className="bg-[#f1f5f9] p-1 rounded-full flex gap-1 border border-[#cbd5e1]/30">
          <button
            type="button"
            onClick={() => handleTabSwitch('seeker')}
            className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeRole === 'seeker'
                ? 'bg-white text-[#4f46e5] shadow-sm'
                : 'text-[#475569] hover:text-[#0f172a]'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Job Seeker</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch('employer')}
            className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeRole === 'employer'
                ? 'bg-white text-[#4f46e5] shadow-sm'
                : 'text-[#475569] hover:text-[#0f172a]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Employer</span>
          </button>
        </div>
        <p className="-mt-4 text-center text-[11px] font-medium text-[#475569]">
          Each email is permanently linked to one portal type.
        </p>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-[0_4px_16px_rgba(15,23,42,0.06)] border border-[#cbd5e1]/40 p-5 flex flex-col gap-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email Input */}
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

            {/* Password Input */}
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
                  onClick={handleSwitchPortal}
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
              <div role="alert" className={`rounded-xl border px-3.5 py-3 flex flex-col gap-2.5 ${
                signInBlocked.oauthOnly
                  ? 'border-indigo-200 bg-indigo-50'
                  : 'border-amber-200 bg-amber-50'
              }`}>
                <p className={`text-xs font-medium leading-relaxed ${
                  signInBlocked.oauthOnly ? 'text-indigo-900' : 'text-amber-900'
                }`}>{signInBlocked.message}</p>
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
                ) : signInBlocked.oauthOnly ? (
                <>
                {/* OAuth-only: the server confirmed no password identity exists. */}
                <p className="text-[11px] font-semibold text-indigo-800">
                  This account was created via Google or Apple and has no password set.
                  Please sign in using OAuth — you can set a password later from your account settings.
                </p>
                {onSocialLogin && (
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => handleSocialLogin('google')}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-white border border-indigo-300 hover:bg-indigo-100 text-indigo-900 text-xs font-bold py-2 px-3 transition-colors cursor-pointer"
                    >
                      Continue with Google
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSocialLogin('apple')}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-white border border-indigo-300 hover:bg-indigo-100 text-indigo-900 text-xs font-bold py-2 px-3 transition-colors cursor-pointer"
                    >
                      <Apple className="w-3.5 h-3.5" />
                      Continue with Apple
                    </button>
                  </div>
                )}
                </>
                ) : (
                <>
                {/* Inline password-reset: sends the email without navigating away. */}
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
                {onSocialLogin && signInBlocked.reason !== 'unconfirmed' && (
                  <>
                    <p className="text-[11px] font-semibold text-amber-800">
                      {signInBlocked.reason === 'wrong_password'
                        ? 'This account may have been created via Google or Apple — those accounts have no password. Use the buttons below to sign in without one.'
                        : 'Created the account with Google or Apple? Use the same button — those accounts have no password.'}
                    </p>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => handleSocialLogin('google')}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-bold py-2 px-3 transition-colors cursor-pointer"
                      >
                        Continue with Google
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSocialLogin('apple')}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-bold py-2 px-3 transition-colors cursor-pointer"
                      >
                        <Apple className="w-3.5 h-3.5" />
                        Continue with Apple
                      </button>
                    </div>
                  </>
                )}
                </>
                )}
              </div>
            )}

            {/* Primary CTA */}
            <button
              type="submit"
              disabled={isLoading || cooldown > 0}
              className="w-full bg-[#7c3aed] disabled:opacity-60 disabled:cursor-wait text-white font-semibold text-base py-3 px-6 rounded-full mt-1 hover:bg-[#6d28d9] active:scale-95 transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{isLoading ? 'Signing in…' : cooldown > 0 ? `Try again in ${formatRetryCountdown(cooldown)}` : 'Login'}</span>
            </button>
          </form>
        </div>

        {/* Social Separator */}
        <div className="flex items-center gap-3 px-2">
          <div className="h-px bg-[#cbd5e1] flex-1" />
          <span className="text-[11px] font-semibold text-[#475569] uppercase tracking-wider">
            Or continue with
          </span>
          <div className="h-px bg-[#cbd5e1] flex-1" />
        </div>

        {/* Social Buttons */}
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            disabled={isLoading || !onSocialLogin}
            onClick={() => handleSocialLogin('google')}
            className="w-full bg-white disabled:opacity-50 text-[#0f172a] text-sm font-medium py-2.5 px-4 rounded-full border border-[#cbd5e1] hover:bg-[#f8fafc] transition-colors flex items-center justify-center gap-2.5 shadow-sm cursor-pointer"
          >
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDRbDCIKGSzKAwLwg9STfs20v54KkKGSB9qroIJqrchZBktxb-HOmv1SuO6rSCuxXmdhd3ISGwjmykxVjNRKlFd5INc_5LQEJFQNv976AxWpCLvCXXbtZW3baq1OG4TOXhoRWd1yHx1yFYUMVuzis66Q8SK7Jehg5A4zWyxgu84lNRYX_LWUaXcjGOdPcjG4UD7dlMfnlGJnDg-zh7wkhbv2RegItvEiRVSvosJ2PWzKhZZYQlIbgbN"
              alt="Google"
              className="w-4 h-4 object-contain"
              referrerPolicy="no-referrer"
            />
            <span>Continue with Google</span>
          </button>

          <button
            type="button"
            disabled={isLoading || !onSocialLogin}
            onClick={() => handleSocialLogin('apple')}
            className="w-full bg-white disabled:opacity-50 text-[#0f172a] text-sm font-medium py-2.5 px-4 rounded-full border border-[#cbd5e1] hover:bg-[#f8fafc] transition-colors flex items-center justify-center gap-2.5 shadow-sm cursor-pointer"
          >
            <Apple className="w-4 h-4" />
            <span>Continue with Apple</span>
          </button>
        </div>

        {/* Footer Link */}
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

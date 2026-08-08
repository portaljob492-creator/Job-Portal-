import React, { useState } from 'react';
import { UserRole } from '../../types';
import { Eye, EyeOff, Sparkles, UserCheck, Building2, Apple } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (role: UserRole, email: string, password: string) => Promise<void> | void;
  onSocialLogin?: (provider: 'google' | 'apple', role: UserRole) => Promise<void> | void;
  onSignUp: () => void;
  onForgotPassword: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  onSocialLogin,
  onSignUp,
  onForgotPassword,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [activeRole, setActiveRole] = useState<UserRole>('seeker');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await onLoginSuccess(activeRole, email, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    if (!onSocialLogin) return;
    setError(null);
    setIsLoading(true);
    try {
      await onSocialLogin(provider, activeRole);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to start social sign-in.');
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#fdf8f8] min-h-screen flex flex-col justify-center items-center px-5 py-8 font-sans text-[#1c1b1b] antialiased">
      <main className="w-full max-w-[400px] flex flex-col gap-6">
        {/* Header */}
        <header className="text-center flex flex-col items-center">
          {/* Brand Spa Icon Placeholder */}
          <div className="w-16 h-16 rounded-full bg-[#b90064] text-white flex items-center justify-center mb-4 shadow-[0_4px_12px_rgba(90,63,71,0.08)]">
            <span className="material-symbols-outlined text-3xl filled-icon">spa</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1c1b1b] mb-1">Welcome Back</h1>
          <p className="text-sm text-[#594047]">Sign in to continue your journey.</p>
        </header>

        {/* Demo Mode Role Selector Pills */}
        <div className="bg-[#f1edec] p-1 rounded-full flex gap-1 border border-[#e0bec6]/30">
          <button
            type="button"
            onClick={() => setActiveRole('seeker')}
            className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeRole === 'seeker'
                ? 'bg-white text-[#8e004b] shadow-sm'
                : 'text-[#594047] hover:text-[#1c1b1b]'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Job Seeker</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveRole('employer')}
            className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeRole === 'employer'
                ? 'bg-white text-[#8e004b] shadow-sm'
                : 'text-[#594047] hover:text-[#1c1b1b]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Employer</span>
          </button>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-[0_4px_16px_rgba(90,63,71,0.06)] border border-[#e0bec6]/40 p-5 flex flex-col gap-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email Input */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#1c1b1b]" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full bg-[#fdf8f8] text-[#1c1b1b] text-sm px-4 py-3 rounded-lg border-0 ring-1 ring-[#e0bec6] focus:ring-2 focus:ring-[#8e004b] focus:bg-white transition-all outline-none placeholder:text-[#594047]/50"
              />
            </div>

            {/* Password Input */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-[#1c1b1b]" htmlFor="password">
                  Password
                </label>
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="text-xs text-[#594047] hover:text-[#e2007c] transition-colors cursor-pointer"
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
                  className="w-full bg-[#fdf8f8] text-[#1c1b1b] text-sm px-4 py-3 rounded-lg border-0 ring-1 ring-[#e0bec6] focus:ring-2 focus:ring-[#8e004b] focus:bg-white transition-all outline-none placeholder:text-[#594047]/50 pr-10"
                />
                <button
                  type="button"
                  aria-label="Toggle password visibility"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#594047] hover:text-[#8e004b] transition-colors cursor-pointer"
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

            {/* Primary CTA */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#e6007e] disabled:opacity-60 disabled:cursor-wait text-white font-semibold text-base py-3 px-6 rounded-full mt-1 hover:bg-[#b50062] active:scale-95 transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{isLoading ? 'Signing in…' : 'Login'}</span>
            </button>
          </form>
        </div>

        {/* Social Separator */}
        <div className="flex items-center gap-3 px-2">
          <div className="h-px bg-[#e0bec6] flex-1" />
          <span className="text-[11px] font-semibold text-[#594047] uppercase tracking-wider">
            Or continue with
          </span>
          <div className="h-px bg-[#e0bec6] flex-1" />
        </div>

        {/* Social Buttons */}
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            disabled={isLoading || !onSocialLogin}
            onClick={() => handleSocialLogin('google')}
            className="w-full bg-white disabled:opacity-50 text-[#1c1b1b] text-sm font-medium py-2.5 px-4 rounded-full border border-[#e0bec6] hover:bg-[#f7f2f2] transition-colors flex items-center justify-center gap-2.5 shadow-sm cursor-pointer"
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
            className="w-full bg-white disabled:opacity-50 text-[#1c1b1b] text-sm font-medium py-2.5 px-4 rounded-full border border-[#e0bec6] hover:bg-[#f7f2f2] transition-colors flex items-center justify-center gap-2.5 shadow-sm cursor-pointer"
          >
            <Apple className="w-4 h-4" />
            <span>Continue with Apple</span>
          </button>
        </div>

        {/* Footer Link */}
        <footer className="text-center mt-2">
          <p className="text-sm text-[#594047]">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onSignUp}
              className="text-[#8e004b] font-semibold hover:text-[#e2007c] transition-colors cursor-pointer"
            >
              Sign Up
            </button>
          </p>
        </footer>
      </main>
    </div>
  );
};

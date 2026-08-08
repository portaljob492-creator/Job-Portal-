import React, { useState } from 'react';
import { User, Mail, Phone, Lock, Eye, EyeOff, ArrowLeft, Bell, Apple } from 'lucide-react';

interface JobSeekerSignupScreenProps {
  onSubmit: (formData: { name: string; email: string; phone: string }) => void;
  onBack: () => void;
  onLogin: () => void;
}

export const JobSeekerSignupScreen: React.FC<JobSeekerSignupScreenProps> = ({
  onSubmit,
  onBack,
  onLogin,
}) => {
  const [fullName, setFullName] = useState('Jane Doe');
  const [email, setEmail] = useState('jane@example.com');
  const [phone, setPhone] = useState('(555) 000-0000');
  const [password, setPassword] = useState('••••••••');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name: fullName, email, phone });
  };

  return (
    <div className="bg-[#ffffff] text-[#1c1b1b] min-h-screen flex flex-col items-center justify-center p-4 antialiased">
      {/* TopAppBar */}
      <header className="fixed top-0 w-full flex justify-between items-center px-5 h-16 z-50 bg-[#fdf8f8] shadow-[0_4px_12px_rgba(90,63,71,0.05)]">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="p-2 text-[#594047] hover:bg-[#e6e1e1] transition-colors rounded-full active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-[#8e004b]" />
        </button>
        <h1 className="text-xl font-bold text-[#8e004b]">Nexora Jobs</h1>
        <button
          type="button"
          aria-label="Notifications"
          className="p-2 text-[#594047] hover:bg-[#e6e1e1] transition-colors rounded-full active:scale-95 cursor-pointer"
        >
          <Bell className="w-5 h-5" />
        </button>
      </header>

      {/* Main Form */}
      <main className="w-full max-w-md pt-20 pb-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1c1b1b] mb-2">
            Create Account
          </h2>
          <p className="text-base text-[#594047]">
            Join the premium beauty community
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Full Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#594047]" htmlFor="fullName">
              Full Name
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#594047]">
                <User className="w-5 h-5 text-[#8c7077]" />
              </span>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                required
                className="w-full pl-10 pr-4 py-3 bg-[#fdf8f8] border-0 ring-1 ring-inset ring-[#e0bec6] rounded-xl text-base text-[#1c1b1b] focus:ring-2 focus:ring-inset focus:ring-[#8e004b] focus:bg-white transition-all outline-none"
              />
            </div>
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#594047]" htmlFor="email">
              Email
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#594047]">
                <Mail className="w-5 h-5 text-[#8c7077]" />
              </span>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                required
                className="w-full pl-10 pr-4 py-3 bg-[#fdf8f8] border-0 ring-1 ring-inset ring-[#e0bec6] rounded-xl text-base text-[#1c1b1b] focus:ring-2 focus:ring-inset focus:ring-[#8e004b] focus:bg-white transition-all outline-none"
              />
            </div>
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#594047]" htmlFor="phone">
              Phone Number
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#594047]">
                <Phone className="w-5 h-5 text-[#8c7077]" />
              </span>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 000-0000"
                required
                className="w-full pl-10 pr-4 py-3 bg-[#fdf8f8] border-0 ring-1 ring-inset ring-[#e0bec6] rounded-xl text-base text-[#1c1b1b] focus:ring-2 focus:ring-inset focus:ring-[#8e004b] focus:bg-white transition-all outline-none"
              />
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#594047]" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#594047]">
                <Lock className="w-5 h-5 text-[#8c7077]" />
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-10 py-3 bg-[#fdf8f8] border-0 ring-1 ring-inset ring-[#e0bec6] rounded-xl text-base text-[#1c1b1b] focus:ring-2 focus:ring-inset focus:ring-[#8e004b] focus:bg-white transition-all outline-none"
              />
              <button
                type="button"
                aria-label="Toggle password visibility"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#594047] hover:text-[#8e004b] transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Submit CTA */}
          <button
            type="submit"
            className="mt-2 w-full py-3.5 bg-[#e2007c] text-white rounded-full text-sm font-bold tracking-wide hover:bg-[#b90064] active:scale-95 transition-all shadow-md cursor-pointer"
          >
            Create Account
          </button>
        </form>

        {/* Separator */}
        <div className="my-6 flex items-center justify-center">
          <div className="h-px bg-[#e0bec6] flex-1" />
          <span className="px-4 text-xs font-semibold text-[#594047] uppercase tracking-wider">Or</span>
          <div className="h-px bg-[#e0bec6] flex-1" />
        </div>

        {/* Social Buttons */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => onSubmit({ name: 'Google User', email: 'user@google.com', phone: '(555) 123-4567' })}
            className="w-full py-3 bg-white border border-[#e0bec6] rounded-full flex items-center justify-center gap-3 text-[#1c1b1b] text-sm font-medium hover:bg-[#f7f2f2] transition-colors active:scale-95 cursor-pointer"
          >
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDRbDCIKGSzKAwLwg9STfs20v54KkKGSB9qroIJqrchZBktxb-HOmv1SuO6rSCuxXmdhd3ISGwjmykxVjNRKlFd5INc_5LQEJFQNv976AxWpCLvCXXbtZW3baq1OG4TOXhoRWd1yHx1yFYUMVuzis66Q8SK7Jehg5A4zWyxgu84lNRYX_LWUaXcjGOdPcjG4UD7dlMfnlGJnDg-zh7wkhbv2RegItvEiRVSvosJ2PWzKhZZYQlIbgbN"
              alt="Google"
              className="w-5 h-5 object-contain"
              referrerPolicy="no-referrer"
            />
            <span>Continue with Google</span>
          </button>

          <button
            type="button"
            onClick={() => onSubmit({ name: 'Apple User', email: 'user@apple.com', phone: '(555) 765-4321' })}
            className="w-full py-3 bg-[#1c1b1b] text-white rounded-full flex items-center justify-center gap-3 text-sm font-medium hover:bg-[#313030] transition-colors active:scale-95 cursor-pointer"
          >
            <Apple className="w-5 h-5" />
            <span>Continue with Apple</span>
          </button>
        </div>

        {/* Footer Link */}
        <div className="mt-8 text-center">
          <p className="text-sm text-[#594047]">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onLogin}
              className="text-[#8e004b] font-semibold hover:underline cursor-pointer"
            >
              Login
            </button>
          </p>
        </div>
      </main>
    </div>
  );
};

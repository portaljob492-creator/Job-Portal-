import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff } from 'lucide-react';

interface EmployerSignupScreenProps {
  onSubmit: (formData: { businessName: string; contactPerson: string; email: string }) => void;
  onBack: () => void;
  onLogin: () => void;
}

export const EmployerSignupScreen: React.FC<EmployerSignupScreenProps> = ({
  onSubmit,
  onBack,
  onLogin,
}) => {
  const [businessName, setBusinessName] = useState('Nexora Beauty Group');
  const [contactPerson, setContactPerson] = useState('Sarah Jenkins');
  const [businessEmail, setBusinessEmail] = useState('hello@nexorabeauty.com');
  const [password, setPassword] = useState('••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreeTerms) return;
    onSubmit({ businessName, contactPerson, email: businessEmail });
  };

  return (
    <div className="bg-[#fcf9f8] text-[#1c1b1b] min-h-screen flex flex-col font-sans antialiased selection:bg-[#ffd9e2] selection:text-[#8e004b] relative overflow-hidden">
      {/* TopAppBar */}
      <header className="flex justify-between items-center px-5 h-16 w-full z-50 bg-[#fdf8f8] shadow-[0_4px_12px_rgba(90,63,71,0.05)] sticky top-0">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="text-[#8e004b] hover:bg-[#e6e1e1] transition-colors p-2 rounded-full flex items-center justify-center cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-[#8e004b]">Nexora Jobs</h1>
        <div className="w-9" />
      </header>

      {/* Main Content Area */}
      <main className="flex-grow px-5 py-8 flex flex-col items-center justify-center relative z-10">
        {/* Animated Background Accents */}
        <div className="absolute inset-0 z-[-1] overflow-hidden opacity-30 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#ffb0c8] blur-[100px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-[#f2dde9] blur-[120px]" />
        </div>

        <div className="w-full max-w-md glass-card rounded-2xl p-6 sm:p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-[#1c1b1b] mb-1">
              Register Business
            </h2>
            <p className="text-sm text-[#594047]">
              Find top talent for your salon or spa.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Business Name Field */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#1c1b1b]" htmlFor="businessName">
                Business Name
              </label>
              <input
                id="businessName"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Nexora Beauty Group"
                required
                className="bg-[#f0edec] border-transparent focus:bg-white focus:border-[#8e004b] focus:ring-1 focus:ring-[#8e004b] rounded-lg px-4 py-3 text-sm text-[#1c1b1b] transition-colors outline-none placeholder:text-[#594047]/60"
              />
            </div>

            {/* Contact Person Field */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#1c1b1b]" htmlFor="contactPerson">
                Contact Person
              </label>
              <input
                id="contactPerson"
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Full Name"
                required
                className="bg-[#f0edec] border-transparent focus:bg-white focus:border-[#8e004b] focus:ring-1 focus:ring-[#8e004b] rounded-lg px-4 py-3 text-sm text-[#1c1b1b] transition-colors outline-none placeholder:text-[#594047]/60"
              />
            </div>

            {/* Business Email Field */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#1c1b1b]" htmlFor="businessEmail">
                Business Email
              </label>
              <input
                id="businessEmail"
                type="email"
                value={businessEmail}
                onChange={(e) => setBusinessEmail(e.target.value)}
                placeholder="hello@nexorabeauty.com"
                required
                className="bg-[#f0edec] border-transparent focus:bg-white focus:border-[#8e004b] focus:ring-1 focus:ring-[#8e004b] rounded-lg px-4 py-3 text-sm text-[#1c1b1b] transition-colors outline-none placeholder:text-[#594047]/60"
              />
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#1c1b1b]" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#f0edec] border-transparent focus:bg-white focus:border-[#8e004b] focus:ring-1 focus:ring-[#8e004b] rounded-lg px-4 py-3 text-sm text-[#1c1b1b] transition-colors outline-none placeholder:text-[#594047]/60 pr-10"
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

            {/* Terms Checkbox */}
            <div className="flex items-start gap-2.5 py-1">
              <input
                id="terms"
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-[#8e004b] bg-white border-[#8c7077] rounded focus:ring-[#8e004b]"
              />
              <label className="text-xs text-[#594047] leading-tight" htmlFor="terms">
                I agree to the <a href="#" className="text-[#8e004b] hover:underline font-medium">Terms & Conditions</a> and <a href="#" className="text-[#8e004b] hover:underline font-medium">Privacy Policy</a>.
              </label>
            </div>

            {/* CTA */}
            <button
              type="submit"
              disabled={!agreeTerms}
              className={`w-full h-12 rounded-full font-bold text-sm tracking-wide transition-all duration-200 mt-2 flex items-center justify-center gap-2 shadow-md cursor-pointer ${
                agreeTerms
                  ? 'bg-[#e6007e] text-white hover:bg-[#b50062] active:scale-[0.98]'
                  : 'bg-[#e6e1e1] text-[#594047] opacity-60 cursor-not-allowed'
              }`}
            >
              <span>Create Employer Account</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-[#594047]">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onLogin}
                className="text-[#8e004b] font-bold hover:underline cursor-pointer"
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

import React from 'react';
import { ArrowRight } from 'lucide-react';

interface WelcomeScreenProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onGetStarted,
  onLogin,
}) => {
  return (
    <div className="relative min-h-screen w-full bg-[#fdf8f8] text-[#1c1b1b] flex flex-col justify-between overflow-hidden">
      {/* Hero Background Image Container */}
      <div className="absolute inset-0 z-0 h-[520px] md:h-full md:w-1/2 md:right-0">
        <div 
          className="w-full h-full bg-cover bg-center transition-transform duration-1000 scale-105"
          style={{
            backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuCWP-tfHxs6zmZlZ-3nqmwbgnAPiAZVyfcsBMOUZs2bd8dhktf2-TxVLpARw1DLoZRgxr3A1wsrZJP-sJg0yCTaD8xUdj5aiOIcRz-Aw8FYeQ68SUMMV2ocrbjWpSS8marxVkDAME5a7a0HbVGu_GmERcW4fiviZwAokyB3wmi7acNG4vFdt4PNmzIlbvJD2b1DO0sNAOgb8OpsWOoo5P9LFDbV68Ei8bS23V8vuhCwhiAOGGmdsp50')`
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#fdf8f8]/60 to-[#fdf8f8] md:bg-gradient-to-r md:from-[#fdf8f8] md:via-[#fdf8f8]/80 md:to-transparent" />
        </div>
      </div>

      {/* Top Header branding */}
      <header className="relative z-20 pt-6 px-6 flex justify-between items-center max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#b90064] text-white flex items-center justify-center overflow-hidden shadow-md">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuA9YCfaHhiweK-DgFXUTX5By-ZlrtM7o_48z0R1CvglhQdeBo7o43CuXSrWkbdkRD0JOPXt1SEXjDjHt4zdZm8fOv-dhvMyqdbDZUNXwmpenD2eJciah26z8NQ4rKKhffJV8gjYX4dAKtGkUZUkl0oF59mZPMl5qgGnqVkNEfaNACu_hsf0OXFq8yH8vmwqQEwxoqoq0SJgaI2EW8ndBOdaiKTgwADhial60zjXq9BxWx2H-NMVdsGgUQzUehuN6oboGQ"
              alt="Nexora Logo"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <span className="font-bold text-2xl tracking-tight text-[#8e004b] block leading-none">Nexora Jobs</span>
            <span className="text-[10px] font-semibold text-[#594047] tracking-wider uppercase">Beauty careers</span>
          </div>
        </div>

      </header>

      {/* Content Area */}
      <main className="relative z-10 flex flex-col justify-end md:justify-center flex-grow px-5 pb-10 pt-[420px] md:pt-0 md:w-1/2 md:max-w-[600px] md:pl-[8%] max-w-lg mx-auto md:mx-0">
        <div className="flex flex-col gap-4 text-center md:text-left bg-[#fdf8f8]/90 backdrop-blur-md md:bg-transparent p-6 rounded-2xl md:p-0 border border-[#e0bec6]/30 md:border-none shadow-sm md:shadow-none">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#ffd9e2] text-[#8e004b] rounded-full text-xs font-semibold w-fit mx-auto md:mx-0">
            <span>✨ The #1 Beauty Career Network</span>
          </div>

          <h1 className="text-[30px] sm:text-[34px] md:text-[38px] leading-[1.15] font-bold text-[#1c1b1b] tracking-tight">
            Find your perfect role in beauty.
          </h1>

          <p className="text-[#594047] text-base leading-relaxed max-w-[420px] mx-auto md:mx-0">
            Beauty careers. Better opportunities. Connect with premier salons, spas, and luxury beauty groups looking for top talent like you.
          </p>

          <div className="flex flex-col gap-3 mt-4 md:w-[85%]">
            <button 
              onClick={onGetStarted}
              className="w-full h-12 bg-[#e2007c] text-white rounded-full text-base font-semibold hover:bg-[#b90064] transition-all active:scale-[0.98] duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2 group cursor-pointer"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>

            <button 
              onClick={onLogin}
              className="w-full h-12 bg-transparent text-[#8e004b] hover:bg-[#ffd9e2]/40 rounded-full text-base font-semibold transition-colors active:scale-[0.98] duration-200 cursor-pointer"
            >
              I already have an account
            </button>
          </div>


        </div>
      </main>

      <footer className="relative z-10 py-3 text-center text-xs text-[#594047]/70">
        © Nexora Jobs Inc. • Beauty & Wellness Recruitment
      </footer>
    </div>
  );
};

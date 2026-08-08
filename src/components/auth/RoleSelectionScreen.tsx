import React, { useState } from 'react';
import { UserRole } from '../../types';
import { User, Building2, ArrowLeft } from 'lucide-react';

interface RoleSelectionScreenProps {
  onSelectRole: (role: UserRole) => void;
  onBack: () => void;
}

export const RoleSelectionScreen: React.FC<RoleSelectionScreenProps> = ({
  onSelectRole,
  onBack,
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  const handleContinue = () => {
    if (selectedRole) {
      onSelectRole(selectedRole);
    }
  };

  return (
    <div className="bg-[#fdf8f8] text-[#1c1b1b] min-h-screen flex flex-col antialiased">
      {/* Top Bar */}
      <header className="flex justify-between items-center px-5 h-16 w-full max-w-lg mx-auto">
        <button
          onClick={onBack}
          aria-label="Go back"
          className="text-[#8e004b] hover:bg-[#e6e1e1] transition-colors p-2 rounded-full cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-lg text-[#8e004b]">Nexora Jobs</span>
        <div className="w-9" />
      </header>

      {/* Main Canvas */}
      <main className="flex-grow flex flex-col px-5 pt-8 pb-32 max-w-lg mx-auto w-full">
        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1c1b1b] mb-2">
            Join Nexora Jobs
          </h1>
          <p className="text-base text-[#594047]">
            Tell us how you would like to use the app.
          </p>
        </header>

        {/* Role Selection Cards */}
        <div className="flex flex-col gap-4">
          {/* Job Seeker Card */}
          <button
            type="button"
            onClick={() => setSelectedRole('seeker')}
            className={`w-full text-left bg-white rounded-xl border transition-all duration-200 p-4 shadow-[0_4px_12px_rgba(90,63,71,0.05)] cursor-pointer ${
              selectedRole === 'seeker'
                ? 'border-[#8e004b] bg-[#fcf9f8] ring-2 ring-[#8e004b]/20 shadow-md'
                : 'border-[#e8e8e8] hover:bg-[#f7f2f2]'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-[#ffd9e2] rounded-full flex items-center justify-center text-[#8e004b]">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#1c1b1b] mb-1">
                  I am a Job Seeker
                </h2>
                <p className="text-sm text-[#594047]">
                  Find jobs, track applications, and grow your beauty career.
                </p>
              </div>
            </div>
          </button>

          {/* Employer Card */}
          <button
            type="button"
            onClick={() => setSelectedRole('employer')}
            className={`w-full text-left bg-white rounded-xl border transition-all duration-200 p-4 shadow-[0_4px_12px_rgba(90,63,71,0.05)] cursor-pointer ${
              selectedRole === 'employer'
                ? 'border-[#8e004b] bg-[#fcf9f8] ring-2 ring-[#8e004b]/20 shadow-md'
                : 'border-[#e8e8e8] hover:bg-[#f7f2f2]'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-[#ffd9e2] rounded-full flex items-center justify-center text-[#8e004b]">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#1c1b1b] mb-1">
                  I am an Employer
                </h2>
                <p className="text-sm text-[#594047]">
                  Post jobs, find talent, and manage your beauty business.
                </p>
              </div>
            </div>
          </button>
        </div>
      </main>

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-0 w-full p-5 bg-white border-t border-[#e0bec6]/40 shadow-[0_-4px_12px_rgba(90,63,71,0.05)] flex justify-center z-40">
        <div className="w-full max-w-lg">
          <button
            type="button"
            disabled={!selectedRole}
            onClick={handleContinue}
            className={`w-full h-12 rounded-full font-semibold text-sm transition-all duration-200 ${
              selectedRole
                ? 'bg-[#e2007c] text-white hover:bg-[#8e004b] active:scale-95 shadow-md cursor-pointer'
                : 'bg-[#e6e1e1] text-[#594047] opacity-50 cursor-not-allowed'
            }`}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

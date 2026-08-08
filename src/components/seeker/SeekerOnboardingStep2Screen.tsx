import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';

interface SeekerOnboardingStep2ScreenProps {
  initialRoles?: string[];
  onBack: () => void;
  onNext: (selectedRoles: string[]) => void;
}

const DEFAULT_ROLES = [
  'Hair Stylist',
  'Beautician',
  'Makeup Artist',
  'Nail Artist',
  'Spa Therapist',
  'Massage Therapist',
  'Salon Manager',
  'Receptionist',
  'Barber',
  'Skin Therapist',
  'Hair Colorist',
  'Assistant',
  'Other',
];

export const SeekerOnboardingStep2Screen: React.FC<SeekerOnboardingStep2ScreenProps> = ({
  initialRoles = ['Makeup Artist', 'Skin Therapist'],
  onBack,
  onNext,
}) => {
  const [selectedRoles, setSelectedRoles] = useState<string[]>(initialRoles);

  const toggleRole = (role: string) => {
    if (selectedRoles.includes(role)) {
      setSelectedRoles(selectedRoles.filter((r) => r !== role));
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  const handleContinue = () => {
    onNext(selectedRoles);
  };

  return (
    <div className="bg-[#fdf8f8] text-[#1c1b1b] min-h-screen flex flex-col font-sans antialiased pb-24">
      {/* TopAppBar Header */}
      <header className="bg-white shadow-[0_4px_12px_rgba(90,63,71,0.05)] sticky top-0 z-50 flex justify-between items-center px-5 h-16 w-full border-b border-[#e6e1e1]">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="p-2 -ml-2 rounded-full hover:bg-[#e6e1e1] transition-colors active:scale-95 text-[#594047] hover:text-[#8e004b] flex items-center justify-center cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <h1 className="font-extrabold text-xl text-[#8e004b] tracking-tight">Nexora Jobs</h1>
          <span className="text-[10px] font-extrabold uppercase tracking-wider bg-[#ffd9e2] text-[#8e004b] px-2 py-0.5 rounded-full">
            Route: /app/jobs/onboarding/seeker/step-2
          </span>
        </div>

        <div className="w-10" />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col px-5 pt-6 pb-12 w-full max-w-2xl mx-auto">
        {/* Progress Tracking */}
        <div className="mb-6 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-[#8c7077] tracking-wider uppercase">
              Step 2 of 7
            </span>
            <span className="text-xs font-bold text-[#8e004b]">
              Professional Role
            </span>
          </div>
          <div className="h-2 w-full bg-[#e6e1e1] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#b90064] rounded-full transition-all duration-500 ease-out"
              style={{ width: '28.5%' }}
            />
          </div>
        </div>

        {/* Header Section */}
        <div className="mb-8 text-center sm:text-left">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1c1b1b] mb-2 tracking-tight">
            What do you do?
          </h2>
          <p className="text-sm text-[#594047] leading-relaxed">
            Select one or more roles that best describe your expertise.
          </p>
        </div>

        {/* Selection Role Chips Grid */}
        <div className="flex flex-wrap gap-3">
          {DEFAULT_ROLES.map((role) => {
            const isSelected = selectedRoles.includes(role);
            return (
              <button
                key={role}
                type="button"
                onClick={() => toggleRole(role)}
                className={`role-chip border rounded-full px-5 py-3 text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  isSelected
                    ? 'bg-[#b90064] text-white border-[#b90064] shadow-sm scale-[1.02]'
                    : 'bg-white text-[#1c1b1b] border-[#e0bec6] hover:border-[#b90064] hover:bg-[#fdf8f8]'
                }`}
              >
                {isSelected && <Check className="w-4 h-4 text-white flex-shrink-0" />}
                <span>{role}</span>
              </button>
            );
          })}
        </div>

        {/* Helper Note if None Selected */}
        {selectedRoles.length === 0 && (
          <p className="mt-4 text-xs font-semibold text-rose-600">
            Please select at least one role to continue.
          </p>
        )}
      </main>

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-0 w-full p-5 bg-gradient-to-t from-[#fdf8f8] via-[#fdf8f8] to-transparent pt-8 z-40 border-t border-[#e6e1e1]/60">
        <div className="max-w-2xl mx-auto">
          <button
            type="button"
            onClick={handleContinue}
            disabled={selectedRoles.length === 0}
            className={`w-full h-12 rounded-full font-extrabold text-base flex items-center justify-center gap-2 transition-all shadow-md ${
              selectedRoles.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-[#e2007c] hover:bg-[#8e004b] text-white active:scale-[0.98] cursor-pointer'
            }`}
          >
            <span>Continue</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

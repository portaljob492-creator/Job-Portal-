import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';

interface SeekerOnboardingStep2ScreenProps {
  initialRoles?: string[];
  onBack: () => void;
  onNext: (selectedRoles: string[]) => Promise<void>;
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
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const toggleRole = (role: string) => {
    if (selectedRoles.includes(role)) {
      setSelectedRoles(selectedRoles.filter((r) => r !== role));
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  const handleContinue = async () => {
    if (isSaving || selectedRoles.length === 0) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onNext(selectedRoles);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save your roles. Please retry.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-[#f8fafc] text-[#0f172a] min-h-screen flex flex-col font-sans antialiased pb-24">
      {/* TopAppBar Header */}
      <header className="bg-white shadow-[0_4px_12px_rgba(15,23,42,0.05)] sticky top-0 z-50 flex justify-between items-center px-5 h-16 w-full border-b border-[#e2e8f0]">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="p-2 -ml-2 rounded-full hover:bg-[#e2e8f0] transition-colors active:scale-95 text-[#475569] hover:text-[#4f46e5] flex items-center justify-center cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <h1 className="font-extrabold text-xl text-[#4f46e5] tracking-tight">Nexora Jobs</h1>

        <div className="w-10" />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col px-5 pt-6 pb-12 w-full max-w-2xl mx-auto">
        {/* Progress Tracking */}
        <div className="mb-6 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-[#64748b] tracking-wider uppercase">
              Step 2 of 7
            </span>
            <span className="text-xs font-bold text-[#4f46e5]">
              Professional Role
            </span>
          </div>
          <div className="h-2 w-full bg-[#e2e8f0] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#6d28d9] rounded-full transition-all duration-500 ease-out"
              style={{ width: '28.5%' }}
            />
          </div>
        </div>

        {/* Header Section */}
        <div className="mb-8 text-center sm:text-left">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] mb-2 tracking-tight">
            What do you do?
          </h2>
          <p className="text-sm text-[#475569] leading-relaxed">
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
                    ? 'bg-[#6d28d9] text-white border-[#6d28d9] shadow-sm scale-[1.02]'
                    : 'bg-white text-[#0f172a] border-[#cbd5e1] hover:border-[#6d28d9] hover:bg-[#f8fafc]'
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
      <div className="fixed bottom-0 left-0 w-full p-5 bg-gradient-to-t from-[#f8fafc] via-[#f8fafc] to-transparent pt-8 z-40 border-t border-[#e2e8f0]/60">
        <div className="max-w-2xl mx-auto">
          {saveError && <p role="alert" className="mb-2 text-sm font-semibold text-rose-700">{saveError}</p>}
          <button
            type="button"
            onClick={() => void handleContinue()}
            disabled={selectedRoles.length === 0 || isSaving}
            className={`w-full h-12 rounded-full font-extrabold text-base flex items-center justify-center gap-2 transition-all shadow-md ${
              selectedRoles.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-[#7c3aed] hover:bg-[#4f46e5] text-white active:scale-[0.98] cursor-pointer'
            }`}
          >
            <span>{isSaving ? 'Saving…' : 'Continue'}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

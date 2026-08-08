import React from 'react';
import { ScreenState, UserRole } from '../types';
import { Layers, ChevronDown } from 'lucide-react';

interface NavigationToolbarProps {
  currentScreen: ScreenState;
  currentRole: UserRole;
  onNavigate: (screen: ScreenState, role?: UserRole) => void;
}

export const NavigationToolbar: React.FC<NavigationToolbarProps> = ({
  currentScreen,
  currentRole,
  onNavigate,
}) => {
  const screens: { id: ScreenState; label: string }[] = [
    { id: 'welcome', label: '1. Welcome Hero' },
    { id: 'role_select', label: '2. Role Selection' },
    { id: 'login', label: '3. Login Page' },
    { id: 'seeker_signup', label: '4. Seeker Signup' },
    { id: 'employer_signup', label: '5. Employer Signup' },
    { id: 'otp_verify', label: '6. OTP Verification' },
    { id: 'forgot_password', label: '7. Forgot Password' },
    { id: 'main_app', label: `8. App Workspace (${currentRole === 'seeker' ? 'Seeker' : 'Employer'})` },
  ];

  return (
    <div className="fixed bottom-3 right-3 z-50 bg-[#1c1b1b]/90 text-white backdrop-blur-md px-3 py-2 rounded-2xl shadow-2xl border border-white/20 flex items-center gap-2 text-xs">
      <div className="flex items-center gap-1.5 text-[#ffd9e2] font-semibold">
        <Layers className="w-4 h-4 text-[#e2007c]" />
        <span className="hidden sm:inline">Screen Preview:</span>
      </div>

      <select
        value={currentScreen}
        onChange={(e) => onNavigate(e.target.value as ScreenState)}
        className="bg-[#313030] text-white text-xs font-medium rounded-xl px-2.5 py-1.5 border border-white/20 outline-none cursor-pointer"
      >
        {screens.map((sc) => (
          <option key={sc.id} value={sc.id}>
            {sc.label}
          </option>
        ))}
      </select>

      {currentScreen === 'main_app' && (
        <button
          onClick={() => onNavigate('main_app', currentRole === 'seeker' ? 'employer' : 'seeker')}
          className="px-2.5 py-1 bg-[#e2007c] hover:bg-[#b90064] text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
        >
          View as {currentRole === 'seeker' ? 'Employer' : 'Seeker'}
        </button>
      )}
    </div>
  );
};

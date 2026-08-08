import React from 'react';
import { LogOut } from 'lucide-react';

interface LogoutConfirmationModalProps {
  onClose: () => void;
  onLogout: () => void;
}

export const LogoutConfirmationModal: React.FC<LogoutConfirmationModalProps> = ({ onClose, onLogout }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-4">
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-slide-up {
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
      <div className="absolute inset-0 bg-[#1c1b1b]/60 backdrop-blur-[2px] animate-fade-in" onClick={onClose}></div>
      <div className="bg-white rounded-t-xl md:rounded-xl shadow-[0_-4px_24px_rgba(90,63,71,0.1)] w-full max-w-md mx-auto animate-slide-up p-5 md:p-8 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-[#ffdad6]/30 flex items-center justify-center mb-4 text-[#ba1a1a]">
          <LogOut className="w-8 h-8" />
        </div>
        <h2 className="text-[20px] font-semibold text-[#1c1b1b] mb-2">
          Log out of Nexora Jobs?
        </h2>
        <p className="text-[16px] text-[#594047] mb-8 max-w-[280px]">
          You'll need to log in again to manage jobs, candidates and interviews.
        </p>
        <div className="w-full flex flex-col gap-4">
          <button 
            onClick={onLogout}
            className="w-full h-12 flex items-center justify-center rounded-full bg-[#ba1a1a] text-white text-[13px] font-bold transition-colors hover:bg-[#ba1a1a]/90 active:scale-[0.98]"
          >
            Log Out
          </button>
          <button 
            onClick={onClose}
            className="w-full h-12 flex items-center justify-center rounded-full border border-[#e0bec6] bg-white text-[#8e004b] text-[13px] font-bold transition-colors hover:bg-[#e6e1e1] active:scale-[0.98]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

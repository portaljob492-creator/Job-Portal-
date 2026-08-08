import React, { useEffect, useState } from 'react';
import { CheckCircle, Sparkles } from 'lucide-react';
import { Applicant } from '../../types';

interface HiringSuccessScreenProps {
  applicant: Applicant;
  offerDetails?: {
    salary: string;
    joiningDate: string;
    jobRole: string;
  };
  onClose: () => void;
  onViewProfile: () => void;
}

export const HiringSuccessScreen: React.FC<HiringSuccessScreenProps> = ({ 
  applicant, 
  offerDetails, 
  onClose,
  onViewProfile
}) => {
  const [confettiPieces, setConfettiPieces] = useState<Array<{ id: number; left: string; color: string; animDuration: string; animDelay: string; shape: string }>>([]);

  useEffect(() => {
    const colors = ['#e2007c', '#ffb0c8', '#8e004b', '#f2dde9'];
    const pieces = Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100 + 'vw',
      color: colors[Math.floor(Math.random() * colors.length)],
      animDuration: (Math.random() * 3 + 2) + 's',
      animDelay: (Math.random() * 2) + 's',
      shape: Math.random() > 0.5 ? '50%' : '0'
    }));
    setConfettiPieces(pieces);
  }, []);

  return (
    <div className="fixed inset-0 z-[120] bg-[#fdf8f8] flex flex-col items-center justify-center overflow-hidden animate-in fade-in duration-300">
      {/* Decorative Background Elements */}
      <div 
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#e0bec6 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      ></div>
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-[#ffb0c8]/20 to-transparent pointer-events-none"></div>
      
      {/* Confetti */}
      {confettiPieces.map(piece => (
        <div
          key={piece.id}
          className="absolute w-2.5 h-2.5 pointer-events-none"
          style={{
            backgroundColor: piece.color,
            left: piece.left,
            top: '-10vh',
            borderRadius: piece.shape,
            animation: `fall ${piece.animDuration} linear ${piece.animDelay} infinite`
          }}
        ></div>
      ))}

      {/* Main Content */}
      <main className="w-full max-w-md px-5 py-8 z-10 flex flex-col items-center relative text-center">
        {/* Celebratory Icon */}
        <div className="mb-4 relative">
          <div className="w-24 h-24 rounded-full bg-[#e2007c] flex items-center justify-center shadow-[0_8px_24px_rgba(226,0,124,0.3)] animate-bounce" style={{ animationDuration: '2s' }}>
            <CheckCircle className="text-white w-12 h-12" fill="currentColor" color="#e2007c" />
          </div>
          {/* Sparkles */}
          <Sparkles className="absolute -top-4 -right-4 text-[#8e004b] w-6 h-6" />
          <Sparkles className="absolute top-12 -left-6 text-[#b90064] w-5 h-5" />
        </div>

        {/* Headline */}
        <h1 className="text-[28px] md:text-[32px] font-bold text-[#1c1b1b] mb-2 tracking-tight">Candidate hired successfully</h1>
        <p className="text-[16px] text-[#594047] mb-8">You've successfully added a new member to your team.</p>

        {/* Candidate Summary Card */}
        <div className="w-full bg-white border border-[#e0bec6] rounded-xl p-4 shadow-[0_4px_12px_rgba(90,63,71,0.05)] mb-4 flex flex-col items-center">
          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#e6e1e1] mb-2">
            {applicant.avatarUrl ? (
              <img src={applicant.avatarUrl} alt={applicant.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#ece7e7] flex items-center justify-center text-[#594047] font-semibold text-2xl">
                {applicant.name.charAt(0)}
              </div>
            )}
          </div>
          <h2 className="text-[18px] font-semibold text-[#1c1b1b]">{applicant.name}</h2>
          <p className="text-[13px] font-medium text-[#594047] mb-2">{offerDetails?.jobRole || applicant.appliedJobTitle}</p>
          <div className="px-3 py-1 rounded-full bg-[#E6F4EA] border border-[#CEEAD6] flex items-center gap-1">
            <CheckCircle className="text-[#137333] w-4 h-4" />
            <span className="text-[13px] font-medium text-[#137333]">Hired</span>
          </div>
        </div>

        {/* Details Section */}
        {offerDetails && (
          <div className="w-full bg-[#f7f2f2] rounded-lg p-4 flex justify-between items-center mb-8 border border-[#e6e1e1]">
            <div className="text-left">
              <span className="block text-[13px] font-medium text-[#594047] mb-1">Annual Salary</span>
              <span className="block text-[18px] font-semibold text-[#1c1b1b]">${offerDetails.salary} USD</span>
            </div>
            <div className="h-8 w-px bg-[#e0bec6]"></div>
            <div className="text-right">
              <span className="block text-[13px] font-medium text-[#594047] mb-1">Joining Date</span>
              <span className="block text-[18px] font-semibold text-[#1c1b1b]">{new Date(offerDetails.joiningDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="w-full flex flex-col gap-3">
          <button 
            onClick={onClose}
            className="w-full h-12 bg-[#e2007c] hover:bg-[#8e004b] text-white rounded-full text-[13px] font-medium transition-colors shadow-sm cursor-pointer"
          >
            Back to Dashboard
          </button>
          <button 
            onClick={onViewProfile}
            className="w-full h-12 bg-transparent border border-[#e0bec6] text-[#8e004b] hover:bg-[#f1edec] transition-colors rounded-full text-[13px] font-medium cursor-pointer"
          >
            View Candidate Profile
          </button>
        </div>
      </main>
      
      <style>{`
        @keyframes fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(120vh) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

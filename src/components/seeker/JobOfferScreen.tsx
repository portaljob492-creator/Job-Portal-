import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Bell, 
  Calendar, 
  Clock, 
  FileText, 
  Download, 
  CheckCircle, 
  XCircle, 
  MessageSquare, 
  Bookmark, 
  User, 
  Store, 
  Award, 
  Briefcase, 
  X, 
  HelpCircle,
  FileSpreadsheet,
  Check
} from 'lucide-react';
import { JobPosting, Application } from '../../types';

interface JobOfferScreenProps {
  jobs: JobPosting[];
  applications: Application[];
  selectedApplication: Application | null;
  onUpdateApplicationStatus: (appId: string, status: 'Submitted' | 'Under Review' | 'Interview Scheduled' | 'Offer Extended' | 'Accepted' | 'Declined', notes?: string) => void;
  onBack: () => void;
  onNavigateTab?: (tab: 'feed' | 'applications' | 'saved' | 'messages' | 'portfolio' | 'profile') => void;
}

export const JobOfferScreen: React.FC<JobOfferScreenProps> = ({
  jobs,
  applications,
  selectedApplication,
  onUpdateApplicationStatus,
  onBack,
  onNavigateTab,
}) => {
  // Find matching application with 'Offer Extended' or fallback
  const activeApp = selectedApplication || applications.find(a => a.status === 'Offer Extended') || applications[0] || {
    id: 'mock-app',
    jobId: 'mock-job',
    jobTitle: 'Senior Hair Stylist',
    salonName: 'Lumière Studio',
    salonLogo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB5JCqBiVfa_CwowlJQTTK_3eiwfgzf0Z_pWCPoR66iHIDnWdTP-9LiiTLzZTxOtz5HJf9bLk9EP0mNUCxumCZzM0Pmwefn6z0-gm4YPPCybj25rgcv3sPYZZxLYH0Vb3DXOe2V1qWVelxOYXhfccRaEHPtCX6kxTXwBjsEuww_XnixKQfqjq13RmtKMB10RjNUeKiXm-yvx2JrKNqO0Zj5PYIRZ4l94UjX9KIiXKDRSLfVkNB9MtY6-45ojbmNxLfHxQ',
    location: 'Beverly Hills, CA',
    appliedDate: 'Oct 28, 2023',
    status: 'Offer Extended',
    notes: 'We are thrilled to offer you this position. Your expertise in hair coloring and styling is exactly what we need at Lumière Studio. We look forward to having you on our team.',
  };

  // Find matching job details
  const matchingJob = jobs.find(j => j.id === activeApp.jobId);

  // Offer dynamic state
  const [offerState, setOfferState] = useState<'pending' | 'accepted' | 'declined'>('pending');
  const [showToast, setShowToast] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  // Extract variables
  const jobTitle = matchingJob?.title || activeApp.jobTitle || 'Senior Hair Stylist';
  const salonName = matchingJob?.salonName || activeApp.salonName || 'Lumière Studio';
  const salonLogo = activeApp.salonLogo || matchingJob?.salonLogo || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=200';
  const salary = matchingJob?.salary || activeApp.expectedSalary || '₹4,50,000 - ₹5,50,000 / year';
  const jobType = matchingJob?.jobType || 'Full-time';
  const location = matchingJob?.location || activeApp.location || 'Beverly Hills, CA';
  
  // Custom message/notes
  const employerMessage = activeApp.notes || 'We are thrilled to offer you this position. Your expertise in hair coloring and styling is exactly what we need at Lumière Studio. We look forward to having you on our team.';

  const handleAccept = () => {
    setOfferState('accepted');
    onUpdateApplicationStatus(activeApp.id, 'Offer Extended', 'Offer Accepted! Thank you.');
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 4000);
  };

  const handleDeclineConfirm = () => {
    setOfferState('declined');
    onUpdateApplicationStatus(activeApp.id, 'Offer Extended', `Offer Declined. Reason: ${declineReason || 'None specified'}`);
    setShowDeclineModal(false);
  };

  return (
    <div className="min-h-screen bg-[#fdf8f8] text-[#1c1b1b] pb-24 relative select-none">
      {/* Top App Bar */}
      <header className="sticky top-0 bg-white border-b border-[#e0bec6]/30 px-margin-side h-16 w-full flex justify-between items-center z-40 shadow-xs">
        <button 
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#ffd9e2]/50 text-[#8e004b] transition-colors active:scale-95 duration-200 cursor-pointer"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-screen-title text-lg font-bold text-[#8e004b]">Job Offer</h1>
        <button 
          onClick={() => {
            if (onNavigateTab) onNavigateTab('profile');
          }}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#ffd9e2]/50 text-[#594047] transition-colors active:scale-95 duration-200 cursor-pointer"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content Body */}
      <main className="px-margin-side py-stack-default max-w-3xl mx-auto flex flex-col gap-6">
        
        {/* Header Card: Identity */}
        <section className="bg-white rounded-2xl border border-[#e0bec6]/40 shadow-sm p-6 flex flex-col sm:flex-row gap-5 items-center sm:items-start text-center sm:text-left hover:shadow-md transition-shadow">
          <div className="w-20 h-20 rounded-2xl overflow-hidden border border-[#e0bec6]/30 shrink-0 relative shadow-inner bg-[#ffd9e2]/10 flex items-center justify-center">
            <img 
              alt={`${salonName} Logo`} 
              className="w-full h-full object-cover" 
              src={salonLogo}
              onError={(e) => {
                // Fail-safe placeholder
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=200';
              }}
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex-grow flex flex-col gap-1 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-[#1c1b1b] leading-tight">{jobTitle}</h2>
              <span className={`px-3.5 py-1 rounded-full text-xs font-bold self-center sm:self-auto ${
                offerState === 'accepted' 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                  : offerState === 'declined' 
                  ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                  : 'bg-[#ffd9e2] text-[#8e004b] border border-[#e0bec6]/40'
              }`}>
                {offerState === 'accepted' ? 'Offer Accepted' : offerState === 'declined' ? 'Offer Declined' : 'Offer Pending'}
              </span>
            </div>
            
            <p className="text-[#594047] text-sm font-semibold flex items-center justify-center sm:justify-start gap-1.5 mt-1">
              <Store className="w-4 h-4 text-[#8e004b]" />
              <span>{salonName}</span>
              <span className="text-[#e0bec6]">•</span>
              <span>{location}</span>
            </p>
          </div>
        </section>

        {/* Bento Grid: Offer Details */}
        <section>
          <h3 className="text-base font-bold text-[#1c1b1b] mb-3">Offer Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Salary Card */}
            <div className="bg-white rounded-2xl border border-[#e0bec6]/40 p-5 flex flex-col items-center justify-center text-center shadow-xs hover:bg-[#ffd9e2]/10 transition-colors">
              <div className="w-12 h-12 rounded-full bg-[#ffd9e2] text-[#8e004b] flex items-center justify-center mb-3">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <span className="text-[#594047] text-xs font-medium mb-1 uppercase tracking-wider">Salary Structure</span>
              <span className="text-base font-bold text-[#1c1b1b] leading-none">{salary}</span>
              <span className="text-[10px] text-[#594047] font-semibold mt-1">Base + Commission</span>
            </div>

            {/* Employment Type Card */}
            <div className="bg-white rounded-2xl border border-[#e0bec6]/40 p-5 flex flex-col items-center justify-center text-center shadow-xs hover:bg-[#ffd9e2]/10 transition-colors">
              <div className="w-12 h-12 rounded-full bg-[#ffd9e2] text-[#8e004b] flex items-center justify-center mb-3">
                <Briefcase className="w-5 h-5" />
              </div>
              <span className="text-[#594047] text-xs font-medium mb-1 uppercase tracking-wider">Employment Type</span>
              <span className="text-base font-bold text-[#1c1b1b] leading-none">{jobType}</span>
              <span className="text-[10px] text-[#594047] font-semibold mt-1">Full-time standard</span>
            </div>

            {/* Joining Date Card */}
            <div className="bg-white rounded-2xl border border-[#e0bec6]/40 p-5 flex flex-col items-center justify-center text-center shadow-xs hover:bg-[#ffd9e2]/10 transition-colors">
              <div className="w-12 h-12 rounded-full bg-[#ffd9e2] text-[#8e004b] flex items-center justify-center mb-3">
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-[#594047] text-xs font-medium mb-1 uppercase tracking-wider">Target Joining Date</span>
              <span className="text-base font-bold text-[#1c1b1b] leading-none">Nov 15, 2026</span>
              <span className="text-[10px] text-[#594047] font-semibold mt-1">Immediate start</span>
            </div>

          </div>
        </section>

        {/* Offer Notes / Cover Message */}
        <section className="bg-white rounded-2xl border border-[#e0bec6]/40 shadow-xs p-6 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#e2007c]"></div>
          <h3 className="text-base font-bold text-[#1c1b1b] mb-3 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#8e004b]" />
            <span>Message from Employer</span>
          </h3>
          <p className="text-[#594047] italic text-sm leading-relaxed pl-4 border-l-2 border-[#e0bec6]/40 ml-1">
            "{employerMessage}"
          </p>
        </section>

        {/* Document Section */}
        <section>
          <h3 className="text-base font-bold text-[#1c1b1b] mb-3">Documents</h3>
          <div className="group bg-white rounded-2xl border border-[#e0bec6]/40 shadow-xs p-4 flex items-center gap-4 hover:border-[#8e004b] transition-all cursor-pointer">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
              <FileText className="w-6 h-6" />
            </div>
            <div className="flex-grow min-w-0">
              <p className="text-sm font-bold text-[#1c1b1b] truncate group-hover:text-[#8e004b] transition-colors">Offer_Letter_{salonName.replace(/\s+/g, '_')}.pdf</p>
              <p className="text-xs text-[#594047] font-medium">PDF Document • 2.4 MB • Ready to sign</p>
            </div>
            <button 
              type="button"
              onClick={() => {
                alert('Offer letter downloaded. Please review, sign, and upload here if necessary.');
              }}
              className="w-10 h-10 rounded-full bg-[#fdf8f8] text-[#8e004b] flex items-center justify-center border border-[#e0bec6]/30 hover:bg-[#8e004b] hover:text-white hover:border-[#8e004b] transition-colors shrink-0 cursor-pointer"
              title="Download Document"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </section>

      </main>

      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-md border-t border-[#e0bec6]/40 p-4 z-40 shadow-lg">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3">
          {offerState === 'pending' ? (
            <>
              <button 
                onClick={handleAccept}
                className="flex-1 h-12 bg-[#8e004b] text-white rounded-full font-bold flex items-center justify-center gap-2 hover:bg-[#b90064] active:scale-98 transition-all shadow-md cursor-pointer"
              >
                <CheckCircle className="w-5 h-5" />
                <span>Accept Offer</span>
              </button>
              <button 
                onClick={() => setShowDeclineModal(true)}
                className="flex-1 h-12 bg-white text-[#594047] border border-[#8c7077] rounded-full font-bold flex items-center justify-center gap-2 hover:bg-[#f1edec] active:scale-98 transition-all cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
                <span>Decline Offer</span>
              </button>
            </>
          ) : offerState === 'accepted' ? (
            <button 
              className="w-full h-12 bg-emerald-600 text-white rounded-full font-bold flex items-center justify-center gap-2 cursor-default"
              disabled
            >
              <Check className="w-5 h-5" />
              <span>Offer Accepted</span>
            </button>
          ) : (
            <button 
              className="w-full h-12 bg-rose-600 text-white rounded-full font-bold flex items-center justify-center gap-2 cursor-default"
              disabled
            >
              <X className="w-5 h-5" />
              <span>Offer Declined</span>
            </button>
          )}
        </div>
      </div>

      {/* Celebration Toast Modal overlay */}
      {showToast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-[#e0bec6]/40 rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-[#ffd9e2] text-[#8e004b] rounded-full flex items-center justify-center mb-5 shadow-inner">
              <Award className="w-10 h-10 animate-bounce" />
            </div>
            <h4 className="text-xl font-bold text-[#8e004b] mb-2">Offer Accepted!</h4>
            <p className="text-sm text-[#594047] mb-6">Congratulations on your new role at {salonName}! The salon manager has been notified and will reach out with your onboarding steps.</p>
            <button 
              onClick={() => {
                setShowToast(false);
                onBack();
              }}
              className="w-full h-11 bg-[#8e004b] text-white rounded-full font-bold hover:bg-[#b90064] transition-colors cursor-pointer"
            >
              Back to Workspace
            </button>
          </div>
        </div>
      )}

      {/* Decline Dialog Modal */}
      {showDeclineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-[#e0bec6]/40 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-bold text-[#1c1b1b]">Decline Offer</h4>
              <button 
                onClick={() => setShowDeclineModal(false)}
                className="w-8 h-8 rounded-full hover:bg-[#ffd9e2]/30 flex items-center justify-center text-[#594047] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-xs text-[#594047] mb-4 font-semibold">
              Please share your reason for declining this offer. This feedback will be shared with {salonName} constructively.
            </p>

            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="e.g., I have accepted another offer / The salary is below my expectations / Commute is too long..."
              className="w-full h-28 p-3 rounded-xl border border-[#e0bec6]/50 focus:border-[#8e004b] focus:ring-1 focus:ring-[#8e004b] outline-none text-xs text-[#1c1b1b] resize-none mb-6"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeclineModal(false)}
                className="flex-1 h-10 rounded-full border border-[#8c7077] text-[#594047] font-bold text-xs hover:bg-[#f1edec] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeclineConfirm}
                className="flex-1 h-10 rounded-full bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 cursor-pointer"
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile BottomNavBar */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center py-3 bg-white border-t border-[#e0bec6]/40 z-30 sm:hidden">
        <button 
          onClick={() => {
            onBack();
            if (onNavigateTab) onNavigateTab('feed');
          }}
          className="flex flex-col items-center justify-center text-[#594047] hover:text-[#8e004b] active:scale-90 transition-transform w-16 cursor-pointer"
        >
          <Briefcase className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-1">Jobs</span>
        </button>
        <button 
          onClick={onBack}
          className="flex flex-col items-center justify-center bg-[#ffd9e2] text-[#8e004b] rounded-full px-5 py-1.5 active:scale-90 transition-transform cursor-pointer"
        >
          <FileText className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-0.5">Apps</span>
        </button>
        <button 
          onClick={() => {
            onBack();
            if (onNavigateTab) onNavigateTab('saved');
          }}
          className="flex flex-col items-center justify-center text-[#594047] hover:text-[#8e004b] active:scale-90 transition-transform w-16 cursor-pointer"
        >
          <Bookmark className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-1">Saved</span>
        </button>
        <button 
          onClick={() => {
            onBack();
            if (onNavigateTab) onNavigateTab('profile');
          }}
          className="flex flex-col items-center justify-center text-[#594047] hover:text-[#8e004b] active:scale-90 transition-transform w-16 cursor-pointer"
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-1">Profile</span>
        </button>
      </nav>
    </div>
  );
};

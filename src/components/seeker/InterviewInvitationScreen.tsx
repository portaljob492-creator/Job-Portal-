import React, { useState } from 'react';
import { ArrowLeft, Bell, Calendar, Clock, Video, Copy, Check, MessageSquare, X, ChevronRight, HelpCircle, Briefcase, Bookmark, PersonStanding, User, MapPin, Phone } from 'lucide-react';
import { JobPosting, Application } from '../../types';

interface InterviewInvitationScreenProps {
  jobs: JobPosting[];
  applications: Application[];
  selectedApplication?: Application | null;
  /** Persists the candidate's answer through `accept_interview` / `decline_interview` / `request_interview_reschedule`. */
  onInterviewResponse?: (applicationId: string, action: 'accept' | 'decline' | 'reschedule', reason?: string) => Promise<void>;
  onBack: () => void;
  onNavigateTab?: (tab: 'explore' | 'applications' | 'saved' | 'messages' | 'profile') => void;
}

export const InterviewInvitationScreen: React.FC<InterviewInvitationScreenProps> = ({
  jobs,
  applications,
  selectedApplication,
  onInterviewResponse,
  onBack,
  onNavigateTab,
}) => {
  const activeApp = selectedApplication
    || applications.find((application) => application.status === 'Interview Scheduled')
    || null;

  const [copied, setCopied] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'info' | 'error'>('success');
  const [pendingAction, setPendingAction] = useState<'accept' | 'decline' | 'reschedule' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  
  // Local status changes only after the authoritative workflow RPC succeeds.
  const [invitationStatus, setInvitationStatus] = useState<'pending' | 'accepted' | 'declined' | 'rescheduled'>('pending');

  if (!activeApp) {
    return (
      <div className="min-h-screen bg-[#fdf8f8] text-[#1c1b1b]">
        <header className="sticky top-0 z-40 flex h-16 items-center border-b border-[#e0bec6]/30 bg-white px-5 shadow-xs">
          <button type="button" onClick={onBack} aria-label="Go back" className="flex h-10 w-10 items-center justify-center rounded-full text-[#8e004b] hover:bg-[#ffd9e2]/50">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="mx-auto pr-10 text-lg font-bold text-[#8e004b]">Interview Invitation</h1>
        </header>
        <main className="mx-auto max-w-xl px-5 py-16 text-center">
          <Calendar className="mx-auto mb-4 h-10 w-10 text-[#8c7077]" />
          <h2 className="text-lg font-bold">No interview invitation</h2>
          <p className="mt-2 text-sm text-[#594047]">When an employer schedules an interview, its confirmed details will appear here.</p>
          <button type="button" onClick={onBack} className="mt-6 rounded-full bg-[#8e004b] px-5 py-2.5 text-sm font-bold text-white">Back to applications</button>
        </main>
      </div>
    );
  }

  const showToast = (msg: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleCopyLink = async () => {
    if (!activeApp.interviewMeetingUrl) return;
    try {
      await navigator.clipboard.writeText(activeApp.interviewMeetingUrl);
      setCopied(true);
      showToast('Meeting link copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Unable to copy the link. Select it and copy it manually.', 'error');
    }
  };

  const persistInterviewResponse = async (
    action: 'accept' | 'decline' | 'reschedule',
    reason?: string,
  ) => {
    if (!onInterviewResponse) throw new Error('Interview updates are unavailable. Reload the page and try again.');
    setPendingAction(action);
    setActionError(null);
    try {
      await onInterviewResponse(activeApp.id, action, reason);
      setInvitationStatus(action === 'accept' ? 'accepted' : action === 'decline' ? 'declined' : 'rescheduled');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update the interview. Please retry.';
      setActionError(message);
      throw error;
    } finally {
      setPendingAction(null);
    }
  };

  const handleAccept = async () => {
    if (pendingAction) return;
    try {
      await persistInterviewResponse('accept');
      showToast('Interview invitation accepted successfully!', 'success');
    } catch {
      // The inline error retains the authoritative state and gives a retry path.
    }
  };

  const handleDecline = async () => {
    if (pendingAction) return;
    try {
      await persistInterviewResponse('decline', 'Declined by candidate');
      showToast('You have declined the interview invitation.', 'info');
    } catch {
      // Error is rendered above the action controls.
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingAction) return;
    if (!rescheduleDate || !rescheduleTime) {
      showToast('Please specify a date and time.', 'error');
      return;
    }
    const formattedProposedTime = `${rescheduleDate} at ${rescheduleTime}`;
    try {
      await persistInterviewResponse(
        'reschedule',
        `Proposed time: ${formattedProposedTime}. Reason: ${rescheduleReason || 'None'}`,
      );
      setShowRescheduleModal(false);
      showToast(`Reschedule request sent for ${formattedProposedTime}!`, 'success');
    } catch {
      // Keep the modal values intact for retry.
    }
  };

  const handleBottomNavClick = (tab: 'explore' | 'applications' | 'saved' | 'messages' | 'profile') => {
    if (onNavigateTab) {
      onNavigateTab(tab);
    } else {
      onBack();
    }
  };

  const interviewTimeText = activeApp.interviewDate || 'Date and time to be confirmed';
  const interviewTypeLabel = activeApp.interviewType === 'video'
    ? 'Video interview'
    : activeApp.interviewType === 'phone'
      ? 'Phone interview'
      : 'In-person interview';

  return (
    <div id="interview_invitation_screen" className="relative min-h-screen bg-[#fdf8f8] text-[#1c1b1b] pb-40">
      {/* Toast Alert */}
      {toastMessage && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-100 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl border text-xs font-bold animate-in fade-in slide-in-from-top-4 duration-300 ${
          toastType === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : toastType === 'error' 
            ? 'bg-rose-50 text-rose-800 border-rose-200' 
            : 'bg-amber-50 text-amber-800 border-amber-200'
        }`}>
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="p-0.5 hover:bg-black/5 rounded-full">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header App Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#e0bec6]/30 shadow-xs">
        <div className="max-w-3xl mx-auto flex justify-between items-center px-margin-side h-16 w-full">
          <button 
            id="back_to_workspace"
            onClick={onBack} 
            className="w-10 h-10 flex items-center justify-center rounded-full text-[#594047] hover:bg-[#f1edec] transition-all active:scale-95 duration-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <h1 className="text-lg font-bold text-[#8e004b] tracking-tight">Nexora Jobs</h1>
          
          <button 
            id="notifications_bell"
            onClick={() => showToast('No new notifications', 'info')}
            className="w-10 h-10 flex items-center justify-center rounded-full text-[#594047] hover:bg-[#f1edec] transition-all active:scale-95 duration-200"
          >
            <Bell className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-3xl mx-auto pt-6 px-margin-side animate-in fade-in duration-500">
        
        {/* Screen Header */}
        <div className="mb-section-gap">
          <h2 className="text-2xl font-extrabold text-[#8e004b] tracking-tight leading-tight">Interview Invitation</h2>
          <p className="text-[#594047] text-xs font-semibold mt-1">
            You have been invited to an interview for the following position.
          </p>
        </div>

        {/* Invitation Status Alert (If already interacted with) */}
        {invitationStatus !== 'pending' && (
          <div className={`mb-6 p-4 rounded-2xl border text-xs font-bold flex items-center gap-3 ${
            invitationStatus === 'accepted' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : invitationStatus === 'declined' 
              ? 'bg-rose-50 text-rose-800 border-rose-200' 
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              invitationStatus === 'accepted' ? 'bg-emerald-100' : invitationStatus === 'declined' ? 'bg-rose-100' : 'bg-amber-100'
            }`}>
              {invitationStatus === 'accepted' ? <Check className="w-4 h-4" /> : invitationStatus === 'declined' ? <X className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            </div>
            <div>
              <p className="text-sm font-extrabold">
                {invitationStatus === 'accepted' 
                  ? 'Accepted' 
                  : invitationStatus === 'declined' 
                  ? 'Declined' 
                  : 'Reschedule Requested'}
              </p>
              <p className="text-xs font-medium opacity-90 mt-0.5">
                {invitationStatus === 'accepted' 
                  ? 'Your interview is confirmed! You can join the meeting at the scheduled time.' 
                  : invitationStatus === 'declined' 
                  ? 'You declined this interview. The employer will be notified.' 
                  : `You requested a reschedule. Proposed: ${rescheduleDate} at ${rescheduleTime}`}
              </p>
            </div>
          </div>
        )}

        {/* Job Context Card */}
        <div className="bg-white border border-[#e0bec6]/50 rounded-2xl p-stack-default mb-section-gap shadow-sm">
          <div className="flex items-center gap-stack-default">
            <div className="w-16 h-16 rounded-xl overflow-hidden border border-[#e0bec6]/30 bg-[#fdf8f8] shrink-0 flex items-center justify-center">
              {activeApp.salonLogo ? (
                <img 
                  src={activeApp.salonLogo} 
                  alt={activeApp.salonName} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Briefcase className="w-8 h-8 text-[#8e004b]" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#1c1b1b] leading-snug">{activeApp.jobTitle}</h3>
              <p className="text-xs font-bold text-[#e2007c]">{activeApp.salonName}</p>
              <p className="text-[11px] text-[#594047] mt-0.5">{activeApp.location}</p>
            </div>
          </div>
        </div>

        {/* Interview Details Bento */}
        <div className="mb-section-gap">
          <h3 className="mb-stack-default text-base font-bold text-[#1c1b1b]">Interview Details</h3>
          <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2">
            <div className="flex items-start gap-stack-default rounded-2xl border border-[#e0bec6]/40 bg-white p-stack-default shadow-xs">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ffd9e2] text-[#8e004b]">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-[#594047]">Date & Time</p>
                <p className="text-sm font-bold text-[#1c1b1b]">{interviewTimeText}</p>
              </div>
            </div>

            <div className="flex items-start gap-stack-default rounded-2xl border border-[#e0bec6]/40 bg-white p-stack-default shadow-xs">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ffd9e2] text-[#8e004b]">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-[#594047]">Duration</p>
                <p className="text-sm font-bold text-[#1c1b1b]">{activeApp.interviewDurationMinutes ? `${activeApp.interviewDurationMinutes} minutes` : 'To be confirmed'}</p>
              </div>
            </div>

            <div className="flex items-start gap-stack-default rounded-2xl border border-[#e0bec6]/40 bg-white p-stack-default shadow-xs sm:col-span-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ffd9e2] text-[#8e004b]">
                {activeApp.interviewType === 'video' ? <Video className="h-5 w-5" /> : activeApp.interviewType === 'phone' ? <Phone className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-grow">
                <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-[#594047]">Interview Type</p>
                <p className="text-sm font-bold text-[#1c1b1b]">{interviewTypeLabel}</p>
                {activeApp.interviewLocation && (
                  <p className="mt-1 text-xs font-semibold text-[#594047]">{activeApp.interviewLocation}</p>
                )}
                {activeApp.interviewMeetingUrl && (
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-[#e0bec6]/40 bg-[#fdf8f8] px-3 py-2">
                    <a href={activeApp.interviewMeetingUrl} target="_blank" rel="noreferrer" className="truncate text-xs font-medium text-[#8e004b] hover:underline">
                      {activeApp.interviewMeetingUrl}
                    </a>
                    <button type="button" onClick={() => void handleCopyLink()} className="flex shrink-0 items-center gap-1 text-xs font-bold text-[#8e004b] hover:underline">
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Message from Employer */}
        <div className="mb-section-gap">
          <h3 className="text-base font-bold text-[#1c1b1b] mb-stack-default">Message from Employer</h3>
          <div className="bg-[#f2dde9] rounded-2xl p-stack-default border border-[#e0bec6]/50 relative overflow-hidden shadow-xs">
            {/* Elegant decorative background accent */}
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-[#8e004b]/5 to-transparent rounded-bl-full pointer-events-none" />
            
            <p className="text-sm text-[#1c1b1b] italic font-medium leading-relaxed pl-2 border-l-2 border-[#8e004b]">
              "{activeApp.interviewEmployerMessage || activeApp.notes || 'No additional message was provided.'}"
            </p>
          </div>
        </div>

      </main>

      {/* Sticky Bottom Action Tray */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e0bec6]/40 py-4 px-margin-side shadow-lg z-30 pb-20 md:pb-4">
        <div className="mx-auto max-w-3xl">
          {actionError && <p role="alert" className="mb-2 text-center text-xs font-semibold text-rose-700">{actionError}</p>}
          <div className="flex flex-col items-center justify-end gap-stack-sm sm:flex-row">
          <button 
            id="decline_button"
            onClick={() => void handleDecline()}
            disabled={Boolean(pendingAction) || invitationStatus === 'declined'}
            className="w-full sm:w-auto font-bold text-xs text-rose-600 hover:text-rose-700 px-6 py-3 rounded-full hover:bg-rose-50 transition-colors order-3 sm:order-1 sm:mr-auto cursor-pointer text-center disabled:opacity-50"
          >
            {pendingAction === 'decline' ? 'Declining…' : 'Decline Invitation'}
          </button>
          
          <button 
            id="reschedule_button"
            onClick={() => setShowRescheduleModal(true)}
            disabled={Boolean(pendingAction)}
            className="w-full sm:w-auto font-bold text-xs text-[#8e004b] border border-[#8e004b] px-6 py-3 rounded-full hover:bg-[#ffd9e2] transition-colors order-2 cursor-pointer text-center disabled:cursor-not-allowed disabled:opacity-50"
          >
            Request Another Time
          </button>
          
          <button 
            id="accept_button"
            onClick={() => void handleAccept()}
            disabled={Boolean(pendingAction) || invitationStatus === 'accepted'}
            className="w-full sm:w-auto font-bold text-xs bg-[#8e004b] text-white px-8 py-3 rounded-full hover:bg-[#b90064] transition-all duration-200 shadow-sm hover:shadow-md order-1 sm:order-3 cursor-pointer text-center disabled:bg-emerald-600 disabled:hover:bg-emerald-600"
          >
            {pendingAction === 'accept' ? 'Accepting…' : invitationStatus === 'accepted' ? 'Confirmed & Accepted' : 'Accept Interview'}
          </button>
          </div>
        </div>
      </div>

      {/* RESCHEDULE PROPOSAL MODAL */}
      {showRescheduleModal && (
        <div className="fixed inset-0 z-100 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-[#e0bec6] shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center pb-3 border-b border-[#e0bec6]/30 mb-4">
              <div>
                <h3 className="text-base font-extrabold text-[#1c1b1b]">Propose New Time</h3>
                <p className="text-[10px] text-[#594047]">Request a schedule change from the salon coordinator</p>
              </div>
              <button 
                onClick={() => setShowRescheduleModal(false)}
                className="w-8 h-8 rounded-full hover:bg-[#f1edec] flex items-center justify-center text-[#594047] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-[#1c1b1b] block mb-1">Preferred Date</label>
                <input 
                  type="date"
                  required
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full bg-[#fdf8f8] border border-[#e0bec6] rounded-xl p-3 text-xs text-[#1c1b1b] outline-none focus:ring-2 focus:ring-[#8e004b]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#1c1b1b] block mb-1">Preferred Time</label>
                <input 
                  type="time"
                  required
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full bg-[#fdf8f8] border border-[#e0bec6] rounded-xl p-3 text-xs text-[#1c1b1b] outline-none focus:ring-2 focus:ring-[#8e004b]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#1c1b1b] block mb-1">Reason for Rescheduling (Optional)</label>
                <textarea 
                  rows={2}
                  placeholder="e.g. Schedule conflict with model test, prior client booking, etc."
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  className="w-full bg-[#fdf8f8] border border-[#e0bec6] rounded-xl p-3 text-xs text-[#1c1b1b] outline-none focus:ring-2 focus:ring-[#8e004b] placeholder-[#594047]/60"
                />
              </div>

              {actionError && <p role="alert" className="text-xs font-semibold text-rose-700">{actionError}</p>}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRescheduleModal(false)}
                  className="flex-1 py-2.5 rounded-full text-xs font-bold text-[#594047] bg-[#f1edec]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={Boolean(pendingAction)}
                  className="flex-1 py-2.5 rounded-full text-xs font-bold bg-[#8e004b] text-white hover:bg-[#b90064] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pendingAction === 'reschedule' ? 'Sending…' : 'Send Proposal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bottom NavBar (Mobile Only) to allow seamless navigation */}
      <nav className="fixed bottom-0 left-0 right-0 w-full flex justify-around items-center px-2 py-3 bg-white border-t border-[#e0bec6]/40 rounded-t-2xl z-40 shadow-lg md:hidden">
        <button 
          onClick={() => handleBottomNavClick('explore')}
          className="flex flex-col items-center justify-center text-[#594047] hover:text-[#8e004b] active:scale-90 transition-transform w-14 cursor-pointer"
        >
          <Briefcase className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-semibold">Jobs</span>
        </button>
        
        {/* Active Apps tab */}
        <button 
          onClick={() => handleBottomNavClick('applications')}
          className="flex flex-col items-center justify-center bg-[#ffd9e2] text-[#8e004b] rounded-2xl px-4 py-1.5 active:scale-90 transition-transform cursor-pointer"
        >
          <Check className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] font-extrabold">Apps</span>
        </button>

        <button 
          onClick={() => handleBottomNavClick('saved')}
          className="flex flex-col items-center justify-center text-[#594047] hover:text-[#8e004b] active:scale-90 transition-transform w-14 cursor-pointer"
        >
          <Bookmark className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-semibold">Saved</span>
        </button>

        <button 
          onClick={() => handleBottomNavClick('messages')}
          className="flex flex-col items-center justify-center text-[#594047] hover:text-[#8e004b] active:scale-90 transition-transform w-14 cursor-pointer"
        >
          <MessageSquare className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-semibold">Messages</span>
        </button>

        <button 
          onClick={() => handleBottomNavClick('profile')}
          className="flex flex-col items-center justify-center text-[#594047] hover:text-[#8e004b] active:scale-90 transition-transform w-14 cursor-pointer"
        >
          <User className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-semibold">Profile</span>
        </button>
      </nav>
    </div>
  );
};

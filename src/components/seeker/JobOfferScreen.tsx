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
import { getOfferDocumentUrl, mapBackendError } from '../../services/backend';

interface JobOfferScreenProps {
  jobs: JobPosting[];
  applications: Application[];
  selectedApplication: Application | null;
  /** Persists the answer through `accept_job_offer` / `decline_job_offer`. */
  onOfferResponse?: (appId: string, action: 'accept' | 'decline', reason?: string) => Promise<void>;
  onBack: () => void;
  onNavigateTab?: (tab: 'feed' | 'applications' | 'saved' | 'messages' | 'portfolio' | 'profile') => void;
}

export const JobOfferScreen: React.FC<JobOfferScreenProps> = ({
  jobs,
  applications,
  selectedApplication,
  onOfferResponse,
  onBack,
  onNavigateTab,
}) => {
  const activeApp = selectedApplication
    || applications.find((application) => application.status === 'Offer Extended')
    || null;

  // Find matching job details
  const matchingJob = jobs.find((job) => job.id === activeApp?.jobId);

  // Offer dynamic state
  const [offerState, setOfferState] = useState<'pending' | 'accepted' | 'declined'>(
    activeApp?.status === 'Accepted' ? 'accepted' : activeApp?.status === 'Declined' ? 'declined' : 'pending',
  );
  const [showToast, setShowToast] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [pendingAction, setPendingAction] = useState<'accept' | 'decline' | 'download' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!activeApp) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
        <header className="sticky top-0 z-40 flex h-16 items-center border-b border-[#cbd5e1]/30 bg-white px-5 shadow-xs">
          <button type="button" onClick={onBack} aria-label="Go back" className="flex h-10 w-10 items-center justify-center rounded-full text-[#4f46e5] hover:bg-[#ede9fe]/50">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="mx-auto pr-10 text-lg font-bold text-[#4f46e5]">Job Offer</h1>
        </header>
        <main className="mx-auto max-w-xl px-5 py-16 text-center">
          <FileText className="mx-auto mb-4 h-10 w-10 text-[#64748b]" />
          <h2 className="text-lg font-bold">No active job offer</h2>
          <p className="mt-2 text-sm text-[#475569]">Offers from employers will appear here with their confirmed terms.</p>
          <button type="button" onClick={onBack} className="mt-6 rounded-full bg-[#4f46e5] px-5 py-2.5 text-sm font-bold text-white">Back to applications</button>
        </main>
      </div>
    );
  }

  const jobTitle = activeApp.offerJobRole || matchingJob?.title || activeApp.jobTitle || 'Job offer';
  const salonName = matchingJob?.salonName || activeApp.salonName || 'Employer';
  const salonLogo = activeApp.salonLogo || matchingJob?.salonLogo;
  const salary = activeApp.offerSalary == null
    ? 'Not specified'
    : `₹${activeApp.offerSalary.toLocaleString('en-IN')} / month`;
  const jobType = activeApp.offerEmploymentType
    ? activeApp.offerEmploymentType.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
    : 'Not specified';
  const location = matchingJob?.location || activeApp.location || 'Location not specified';
  const joiningDate = activeApp.offerJoiningDate
    ? new Date(`${activeApp.offerJoiningDate}T00:00:00`).toLocaleDateString()
    : 'To be confirmed';
  const employerMessage = activeApp.offerNotes || 'No additional message was provided.';

  const persistOfferResponse = async (action: 'accept' | 'decline', reason?: string) => {
    if (!onOfferResponse) throw new Error('Offer updates are unavailable. Reload the page and try again.');
    setPendingAction(action);
    setActionError(null);
    try {
      await onOfferResponse(activeApp.id, action, reason);
      setOfferState(action === 'accept' ? 'accepted' : 'declined');
    } catch (error) {
      setActionError(mapBackendError(error, 'Unable to update the offer. Please retry.'));
      throw error;
    } finally {
      setPendingAction(null);
    }
  };

  const handleAccept = async () => {
    if (pendingAction) return;
    try {
      await persistOfferResponse('accept');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    } catch {
      // The offer remains pending and the inline error provides a retry path.
    }
  };

  const handleDeclineConfirm = async () => {
    if (pendingAction) return;
    try {
      await persistOfferResponse('decline', declineReason);
      setShowDeclineModal(false);
    } catch {
      // Keep the reason intact for retry.
    }
  };

  const handleDownloadOffer = async () => {
    if (!activeApp.offerDocumentPath || pendingAction) return;
    setPendingAction('download');
    setActionError(null);
    try {
      const signedUrl = await getOfferDocumentUrl(activeApp.offerDocumentPath);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setActionError(mapBackendError(error, 'Unable to open the offer document. Please retry.'));
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] pb-24 relative select-none">
      {/* Top App Bar */}
      <header className="sticky top-0 bg-white border-b border-[#cbd5e1]/30 px-margin-side h-16 w-full flex justify-between items-center z-40 shadow-xs">
        <button
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#ede9fe]/50 text-[#4f46e5] transition-colors active:scale-95 duration-200 cursor-pointer"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-screen-title text-lg font-bold text-[#4f46e5]">Job Offer</h1>
        <button
          onClick={() => {
            if (onNavigateTab) onNavigateTab('profile');
          }}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#ede9fe]/50 text-[#475569] transition-colors active:scale-95 duration-200 cursor-pointer"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content Body */}
      <main className="px-margin-side py-stack-default max-w-3xl mx-auto flex flex-col gap-6">

        {/* Header Card: Identity */}
        <section className="bg-white rounded-2xl border border-[#cbd5e1]/40 shadow-sm p-6 flex flex-col sm:flex-row gap-5 items-center sm:items-start text-center sm:text-left hover:shadow-md transition-shadow">
          <div className="w-20 h-20 rounded-2xl overflow-hidden border border-[#cbd5e1]/30 shrink-0 relative shadow-inner bg-[#ede9fe]/10 flex items-center justify-center">
            {salonLogo ? (
              <img alt={`${salonName} logo`} className="h-full w-full object-cover" src={salonLogo} referrerPolicy="no-referrer" />
            ) : (
              <Store className="h-8 w-8 text-[#4f46e5]" />
            )}
          </div>
          <div className="flex-grow flex flex-col gap-1 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] leading-tight">{jobTitle}</h2>
              <span className={`px-3.5 py-1 rounded-full text-xs font-bold self-center sm:self-auto ${
                offerState === 'accepted'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : offerState === 'declined'
                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                  : 'bg-[#ede9fe] text-[#4f46e5] border border-[#cbd5e1]/40'
              }`}>
                {offerState === 'accepted' ? 'Offer Accepted' : offerState === 'declined' ? 'Offer Declined' : 'Offer Pending'}
              </span>
            </div>

            <p className="text-[#475569] text-sm font-semibold flex items-center justify-center sm:justify-start gap-1.5 mt-1">
              <Store className="w-4 h-4 text-[#4f46e5]" />
              <span>{salonName}</span>
              <span className="text-[#cbd5e1]">•</span>
              <span>{location}</span>
            </p>
          </div>
        </section>

        {/* Bento Grid: Offer Details */}
        <section>
          <h3 className="text-base font-bold text-[#0f172a] mb-3">Offer Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* Salary Card */}
            <div className="bg-white rounded-2xl border border-[#cbd5e1]/40 p-5 flex flex-col items-center justify-center text-center shadow-xs hover:bg-[#ede9fe]/10 transition-colors">
              <div className="w-12 h-12 rounded-full bg-[#ede9fe] text-[#4f46e5] flex items-center justify-center mb-3">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <span className="text-[#475569] text-xs font-medium mb-1 uppercase tracking-wider">Salary Structure</span>
              <span className="text-base font-bold text-[#0f172a] leading-none">{salary}</span>
              <span className="text-[10px] text-[#475569] font-semibold mt-1">Confirmed offer amount</span>
            </div>

            {/* Employment Type Card */}
            <div className="bg-white rounded-2xl border border-[#cbd5e1]/40 p-5 flex flex-col items-center justify-center text-center shadow-xs hover:bg-[#ede9fe]/10 transition-colors">
              <div className="w-12 h-12 rounded-full bg-[#ede9fe] text-[#4f46e5] flex items-center justify-center mb-3">
                <Briefcase className="w-5 h-5" />
              </div>
              <span className="text-[#475569] text-xs font-medium mb-1 uppercase tracking-wider">Employment Type</span>
              <span className="text-base font-bold text-[#0f172a] leading-none">{jobType}</span>
              <span className="text-[10px] text-[#475569] font-semibold mt-1">Offer employment terms</span>
            </div>

            {/* Joining Date Card */}
            <div className="bg-white rounded-2xl border border-[#cbd5e1]/40 p-5 flex flex-col items-center justify-center text-center shadow-xs hover:bg-[#ede9fe]/10 transition-colors">
              <div className="w-12 h-12 rounded-full bg-[#ede9fe] text-[#4f46e5] flex items-center justify-center mb-3">
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-[#475569] text-xs font-medium mb-1 uppercase tracking-wider">Target Joining Date</span>
              <span className="text-base font-bold text-[#0f172a] leading-none">{joiningDate}</span>
              <span className="text-[10px] text-[#475569] font-semibold mt-1">Confirmed by the employer</span>
            </div>

          </div>
        </section>

        {/* Offer Notes / Cover Message */}
        <section className="bg-white rounded-2xl border border-[#cbd5e1]/40 shadow-xs p-6 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#7c3aed]"></div>
          <h3 className="text-base font-bold text-[#0f172a] mb-3 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#4f46e5]" />
            <span>Message from Employer</span>
          </h3>
          <p className="text-[#475569] italic text-sm leading-relaxed pl-4 border-l-2 border-[#cbd5e1]/40 ml-1">
            "{employerMessage}"
          </p>
        </section>

        {/* Document Section */}
        <section>
          <h3 className="mb-3 text-base font-bold text-[#0f172a]">Documents</h3>
          {activeApp.offerDocumentPath ? (
            <div className="flex items-center gap-4 rounded-2xl border border-[#cbd5e1]/40 bg-white p-4 shadow-xs transition-all hover:border-[#4f46e5]">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600">
                <FileText className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-grow">
                <p className="truncate text-sm font-bold text-[#0f172a]">Offer letter</p>
                <p className="text-xs font-medium text-[#475569]">Private document • short-lived secure link</p>
              </div>
              <button
                type="button"
                onClick={() => void handleDownloadOffer()}
                disabled={Boolean(pendingAction)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#cbd5e1]/30 bg-[#f8fafc] text-[#4f46e5] transition-colors hover:border-[#4f46e5] hover:bg-[#4f46e5] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                title="Open offer document"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#cbd5e1] bg-white p-5 text-sm text-[#475569]">
              The employer did not attach an offer document. Review the confirmed terms above.
            </div>
          )}
          {actionError && <p role="alert" className="mt-2 text-sm font-semibold text-rose-700">{actionError}</p>}
        </section>

      </main>

      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-md border-t border-[#cbd5e1]/40 p-4 z-40 shadow-lg">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3">
          {offerState === 'pending' ? (
            <>
              <button
                onClick={() => void handleAccept()}
                disabled={Boolean(pendingAction)}
                className="flex-1 h-12 bg-[#4f46e5] text-white rounded-full font-bold flex items-center justify-center gap-2 hover:bg-[#6d28d9] active:scale-98 transition-all shadow-md cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle className="w-5 h-5" />
                <span>{pendingAction === 'accept' ? 'Accepting…' : 'Accept Offer'}</span>
              </button>
              <button
                onClick={() => setShowDeclineModal(true)}
                disabled={Boolean(pendingAction)}
                className="flex-1 h-12 bg-white text-[#475569] border border-[#64748b] rounded-full font-bold flex items-center justify-center gap-2 hover:bg-[#f1f5f9] active:scale-98 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
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
          <div className="bg-white border border-[#cbd5e1]/40 rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-[#ede9fe] text-[#4f46e5] rounded-full flex items-center justify-center mb-5 shadow-inner">
              <Award className="w-10 h-10 animate-bounce" />
            </div>
            <h4 className="text-xl font-bold text-[#4f46e5] mb-2">Offer Accepted!</h4>
            <p className="text-sm text-[#475569] mb-6">Congratulations on your new role at {salonName}! The salon manager has been notified and will reach out with your onboarding steps.</p>
            <button
              onClick={() => {
                setShowToast(false);
                onBack();
              }}
              className="w-full h-11 bg-[#4f46e5] text-white rounded-full font-bold hover:bg-[#6d28d9] transition-colors cursor-pointer"
            >
              Back to Workspace
            </button>
          </div>
        </div>
      )}

      {/* Decline Dialog Modal */}
      {showDeclineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-[#cbd5e1]/40 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-bold text-[#0f172a]">Decline Offer</h4>
              <button
                onClick={() => setShowDeclineModal(false)}
                className="w-8 h-8 rounded-full hover:bg-[#ede9fe]/30 flex items-center justify-center text-[#475569] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#475569] mb-4 font-semibold">
              Please share your reason for declining this offer. This feedback will be shared with {salonName} constructively.
            </p>

            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="e.g., I have accepted another offer / The salary is below my expectations / Commute is too long..."
              className="w-full h-28 p-3 rounded-xl border border-[#cbd5e1]/50 focus:border-[#4f46e5] focus:ring-1 focus:ring-[#4f46e5] outline-none text-xs text-[#0f172a] resize-none mb-6"
            />

            {actionError && <p role="alert" className="mb-3 text-xs font-semibold text-rose-700">{actionError}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeclineModal(false)}
                className="flex-1 h-10 rounded-full border border-[#64748b] text-[#475569] font-bold text-xs hover:bg-[#f1f5f9] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDeclineConfirm()}
                disabled={Boolean(pendingAction)}
                className="flex-1 h-10 rounded-full bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pendingAction === 'decline' ? 'Declining…' : 'Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile BottomNavBar */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center py-3 bg-white border-t border-[#cbd5e1]/40 z-30 sm:hidden">
        <button
          onClick={() => {
            onBack();
            if (onNavigateTab) onNavigateTab('feed');
          }}
          className="flex flex-col items-center justify-center text-[#475569] hover:text-[#4f46e5] active:scale-90 transition-transform w-16 cursor-pointer"
        >
          <Briefcase className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-1">Jobs</span>
        </button>
        <button
          onClick={onBack}
          className="flex flex-col items-center justify-center bg-[#ede9fe] text-[#4f46e5] rounded-full px-5 py-1.5 active:scale-90 transition-transform cursor-pointer"
        >
          <FileText className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-0.5">Apps</span>
        </button>
        <button
          onClick={() => {
            onBack();
            if (onNavigateTab) onNavigateTab('saved');
          }}
          className="flex flex-col items-center justify-center text-[#475569] hover:text-[#4f46e5] active:scale-90 transition-transform w-16 cursor-pointer"
        >
          <Bookmark className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-1">Saved</span>
        </button>
        <button
          onClick={() => {
            onBack();
            if (onNavigateTab) onNavigateTab('profile');
          }}
          className="flex flex-col items-center justify-center text-[#475569] hover:text-[#4f46e5] active:scale-90 transition-transform w-16 cursor-pointer"
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-1">Profile</span>
        </button>
      </nav>
    </div>
  );
};

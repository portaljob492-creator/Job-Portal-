import React, { useState } from 'react';
import { JobPosting, Application, UserProfile } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Send, ArrowLeft, Info, FileText, Briefcase, Sparkles, User, AlertTriangle } from 'lucide-react';

interface ApplyJobScreenProps {
  jobs: JobPosting[];
  selectedJob: JobPosting | null;
  applications: Application[];
  userProfile: UserProfile;
  onApplyJob: (job: JobPosting, coverNote: string, expectedSalary: string, availability: string) => void;
  onBack: () => void;
  onNavigateToApplications?: () => void;
}

export const ApplyJobScreen: React.FC<ApplyJobScreenProps> = ({
  jobs,
  selectedJob: initialSelectedJob,
  applications,
  userProfile,
  onApplyJob,
  onBack,
  onNavigateToApplications,
}) => {
  // If no job is pre-selected, fallback to the first active job
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(
    initialSelectedJob || (jobs.length > 0 ? jobs[0] : null)
  );

  // Form Fields
  const [expectedSalary, setExpectedSalary] = useState<string>('65000');
  const [availability, setAvailability] = useState<string>('immediate');
  const [coverNote, setCoverNote] = useState<string>('');
  
  // Submission Flow
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  if (!selectedJob) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center bg-background">
        <p className="text-on-surface-variant font-medium">No active job selected to apply.</p>
        <button
          onClick={onBack}
          className="mt-4 px-6 py-2.5 bg-primary text-white rounded-full font-semibold hover:bg-secondary transition-colors"
        >
          Back to Browse
        </button>
      </div>
    );
  }

  // Duplicate Check
  const hasAlreadyApplied = applications.some((app) => app.jobId === selectedJob.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasAlreadyApplied) {
      showTemporaryError('You have already submitted an application for this position.');
      return;
    }
    
    // Call the parent state handler to persist the application
    onApplyJob(selectedJob, coverNote, expectedSalary, availability);
    
    // Trigger successful animation transition state
    setIsSubmitted(true);
  };

  const showTemporaryError = (msg: string) => {
    setErrorToast(msg);
    setTimeout(() => {
      setErrorToast(null);
    }, 4000);
  };

  const formattedJobType = selectedJob.jobType || 'Full-time';

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md relative overflow-x-hidden w-full pb-28">
      {/* Toast Alert */}
      <AnimatePresence>
        {errorToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-error-container text-on-error-container border border-error/20 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 max-w-sm w-[90%]"
          >
            <AlertTriangle className="w-5 h-5 text-error flex-shrink-0" />
            <p className="text-xs font-semibold">{errorToast}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {!isSubmitted ? (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          {/* Top App Bar */}
          <header className="flex justify-between items-center px-margin-side h-16 w-full z-50 bg-surface dark:bg-surface-dim shadow-[0_4px_12px_rgba(90,63,71,0.05)] sticky top-0">
            <button
              onClick={onBack}
              className="text-primary dark:text-primary-fixed hover:bg-surface-variant transition-colors active:scale-95 duration-200 p-2 rounded-full -ml-2 flex items-center justify-center cursor-pointer"
              type="button"
              aria-label="Back"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-mono tracking-wider text-[#8c7077] uppercase bg-[#f1edec] px-2 py-0.5 rounded-md">
                /app/jobs/job/{selectedJob.id}/apply
              </span>
              <h1 className="font-screen-title text-screen-title text-primary font-bold">Review your application</h1>
            </div>
            <div className="w-10"></div> {/* Spacer for center alignment */}
          </header>

          {/* Main Content Canvas */}
          <main className="max-w-2xl mx-auto px-margin-side py-stack-default">
            {/* Application Context Note */}
            <div className="bg-primary-fixed text-[#3e001e] px-4 py-3 rounded-lg mb-6 flex items-start gap-3 shadow-sm border border-outline-variant">
              <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-body-md text-sm text-on-primary-fixed">
                  You are applying for <strong>{selectedJob.title}</strong> at <strong>{selectedJob.salonName}</strong>.
                </p>
                <p className="font-label-sm text-xs opacity-80 mt-1">Please review your details carefully before submitting.</p>
              </div>
            </div>

            {/* Candidate Preview Section */}
            <section className="mb-6">
              <h2 className="font-section-title text-section-title text-on-surface mb-3">Candidate Profile</h2>
              <div className="bg-surface-container-lowest border border-surface-variant rounded-lg p-4 shadow-[0_4px_12px_rgba(90,63,71,0.05)]">
                <div className="flex items-center gap-4 mb-4">
                  {userProfile.avatarUrl ? (
                    <img
                      src={userProfile.avatarUrl}
                      alt={userProfile.name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-primary"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-primary-fixed text-[#3e001e] font-bold flex items-center justify-center text-xl">
                      {userProfile.name ? userProfile.name.charAt(0) : 'A'}
                    </div>
                  )}
                  <div>
                    <h3 className="font-card-title text-card-title text-on-surface">{userProfile.name || 'Anjali Sharma'}</h3>
                    <p className="font-body-md text-sm text-on-surface-variant flex items-center gap-1 mt-0.5">
                      <Briefcase className="w-4 h-4 text-outline" />
                      {userProfile.primaryRole || 'Senior Hair Stylist'}
                    </p>
                    <p className="font-label-sm text-xs text-outline mt-0.5">5+ Years Experience • License: {userProfile.licenseNumber || 'CA-COS-889124'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-outline-variant/30">
                  {(userProfile.specialties && userProfile.specialties.length > 0) ? (
                    userProfile.specialties.map((spec, i) => (
                      <span
                        key={i}
                        className="bg-secondary-fixed text-primary px-3 py-1 rounded-full font-label-sm text-xs border border-outline-variant/30"
                      >
                        {spec}
                      </span>
                    ))
                  ) : (
                    <>
                      <span className="bg-secondary-fixed text-primary px-3 py-1 rounded-full font-label-sm text-xs border border-outline-variant/30">Color Correction</span>
                      <span className="bg-secondary-fixed text-primary px-3 py-1 rounded-full font-label-sm text-xs border border-outline-variant/30">Balayage</span>
                      <span className="bg-secondary-fixed text-primary px-3 py-1 rounded-full font-label-sm text-xs border border-outline-variant/30">Bridal Styling</span>
                      <span className="bg-secondary-fixed text-primary px-3 py-1 rounded-full font-label-sm text-xs border border-outline-variant/30">Extensions</span>
                    </>
                  )}
                </div>
              </div>
            </section>

            {/* Resume Section */}
            <section className="mb-6">
              <h2 className="font-section-title text-section-title text-on-surface mb-3">Resume Attachment</h2>
              <div className="bg-surface-container-lowest border border-surface-variant rounded-lg p-4 shadow-[0_4px_12px_rgba(90,63,71,0.05)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-error-container/20 text-error p-2 rounded-lg">
                    <FileText className="w-6 h-6 text-error" />
                  </div>
                  <div>
                    <p className="font-body-md text-sm font-medium text-on-surface">Anjali_Resume_2024.pdf</p>
                    <p className="font-label-sm text-xs text-on-surface-variant">2.4 MB • Uploaded Today</p>
                  </div>
                </div>
                <span className="text-primary font-label-sm text-xs font-semibold cursor-pointer hover:underline">View</span>
              </div>
            </section>

            {/* Duplicate Application Warning banner */}
            {hasAlreadyApplied && (
              <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3 text-amber-800 text-xs">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Duplicate Application Prevented</p>
                  <p className="mt-0.5">
                    You have already submitted an active application for this role. To maintain platform integrity and fairness, you cannot apply multiple times.
                  </p>
                </div>
              </div>
            )}

            {/* Application Details Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <section className="bg-surface-container-lowest border border-surface-variant rounded-lg p-5 shadow-[0_4px_12px_rgba(90,63,71,0.05)] space-y-4">
                <h2 className="font-section-title text-base text-on-surface font-semibold border-b border-outline-variant/20 pb-2">Application Details</h2>
                
                {/* Expected Salary */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-xs text-on-surface font-semibold" htmlFor="salary">Expected Salary (Annual)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-on-surface-variant font-body-md">₹</span>
                    <input
                      className="w-full bg-surface-container border border-surface-variant rounded-lg pl-8 pr-4 py-3 font-body-md text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-colors placeholder:text-outline"
                      id="salary"
                      placeholder="e.g. 6,50,000"
                      type="number"
                      required
                      disabled={hasAlreadyApplied}
                      value={expectedSalary}
                      onChange={(e) => setExpectedSalary(e.target.value)}
                    />
                  </div>
                </div>

                {/* Availability */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-xs text-on-surface font-semibold" htmlFor="availability">Notice Period / Availability</label>
                  <div className="relative">
                    <select
                      className="w-full bg-surface-container border border-surface-variant rounded-lg px-4 py-3 font-body-md text-sm text-on-surface appearance-none focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-colors"
                      id="availability"
                      required
                      disabled={hasAlreadyApplied}
                      value={availability}
                      onChange={(e) => setAvailability(e.target.value)}
                    >
                      <option disabled value="">Select availability...</option>
                      <option value="immediate">Immediate</option>
                      <option value="15days">15 Days</option>
                      <option value="1month">1 Month</option>
                      <option value="2months">2 Months+</option>
                    </select>
                  </div>
                </div>

                {/* Cover Note */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-xs text-on-surface font-semibold" htmlFor="coverNote">Cover Note <span className="text-outline font-normal">(Optional)</span></label>
                  <textarea
                    className="w-full bg-surface-container border border-surface-variant rounded-lg px-4 py-3 font-body-md text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-colors placeholder:text-outline resize-none"
                    id="coverNote"
                    placeholder="Briefly introduce yourself and why you're a great fit for Lumière Studio..."
                    rows={4}
                    disabled={hasAlreadyApplied}
                    value={coverNote}
                    onChange={(e) => setCoverNote(e.target.value)}
                  />
                </div>
              </section>

              {/* Sticky Bottom CTA Container */}
              <div className="fixed bottom-0 left-0 right-0 p-margin-side bg-surface-container-lowest border-t border-outline-variant/50 shadow-[0_-4px_12px_rgba(90,63,71,0.05)] z-40 flex justify-center">
                <div className="w-full max-w-2xl">
                  <button
                    type="submit"
                    disabled={hasAlreadyApplied}
                    className={`w-full text-white font-card-title text-base rounded-full py-4 flex items-center justify-center gap-2 transition-all duration-200 ${
                      hasAlreadyApplied
                        ? 'bg-gray-400 cursor-not-allowed opacity-80'
                        : 'bg-[#b90064] hover:bg-secondary active:scale-[0.98]'
                    }`}
                  >
                    {hasAlreadyApplied ? 'Already Applied' : 'Submit Application'}
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </form>
          </main>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full min-h-[100dvh] flex flex-col items-center justify-center relative overflow-hidden bg-background px-margin-side"
        >
          {/* Ambient Background Effect */}
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
            <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-primary-container opacity-[0.03] blur-3xl"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-secondary-container opacity-[0.02] blur-3xl"></div>
          </div>

          <main className="w-full max-w-md py-section-gap flex flex-col items-center justify-center z-10 relative">
            {/* Success Animation / Icon */}
            <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
              {/* Pulsing background circles */}
              <div className="absolute inset-0 bg-primary-container opacity-20 rounded-full animate-ping" style={{ animationDuration: '2s' }}></div>
              <div className="absolute inset-2 bg-primary-container opacity-30 rounded-full animate-pulse"></div>
              {/* Core Icon Container */}
              <div className="relative w-16 h-16 bg-primary rounded-full flex items-center justify-center shadow-[0_8px_24px_rgba(185,0,100,0.25)]">
                <Check className="w-9 h-9 text-white" />
              </div>
            </div>

            {/* Typography Block */}
            <div className="text-center mb-6 w-full flex flex-col gap-2">
              <h1 className="font-screen-title text-2xl text-on-surface font-bold">Application sent</h1>
              <p className="font-body-md text-sm text-on-surface-variant max-w-[280px] mx-auto">
                Your application has been successfully sent to the employer.
              </p>
            </div>

            {/* Contextual Info Card */}
            <div className="w-full bg-surface-container-lowest rounded-lg border border-outline-variant shadow-[0_4px_12px_rgba(90,63,71,0.05)] p-4 mb-4 flex items-center gap-4 hover:bg-surface-bright transition-colors cursor-default">
              <div className="w-12 h-12 rounded-lg bg-surface-container-high flex-shrink-0 overflow-hidden border border-outline-variant/50">
                {selectedJob.salonLogo ? (
                  <img
                    src={selectedJob.salonLogo}
                    alt={selectedJob.salonName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[#b90064] text-white font-bold flex items-center justify-center">
                    {selectedJob.salonName.charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex flex-col flex-grow min-w-0">
                <h3 className="font-card-title text-base text-on-surface truncate font-semibold">{selectedJob.title}</h3>
                <p className="font-body-md text-sm text-on-surface-variant truncate">{selectedJob.salonName}</p>
              </div>
            </div>

            {/* Secondary Message */}
            <p className="font-label-sm text-xs text-tertiary text-center mb-8 px-4">
              The employer will review your profile and get in touch if you're a good fit.
            </p>

            {/* Actions */}
            <div className="w-full flex flex-col gap-3">
              <button
                onClick={onBack}
                className="w-full h-12 bg-primary text-white rounded-full font-semibold uppercase tracking-wider text-xs shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-secondary cursor-pointer"
                type="button"
              >
                <Sparkles className="w-4 h-4" />
                Explore More Jobs
              </button>
              <button
                onClick={() => {
                  if (onNavigateToApplications) {
                    onNavigateToApplications();
                  } else {
                    onBack();
                  }
                }}
                className="w-full h-12 bg-surface-container-lowest text-primary rounded-full font-semibold border border-outline-variant active:scale-[0.98] transition-all hover:bg-surface-container-low flex items-center justify-center gap-2 cursor-pointer"
                type="button"
              >
                <FileText className="w-4 h-4" />
                View Application
              </button>
            </div>
          </main>
        </motion.div>
      )}
    </div>
  );
};

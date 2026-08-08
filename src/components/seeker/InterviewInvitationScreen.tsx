import React, { useState } from 'react';
import { ArrowLeft, Bell, Calendar, Clock, Video, Copy, Check, MessageSquare, X, ChevronRight, HelpCircle, Briefcase, Bookmark, PersonStanding, User, MapPin, Map, Navigation, ZoomIn, ZoomOut } from 'lucide-react';
import { JobPosting, Application } from '../../types';

interface InterviewInvitationScreenProps {
  jobs: JobPosting[];
  applications: Application[];
  selectedApplication?: Application | null;
  onUpdateApplicationStatus?: (applicationId: string, status: Application['status'], notes?: string, interviewDate?: string) => void;
  onBack: () => void;
  onNavigateTab?: (tab: 'explore' | 'applications' | 'saved' | 'messages' | 'profile') => void;
}

export const InterviewInvitationScreen: React.FC<InterviewInvitationScreenProps> = ({
  jobs,
  applications,
  selectedApplication,
  onUpdateApplicationStatus,
  onBack,
  onNavigateTab,
}) => {
  // If no application is passed, let's find one with 'Interview Scheduled' or default to the first one,
  // or fall back to mock data if there are no applications.
  const activeApp = selectedApplication || applications.find(a => a.status === 'Interview Scheduled') || applications[0] || {
    id: 'mock-app',
    jobId: 'mock-job',
    jobTitle: 'Senior Hair Stylist',
    salonName: 'Lumière Studio',
    salonLogo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB1ppJlNNFiuA8yWWJLEEb4DDcHtwsIQfKV1BFOABTh3-3d306riQb_EtRqLWxDyUOr9bgkuVD9_az_5_dyTLvv1Wn3mbATj2vNO5T0oHwvSey-4FpVZSfd1o-JHpL0vU6KJok2acUzKpXxGLMhSq6bcqjPp8Wc47Ls4qErDIVslY2wDYbr8KrmNp-haHRGuDDHOhjlBchAUjB1nMO17KGz1IXtfW0N8L3SfQn0dLKGMqE4wUg_3luR',
    location: 'Beverly Hills, CA',
    appliedDate: 'Oct 28, 2023',
    status: 'Interview Scheduled',
    notes: 'Interview scheduled with hiring team.',
    interviewDate: 'Thursday, Nov 2, 2023 • 10:00 AM PST',
  };

  const [copied, setCopied] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'info' | 'error'>('success');
  
  // Local status state to reflect accepting/declining instantly in preview
  const [invitationStatus, setInvitationStatus] = useState<'pending' | 'accepted' | 'declined' | 'rescheduled'>(
    activeApp.status === 'Interview Scheduled' ? 'pending' : 'pending'
  );

  const [interviewType, setInterviewType] = useState<'virtual' | 'in-person'>('in-person');
  const [zoom, setZoom] = useState<number>(1.2);

  const showToast = (msg: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleCopyLink = () => {
    const zoomLink = 'zoom.us/j/1234567890';
    try {
      navigator.clipboard.writeText(zoomLink);
      setCopied(true);
      showToast('Zoom link copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback
      setCopied(true);
      showToast('zoom.us/j/1234567890', 'info');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAccept = () => {
    setInvitationStatus('accepted');
    if (onUpdateApplicationStatus && activeApp.id !== 'mock-app') {
      onUpdateApplicationStatus(activeApp.id, 'Interview Scheduled', 'Interview accepted. Looking forward to meeting you!');
    }
    showToast('Interview invitation accepted successfully!', 'success');
  };

  const handleDecline = () => {
    setInvitationStatus('declined');
    if (onUpdateApplicationStatus && activeApp.id !== 'mock-app') {
      onUpdateApplicationStatus(activeApp.id, 'Under Review', 'Declined current interview invitation. Awaiting further updates.');
    }
    showToast('You have declined the interview invitation.', 'info');
  };

  const handleRescheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleDate || !rescheduleTime) {
      showToast('Please specify a date and time.', 'error');
      return;
    }
    setInvitationStatus('rescheduled');
    setShowRescheduleModal(false);
    
    const formattedProposedTime = `${rescheduleDate} at ${rescheduleTime}`;
    if (onUpdateApplicationStatus && activeApp.id !== 'mock-app') {
      onUpdateApplicationStatus(
        activeApp.id, 
        'Under Review', 
        `Reschedule requested. Proposed time: ${formattedProposedTime}. Reason: ${rescheduleReason || 'None'}`
      );
    }
    showToast(`Reschedule request sent for ${formattedProposedTime}!`, 'success');
  };

  const handleBottomNavClick = (tab: 'explore' | 'applications' | 'saved' | 'messages' | 'profile') => {
    if (onNavigateTab) {
      onNavigateTab(tab);
    } else {
      onBack();
    }
  };

  // Extract zoom link or format meeting details cleanly
  const interviewTimeText = activeApp.interviewDate || 'Thursday, Nov 2, 2023 • 10:00 AM PST';
  const [datePart, timePart] = interviewTimeText.split('•').map(s => s.trim());

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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-stack-default">
            <h3 className="text-base font-bold text-[#1c1b1b]">Interview Details</h3>
            <div className="inline-flex bg-[#ffd9e2]/30 p-1 rounded-full border border-[#e0bec6]/30 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setInterviewType('virtual')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  interviewType === 'virtual'
                    ? 'bg-[#8e004b] text-white shadow-sm'
                    : 'text-[#594047] hover:text-[#8e004b]'
                }`}
              >
                Virtual Zoom
              </button>
              <button
                type="button"
                onClick={() => setInterviewType('in-person')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  interviewType === 'in-person'
                    ? 'bg-[#8e004b] text-white shadow-sm'
                    : 'text-[#594047] hover:text-[#8e004b]'
                }`}
              >
                In-Person Map
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-gutter">
            
            {/* Date & Time */}
            <div className="bg-white border border-[#e0bec6]/40 rounded-2xl p-stack-default shadow-xs flex items-start gap-stack-default">
              <div className="w-10 h-10 rounded-full bg-[#ffd9e2] text-[#8e004b] flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#594047] uppercase tracking-wider mb-0.5">Date & Time</p>
                <p className="text-sm font-bold text-[#1c1b1b]">{datePart || 'Thursday, Nov 2, 2023'}</p>
                <p className="text-xs font-semibold text-[#8e004b]">{timePart || '10:00 AM PST'}</p>
              </div>
            </div>

            {/* Duration */}
            <div className="bg-white border border-[#e0bec6]/40 rounded-2xl p-stack-default shadow-xs flex items-start gap-stack-default">
              <div className="w-10 h-10 rounded-full bg-[#ffd9e2] text-[#8e004b] flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#594047] uppercase tracking-wider mb-0.5">Duration</p>
                <p className="text-sm font-bold text-[#1c1b1b]">45 Minutes</p>
                <p className="text-xs text-[#594047] font-medium">Model Test & Portfolio Q&A</p>
              </div>
            </div>

            {/* Location / Type (Virtual Zoom vs In-Person) */}
            {interviewType === 'virtual' ? (
              <div className="bg-white border border-[#e0bec6]/40 rounded-2xl p-stack-default shadow-xs flex items-start gap-stack-default sm:col-span-2 animate-in fade-in duration-300">
                <div className="w-10 h-10 rounded-full bg-[#ffd9e2] text-[#8e004b] flex items-center justify-center shrink-0">
                  <Video className="w-5 h-5" />
                </div>
                <div className="flex-grow">
                  <p className="text-[10px] font-bold text-[#594047] uppercase tracking-wider mb-0.5">Interview Type</p>
                  <p className="text-sm font-bold text-[#1c1b1b] mb-2">Virtual Interview (Zoom)</p>
                  
                  {/* Copy Link Row */}
                  <div className="bg-[#fdf8f8] px-3 py-2 rounded-xl border border-[#e0bec6]/40 flex items-center justify-between">
                    <span className="text-xs text-[#594047] font-medium truncate select-all">zoom.us/j/1234567890</span>
                    <button 
                      type="button"
                      onClick={handleCopyLink}
                      className="text-xs text-[#8e004b] font-bold hover:underline shrink-0 flex items-center gap-1 active:scale-95 transition-transform cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy Link'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-[#e0bec6]/40 rounded-2xl p-stack-default shadow-xs flex flex-col gap-4 sm:col-span-2 animate-in fade-in duration-300">
                <div className="flex items-start gap-stack-default">
                  <div className="w-10 h-10 rounded-full bg-[#ffd9e2] text-[#8e004b] flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="flex-grow">
                    <p className="text-[10px] font-bold text-[#594047] uppercase tracking-wider mb-0.5">Interview Type</p>
                    <p className="text-sm font-bold text-[#1c1b1b]">In-Person Interview</p>
                    <p className="text-xs text-[#594047] mt-0.5 font-semibold">Lumière Studio Headquarters</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#ffd9e2] text-[#8e004b]">
                      <Navigation className="w-3 h-3 animate-pulse" />
                      1.2 mi away
                    </span>
                  </div>
                </div>

                {/* THE HIGH-FIDELITY MAP WIDGET */}
                <div className="relative w-full h-64 bg-[#fdf8f8] rounded-2xl border border-[#e0bec6]/50 overflow-hidden group shadow-inner">
                  {/* Styled Map Background Grid and Vector Paths */}
                  <svg className="w-full h-full text-[#ffd9e2]/40 bg-[#fdf8f8]" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice">
                    <defs>
                      <pattern id="mapGrid" width="24" height="24" patternUnits="userSpaceOnUse">
                        <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#e0bec6" strokeWidth="0.5" opacity="0.25" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#mapGrid)" />

                    {/* Scalable Map Group */}
                    <g transform={`scale(${zoom})`} style={{ transformOrigin: '200px 120px', transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                      {/* Park Area */}
                      <rect x="50" y="20" width="100" height="60" rx="8" fill="#d5c1cc" opacity="0.35" />
                      <text x="100" y="55" textAnchor="middle" className="text-[7px] font-bold fill-[#51434c] opacity-60">Beverly Gardens</text>

                      {/* Rodeo Drive Shopping Block */}
                      <rect x="250" y="140" width="110" height="70" rx="8" fill="#f2dde9" opacity="0.45" />
                      <text x="305" y="180" textAnchor="middle" className="text-[7px] font-bold fill-[#51434c] opacity-60">Rodeo Drive</text>

                      {/* Streets Grid */}
                      {/* Santa Monica Boulevard */}
                      <path d="M -100 80 L 500 80" stroke="#e0bec6" strokeWidth="10" strokeLinecap="round" fill="none" opacity="0.4" />
                      <path d="M -100 80 L 500 80" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" fill="none" />
                      <text x="120" y="83" className="text-[6px] font-extrabold fill-[#594047] tracking-wider uppercase opacity-50">Santa Monica Blvd</text>

                      {/* Wilshire Boulevard */}
                      <path d="M -100 190 L 500 190" stroke="#e0bec6" strokeWidth="12" strokeLinecap="round" fill="none" opacity="0.4" />
                      <path d="M -100 190 L 500 190" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" fill="none" />
                      <text x="120" y="193" className="text-[6px] font-extrabold fill-[#594047] tracking-wider uppercase opacity-50">Wilshire Blvd</text>

                      {/* Beverly Hills Drive */}
                      <path d="M 200 -50 L 200 350" stroke="#e0bec6" strokeWidth="10" strokeLinecap="round" fill="none" opacity="0.4" />
                      <path d="M 200 -50 L 200 350" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" fill="none" />
                      <text x="203" y="15" className="text-[6px] font-extrabold fill-[#594047] tracking-wider uppercase opacity-50 rotate-90 origin-left">Beverly Hills Dr</text>

                      {/* Custom Route Line with Dash Animation */}
                      <path 
                        d="M 120 80 L 200 80 L 200 120" 
                        stroke="#8e004b" 
                        strokeWidth="3.5" 
                        strokeLinecap="round" 
                        strokeDasharray="6 4" 
                        fill="none" 
                        className="animate-[dash_3s_linear_infinite]" 
                      />

                      {/* Current Location Point */}
                      <circle cx="120" cy="80" r="4" fill="#8e004b" />
                      <circle cx="120" cy="80" r="9" stroke="#8e004b" strokeWidth="1" fill="none" className="animate-ping" />

                      {/* Central Destination Pin (Lumière Studio) */}
                      <g transform="translate(200, 120)">
                        <circle cx="0" cy="0" r="14" fill="#8e004b" opacity="0.15" className="animate-pulse" />
                        <circle cx="0" cy="0" r="6" fill="#8e004b" opacity="0.3" />
                        
                        {/* Custom Map Pin Path */}
                        <path 
                          d="M 0 -11 C -5 -11 -8 -7 -8 -2 C -8 3.5 0 12 0 12 C 0 12 8 3.5 8 -2 C 8 -7 5 -11 0 -11 Z" 
                          fill="#8e004b" 
                          stroke="#ffffff"
                          strokeWidth="1"
                        />
                        <circle cx="0" cy="-3" r="2.5" fill="#ffffff" />

                        {/* Hover/Always visible elegant banner */}
                        <g transform="translate(0, -24)">
                          <rect x="-42" y="-10" width="84" height="18" rx="5" fill="#1c1b1b" shadow="md" />
                          <polygon points="0,11 -4,8 4,8" fill="#1c1b1b" />
                          <text x="0" y="1" textAnchor="middle" className="text-[7.5px] font-bold fill-white tracking-tight">Lumière Studio</text>
                        </g>
                      </g>
                    </g>
                  </svg>

                  {/* SVG Dash animation style block */}
                  <style>{`
                    @keyframes dash {
                      to {
                        stroke-dashoffset: -20;
                      }
                    }
                  `}</style>

                  {/* Overlays inside Map view */}
                  {/* Traffic status */}
                  <div className="absolute top-3 left-3 flex gap-2 z-10">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-extrabold bg-white/95 border border-[#e0bec6]/30 text-[#1c1b1b] shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Traffic: Light (6m)
                    </span>
                  </div>

                  {/* Streetview peek */}
                  <div className="absolute bottom-3 left-3 max-w-[120px] bg-white/95 backdrop-blur-xs border border-[#e0bec6]/40 p-1 rounded-lg hidden sm:flex gap-1.5 items-center z-10 shadow-xs">
                    <div className="w-8 h-8 rounded-md overflow-hidden shrink-0 border border-[#e0bec6]/20 bg-[#fdf8f8]">
                      <img 
                        src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&q=80&w=100" 
                        alt="Salon Storefront" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div>
                      <p className="text-[8px] font-extrabold text-[#1c1b1b] leading-none mb-0.5">Storefront</p>
                      <p className="text-[7px] text-[#594047] font-semibold leading-none">Beverly Hills</p>
                    </div>
                  </div>

                  {/* Map Zoom Controls */}
                  <div className="absolute right-3 bottom-3 flex flex-col gap-1 z-10">
                    <button 
                      type="button"
                      onClick={() => setZoom(prev => Math.min(prev + 0.15, 2.0))}
                      className="w-7 h-7 rounded-lg bg-white border border-[#e0bec6]/50 shadow-xs flex items-center justify-center text-[#8e004b] hover:bg-[#ffd9e2] transition-colors cursor-pointer"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      type="button"
                      onClick={() => setZoom(prev => Math.max(prev - 0.15, 0.7))}
                      className="w-7 h-7 rounded-lg bg-white border border-[#e0bec6]/50 shadow-xs flex items-center justify-center text-[#8e004b] hover:bg-[#ffd9e2] transition-colors cursor-pointer"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Physical Address Details and Trigger Button */}
                <div className="bg-[#fdf8f8] p-3 rounded-xl border border-[#e0bec6]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Map className="w-4 h-4 text-[#8e004b] shrink-0" />
                    <span className="text-xs font-bold text-[#1c1b1b]">942 Beverly Hills Dr, Beverly Hills, CA 90210</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      showToast('Directions link copied. Opening external navigation...', 'success');
                      window.open('https://maps.google.com/?q=Lumiere+Studio+Beverly+Hills', '_blank');
                    }}
                    className="text-xs bg-[#8e004b] text-white px-4 py-1.5 rounded-full font-bold hover:bg-[#b90064] transition-colors flex items-center gap-1.5 shadow-2xs self-end sm:self-auto cursor-pointer"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Get Directions</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Message from Employer */}
        <div className="mb-section-gap">
          <h3 className="text-base font-bold text-[#1c1b1b] mb-stack-default">Message from Employer</h3>
          <div className="bg-[#f2dde9] rounded-2xl p-stack-default border border-[#e0bec6]/50 relative overflow-hidden shadow-xs">
            {/* Elegant decorative background accent */}
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-[#8e004b]/5 to-transparent rounded-bl-full pointer-events-none" />
            
            <p className="text-sm text-[#1c1b1b] italic font-medium leading-relaxed pl-2 border-l-2 border-[#8e004b]">
              "{activeApp.notes || 'We loved your portfolio and would like to discuss the hair stylist opportunity further. Looking forward to meeting you!'}"
            </p>
          </div>
        </div>

      </main>

      {/* Sticky Bottom Action Tray */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e0bec6]/40 py-4 px-margin-side shadow-lg z-30 pb-20 md:pb-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-stack-sm justify-end items-center">
          <button 
            id="decline_button"
            onClick={handleDecline}
            disabled={invitationStatus === 'declined'}
            className="w-full sm:w-auto font-bold text-xs text-rose-600 hover:text-rose-700 px-6 py-3 rounded-full hover:bg-rose-50 transition-colors order-3 sm:order-1 sm:mr-auto cursor-pointer text-center disabled:opacity-50"
          >
            Decline Invitation
          </button>
          
          <button 
            id="reschedule_button"
            onClick={() => setShowRescheduleModal(true)}
            className="w-full sm:w-auto font-bold text-xs text-[#8e004b] border border-[#8e004b] px-6 py-3 rounded-full hover:bg-[#ffd9e2] transition-colors order-2 cursor-pointer text-center"
          >
            Request Another Time
          </button>
          
          <button 
            id="accept_button"
            onClick={handleAccept}
            disabled={invitationStatus === 'accepted'}
            className="w-full sm:w-auto font-bold text-xs bg-[#8e004b] text-white px-8 py-3 rounded-full hover:bg-[#b90064] transition-all duration-200 shadow-sm hover:shadow-md order-1 sm:order-3 cursor-pointer text-center disabled:bg-emerald-600 disabled:hover:bg-emerald-600"
          >
            {invitationStatus === 'accepted' ? 'Confirmed & Accepted' : 'Accept Interview'}
          </button>
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
                  className="flex-1 py-2.5 rounded-full text-xs font-bold bg-[#8e004b] text-white hover:bg-[#b90064]"
                >
                  Send Proposal
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

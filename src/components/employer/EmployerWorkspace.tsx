import React, { useEffect, useState } from 'react';
import { JobPosting, Applicant, UserProfile, Conversation, ChatMessage, PortfolioItem } from '../../types';
import { getApplicantPortfolio, getResumeDownloadUrl } from '../../services/backend';
import type { InterviewSchedulePayload } from '../../lib/interviewSchedule';
import { ProfileImageUploader } from '../profile/ProfileImageUploader';
import { MessagingCenter } from '../messaging/MessagingCenter';
import { PortfolioGallery } from '../profile/PortfolioGallery';
import { RegionalSalaryAnalytics } from './RegionalSalaryAnalytics';
import { PostJobWizard } from './PostJobWizard';
import { RequestInterviewScreen } from './RequestInterviewScreen';
import { EmployerInterviewsTab } from './EmployerInterviewsTab';
import { CreateJobOfferScreen } from './CreateJobOfferScreen';
import { HiringSuccessScreen } from './HiringSuccessScreen';
import { EmployerProfileTab } from './EmployerProfileTab';
import { LogoutConfirmationModal } from './LogoutConfirmationModal';
import {
  Plus,
  Building2,
  Users,
  Briefcase,
  Calendar,
  Clock,
  X,
  Phone,
  Mail,
  FileText,
  UserCheck,
  ChevronRight,
  LogOut,
  Sparkles,
  MapPin,
  ExternalLink,
  Tag,
  Camera,
  MessageSquare,
  Layers,
  BarChart3,
  TrendingUp,
  LayoutDashboard,
  Bell,
  ArrowLeft
} from 'lucide-react';

interface EmployerWorkspaceProps {
  jobs: JobPosting[];
  applicants: Applicant[];
  conversations?: Conversation[];
  messages?: ChatMessage[];
  userProfile: UserProfile;
  onAddJob: (newJob: JobPosting) => Promise<JobPosting>;
  onUpdateJob: (job: JobPosting) => Promise<JobPosting>;
  onUpdateApplicantStatus: (applicantId: string, status: Applicant['status']) => Promise<void>;
  /** Persists a real interview row from the scheduling form payload. */
  onScheduleInterview: (applicantId: string, payload: InterviewSchedulePayload) => Promise<void>;
  /** Moves an interview to a new start time. */
  onRescheduleInterview?: (interviewId: string, newStartIso: string) => Promise<void>;
  /** Marks a confirmed interview complete. */
  onCompleteInterview?: (interviewId: string) => Promise<void>;
  /** Sends the offer through the backend (`send_job_offer`) for this applicant. */
  onSendOffer?: (
    applicantId: string,
    details: { jobRole: string; salary?: string; employmentType?: string; joiningDate?: string; offerNotes?: string },
    interviewId?: string,
  ) => void;
  onSendMessage?: (conversationId: string, text: string, attachment?: { name: string; url: string; type: 'image' | 'file' }) => void;
  onStartConversation?: (jobId: string, targetSeekerName?: string, targetSalonName?: string) => string;
  onUpdateAvatar?: (newAvatarUrl: string | undefined) => void;
  onUpdateProfile?: (updated: UserProfile) => void;
  onJobAction?: (jobId: string, action: 'submit' | 'pause' | 'resume' | 'close') => void;
  initialTab?: 'dashboard' | 'jobs' | 'candidates';
  initialJobId?: string;
  openPostJobOnMount?: boolean;
  onPostJobFlowExit?: (destination?: 'dashboard' | 'jobs' | 'candidates', jobId?: string) => void;
  onLogout: () => void;
}

export const EmployerWorkspace: React.FC<EmployerWorkspaceProps> = ({
  jobs,
  applicants,
  conversations = [],
  messages = [],
  userProfile,
  onAddJob,
  onUpdateJob,
  onUpdateApplicantStatus,
  onScheduleInterview,
  onRescheduleInterview,
  onCompleteInterview,
  onSendOffer,
  onSendMessage,
  onStartConversation,
  onUpdateAvatar,
  onUpdateProfile,
  onJobAction,
  initialTab,
  initialJobId,
  openPostJobOnMount,
  onPostJobFlowExit,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'jobs' | 'candidates' | 'interviews' | 'messages' | 'analytics' | 'profile'>(initialTab || 'dashboard');
  const [activeConvId, setActiveConvId] = useState<string | undefined>(undefined);
  const [showPostModal, setShowPostModal] = useState<boolean>(false);
  const [editingJob, setEditingJob] = useState<JobPosting | null>(null);
  const [candidateJobFilter, setCandidateJobFilter] = useState<string | null>(initialJobId || null);
  const [updatingApplicationId, setUpdatingApplicationId] = useState<string | null>(null);
  const [downloadingResumeId, setDownloadingResumeId] = useState<string | null>(null);
  const [applicationActionError, setApplicationActionError] = useState<string | null>(null);
  const [showImageUploader, setShowImageUploader] = useState<boolean>(false);
  const [viewingPortfolioApplicant, setViewingPortfolioApplicant] = useState<Applicant | null>(null);
  const [offeringApplicant, setOfferingApplicant] = useState<Applicant | null>(null);
  const [hiredApplicant, setHiredApplicant] = useState<Applicant | null>(null);
  const [hiredOfferDetails, setHiredOfferDetails] = useState<any>(null);
  const [showLogoutModal, setShowLogoutModal] = useState<boolean>(false);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);
  useEffect(() => {
    setCandidateJobFilter(initialJobId || null);
    if (initialJobId) setActiveTab('candidates');
  }, [initialJobId]);
  useEffect(() => {
    if (openPostJobOnMount) {
      setEditingJob(null);
      setShowPostModal(true);
    }
  }, [openPostJobOnMount]);

  // Candidate Filter State
  const [candidateFilter, setCandidateFilter] = useState<string>('All');
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [isScheduling, setIsScheduling] = useState<boolean>(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [applicantPortfolio, setApplicantPortfolio] = useState<PortfolioItem[]>([]);
  const [applicantPortfolioLoading, setApplicantPortfolioLoading] = useState<boolean>(false);

  // The employer's read-only view of the applicant's real portfolio items.
  useEffect(() => {
    if (!viewingPortfolioApplicant?.candidateProfileId) {
      setApplicantPortfolio([]);
      return;
    }
    let cancelled = false;
    setApplicantPortfolioLoading(true);
    getApplicantPortfolio(viewingPortfolioApplicant.candidateProfileId)
      .then((items) => { if (!cancelled) setApplicantPortfolio(items); })
      .catch(() => { if (!cancelled) setApplicantPortfolio([]); })
      .finally(() => { if (!cancelled) setApplicantPortfolioLoading(false); });
    return () => { cancelled = true; };
  }, [viewingPortfolioApplicant]);

  const applicationPool = candidateJobFilter
    ? applicants.filter((applicant) => applicant.appliedJobId === candidateJobFilter)
    : applicants;
  const filteredApplicants = applicationPool.filter((applicant) => {
    if (candidateFilter === 'All') return true;
    return applicant.status === candidateFilter;
  });
  const filteredJobTitle = candidateJobFilter
    ? jobs.find((job) => job.id === candidateJobFilter)?.title
    : undefined;

  const handleApplicationStatus = async (applicant: Applicant, status: Applicant['status']) => {
    if (updatingApplicationId) return;
    setUpdatingApplicationId(applicant.id);
    setApplicationActionError(null);
    try {
      await onUpdateApplicantStatus(applicant.id, status);
    } catch (error) {
      setApplicationActionError(error instanceof Error ? error.message : 'Unable to update this application.');
    } finally {
      setUpdatingApplicationId(null);
    }
  };

  const handleResumeDownload = async (applicant: Applicant) => {
    if (!applicant.resumeStoragePath || downloadingResumeId) return;
    setDownloadingResumeId(applicant.id);
    setApplicationActionError(null);
    try {
      const url = await getResumeDownloadUrl(applicant.resumeStoragePath);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.download = applicant.resumeFileName || 'candidate-resume';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      setApplicationActionError(error instanceof Error ? error.message : 'Unable to download this resume.');
    } finally {
      setDownloadingResumeId(null);
    }
  };

  const handleScheduleConfirm = async (payload: InterviewSchedulePayload) => {
    if (!selectedApplicant || isScheduling) return;
    setIsScheduling(true);
    setScheduleError(null);
    try {
      await onScheduleInterview(selectedApplicant.id, payload);
      setShowScheduleModal(false);
      setSelectedApplicant(null);
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : 'Unable to schedule the interview.');
    } finally {
      setIsScheduling(false);
    }
  };

  const closeScheduleModal = () => {
    setShowScheduleModal(false);
    setScheduleError(null);
  };

  const NavItem = ({ icon: Icon, label, tab, filledIcon = false }: { icon: any, label: string, tab: any, filledIcon?: boolean }) => {
    const isActive = activeTab === tab;
    
    return (
      <button 
        onClick={() => {
          if (tab === 'dashboard' || tab === 'jobs' || tab === 'candidates') onPostJobFlowExit?.(tab);
          if (tab === 'candidates') setCandidateJobFilter(null);
          setActiveTab(tab);
        }}
        className={`flex items-center gap-3 p-3 rounded-lg w-full text-left transition-all active:translate-x-1 duration-150 cursor-pointer ${
          isActive 
            ? 'bg-[#e2007c] text-white font-bold' 
            : 'text-[#594047] hover:bg-[#e6e1e1] hover:bg-[#ece7e7]'
        }`}
      >
        <Icon className="w-5 h-5" style={isActive && filledIcon ? { fill: 'currentColor' } : {}} />
        <span>{label}</span>
      </button>
    );
  };

  const MobileNavItem = ({ icon: Icon, label, tab, filledIcon = false }: { icon: any, label: string, tab: any, filledIcon?: boolean }) => {
    const isActive = activeTab === tab;
    
    return (
      <button 
        onClick={() => {
          if (tab === 'dashboard' || tab === 'jobs' || tab === 'candidates') onPostJobFlowExit?.(tab);
          if (tab === 'candidates') setCandidateJobFilter(null);
          setActiveTab(tab);
        }}
        className={`flex flex-col items-center justify-center px-2 py-1 active:scale-90 transition-transform cursor-pointer ${
          isActive
            ? 'bg-[#b90064] text-[#ffcbd9] rounded-full px-4'
            : 'text-[#594047] hover:text-[#8e004b]'
        }`}
      >
        <Icon className="w-6 h-6" style={isActive && filledIcon ? { fill: 'currentColor' } : {}} />
        <span className="text-[13px] font-medium mt-1">{label}</span>
      </button>
    );
  };

  return (
    <div className="bg-[#fdf8f8] text-[#1c1b1b] min-h-screen pb-24 md:pb-0 md:pl-80 flex flex-col md:flex-row select-none">
      {/* Navigation Drawer (Desktop) */}
      <aside className="hidden md:flex flex-col h-full w-80 rounded-r-xl bg-[#fdf8f8] shadow-xl fixed left-0 top-0 z-50 p-4 gap-4 border-r border-[#e0bec6]">
        <div className="flex items-center gap-4 mb-8">
          <img 
            alt="Employer Profile" 
            className="w-12 h-12 rounded-full object-cover border border-[#e0bec6]" 
            src={userProfile.avatarUrl || "https://lh3.googleusercontent.com/aida-public/AB6AXuAuZ-FXyC98oUtW9eo9ufnZH826kE3xNJbYn_zhbya-ynLr5gz9yAE4oLfkTzvPglaIhUbZmcidW1zLOMhe_utK4AXXpiCjm4Xy92Kg5LXKckRihIV2NPj2xIjbRgj7u_hcMizHTwSb0J0F0JDpf0zgZSaLkP-MqdVVs5DzNeCjtNPkD0J7XRWhnTDeGQdBPGNs_ChHRa8NGnIPTWZl9G8kHiZLiHravsS1ZhwL62__kMcGhkdwh-gME6JNbvlIYQFalg"}
          />
          <div>
            <h2 className="text-base font-bold text-[#1c1b1b]">{userProfile.businessName || 'The Glamour Studio'}</h2>
            <p className="text-[13px] font-medium text-[#594047]">Premium Employer</p>
            <p className="text-xs font-medium text-[#8e004b] mt-1">Verified Account</p>
          </div>
        </div>

        <nav className="flex-1 flex flex-col gap-2">
          <NavItem icon={LayoutDashboard} label="Dashboard" tab="dashboard" filledIcon />
          <NavItem icon={Briefcase} label="My Jobs" tab="jobs" />
          <NavItem icon={FileText} label="Applications" tab="candidates" />
          <NavItem icon={Calendar} label="Interviews" tab="interviews" />
          <NavItem icon={MessageSquare} label="Messages" tab="messages" />
          <NavItem icon={BarChart3} label="Analytics" tab="analytics" />
          <NavItem icon={Building2} label="Profile" tab="profile" />
        </nav>
        
        <div className="mt-auto border-t border-[#e0bec6] pt-4 flex flex-col gap-2">
          <button
            onClick={onLogout}
            className="flex items-center gap-3 p-3 text-[#ba1a1a] hover:bg-[#ffdad6] rounded-lg transition-all active:translate-x-1 duration-150 cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
        {/* TopAppBar */}
        <header className="flex justify-between items-center px-5 h-16 w-full z-40 bg-[#fdf8f8] shadow-[0_4px_12px_rgba(90,63,71,0.05)] sticky top-0 md:static">
          <div className="flex items-center gap-3">
            <button className="md:hidden text-[#8e004b] hover:bg-[#e6e1e1] transition-colors active:scale-95 duration-200 p-2 rounded-full cursor-pointer">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2">
              <img 
                alt="Logo" 
                className="w-8 h-8 rounded-full border border-[#e0bec6] md:hidden" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDrWHddqhJawn6_Y6s98bBH8_EeXeZa9k7ArYyiRW_NiTTAb4xFyvOsQFPvapS3_Fb8e_YhQYP_Etu9pLWlyiJ5jI2uX9d_AK2pd4A6hh5ndJR5RIlYOucHbdCjHIO1nFSCxDFyLY09WWI4AqpWv6Ca6eJqKdLG-RhSFTV9jGArY0ISzjUC9-Ae4-ZtC2_gZWj903Tjwje5SWF-D3Ozj4PeLha8Cwp9NlE8cu1jKx92yJSPrlnXcfAHlWHEiXPIS8RIrw"
              />
              <h1 className="text-2xl font-semibold text-[#8e004b] tracking-tight">Nexora Jobs</h1>
            </div>
          </div>
          
          <button className="text-[#8e004b] hover:bg-[#e6e1e1] transition-colors active:scale-95 duration-200 p-2 rounded-full relative cursor-pointer">
            <Bell className="w-6 h-6" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-[#b50062] rounded-full"></span>
          </button>
        </header>

        <main className="flex-1 p-5 md:p-8 max-w-5xl mx-auto w-full flex flex-col gap-8">
          
          {/* TAB: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <>
              {/* Welcome */}
              <section>
                <h2 className="text-2xl md:text-3xl font-bold text-[#1c1b1b] mb-2 tracking-tight">
                  Welcome back, {userProfile.businessName || 'The Glamour Studio'}
                </h2>
                <p className="text-base text-[#594047]">Here is what's happening with your job listings today.</p>
              </section>

              {/* Stats Overview Bento Grid */}
              <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div 
                  onClick={() => setActiveTab('jobs')}
                  className="bg-white border border-[#e0bec6] rounded-lg p-4 shadow-[0_4px_12px_rgba(90,63,71,0.05)] flex flex-col items-center justify-center text-center group hover:bg-[#ece7e7] transition-colors cursor-pointer"
                >
                  <Briefcase className="text-[#8e004b] mb-2 w-8 h-8 group-hover:scale-110 transition-transform" />
                  <span className="text-2xl md:text-3xl font-bold text-[#1c1b1b]">{jobs.length}</span>
                  <span className="text-[13px] font-medium text-[#594047] mt-1">Posted Jobs</span>
                </div>
                
                <div 
                  onClick={() => setActiveTab('candidates')}
                  className="bg-white border border-[#e0bec6] rounded-lg p-4 shadow-[0_4px_12px_rgba(90,63,71,0.05)] flex flex-col items-center justify-center text-center group hover:bg-[#ece7e7] transition-colors cursor-pointer"
                >
                  <FileText className="text-[#b50062] mb-2 w-8 h-8 group-hover:scale-110 transition-transform" />
                  <span className="text-2xl md:text-3xl font-bold text-[#1c1b1b]">{applicants.length}</span>
                  <span className="text-[13px] font-medium text-[#594047] mt-1">Applications</span>
                </div>
                
                <div 
                  onClick={() => setActiveTab('interviews')}
                  className="bg-white border border-[#e0bec6] rounded-lg p-4 shadow-[0_4px_12px_rgba(90,63,71,0.05)] flex flex-col items-center justify-center text-center group hover:bg-[#ece7e7] transition-colors cursor-pointer"
                >
                  <Calendar className="text-[#51434c] mb-2 w-8 h-8 group-hover:scale-110 transition-transform" />
                  <span className="text-2xl md:text-3xl font-bold text-[#1c1b1b]">{applicants.filter(a => a.status === 'Interview Scheduled').length}</span>
                  <span className="text-[13px] font-medium text-[#594047] mt-1">Interviews</span>
                </div>
                
                <div 
                  onClick={() => setActiveTab('candidates')}
                  className="bg-white border border-[#e0bec6] rounded-lg p-4 shadow-[0_4px_12px_rgba(90,63,71,0.05)] flex flex-col items-center justify-center text-center group hover:bg-[#ece7e7] transition-colors cursor-pointer"
                >
                  <UserCheck className="text-[#8e004b] mb-2 w-8 h-8 group-hover:scale-110 transition-transform" />
                  <span className="text-2xl md:text-3xl font-bold text-[#1c1b1b]">{applicants.filter(a => a.status === 'Hired').length}</span>
                  <span className="text-[13px] font-medium text-[#594047] mt-1">Hired</span>
                </div>
              </section>

              {/* Quick Actions */}
              <section className="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar">
                <button 
                  onClick={() => { setEditingJob(null); setShowPostModal(true); }}
                  className="snap-start shrink-0 bg-[#8e004b] text-white rounded-full px-6 py-4 text-base font-semibold flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-md cursor-pointer"
                >
                  <Plus className="w-5 h-5" />
                  Post Job
                </button>
                <button 
                  onClick={() => setActiveTab('candidates')}
                  className="snap-start shrink-0 bg-white border border-[#e0bec6] text-[#1c1b1b] rounded-full px-6 py-4 text-base font-medium flex items-center gap-2 hover:bg-[#e6e1e1] active:scale-95 transition-all cursor-pointer"
                >
                  <FileText className="text-[#8e004b] w-5 h-5" />
                  View Applications
                </button>
                <button 
                  onClick={() => setActiveTab('messages')}
                  className="snap-start shrink-0 bg-white border border-[#e0bec6] text-[#1c1b1b] rounded-full px-6 py-4 text-base font-medium flex items-center gap-2 hover:bg-[#e6e1e1] active:scale-95 transition-all cursor-pointer"
                >
                  <MessageSquare className="text-[#b50062] w-5 h-5" />
                  Messages
                </button>
                <button 
                  onClick={() => setActiveTab('analytics')}
                  className="snap-start shrink-0 bg-white border border-[#e0bec6] text-[#1c1b1b] rounded-full px-6 py-4 text-base font-medium flex items-center gap-2 hover:bg-[#e6e1e1] active:scale-95 transition-all cursor-pointer"
                >
                  <BarChart3 className="text-[#51434c] w-5 h-5" />
                  Insights
                </button>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Recent Applications */}
                <section className="bg-white border border-[#e0bec6] rounded-xl p-6 shadow-[0_4px_12px_rgba(90,63,71,0.05)]">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold text-[#1c1b1b]">Recent Applications</h3>
                    <button onClick={() => setActiveTab('candidates')} className="text-[13px] font-medium text-[#8e004b] hover:underline cursor-pointer">
                      View All
                    </button>
                  </div>
                  
                  <div className="flex flex-col gap-4">
                    {applicants.slice(0, 3).map(applicant => (
                      <div 
                        key={applicant.id}
                        onClick={() => {
                          setCandidateFilter('All');
                          setActiveTab('candidates');
                        }}
                        className="flex items-center gap-4 p-4 border border-[#e0bec6] rounded-lg hover:bg-[#f1edec] transition-colors cursor-pointer"
                      >
                        <div className="w-12 h-12 bg-[#e6e1e1] rounded-full flex items-center justify-center text-[#594047] font-bold">
                          {applicant.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-base font-semibold text-[#1c1b1b] truncate">{applicant.name}</h4>
                          <p className="text-[13px] font-medium text-[#594047] truncate">{applicant.appliedJobTitle}</p>
                        </div>
                        {applicant.status === 'New' && (
                          <span className="bg-[#ffd9e2] text-[#3e001e] text-xs px-2 py-1 rounded-full font-medium">New</span>
                        )}
                      </div>
                    ))}
                    {applicants.length === 0 && (
                      <p className="text-[#594047] text-[13px] italic">No recent applications.</p>
                    )}
                  </div>
                </section>

                {/* Active Jobs */}
                <section className="bg-white border border-[#e0bec6] rounded-xl p-6 shadow-[0_4px_12px_rgba(90,63,71,0.05)]">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold text-[#1c1b1b]">Active Jobs</h3>
                    <button onClick={() => setActiveTab('jobs')} className="text-[13px] font-medium text-[#8e004b] hover:underline cursor-pointer">
                      View All
                    </button>
                  </div>
                  
                  <div className="flex flex-col gap-4">
                    {jobs.slice(0, 3).map(job => (
                      <div 
                        key={job.id}
                        onClick={() => setActiveTab('jobs')}
                        className="p-4 border border-[#e0bec6] rounded-lg hover:bg-[#f1edec] transition-colors cursor-pointer"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="text-base font-semibold text-[#1c1b1b] truncate pr-2">{job.title}</h4>
                          <span className="bg-[#e6e1e1] text-[#594047] text-xs px-2 py-1 rounded-full font-medium shrink-0">
                            {applicants.filter(a => a.appliedJobId === job.id).length} Apps
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[#594047] text-[13px] font-medium">
                          <MapPin className="w-4 h-4" />
                          <span className="truncate">{job.location}</span>
                        </div>
                      </div>
                    ))}
                    {jobs.length === 0 && (
                      <p className="text-[#594047] text-[13px] italic">No active jobs posted.</p>
                    )}
                  </div>
                </section>
              </div>
            </>
          )}

          {/* TAB: JOBS */}
          {activeTab === 'jobs' && (
            <div className="flex flex-col w-full h-full">
              <div className="flex justify-between items-center mb-8">
                <div><h2 className="text-2xl md:text-[24px] font-semibold tracking-tight text-[#8e004b]">My Job Posts</h2><p className="text-xs text-[#594047] mt-1">Every job posted by you, with applications and current status.</p></div>
                <button
                  onClick={() => { setEditingJob(null); setShowPostModal(true); }}
                  className="hidden md:flex bg-[#e2007c] text-white px-4 py-2 rounded-full text-[13px] font-medium items-center gap-1 hover:bg-[#b50062] transition-colors shadow-sm cursor-pointer"
                >
                  <Plus className="w-5 h-5" /> Post Job
                </button>
              </div>
  
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="overflow-x-auto hide-scrollbar -mx-5 px-5 md:mx-0 md:px-0">
                  <div className="flex gap-2 min-w-max pb-1">
                    <span className="bg-[#f2dde9] text-[#8e004b] px-4 py-2 rounded-full text-[13px] font-semibold border border-transparent">All Posted ({jobs.length})</span>
                    <span className="bg-emerald-50 text-emerald-800 px-4 py-2 rounded-full text-[13px] font-medium">Published ({jobs.filter((job) => job.approvalStatus === 'approved').length})</span>
                    <span className="bg-amber-50 text-amber-800 px-4 py-2 rounded-full text-[13px] font-medium">Draft ({jobs.filter((job) => !job.approvalStatus || !['approved', 'closed', 'expired', 'archived'].includes(job.approvalStatus)).length})</span>
                    <span className="bg-[#f1edec] text-[#594047] px-4 py-2 rounded-full text-[13px] font-medium">Closed ({jobs.filter((job) => ['closed', 'expired', 'archived'].includes(job.approvalStatus || '')).length})</span>
                  </div>
                </div>
                <button 
                  onClick={() => { setEditingJob(null); setShowPostModal(true); }}
                  className="md:hidden w-full bg-[#e2007c] text-white py-3 rounded-full text-[13px] font-medium items-center justify-center flex gap-2 hover:bg-[#b50062] transition-colors shadow-sm cursor-pointer"
                >
                  <Plus className="w-5 h-5" /> Post a New Job
                </button>
              </div>
  
              <div className="flex flex-col gap-4">
                {jobs.map((job) => {
                  const closed = ['closed', 'expired', 'archived'].includes(job.approvalStatus || '');
                  const published = job.approvalStatus === 'approved';
                  const statusLabel = published ? 'Published' : closed ? 'Closed' : 'Draft';
                  const jobApplicants = applicants.filter((applicant) => applicant.appliedJobId === job.id);
                  const totalApplications = Math.max(jobApplicants.length, job.activeApplicantsCount || 0);
                  const newApplications = jobApplicants.filter((applicant) => applicant.status === 'New').length;

                  return (
                    <article
                      key={job.id}
                      className="rounded-xl border border-[#e8e8e8] bg-white p-4 shadow-[0_4px_12px_rgba(90,63,71,0.03)] transition-shadow hover:shadow-md md:p-6"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${published ? 'bg-emerald-50 text-emerald-700' : closed ? 'bg-[#f1edec] text-[#594047]' : 'bg-amber-50 text-amber-800'}`}>
                              <span className={`h-2 w-2 rounded-full ${published ? 'bg-emerald-500' : closed ? 'bg-[#8c7077]' : 'bg-amber-500'}`} />
                              Status: {statusLabel}
                            </span>
                          </div>
                          <h3 className="mt-3 truncate text-lg font-bold text-[#1c1b1b]">{job.title}</h3>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={closed}
                            onClick={() => { setEditingJob(job); setShowPostModal(true); }}
                            className="rounded-full border border-[#e0bec6] bg-white px-4 py-2 text-[13px] font-bold text-[#8e004b] hover:bg-[#f7f2f2] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Edit Job
                          </button>
                          <button
                            type="button"
                            disabled={closed}
                            onClick={() => onJobAction?.(job.id, 'close')}
                            className="rounded-full border border-rose-200 bg-white px-4 py-2 text-[13px] font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {closed ? 'Job Closed' : 'Close Job'}
                          </button>
                        </div>
                      </div>

                      <dl className="mt-5 grid grid-cols-2 gap-4 border-y border-[#f1edec] py-4 md:grid-cols-3">
                        {[
                          ['Location', job.location],
                          ['Salary', job.salary],
                          ['Posted Date', job.postedDate],
                          ['Total Applications', String(totalApplications)],
                          ['New Applications', String(newApplications)],
                        ].map(([label, value]) => (
                          <div key={label} className={label === 'Salary' ? 'col-span-2 md:col-span-1' : ''}>
                            <dt className="text-xs font-semibold uppercase tracking-wide text-[#8c7077]">{label}</dt>
                            <dd className="mt-1 truncate text-sm font-bold text-[#1c1b1b]">{value}</dd>
                          </div>
                        ))}
                      </dl>

                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setCandidateFilter('All');
                            setCandidateJobFilter(job.id);
                            setActiveTab('candidates');
                            onPostJobFlowExit?.('candidates', job.id);
                          }}
                          className="rounded-full bg-[#e2007c] px-5 py-2.5 text-[13px] font-bold text-white shadow-sm hover:bg-[#b50062]"
                        >
                          View Applications
                        </button>
                      </div>
                    </article>
                  );
                })}

                {jobs.length === 0 && (
                  <div className="rounded-2xl border-2 border-dashed border-[#e0bec6] px-5 py-14 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#ffd9e2] text-[#e2007c]">
                      <Briefcase className="h-7 w-7" />
                    </div>
                    <p className="mt-4 font-semibold text-[#594047]">You have not posted any job yet.</p>
                    <button
                      type="button"
                      onClick={() => { setEditingJob(null); setShowPostModal(true); }}
                      className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#e2007c] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#b50062]"
                    >
                      <Plus className="h-5 w-5" /> Post a Job
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: APPLICATIONS RECEIVED */}
          {activeTab === 'candidates' && (
            <div className="flex h-full w-full flex-col pb-24 md:pb-0">
              <div className="mb-6 flex flex-col gap-3 px-5 md:flex-row md:items-center md:justify-between md:px-0">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-[#8e004b] md:text-[24px]">Applications Received</h2>
                  <p className="mt-1 text-xs font-medium text-[#594047]">
                    {filteredJobTitle ? `Candidates who applied for ${filteredJobTitle}` : 'Candidates who applied to your job posts'}
                  </p>
                </div>
                {candidateJobFilter && (
                  <button
                    type="button"
                    onClick={() => { setCandidateJobFilter(null); onPostJobFlowExit?.('candidates'); }}
                    className="self-start rounded-full border border-[#e0bec6] bg-white px-4 py-2 text-xs font-bold text-[#8e004b] hover:bg-[#f7f2f2]"
                  >
                    View All Applications
                  </button>
                )}
              </div>

              {applicationActionError && (
                <div role="alert" className="mx-5 mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 md:mx-0">
                  {applicationActionError}
                </div>
              )}

              <div className="mb-6 overflow-x-auto px-5 hide-scrollbar md:px-0">
                <div className="flex min-w-max gap-2 pb-1">
                  {[
                    ['All', 'All'],
                    ['New', 'New'],
                    ['Under Review', 'Viewed'],
                    ['Shortlisted', 'Shortlisted'],
                    ['Rejected', 'Declined'],
                    ['Hired', 'Hired'],
                  ].map(([label, value]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCandidateFilter(value)}
                      className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-[13px] font-medium shadow-sm transition-all ${candidateFilter === value ? 'border-transparent bg-[#e2007c] text-white' : 'border-[#e0bec6] bg-[#f7f2f2] text-[#594047] hover:bg-[#ece7e7]'}`}
                    >
                      {label} ({value === 'All' ? applicationPool.length : applicationPool.filter((applicant) => applicant.status === value).length})
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 px-5 md:grid-cols-2 md:px-0 xl:grid-cols-3">
                {filteredApplicants.map((applicant) => {
                  const busy = updatingApplicationId === applicant.id;
                  const statusLabel = applicant.status === 'New' ? 'Applied'
                    : applicant.status === 'Viewed' ? 'Under Review'
                    : applicant.status === 'Declined' ? 'Rejected'
                    : applicant.status;
                  const phoneDigits = applicant.phone.replace(/\D/g, '');
                  return (
                    <article key={applicant.id} className="flex flex-col gap-4 rounded-xl border border-[#e6e1e1] bg-white p-5 shadow-[0_4px_12px_rgba(90,63,71,0.05)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="sr-only">Profile Image</span>
                          {applicant.avatarUrl ? (
                            <img className="h-14 w-14 shrink-0 rounded-full border border-[#e0bec6] object-cover" alt={`${applicant.name} profile`} src={applicant.avatarUrl} />
                          ) : (
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#e0bec6] bg-[#e6e1e1] text-lg font-bold text-[#594047]">{applicant.name.charAt(0)}</div>
                          )}
                          <div className="min-w-0">
                            <span className="sr-only">Candidate Name</span>
                            <h3 className="truncate text-lg font-bold text-[#1c1b1b]">{applicant.name}</h3>
                            <p className="truncate text-xs font-medium text-[#594047]">{applicant.appliedJobTitle}</p>
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusLabel === 'Hired' ? 'bg-emerald-100 text-emerald-800' : statusLabel === 'Rejected' ? 'bg-rose-50 text-rose-700' : statusLabel === 'Shortlisted' ? 'bg-[#f2dde9] text-[#8e004b]' : 'bg-[#ffd9e2] text-[#3e001e]'}`}>{statusLabel}</span>
                      </div>

                      <dl className="space-y-3 border-y border-[#f1edec] py-4">
                        <div>
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8c7077]">Mobile / Email</dt>
                          <dd className="mt-1 space-y-1 text-sm font-semibold text-[#1c1b1b]">
                            <a href={`tel:${applicant.phone}`} className="block truncate hover:text-[#8e004b] hover:underline">{applicant.phone || 'Mobile not provided'}</a>
                            <a href={`mailto:${applicant.email}`} className="block truncate hover:text-[#8e004b] hover:underline">{applicant.email || 'Email not provided'}</a>
                          </dd>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8c7077]">Experience</dt><dd className="mt-1 text-sm font-bold text-[#1c1b1b]">{applicant.experienceYears} years</dd></div>
                          <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8c7077]">Applied Date</dt><dd className="mt-1 text-sm font-bold text-[#1c1b1b]">{applicant.appliedDate}</dd></div>
                        </div>
                        <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8c7077]">Preferred Location</dt><dd className="mt-1 text-sm font-bold text-[#1c1b1b]">{applicant.location || 'Not specified'}</dd></div>
                        <div>
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8c7077]">Skills</dt>
                          <dd className="mt-2 flex flex-wrap gap-1.5">
                            {(applicant.skills || []).length > 0 ? applicant.skills?.map((skill) => <span key={skill} className="rounded-full bg-[#f2dde9] px-2.5 py-1 text-xs font-semibold text-[#3e001e]">{skill}</span>) : <span className="text-sm text-[#594047]">Not specified</span>}
                          </dd>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8c7077]">Application Status</dt><dd className="mt-1 text-sm font-bold text-[#8e004b]">{statusLabel}</dd></div>
                          <div>
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8c7077]">Resume</dt>
                            <dd className="mt-1">
                              {applicant.resumeStoragePath ? (
                                <button type="button" disabled={downloadingResumeId === applicant.id} onClick={() => void handleResumeDownload(applicant)} className="text-sm font-bold text-[#8e004b] hover:underline disabled:opacity-60">{downloadingResumeId === applicant.id ? 'Preparing…' : 'Resume Download'}</button>
                              ) : <span className="text-sm text-[#594047]">Not uploaded</span>}
                            </dd>
                          </div>
                        </div>
                      </dl>

                      <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#8c7077]">Employer Actions</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" disabled={busy || applicant.status !== 'New'} onClick={() => void handleApplicationStatus(applicant, 'Viewed')} className="rounded-full border border-[#e0bec6] px-3 py-2 text-xs font-bold text-[#8e004b] hover:bg-[#f7f2f2] disabled:opacity-50">Mark Under Review</button>
                          <button type="button" disabled={busy || !['New', 'Viewed'].includes(applicant.status)} onClick={() => void handleApplicationStatus(applicant, 'Shortlisted')} className="rounded-full border border-[#e0bec6] px-3 py-2 text-xs font-bold text-[#8e004b] hover:bg-[#f7f2f2] disabled:opacity-50">Shortlist</button>
                          <button type="button" disabled={busy || applicant.status === 'Declined' || applicant.status === 'Hired'} onClick={() => void handleApplicationStatus(applicant, 'Declined')} className="rounded-full border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Reject</button>
                          <button type="button" title={applicant.status === 'Offer Extended' ? 'Mark candidate as hired after offer acceptance' : 'Hiring is available after the candidate accepts an offer'} disabled={busy || applicant.status !== 'Offer Extended'} onClick={() => void handleApplicationStatus(applicant, 'Hired')} className="rounded-full bg-[#e2007c] px-3 py-2 text-xs font-bold text-white hover:bg-[#b50062] disabled:opacity-50">{busy ? 'Updating…' : 'Hire'}</button>
                        </div>
                        {(applicant.status === 'Shortlisted' || applicant.status === 'Interview Scheduled') && (
                          <button
                            type="button"
                            onClick={() => {
                              if (applicant.status === 'Shortlisted') {
                                setSelectedApplicant(applicant);
                                setScheduleError(null);
                                setShowScheduleModal(true);
                              } else {
                                setOfferingApplicant(applicant);
                              }
                            }}
                            className="mt-2 w-full rounded-full border border-[#8e004b] px-3 py-2 text-xs font-bold text-[#8e004b] hover:bg-[#f2dde9]"
                          >
                            {applicant.status === 'Shortlisted' ? 'Schedule Interview' : 'Make Offer'}
                          </button>
                        )}
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {phoneDigits ? <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer" className="rounded-full border border-emerald-200 px-3 py-2 text-center text-xs font-bold text-emerald-700 hover:bg-emerald-50">WhatsApp Candidate</a> : <span className="rounded-full border border-[#e0bec6] px-3 py-2 text-center text-xs font-bold text-[#8c7077] opacity-60">WhatsApp Candidate</span>}
                          {applicant.phone ? <a href={`tel:${applicant.phone}`} className="rounded-full border border-[#e0bec6] px-3 py-2 text-center text-xs font-bold text-[#8e004b] hover:bg-[#f7f2f2]">Call Candidate</a> : <span className="rounded-full border border-[#e0bec6] px-3 py-2 text-center text-xs font-bold text-[#8c7077] opacity-60">Call Candidate</span>}
                        </div>
                      </div>
                    </article>
                  );
                })}

                {filteredApplicants.length === 0 && (
                  <div className="col-span-full rounded-2xl border-2 border-dashed border-[#e0bec6] py-14 text-center">
                    <p className="font-semibold text-[#594047]">No applications received for this job yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: INTERVIEWS */}
          {activeTab === 'interviews' && (
            <EmployerInterviewsTab
              applicants={applicants}
              onRescheduleInterview={onRescheduleInterview}
              onCompleteInterview={onCompleteInterview}
            />
          )}

          {/* TAB: MESSAGES */}
          {activeTab === 'messages' && (
            <MessagingCenter
              currentRole="employer"
              userProfile={userProfile}
              conversations={conversations}
              messages={messages}
              jobs={jobs}
              activeConversationId={activeConvId}
              onSelectConversation={(id) => setActiveConvId(id)}
              onSendMessage={(convId, text, attachment) => {
                if (onSendMessage) {
                  onSendMessage(convId, text, attachment);
                }
              }}
            />
          )}

          {/* TAB: ANALYTICS */}
          {activeTab === 'analytics' && (
            <RegionalSalaryAnalytics jobs={jobs} defaultRegion={userProfile.location || 'Beverly Hills, CA'} />
          )}

          {/* TAB: PROFILE */}
          {activeTab === 'profile' && (
            <EmployerProfileTab
              userProfile={userProfile}
              onUpdateAvatar={(url) => setShowImageUploader(true)}
              onUpdateProfile={onUpdateProfile}
              onLogout={() => setShowLogoutModal(true)}
            />
          )}

        </main>
      </div>

      {/* BottomNavBar (Mobile) */}
      <nav className="md:hidden fixed bottom-0 w-full z-50 rounded-t-xl border-t border-[#e0bec6] bg-white shadow-[0_-4px_12px_rgba(90,63,71,0.05)] flex justify-around items-center px-2 py-3 pb-safe">
        <MobileNavItem icon={LayoutDashboard} label="Dashboard" tab="dashboard" filledIcon />
        <MobileNavItem icon={Briefcase} label="Jobs" tab="jobs" />
        <MobileNavItem icon={FileText} label="Apps" tab="candidates" />
        <MobileNavItem icon={Calendar} label="Interviews" tab="interviews" />
        <MobileNavItem icon={Building2} label="Profile" tab="profile" />
      </nav>

      {/* MODALS */}
      {/* POST NEW JOB WIZARD */}
      {showPostModal && (
        <PostJobWizard
          key={editingJob?.id || 'new-job'}
          initialJob={editingJob}
          initialBusinessName={userProfile.businessName}
          initialContactPerson={userProfile.contactPerson || userProfile.name}
          initialContactMobile={userProfile.phone}
          initialCity={userProfile.city || userProfile.location?.split(',')[0]?.trim()}
          onClose={() => { setEditingJob(null); setShowPostModal(false); onPostJobFlowExit?.('jobs'); }}
          onComplete={async (newJobPartial) => {
            const job: JobPosting = {
              ...(editingJob || {}),
              id: editingJob?.id || `job-${Date.now()}`,
              title: newJobPartial.title || editingJob?.title || 'New Position',
              salonName: newJobPartial.businessName || editingJob?.salonName || userProfile.businessName || 'Salon',
              salonLogo: editingJob?.salonLogo || userProfile.avatarUrl,
              location: newJobPartial.location || editingJob?.location || 'Location not specified',
              image: editingJob?.image || '',
              rating: editingJob?.rating || 0,
              reviewsCount: editingJob?.reviewsCount || 0,
              salary: newJobPartial.salary || editingJob?.salary || 'Salary not specified',
              jobType: newJobPartial.jobType || editingJob?.jobType || 'Full-time',
              category: newJobPartial.category || editingJob?.category || 'Hair',
              tags: newJobPartial.tags || editingJob?.tags || ['New Listing'],
              description: newJobPartial.description || editingJob?.description || '',
              requirements: newJobPartial.requirements || editingJob?.requirements || [],
              benefits: newJobPartial.benefits || editingJob?.benefits || ['Benefits discussed during interview'],
              postedDate: editingJob?.postedDate || 'Just now',
              isBookmarked: false,
              isFeatured: editingJob?.isFeatured ?? true,
              activeApplicantsCount: editingJob?.activeApplicantsCount || 0,
              ...newJobPartial,
            };
            return editingJob ? onUpdateJob(job) : onAddJob(job);
          }}
          onPostAnother={() => setEditingJob(null)}
          onViewJobPosts={() => {
            setEditingJob(null);
            setShowPostModal(false);
            setActiveTab('jobs');
            onPostJobFlowExit?.('jobs');
          }}
          onViewApplications={() => {
            setEditingJob(null);
            setShowPostModal(false);
            setCandidateFilter('All');
            setActiveTab('candidates');
            onPostJobFlowExit?.('candidates');
          }}
        />
      )}

      {/* SCHEDULE INTERVIEW MODAL */}
      {showScheduleModal && selectedApplicant && (
        <RequestInterviewScreen
          applicantName={selectedApplicant.name}
          applicantJobTitle={selectedApplicant.appliedJobTitle}
          applicantExp={selectedApplicant.experienceYears}
          applicantAvatar={selectedApplicant.avatarUrl}
          onClose={closeScheduleModal}
          onConfirm={handleScheduleConfirm}
          isSubmitting={isScheduling}
          serverError={scheduleError}
        />
      )}

      {/* PROFILE HEADSHOT UPLOADER MODAL */}
      {showImageUploader && (
        <ProfileImageUploader
          currentAvatar={userProfile.avatarUrl}
          userName={userProfile.name}
          onSaveAvatar={(newUrl) => onUpdateAvatar?.(newUrl)}
          onClose={() => setShowImageUploader(false)}
        />
      )}

      {/* CANDIDATE PORTFOLIO MODAL */}
      {viewingPortfolioApplicant && (
        <div className="fixed inset-0 z-[60] bg-[#1c1b1b]/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-5 md:p-8 border border-[#e0bec6] shadow-2xl space-y-8 my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-[#e0bec6]/50">
              <div className="flex items-center gap-4">
                <img
                  src={viewingPortfolioApplicant.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120'}
                  alt={viewingPortfolioApplicant.name}
                  className="w-14 h-14 rounded-full object-cover ring-2 ring-[#ffd9e2]"
                />
                <div>
                  <h3 className="text-xl font-bold text-[#1c1b1b]">
                    {viewingPortfolioApplicant.name}&apos;s Portfolio
                  </h3>
                  <p className="text-[13px] text-[#594047]">
                    Applicant for <span className="font-bold text-[#8e004b]">{viewingPortfolioApplicant.appliedJobTitle}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setViewingPortfolioApplicant(null)}
                className="p-2 text-[#594047] hover:text-[#1c1b1b] rounded-full hover:bg-[#f1edec] transition-colors cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {applicantPortfolioLoading ? (
              <p className="text-center text-[13px] text-[#594047] py-10">Loading {viewingPortfolioApplicant.name.split(' ')[0]}&apos;s portfolio…</p>
            ) : applicantPortfolio.length === 0 ? (
              <p className="text-center text-[13px] text-[#594047] py-10">
                {viewingPortfolioApplicant.name.split(' ')[0]} hasn&apos;t added portfolio work yet.
              </p>
            ) : (
              <PortfolioGallery
                items={applicantPortfolio}
                onUpdateItems={() => {}}
                isEditable={false}
              />
            )}

            <div className="flex justify-end pt-4 border-t border-[#e0bec6]/50">
              <button
                onClick={() => setViewingPortfolioApplicant(null)}
                className="px-8 py-3 bg-[#8e004b] text-white text-[13px] font-bold rounded-full hover:bg-[#b90064] transition-colors cursor-pointer"
              >
                Close Portfolio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE JOB OFFER MODAL */}
      {offeringApplicant && (
        <CreateJobOfferScreen
          applicant={offeringApplicant}
          onClose={() => setOfferingApplicant(null)}
          onSendOffer={(details) => {
            // The backend records the offer and moves the application to
            // `offer_sent`; the candidate acceptance is what later unlocks
            // 'Hired' on this applicant.
            onSendOffer?.(offeringApplicant.id, details);
            setHiredOfferDetails(details);
            setHiredApplicant(offeringApplicant);
            setOfferingApplicant(null);
          }}
        />
      )}

      {/* HIRING SUCCESS SCREEN */}
      {hiredApplicant && (
        <HiringSuccessScreen
          applicant={hiredApplicant}
          offerDetails={hiredOfferDetails}
          onClose={() => {
            setHiredApplicant(null);
            setHiredOfferDetails(null);
          }}
          onViewProfile={() => {
            const applicant = hiredApplicant;
            setHiredApplicant(null);
            setHiredOfferDetails(null);
            setViewingPortfolioApplicant(applicant);
          }}
        />
      )}

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutModal && (
        <LogoutConfirmationModal
          onClose={() => setShowLogoutModal(false)}
          onLogout={() => {
            setShowLogoutModal(false);
            onLogout();
          }}
        />
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { JobPosting, Applicant, UserProfile, Conversation, ChatMessage } from '../../types';
import { ProfileImageUploader } from '../profile/ProfileImageUploader';
import { MessagingCenter } from '../messaging/MessagingCenter';
import { PortfolioGallery } from '../profile/PortfolioGallery';
import { RegionalSalaryAnalytics } from './RegionalSalaryAnalytics';
import { INITIAL_PORTFOLIO_ITEMS } from '../../data/mockData';
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
  CheckCircle2,
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
  ArrowLeft,
  MoreVertical
} from 'lucide-react';

interface EmployerWorkspaceProps {
  jobs: JobPosting[];
  applicants: Applicant[];
  conversations?: Conversation[];
  messages?: ChatMessage[];
  userProfile: UserProfile;
  onAddJob: (newJob: JobPosting) => void;
  onUpdateApplicantStatus: (applicantId: string, status: Applicant['status']) => void;
  onSendMessage?: (conversationId: string, text: string, attachment?: { name: string; url: string; type: 'image' | 'file' }) => void;
  onStartConversation?: (jobId: string, targetSeekerName?: string, targetSalonName?: string) => string;
  onUpdateAvatar?: (newAvatarUrl: string | undefined) => void;
  onLogout: () => void;
}

export const EmployerWorkspace: React.FC<EmployerWorkspaceProps> = ({
  jobs,
  applicants,
  conversations = [],
  messages = [],
  userProfile,
  onAddJob,
  onUpdateApplicantStatus,
  onSendMessage,
  onStartConversation,
  onUpdateAvatar,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'jobs' | 'candidates' | 'interviews' | 'messages' | 'analytics' | 'profile'>('dashboard');
  const [activeConvId, setActiveConvId] = useState<string | undefined>(undefined);
  const [showPostModal, setShowPostModal] = useState<boolean>(false);
  const [showImageUploader, setShowImageUploader] = useState<boolean>(false);
  const [viewingPortfolioApplicant, setViewingPortfolioApplicant] = useState<Applicant | null>(null);
  const [offeringApplicant, setOfferingApplicant] = useState<Applicant | null>(null);
  const [hiredApplicant, setHiredApplicant] = useState<Applicant | null>(null);
  const [hiredOfferDetails, setHiredOfferDetails] = useState<any>(null);
  const [showLogoutModal, setShowLogoutModal] = useState<boolean>(false);

  // New Job Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<JobPosting['category']>('Hair');
  const [jobType, setJobType] = useState<JobPosting['jobType']>('Commission');
  const [salary, setSalary] = useState('₹5,00,000 - ₹7,00,000/year');
  const [location, setLocation] = useState('Beverly Hills, CA');
  const [description, setDescription] = useState('We are hiring a dedicated beauty professional to join our salon team...');
  const [requirements, setRequirements] = useState('Valid State License, 2+ years experience');
  const [benefits, setBenefits] = useState('Health Insurance, Paid Masterclasses, Product Discounts');

  // Candidate Filter State
  const [candidateFilter, setCandidateFilter] = useState<string>('All');
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [interviewTime, setInterviewTime] = useState<string>('Tuesday, Aug 12 at 2:00 PM');

  const filteredApplicants = applicants.filter((a) => {
    if (candidateFilter === 'All') return true;
    return a.status === candidateFilter;
  });

  const handlePostJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    const newJob: JobPosting = {
      id: `job-${Date.now()}`,
      title,
      salonName: userProfile.businessName || 'Luxe & Co Salon Group',
      salonLogo: userProfile.avatarUrl || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=120&h=120',
      location,
      image: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&q=80&w=800',
      rating: 5.0,
      reviewsCount: 1,
      salary,
      jobType,
      category,
      tags: ['New Listing', 'Flexible Hours', 'Health Benefits'],
      description,
      requirements: requirements.split(',').map((r) => r.trim()),
      benefits: benefits.split(',').map((b) => b.trim()),
      postedDate: 'Just now',
      isBookmarked: false,
      isFeatured: true,
      activeApplicantsCount: 0,
    };

    onAddJob(newJob);
    setShowPostModal(false);
    setTitle('');
  };

  const handleScheduleConfirm = () => {
    if (selectedApplicant) {
      onUpdateApplicantStatus(selectedApplicant.id, 'Interview Scheduled');
      setShowScheduleModal(false);
      setSelectedApplicant(null);
    }
  };

  const NavItem = ({ icon: Icon, label, tab, filledIcon = false }: { icon: any, label: string, tab: any, filledIcon?: boolean }) => {
    const isActive = activeTab === tab;
    
    return (
      <button 
        onClick={() => setActiveTab(tab)}
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
        onClick={() => setActiveTab(tab)}
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
                  <span className="text-[13px] font-medium text-[#594047] mt-1">Active Jobs</span>
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
                  onClick={() => setShowPostModal(true)}
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
                <h2 className="text-2xl md:text-[24px] font-semibold tracking-tight text-[#8e004b]">Your Jobs</h2>
                <button
                  onClick={() => setShowPostModal(true)}
                  className="hidden md:flex bg-[#e2007c] text-white px-4 py-2 rounded-full text-[13px] font-medium items-center gap-1 hover:bg-[#b50062] transition-colors shadow-sm cursor-pointer"
                >
                  <Plus className="w-5 h-5" /> Post Job
                </button>
              </div>
  
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="overflow-x-auto hide-scrollbar -mx-5 px-5 md:mx-0 md:px-0">
                  <div className="flex gap-2 min-w-max pb-1">
                    <button className="bg-[#f2dde9] text-[#8e004b] px-4 py-2 rounded-full text-[13px] font-semibold border border-transparent cursor-pointer">Active ({jobs.length})</button>
                    <button className="bg-[#f1edec] text-[#594047] px-4 py-2 rounded-full text-[13px] font-medium hover:bg-[#ece7e7] transition-colors border border-transparent cursor-pointer">Draft (3)</button>
                    <button className="bg-[#f1edec] text-[#594047] px-4 py-2 rounded-full text-[13px] font-medium hover:bg-[#ece7e7] transition-colors border border-transparent cursor-pointer">Paused (1)</button>
                    <button className="bg-[#f1edec] text-[#594047] px-4 py-2 rounded-full text-[13px] font-medium hover:bg-[#ece7e7] transition-colors border border-transparent cursor-pointer">Closed (45)</button>
                  </div>
                </div>
                <button 
                  onClick={() => setShowPostModal(true)}
                  className="md:hidden w-full bg-[#e2007c] text-white py-3 rounded-full text-[13px] font-medium items-center justify-center flex gap-2 hover:bg-[#b50062] transition-colors shadow-sm cursor-pointer"
                >
                  <Plus className="w-5 h-5" /> Post a New Job
                </button>
              </div>
  
              <div className="flex flex-col gap-4">
                {jobs.map((job) => {
                  const jobApplicants = applicants.filter((a) => a.appliedJobId === job.id);
                  const shortlisted = jobApplicants.filter(a => a.status === 'Shortlisted').length;
                  const interviewing = jobApplicants.filter(a => a.status === 'Interview Scheduled').length;
                  
                  return (
                    <div
                      key={job.id}
                      className="bg-white rounded-lg border border-[#e8e8e8] p-4 md:p-6 shadow-[0_4px_12px_rgba(90,63,71,0.02)] hover:shadow-[0_4px_12px_rgba(90,63,71,0.05)] transition-shadow relative group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                            </span>
                            <span className="text-xs text-[#594047]">{job.postedDate}</span>
                          </div>
                          <h2 className="text-[18px] font-semibold text-[#1c1b1b] leading-tight">{job.title}</h2>
                          <p className="text-sm text-[#594047] mt-1 truncate max-w-full">{job.location} • {job.jobType} • {job.salary}</p>
                        </div>
                        <button className="text-[#594047] p-1 hover:bg-[#f1edec] rounded-full transition-colors cursor-pointer shrink-0">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </div>
                      
                      <div className="flex flex-wrap gap-4 md:gap-6 mt-4 pt-4 border-t border-[#e8e8e8]">
                        <div className="flex flex-col">
                          <span className="text-[20px] font-semibold text-[#8e004b]">{jobApplicants.length || job.activeApplicantsCount || 0}</span>
                          <span className="text-[13px] font-medium text-[#594047]">Applicants</span>
                        </div>
                        <div className="w-px bg-[#e8e8e8] hidden sm:block"></div>
                        <div className="flex flex-col">
                          <span className="text-[20px] font-semibold text-[#b50062]">{shortlisted}</span>
                          <span className="text-[13px] font-medium text-[#594047]">Shortlisted</span>
                        </div>
                        <div className="w-px bg-[#e8e8e8] hidden sm:block"></div>
                        <div className="flex flex-col">
                          <span className="text-[20px] font-semibold text-[#1c1b1b]">{interviewing}</span>
                          <span className="text-[13px] font-medium text-[#594047]">Interviewing</span>
                        </div>
                        <div className="flex-1 flex justify-end items-center mt-2 sm:mt-0">
                          <button 
                            onClick={() => {
                              setActiveTab('candidates');
                            }}
                            className="text-[#b50062] text-[13px] font-semibold hover:underline cursor-pointer"
                          >
                            View Candidates →
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {jobs.length === 0 && (
                  <div className="py-12 text-center border-2 border-dashed border-[#e0bec6] rounded-2xl">
                     <p className="text-[#594047]">No jobs posted yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: CANDIDATES */}
          {activeTab === 'candidates' && (
            <div className="flex flex-col w-full h-full pb-24 md:pb-0">
              <div className="flex justify-between items-center mb-8 px-5 md:px-0">
                <h2 className="text-2xl md:text-[24px] font-semibold tracking-tight text-[#8e004b]">Applications</h2>
                <div className="flex items-center gap-2">
                  <button className="text-[#8e004b] hover:bg-[#e6e1e1] transition-colors p-2 rounded-full active:scale-95 flex items-center justify-center">
                    <span className="material-symbols-outlined">search</span>
                  </button>
                  <button className="text-[#8e004b] hover:bg-[#e6e1e1] transition-colors p-2 rounded-full active:scale-95 flex items-center justify-center">
                    <span className="material-symbols-outlined">filter_list</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Tab Bar */}
              <div className="overflow-x-auto hide-scrollbar -mx-5 px-5 md:mx-0 md:px-0 mb-8">
                <div className="flex gap-2 min-w-max pb-1">
                  {['All', 'New', 'Viewed', 'Shortlisted', 'Interview Scheduled', 'Hired'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setCandidateFilter(st)}
                      className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[13px] font-medium transition-all shadow-sm cursor-pointer ${
                        candidateFilter === st
                          ? 'bg-[#e2007c] text-white border border-transparent'
                          : 'bg-[#f7f2f2] text-[#594047] border border-[#e0bec6] hover:bg-[#ece7e7]'
                      }`}
                    >
                      {st} ({st === 'All' ? applicants.length : applicants.filter(a => a.status === st).length})
                    </button>
                  ))}
                </div>
              </div>

              {/* Bento Grid Approach for Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-5 md:px-0">
                {filteredApplicants.map((applicant) => (
                  <article
                    key={applicant.id}
                    className="bg-white rounded-lg border border-[#e6e1e1] shadow-[0_4px_12px_rgba(90,63,71,0.05)] p-4 flex flex-col gap-4 hover:shadow-md transition-shadow relative group"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex gap-3 items-center">
                        {applicant.avatarUrl ? (
                          <img
                            className="w-12 h-12 rounded-full object-cover border border-[#e0bec6]"
                            alt={applicant.name}
                            src={applicant.avatarUrl}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-[#e6e1e1] flex items-center justify-center border border-[#e0bec6] text-[#594047] font-semibold text-lg">
                            {applicant.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <h2 className="text-[18px] font-semibold text-[#1c1b1b] leading-tight">{applicant.name}</h2>
                          <p className="text-[#594047] text-[13px] font-medium">{applicant.appliedJobTitle}</p>
                        </div>
                      </div>
                      
                      {/* Status Badge */}
                      <span className={`text-[13px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        applicant.status === 'New' ? 'bg-[#ffdad6] text-[#93000a]' :
                        applicant.status === 'Shortlisted' ? 'bg-[#f2dde9] text-[#51434c]' :
                        applicant.status === 'Interview Scheduled' ? 'bg-[#ffcbd9] text-[#3e001e]' :
                        applicant.status === 'Hired' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-[#e6e1e1] text-[#594047]' // default/viewed
                      }`}>
                        {applicant.status === 'New' && <span className="w-1.5 h-1.5 bg-[#ba1a1a] rounded-full"></span>}
                        {applicant.status === 'Shortlisted' && <span className="material-symbols-outlined text-[14px]">star</span>}
                        {applicant.status !== 'New' && applicant.status !== 'Shortlisted' && <span className="material-symbols-outlined text-[14px]">visibility</span>}
                        {applicant.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 py-2 border-y border-[#e6e1e1]">
                      <div className="flex items-center gap-1.5 text-[#594047]">
                        <span className="material-symbols-outlined text-[18px]">work_history</span>
                        <span className="text-[13px] font-medium">{applicant.experienceYears} Years Exp.</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#594047]">
                        <span className="material-symbols-outlined text-[18px]">location_on</span>
                        <span className="text-[13px] font-medium truncate">{applicant.location || 'Beverly Hills, CA'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#594047] col-span-2">
                        <span className="material-symbols-outlined text-[18px]">schedule</span>
                        <span className="text-[13px] font-medium">Applied {applicant.appliedDate}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(applicant.skills || ['Balayage', 'Styling']).map((skill, index) => (
                        <span key={index} className="bg-[#f2dde9] text-[#241820] text-[13px] font-medium px-2 py-1 rounded-full">
                          {skill}
                        </span>
                      ))}
                    </div>

                    <div className="mt-auto flex flex-col gap-2">
                      <select
                        value={applicant.status}
                        onChange={(e) =>
                          onUpdateApplicantStatus(applicant.id, e.target.value as Applicant['status'])
                        }
                        className="w-full text-[13px] font-semibold bg-[#f7f2f2] text-[#8e004b] rounded-full px-4 py-2 border border-[#e0bec6] outline-none cursor-pointer text-center appearance-none"
                      >
                        <option value="New">Status: New</option>
                        <option value="Viewed">Status: Viewed</option>
                        <option value="Shortlisted">Status: Shortlisted</option>
                        <option value="Interview Scheduled">Status: Interviewing</option>
                        <option value="Hired">Status: Hired</option>
                        <option value="Declined">Status: Declined</option>
                      </select>
                      
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => setViewingPortfolioApplicant(applicant)}
                          className={`flex-1 rounded-full py-3 text-[13px] font-semibold transition-colors active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${
                            applicant.status === 'New'
                              ? 'bg-[#e2007c] text-white hover:bg-[#b50062]'
                              : 'bg-[#ece7e7] text-[#1c1b1b] hover:bg-[#e6e1e1] border border-[#e0bec6]'
                          }`}
                        >
                          View
                          {applicant.status === 'New' && <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
                        </button>
                        {applicant.status === 'Interview Scheduled' && (
                          <button
                            onClick={() => setOfferingApplicant(applicant)}
                            className="flex-1 rounded-full py-3 text-[13px] font-semibold text-white bg-[#8e004b] hover:bg-[#b90064] transition-colors active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#8e004b]/20"
                          >
                            Make Offer
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
                
                {filteredApplicants.length === 0 && (
                  <div className="col-span-1 md:col-span-2 lg:col-span-3 py-12 text-center border-2 border-dashed border-[#e0bec6] rounded-2xl">
                    <p className="text-[#594047]">No candidates found.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: INTERVIEWS */}
          {activeTab === 'interviews' && (
            <EmployerInterviewsTab applicants={applicants} />
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
          onClose={() => setShowPostModal(false)}
          onComplete={(newJobPartial) => {
            const newJob: JobPosting = {
              id: `job-${Date.now()}`,
              title: newJobPartial.title || 'New Position',
              salonName: userProfile.businessName || 'Luxe & Co Salon Group',
              salonLogo: userProfile.avatarUrl || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=120&h=120',
              location: newJobPartial.location || 'Beverly Hills, CA',
              image: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&q=80&w=800',
              rating: 5.0,
              reviewsCount: 1,
              salary: newJobPartial.salary || '₹5,00,000 - ₹7,00,000/year',
              jobType: newJobPartial.jobType || 'Commission',
              category: newJobPartial.category || 'Hair',
              tags: ['New Listing', 'Flexible Hours', 'Health Benefits'],
              description: newJobPartial.description || 'We are hiring a dedicated beauty professional to join our salon team...',
              requirements: newJobPartial.requirements || ['Valid State License', '2+ years experience'],
              benefits: newJobPartial.benefits || ['Health Insurance', 'Paid Masterclasses', 'Product Discounts'],
              postedDate: 'Just now',
              isBookmarked: false,
              isFeatured: true,
              activeApplicantsCount: 0,
            };
            onAddJob(newJob);
            setShowPostModal(false);
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
          onClose={() => setShowScheduleModal(false)}
          onConfirm={handleScheduleConfirm}
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

            <PortfolioGallery
              items={INITIAL_PORTFOLIO_ITEMS}
              onUpdateItems={() => {}}
              isEditable={false}
            />

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
            // Update the applicant status to 'Offer Extended' or 'Hired'
            onUpdateApplicantStatus(offeringApplicant.id, 'Hired');
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

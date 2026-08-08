import React, { useState, useEffect } from 'react';
import { JobPosting, Application, UserProfile, Conversation, ChatMessage, PortfolioItem, SavedFilter, JobAlertNotification } from '../../types';
import { ProfileImageUploader } from '../profile/ProfileImageUploader';
import { MessagingCenter } from '../messaging/MessagingCenter';
import { PortfolioGallery } from '../profile/PortfolioGallery';
import { ResumePreview } from './ResumePreview';
import { SeekerProfileTab } from './SeekerProfileTab';
import { INITIAL_PORTFOLIO_ITEMS, INITIAL_SAVED_FILTERS, INITIAL_JOB_ALERTS } from '../../data/mockData';
import { processNewJobForAlerts } from '../../utils/jobAlertMatcher';
import {
  Search,
  MapPin,
  Bookmark,
  BookmarkCheck,
  BookmarkPlus,
  Briefcase,
  Star,
  Clock,
  Filter,
  CheckCircle2,
  FileText,
  User as UserIcon,
  X,
  Send,
  Building2,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Calendar,
  LogOut,
  Plus,
  DollarSign,
  SlidersHorizontal,
  ArrowUpDown,
  Tag,
  RotateCcw,
  Camera,
  MessageSquare,
  Trash2,
  Bell,
  BellRing,
  CheckCheck,
  Volume2,
  Smartphone,
  Mail,
  Radio,
  Upload,
  Eye,
  Download,
  Mic,
  MicOff,
  User,
  HelpCircle
} from 'lucide-react';

interface JobSeekerWorkspaceProps {
  jobs: JobPosting[];
  applications: Application[];
  conversations?: Conversation[];
  messages?: ChatMessage[];
  userProfile: UserProfile;
  jobAlerts?: JobAlertNotification[];
  onToggleBookmark: (jobId: string) => void;
  onApplyJob: (job: JobPosting, coverNote: string) => void;
  onSendMessage?: (conversationId: string, text: string, attachment?: { name: string; url: string; type: 'image' | 'file' }) => void;
  onStartConversation?: (jobId: string, targetSeekerName?: string, targetSalonName?: string) => string;
  onUpdateAvatar?: (newAvatarUrl: string | undefined) => void;
  onUpdateProfile?: (updatedProfile: UserProfile) => void;
  onMarkAlertRead?: (alertId: string) => void;
  onMarkAllAlertsRead?: () => void;
  onClearAlert?: (alertId: string) => void;
  onSwitchRole: () => void;
  onLogout: () => void;
  onStartApplyJob?: (job: JobPosting) => void;
  initialTab?: 'feed' | 'applications' | 'saved' | 'messages' | 'portfolio' | 'profile';
  onViewInvitation?: (application: Application) => void;
  onViewOffer?: (application: Application) => void;
  onNavigateScreen?: (screen: any) => void;
}

export const JobSeekerWorkspace: React.FC<JobSeekerWorkspaceProps> = ({
  jobs,
  applications,
  conversations = [],
  messages = [],
  userProfile,
  jobAlerts = INITIAL_JOB_ALERTS,
  onToggleBookmark,
  onApplyJob,
  onSendMessage,
  onStartConversation,
  onUpdateAvatar,
  onUpdateProfile,
  onMarkAlertRead,
  onMarkAllAlertsRead,
  onClearAlert,
  onSwitchRole,
  onLogout,
  onStartApplyJob,
  initialTab,
  onViewInvitation,
  onViewOffer,
  onNavigateScreen,
}) => {
  const [activeTab, setActiveTab] = useState<'feed' | 'applications' | 'saved' | 'messages' | 'portfolio' | 'profile'>(initialTab || 'feed');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const [activeConvId, setActiveConvId] = useState<string | undefined>(undefined);
  const [showImageUploader, setShowImageUploader] = useState<boolean>(false);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>(
    userProfile.portfolioItems || INITIAL_PORTFOLIO_ITEMS
  );
  const [workspaceResumeName, setWorkspaceResumeName] = useState<string>('Jane_Doe_Beauty_CV_2026.pdf');
  const [resumeFileUrl, setResumeFileUrl] = useState<string | null>(null);
  const [showResumePreviewModal, setShowResumePreviewModal] = useState<boolean>(false);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [isJustUploaded, setIsJustUploaded] = useState<boolean>(false);
  
  // Job Alerts Push Notification State
  const [alertsList, setAlertsList] = useState<JobAlertNotification[]>(jobAlerts);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState<boolean>(false);
  const [pushEnabled, setPushEnabled] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  
  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [locationFilter, setLocationFilter] = useState<string>('All Locations');
  const [jobTypeFilter, setJobTypeFilter] = useState<string>('All Types');
  const [salaryFilter, setSalaryFilter] = useState<string>('All Salaries');
  const [selectedTag, setSelectedTag] = useState<string>('All Perks');
  const [sortBy, setSortBy] = useState<'relevant' | 'salary_high' | 'rating_high' | 'newest'>('relevant');
  const [showSavedAd, setShowSavedAd] = useState<boolean>(true);

  // Saved Search Filters State
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(
    userProfile.savedFilters || INITIAL_SAVED_FILTERS
  );
  const [showSaveFilterModal, setShowSaveFilterModal] = useState<boolean>(false);
  const [newFilterNameInput, setNewFilterNameInput] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);

  const startVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Speech recognition is not supported in this browser.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsListening(true);
    showToast('Listening for voice search... Speak now!');

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
      setIsListening(false);
      showToast(`Voice search: "${transcript}"`);
    };

    recognition.onerror = () => {
      setIsListening(false);
      showToast('Voice search error or permission denied.');
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const unreadAlertsCount = alertsList.filter((a) => !a.isRead).length;

  const handleMarkSingleRead = (alertId: string) => {
    setAlertsList((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, isRead: true } : a))
    );
    if (onMarkAlertRead) onMarkAlertRead(alertId);
  };

  const handleMarkAllRead = () => {
    setAlertsList((prev) => prev.map((a) => ({ ...a, isRead: true })));
    if (onMarkAllAlertsRead) onMarkAllAlertsRead();
    showToast('All job match alerts marked as read');
  };

  const handleDeleteAlert = (alertId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setAlertsList((prev) => prev.filter((a) => a.id !== alertId));
    if (onClearAlert) onClearAlert(alertId);
    showToast('Match notification removed');
  };

  const handleToggleFilterNotification = (filterId: string, channel: 'push' | 'email' | 'inApp') => {
    setSavedFilters((prev) =>
      prev.map((sf) => {
        if (sf.id === filterId) {
          if (channel === 'push') return { ...sf, notifyPush: !sf.notifyPush };
          if (channel === 'email') return { ...sf, notifyEmail: !sf.notifyEmail };
          if (channel === 'inApp') return { ...sf, notifyInApp: !sf.notifyInApp };
        }
        return sf;
      })
    );
    showToast('Notification preference updated');
  };

  // Live Push Alert Simulation Engine Trigger
  const handleSimulateNewMatchAlert = () => {
    const targetFilter = savedFilters[0] || INITIAL_SAVED_FILTERS[0];
    const simulatedJob: JobPosting = {
      id: `job-sim-${Date.now()}`,
      title: 'Lead Colorist & Senior Stylist',
      salonName: 'Maison de Beauté Beverly Hills',
      location: 'Beverly Hills, CA',
      image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80',
      rating: 4.9,
      reviewsCount: 38,
      salary: '$85,000 - $120,000/yr',
      jobType: 'Full-time',
      category: (targetFilter.category && targetFilter.category !== 'All' ? targetFilter.category : 'Hair') as any,
      tags: ['Balayage', 'Commission', 'Paid Education', 'Health Benefits'],
      description: 'Prestigious salon searching for an elite Lead Colorist. High client retention, luxury chair setup.',
      requirements: ['5+ years salon experience', 'Valid Cosmetology License', 'Balayage Mastery'],
      benefits: ['Medical & Dental', '401k Matching', '55% Commission Split'],
      postedDate: 'Just now'
    };

    const newAlerts = processNewJobForAlerts(simulatedJob, [targetFilter]);
    if (newAlerts.length > 0) {
      setAlertsList((prev) => [...newAlerts, ...prev]);
      showToast(`🔔 Instant Push Alert: New job match for "${targetFilter.name}"!`);
      setShowNotificationDrawer(true);
    } else {
      showToast('Simulated new job posting checked against saved search filters!');
    }
  };

  const handleApplySavedFilter = (sf: SavedFilter) => {
    setSearchQuery(sf.searchQuery || '');
    setSelectedCategory(sf.category || 'All');
    setLocationFilter(sf.location || 'All Locations');
    setJobTypeFilter(sf.jobType || 'All Types');
    setSalaryFilter(sf.salary || 'All Salaries');
    setSelectedTag(sf.tag || 'All Perks');
    if (sf.sortBy) setSortBy(sf.sortBy);
    showToast(`Re-applied saved search: "${sf.name}"`);
  };

  const handleOpenSaveModal = () => {
    let defaultTitle = '';
    if (searchQuery.trim()) {
      defaultTitle = `Search: "${searchQuery.trim()}"`;
    } else if (selectedCategory !== 'All' && locationFilter !== 'All Locations') {
      defaultTitle = `${selectedCategory} in ${locationFilter.split(',')[0]}`;
    } else if (selectedCategory !== 'All') {
      defaultTitle = `${selectedCategory} Positions`;
    } else if (locationFilter !== 'All Locations') {
      defaultTitle = `Jobs in ${locationFilter.split(',')[0]}`;
    } else if (jobTypeFilter !== 'All Types') {
      defaultTitle = `${jobTypeFilter} Jobs`;
    } else {
      defaultTitle = 'My Preferred Beauty Search';
    }
    setNewFilterNameInput(defaultTitle);
    setShowSaveFilterModal(true);
  };

  const handleSaveCurrentFilter = () => {
    if (!newFilterNameInput.trim()) return;
    const newFilter: SavedFilter = {
      id: `sf-${Date.now()}`,
      name: newFilterNameInput.trim(),
      searchQuery,
      category: selectedCategory,
      location: locationFilter,
      jobType: jobTypeFilter,
      salary: salaryFilter,
      tag: selectedTag,
      sortBy,
      createdAt: 'Just Now'
    };
    setSavedFilters([newFilter, ...savedFilters]);
    setShowSaveFilterModal(false);
    showToast(`Saved search filter "${newFilter.name}" to your profile!`);
  };

  const handleDeleteSavedFilter = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const filter = savedFilters.find((f) => f.id === id);
    setSavedFilters(savedFilters.filter((f) => f.id !== id));
    if (filter) {
      showToast(`Removed "${filter.name}" from saved searches.`);
    }
  };

  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  
  // Apply Modal state
  const [showApplyModal, setShowApplyModal] = useState<boolean>(false);
  const [coverNote, setCoverNote] = useState<string>('I am very interested in this role and believe my skills and background align perfectly with your team!');
  const [expectedSalary, setExpectedSalary] = useState<string>('$95,000 / year');
  const [availability, setAvailability] = useState<string>('Immediate (2 weeks notice)');
  const [applySuccess, setApplySuccess] = useState<boolean>(false);

  // Category & Filter Options
  const categories = ['All', 'Hair', 'Skincare', 'Nails', 'Lashes & Brows', 'Massage', 'Management'];
  const locations = ['All Locations', 'Beverly Hills, CA', 'Soho, New York, NY', 'Austin, TX', 'Miami, FL', 'Chicago, IL', 'Seattle, WA'];
  const jobTypes = ['All Types', 'Full-time', 'Commission', 'Chair Rental', 'Part-time'];
  const salaryRanges = [
    { label: 'All Salaries', value: 'All Salaries' },
    { label: '$30k+ / year', value: '$30k+' },
    { label: '$50k+ / year', value: '$50k+' },
    { label: '$75k+ / year', value: '$75k+' },
    { label: '$100k+ / year', value: '$100k+' },
  ];
  const perkTags = [
    'All Perks',
    'Health Benefits',
    'Flexible Hours',
    'Paid Masterclasses',
    '401(k) Matching',
    'High Foot Traffic',
    'Profit Sharing',
    '24/7 Access'
  ];

  // Helper function to extract approximate maximum annual salary for sorting and filtering
  const parseAnnualSalary = (salaryStr: string): number => {
    if (!salaryStr) return 0;
    const matches = salaryStr.replace(/,/g, '').match(/\d+/g);
    if (!matches || matches.length === 0) return 0;
    const nums = matches.map(Number);
    let maxVal = Math.max(...nums);
    
    // Convert hourly rate ($28 - $52/hr) to approximate annual equivalent (x 2000 hours)
    const isHourly = /hr|hour/i.test(salaryStr) && maxVal < 250;
    if (isHourly) {
      maxVal = maxVal * 2000;
    }
    // Handle chair rental earnings
    if (salaryStr.toLowerCase().includes('keep 100%') || salaryStr.toLowerCase().includes('rent')) {
      maxVal = 85000;
    }
    return maxVal;
  };

  // Filter Jobs
  const filteredJobs = jobs.filter((job) => {
    // 1. Salon Role / Category
    const matchesCategory = selectedCategory === 'All' || job.category === selectedCategory;

    // 2. Search Query (Matches title, salonName, category, location, tags, requirements, description)
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      job.title.toLowerCase().includes(q) ||
      job.salonName.toLowerCase().includes(q) ||
      job.category.toLowerCase().includes(q) ||
      job.location.toLowerCase().includes(q) ||
      job.description.toLowerCase().includes(q) ||
      job.tags.some((t) => t.toLowerCase().includes(q)) ||
      job.requirements.some((r) => r.toLowerCase().includes(q));

    // 3. Location
    const matchesLocation = locationFilter === 'All Locations' || job.location.includes(locationFilter);

    // 4. Position / Job Type
    const matchesJobType = jobTypeFilter === 'All Types' || job.jobType === jobTypeFilter;

    // 5. Salary Range
    const annualSalary = parseAnnualSalary(job.salary);
    let matchesSalary = true;
    if (salaryFilter === '$30k+') matchesSalary = annualSalary >= 30000;
    else if (salaryFilter === '$50k+') matchesSalary = annualSalary >= 50000;
    else if (salaryFilter === '$75k+') matchesSalary = annualSalary >= 75000;
    else if (salaryFilter === '$100k+') matchesSalary = annualSalary >= 100000;

    // 6. Perks & Specialty Tag
    const matchesTag =
      selectedTag === 'All Perks' ||
      job.tags.some((t) => t.toLowerCase().includes(selectedTag.toLowerCase()));

    return matchesCategory && matchesSearch && matchesLocation && matchesJobType && matchesSalary && matchesTag;
  });

  // Sort Jobs
  const sortedAndFilteredJobs = [...filteredJobs].sort((a, b) => {
    if (sortBy === 'salary_high') {
      return parseAnnualSalary(b.salary) - parseAnnualSalary(a.salary);
    }
    if (sortBy === 'rating_high') {
      return b.rating - a.rating;
    }
    if (sortBy === 'newest') {
      return b.id.localeCompare(a.id);
    }
    // Default 'relevant': featured first
    if (a.isFeatured && !b.isFeatured) return -1;
    if (!a.isFeatured && b.isFeatured) return 1;
    return 0;
  });

  const savedJobs = jobs.filter((j) => j.isBookmarked);

  // Active filters count
  const activeFiltersCount = [
    selectedCategory !== 'All',
    locationFilter !== 'All Locations',
    jobTypeFilter !== 'All Types',
    salaryFilter !== 'All Salaries',
    selectedTag !== 'All Perks',
    searchQuery.trim() !== ''
  ].filter(Boolean).length;

  const handleResetFilters = () => {
    setSelectedCategory('All');
    setLocationFilter('All Locations');
    setJobTypeFilter('All Types');
    setSalaryFilter('All Salaries');
    setSelectedTag('All Perks');
    setSearchQuery('');
    setSortBy('relevant');
  };

  const handleApplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedJob) {
      const alreadyApplied = applications.some(app => app.jobId === selectedJob.id);
      if (alreadyApplied) {
        showToast('You have already submitted an application for this position.');
        return;
      }
      onApplyJob(selectedJob, coverNote);
      setApplySuccess(true);
      setTimeout(() => {
        setApplySuccess(false);
        setShowApplyModal(false);
      }, 1800);
    }
  };

  return (
    <div className="bg-[#fdf8f8] min-h-screen text-[#1c1b1b] flex flex-col font-sans pb-20 md:pb-stack-default">
      {/* Top Header */}
      <header className="sticky top-0 bg-white border-b border-[#e0bec6]/40 shadow-sm z-30 px-margin-side py-stack-default">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#b90064] text-white flex items-center justify-center font-bold text-xl shadow-md overflow-hidden">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuA9YCfaHhiweK-DgFXUTX5By-ZlrtM7o_48z0R1CvglhQdeBo7o43CuXSrWkbdkRD0JOPXt1SEXjDjHt4zdZm8fOv-dhvMyqdbDZUNXwmpenD2eJciah26z8NQ4rKKhffJV8gjYX4dAKtGkUZUkl0oF59mZPMl5qgGnqVkNEfaNACu_hsf0OXFq8yH8vmwqQEwxoqoq0SJgaI2EW8ndBOdaiKTgwADhial60zjXq9BxWx2H-NMVdsGgUQzUehuN6oboGQ"
                alt="Nexora Logo"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <span className="font-bold text-xl text-[#8e004b] tracking-tight block leading-none">
                Nexora Jobs
              </span>
              <span className="text-[10px] font-semibold text-[#594047] uppercase tracking-wider">
                Beauty Talent Hub
              </span>
            </div>
          </div>

          {/* Desktop Search Bar */}
          <div className={`hidden md:flex items-center flex-1 max-w-md mx-6 bg-[#fdf8f8] rounded-full px-4 py-2 ring-1 transition-all ${isListening ? 'ring-2 ring-[#8e004b] bg-[#ffd9e2]/20 animate-pulse' : 'ring-[#e0bec6] focus-within:ring-2 focus-within:ring-[#8e004b]'}`}>
            <Search className="w-4 h-4 text-[#8c7077] mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder={isListening ? "Listening... Speak now..." : "Search roles, salons, balayage, facialist, chair rental..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none text-xs text-[#1c1b1b] focus:outline-none placeholder:text-[#594047]/60"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 hover:bg-[#ffd9e2] text-[#8e004b] rounded-full transition-colors cursor-pointer ml-1"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={startVoiceSearch}
              title="Search by voice"
              className={`p-1.5 ml-1 rounded-full transition-colors cursor-pointer flex items-center justify-center ${
                isListening ? 'bg-[#8e004b] text-white animate-bounce' : 'hover:bg-[#ffd9e2] text-[#8e004b]'
              }`}
            >
              <Mic className="w-4 h-4" />
            </button>
          </div>

          {/* User Profile & Push Notification Alerts */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Help & Support Center Button */}
            <button
              onClick={() => onNavigateScreen?.('support')}
              title="Help & Support Center"
              className="p-2 text-[#594047] hover:text-[#8e004b] hover:bg-[#e6e1e1] rounded-full transition-colors cursor-pointer"
            >
              <HelpCircle className="w-5 h-5 text-[#8e004b]" />
            </button>

            {/* Job Match Notification Bell Button */}
            <button
              onClick={() => setShowNotificationDrawer(true)}
              title="Job Search Match Alerts & Push Notifications"
              className="relative p-2 text-[#594047] hover:text-[#8e004b] hover:bg-[#e6e1e1] rounded-full transition-colors cursor-pointer"
            >
              <Bell className="w-5 h-5 text-[#8e004b]" />
              {unreadAlertsCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#e2007c] text-white text-[10px] font-extrabold rounded-full flex items-center justify-center animate-pulse shadow-xs">
                  {unreadAlertsCount}
                </span>
              )}
            </button>

            <button
              onClick={onSwitchRole}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#ffd9e2] text-[#8e004b] text-xs font-semibold hover:bg-[#ffb0c8] transition-colors cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Switch to Employer</span>
            </button>

            <div className="flex items-center gap-2 pl-2 border-l border-[#e0bec6]/40">
              <button
                onClick={() => setShowImageUploader(true)}
                title="Change headshot"
                className="w-9 h-9 rounded-full bg-[#8e004b] text-white font-bold flex items-center justify-center text-sm overflow-hidden border border-[#e0bec6] hover:ring-2 hover:ring-[#8e004b] transition-all cursor-pointer relative group"
              >
                {userProfile.avatarUrl ? (
                  <img
                    src={userProfile.avatarUrl}
                    alt={userProfile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{userProfile.name.charAt(0)}</span>
                )}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="w-3.5 h-3.5 text-white" />
                </div>
              </button>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-semibold text-[#1c1b1b] leading-tight">{userProfile.name}</p>
                <p className="text-[10px] text-[#594047]">Job Seeker</p>
              </div>
              <button
                onClick={onLogout}
                title="Log out"
                className="p-2 text-[#594047] hover:text-[#8e004b] hover:bg-[#e6e1e1] rounded-full transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className={`mt-2 md:hidden flex items-center bg-[#fdf8f8] rounded-full px-3 py-2 ring-1 transition-all ${isListening ? 'ring-2 ring-[#8e004b] bg-[#ffd9e2]/20 animate-pulse' : 'ring-[#e0bec6]'}`}>
          <Search className="w-4 h-4 text-[#8c7077] mr-2 flex-shrink-0" />
          <input
            type="text"
            placeholder={isListening ? "Listening..." : "Search roles, salons, specialties..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-[#1c1b1b] focus:outline-none placeholder:text-[#594047]/60"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="p-1 text-[#8e004b]">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={startVoiceSearch}
            title="Search by voice"
            className={`p-1.5 ml-1 rounded-full transition-colors cursor-pointer flex items-center justify-center ${
              isListening ? 'bg-[#8e004b] text-white animate-bounce' : 'hover:bg-[#ffd9e2] text-[#8e004b]'
            }`}
          >
            <Mic className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-margin-side py-section-gap flex-grow w-full">
        {/* Navigation Tabs Bar */}
        <div className="flex items-center justify-between border-b border-[#e0bec6]/40 pb-stack-default mb-section-gap overflow-x-auto gap-stack-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('feed')}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'feed'
                  ? 'bg-[#8e004b] text-white shadow-sm'
                  : 'bg-white text-[#594047] hover:bg-[#f7f2f2] border border-[#e0bec6]/40'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>Explore Jobs ({sortedAndFilteredJobs.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('applications')}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'applications'
                  ? 'bg-[#8e004b] text-white shadow-sm'
                  : 'bg-white text-[#594047] hover:bg-[#f7f2f2] border border-[#e0bec6]/40'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>My Applications</span>
              {applications.length > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-[#e2007c] text-white font-bold">
                  {applications.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('saved')}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'saved'
                  ? 'bg-[#8e004b] text-white shadow-sm'
                  : 'bg-white text-[#594047] hover:bg-[#f7f2f2] border border-[#e0bec6]/40'
              }`}
            >
              <Bookmark className="w-4 h-4" />
              <span>Saved Jobs</span>
              {savedJobs.length > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-[#ffd9e2] text-[#8e004b] font-bold">
                  {savedJobs.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('messages')}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'messages'
                  ? 'bg-[#8e004b] text-white shadow-sm'
                  : 'bg-white text-[#594047] hover:bg-[#f7f2f2] border border-[#e0bec6]/40'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Messages</span>
              {conversations.reduce((acc, c) => acc + (c.unreadCountSeeker || 0), 0) > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-[#e2007c] text-white font-bold animate-pulse">
                  {conversations.reduce((acc, c) => acc + (c.unreadCountSeeker || 0), 0)}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('portfolio')}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'portfolio'
                  ? 'bg-[#8e004b] text-white shadow-sm'
                  : 'bg-white text-[#594047] hover:bg-[#f7f2f2] border border-[#e0bec6]/40'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Work Portfolio</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#ffd9e2] text-[#8e004b] font-bold">
                {portfolioItems.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-[#8e004b] text-white shadow-sm'
                  : 'bg-white text-[#594047] hover:bg-[#f7f2f2] border border-[#e0bec6]/40'
              }`}
            >
              <UserIcon className="w-4 h-4" />
              <span>Beauty Profile</span>
            </button>
          </div>

          <button
            onClick={onSwitchRole}
            className="sm:hidden text-xs text-[#8e004b] font-semibold underline whitespace-nowrap"
          >
            Switch to Employer
          </button>
        </div>

        {/* TAB 1: EXPLORE JOBS FEED */}
        {activeTab === 'feed' && (
          <div className="flex flex-col gap-6">
            {/* Real-Time Job Match Push Alert Banner */}
            {unreadAlertsCount > 0 && (
              <div className="bg-gradient-to-r from-[#8e004b] via-[#a30058] to-[#e2007c] text-white rounded-2xl p-4 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-white/20">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-xs flex-shrink-0">
                    <BellRing className="w-6 h-6 text-amber-300 animate-bounce" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider bg-amber-400 text-black px-2 py-0.5 rounded-md">
                        {unreadAlertsCount} New Job Match{unreadAlertsCount > 1 ? 'es' : ''}
                      </span>
                      <span className="text-[11px] text-white/80">Saved Search Push Alert Engine</span>
                    </div>
                    <p className="text-sm font-bold mt-1 leading-snug">
                      New job matches your filter: "{alertsList[0]?.savedFilterName}"
                    </p>
                    <p className="text-xs text-white/90 mt-0.5">
                      <span className="font-extrabold">{alertsList[0]?.jobTitle}</span> at {alertsList[0]?.salonName} ({alertsList[0]?.location})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => setShowNotificationDrawer(true)}
                    className="px-4 py-2 bg-white text-[#8e004b] hover:bg-[#ffd9e2] font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                  >
                    View All Matches ({alertsList.length})
                  </button>
                  <button
                    onClick={handleMarkAllRead}
                    className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                    title="Dismiss alert banner"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
            {/* Salon Role Category Tabs */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1c1b1b] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#e2007c]" />
                  <span>Salon Role Categories</span>
                </span>
                <span className="text-[11px] font-semibold text-[#8c7077]">
                  {jobs.length} total openings
                </span>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
                {categories.map((cat) => {
                  const catCount = cat === 'All' ? jobs.length : jobs.filter((j) => j.category === cat).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                        selectedCategory === cat
                          ? 'bg-[#e2007c] text-white shadow-sm'
                          : 'bg-white text-[#594047] hover:bg-[#f7f2f2] border border-[#e0bec6]/40'
                      }`}
                    >
                      <span>{cat}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          selectedCategory === cat ? 'bg-white/30 text-white' : 'bg-[#ffd9e2]/60 text-[#8e004b]'
                        }`}
                      >
                        {catCount}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Quick Re-apply Saved Searches Bar */}
              {savedFilters.length > 0 && (
                <div className="bg-[#fdf8f8] p-3 rounded-2xl border border-[#ffd9e2] shadow-2xs flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-bold text-[#8e004b]">
                    <div className="flex items-center gap-1.5">
                      <BookmarkCheck className="w-4 h-4 text-[#e2007c]" />
                      <span>Saved Search Preferences ({savedFilters.length})</span>
                    </div>
                    <button
                      onClick={() => setActiveTab('profile')}
                      className="text-[11px] font-semibold text-[#8e004b] hover:text-[#e2007c] hover:underline cursor-pointer transition-colors"
                    >
                      Manage in Profile &rarr;
                    </button>
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {savedFilters.map((sf) => {
                      const isCurrentlyActive =
                        (sf.searchQuery || '') === searchQuery &&
                        (sf.category || 'All') === selectedCategory &&
                        (sf.location || 'All Locations') === locationFilter &&
                        (sf.jobType || 'All Types') === jobTypeFilter &&
                        (sf.salary || 'All Salaries') === salaryFilter &&
                        (sf.tag || 'All Perks') === selectedTag;

                      return (
                        <div
                          key={sf.id}
                          className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            isCurrentlyActive
                              ? 'bg-[#8e004b] text-white border-[#8e004b] shadow-xs'
                              : 'bg-white text-[#1c1b1b] border-[#e0bec6] hover:border-[#e2007c] hover:bg-[#ffd9e2]/40 shadow-2xs'
                          }`}
                          onClick={() => handleApplySavedFilter(sf)}
                        >
                          <Sparkles className={`w-3.5 h-3.5 ${isCurrentlyActive ? 'text-amber-300' : 'text-[#e2007c]'}`} />
                          <span>{sf.name}</span>
                          <span className={`text-[10px] font-normal ${isCurrentlyActive ? 'text-white/80' : 'text-[#8c7077]'}`}>
                            ({sf.location !== 'All Locations' ? sf.location.split(',')[0] : sf.category !== 'All' ? sf.category : 'Saved'})
                          </span>
                          <button
                            onClick={(e) => handleDeleteSavedFilter(sf.id, e)}
                            className={`ml-1 opacity-0 group-hover:opacity-100 p-0.5 rounded-full hover:bg-black/10 transition-opacity ${
                              isCurrentlyActive ? 'text-white' : 'text-[#8c7077] hover:text-rose-600'
                            }`}
                            title="Remove saved search"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Advanced Multi-Facet Filters Panel */}
              <div className="bg-white p-stack-default rounded-2xl border border-[#e0bec6]/50 shadow-xs flex flex-col gap-stack-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#e0bec6]/30">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#8e004b]">
                    <SlidersHorizontal className="w-4 h-4" />
                    <span>Search & Refine Filters</span>
                    {activeFiltersCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#e2007c] text-white font-extrabold">
                        {activeFiltersCount} Active
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Save Current Search Button */}
                    <button
                      onClick={handleOpenSaveModal}
                      className="px-3 py-1 rounded-full bg-[#8e004b] text-white hover:bg-[#b90064] text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                      title="Save current search criteria to profile"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      <span>Save Current Search</span>
                    </button>

                    {/* Popular quick search triggers */}
                    <div className="hidden lg:flex items-center gap-1.5 text-[11px] ml-2">
                      <span className="text-[#8c7077] font-medium">Quick:</span>
                      {['Balayage', 'HydraFacial', 'Chair Rental'].map((kw) => (
                        <button
                          key={kw}
                          onClick={() => setSearchQuery(kw)}
                          className="px-2 py-0.5 rounded-md bg-[#fdf8f8] hover:bg-[#ffd9e2] text-[#8e004b] font-medium border border-[#e0bec6]/40 cursor-pointer transition-colors"
                        >
                          +{kw}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Dropdowns Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                  {/* Location Filter */}
                  <div className="relative">
                    <label className="text-[10px] font-bold text-[#594047] uppercase block mb-1">
                      Location
                    </label>
                    <div className="flex items-center bg-[#fdf8f8] rounded-xl px-2.5 py-1.5 border border-[#e0bec6]">
                      <MapPin className="w-3.5 h-3.5 text-[#8e004b] mr-1.5 flex-shrink-0" />
                      <select
                        value={locationFilter}
                        onChange={(e) => setLocationFilter(e.target.value)}
                        className="w-full bg-transparent text-xs font-semibold text-[#1c1b1b] outline-none cursor-pointer"
                      >
                        {locations.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Salary Range Filter */}
                  <div className="relative">
                    <label className="text-[10px] font-bold text-[#594047] uppercase block mb-1">
                      Salary Range
                    </label>
                    <div className="flex items-center bg-[#fdf8f8] rounded-xl px-2.5 py-1.5 border border-[#e0bec6]">
                      <DollarSign className="w-3.5 h-3.5 text-[#8e004b] mr-1.5 flex-shrink-0" />
                      <select
                        value={salaryFilter}
                        onChange={(e) => setSalaryFilter(e.target.value)}
                        className="w-full bg-transparent text-xs font-semibold text-[#1c1b1b] outline-none cursor-pointer"
                      >
                        {salaryRanges.map((sal) => (
                          <option key={sal.value} value={sal.value}>
                            {sal.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Position / Job Type Filter */}
                  <div className="relative">
                    <label className="text-[10px] font-bold text-[#594047] uppercase block mb-1">
                      Position Type
                    </label>
                    <div className="flex items-center bg-[#fdf8f8] rounded-xl px-2.5 py-1.5 border border-[#e0bec6]">
                      <Briefcase className="w-3.5 h-3.5 text-[#8e004b] mr-1.5 flex-shrink-0" />
                      <select
                        value={jobTypeFilter}
                        onChange={(e) => setJobTypeFilter(e.target.value)}
                        className="w-full bg-transparent text-xs font-semibold text-[#1c1b1b] outline-none cursor-pointer"
                      >
                        {jobTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Perk & Specialty Tag Filter */}
                  <div className="relative">
                    <label className="text-[10px] font-bold text-[#594047] uppercase block mb-1">
                      Perks & Specialties
                    </label>
                    <div className="flex items-center bg-[#fdf8f8] rounded-xl px-2.5 py-1.5 border border-[#e0bec6]">
                      <Tag className="w-3.5 h-3.5 text-[#8e004b] mr-1.5 flex-shrink-0" />
                      <select
                        value={selectedTag}
                        onChange={(e) => setSelectedTag(e.target.value)}
                        className="w-full bg-transparent text-xs font-semibold text-[#1c1b1b] outline-none cursor-pointer"
                      >
                        {perkTags.map((tag) => (
                          <option key={tag} value={tag}>
                            {tag}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Sort By Dropdown */}
                  <div className="relative">
                    <label className="text-[10px] font-bold text-[#594047] uppercase block mb-1">
                      Sort Results
                    </label>
                    <div className="flex items-center bg-[#fdf8f8] rounded-xl px-2.5 py-1.5 border border-[#e0bec6]">
                      <ArrowUpDown className="w-3.5 h-3.5 text-[#8e004b] mr-1.5 flex-shrink-0" />
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="w-full bg-transparent text-xs font-semibold text-[#1c1b1b] outline-none cursor-pointer"
                      >
                        <option value="relevant">Most Relevant</option>
                        <option value="salary_high">Highest Compensation</option>
                        <option value="rating_high">Top Rated Salons</option>
                        <option value="newest">Newest First</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Active Filter Chips & Reset Bar */}
                {activeFiltersCount > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#e0bec6]/30">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-[11px] font-semibold text-[#594047] mr-1">Applied Filters:</span>

                      {searchQuery && (
                        <span className="inline-flex items-center gap-1 bg-[#ffd9e2] text-[#8e004b] px-2.5 py-0.5 rounded-full text-xs font-semibold">
                          Keyword: "{searchQuery}"
                          <button onClick={() => setSearchQuery('')} className="hover:text-[#b90064]">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}

                      {selectedCategory !== 'All' && (
                        <span className="inline-flex items-center gap-1 bg-[#ffd9e2] text-[#8e004b] px-2.5 py-0.5 rounded-full text-xs font-semibold">
                          Role: {selectedCategory}
                          <button onClick={() => setSelectedCategory('All')} className="hover:text-[#b90064]">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}

                      {locationFilter !== 'All Locations' && (
                        <span className="inline-flex items-center gap-1 bg-[#ffd9e2] text-[#8e004b] px-2.5 py-0.5 rounded-full text-xs font-semibold">
                          Location: {locationFilter}
                          <button onClick={() => setLocationFilter('All Locations')} className="hover:text-[#b90064]">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}

                      {salaryFilter !== 'All Salaries' && (
                        <span className="inline-flex items-center gap-1 bg-[#ffd9e2] text-[#8e004b] px-2.5 py-0.5 rounded-full text-xs font-semibold">
                          Salary: {salaryFilter}
                          <button onClick={() => setSalaryFilter('All Salaries')} className="hover:text-[#b90064]">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}

                      {jobTypeFilter !== 'All Types' && (
                        <span className="inline-flex items-center gap-1 bg-[#ffd9e2] text-[#8e004b] px-2.5 py-0.5 rounded-full text-xs font-semibold">
                          Type: {jobTypeFilter}
                          <button onClick={() => setJobTypeFilter('All Types')} className="hover:text-[#b90064]">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}

                      {selectedTag !== 'All Perks' && (
                        <span className="inline-flex items-center gap-1 bg-[#ffd9e2] text-[#8e004b] px-2.5 py-0.5 rounded-full text-xs font-semibold">
                          Perk: {selectedTag}
                          <button onClick={() => setSelectedTag('All Perks')} className="hover:text-[#b90064]">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}
                    </div>

                    <button
                      onClick={handleResetFilters}
                      className="text-xs text-[#8e004b] font-bold hover:underline flex items-center gap-1 cursor-pointer ml-auto"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset All</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Results Count Summary Banner */}
            <div className="flex items-center justify-between text-xs text-[#594047] font-medium px-1">
              <p>
                Showing <strong className="text-[#8e004b] font-extrabold">{sortedAndFilteredJobs.length}</strong> of{' '}
                <strong className="text-[#1c1b1b]">{jobs.length}</strong> luxury salon job listings
              </p>
              {sortBy !== 'relevant' && (
                <span className="text-[11px] font-semibold text-[#8e004b] bg-[#ffd9e2] px-2.5 py-0.5 rounded-full">
                  Sorted by: {sortBy === 'salary_high' ? 'Highest Compensation' : sortBy === 'rating_high' ? 'Top Rated' : 'Newest'}
                </span>
              )}
            </div>

            {/* Jobs List Grid */}
            {sortedAndFilteredJobs.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 sm:p-14 text-center border border-[#e0bec6]/40 my-4 shadow-sm space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#ffd9e2] text-[#8e004b] flex items-center justify-center mx-auto">
                  <Sparkles className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#1c1b1b] mb-1">No roles matched your search criteria</h3>
                  <p className="text-xs sm:text-sm text-[#594047] max-w-md mx-auto">
                    We couldn't find any salon listings matching your active filters. Try clearing your search keyword or relaxing salary & location options.
                  </p>
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  <button
                    onClick={handleResetFilters}
                    className="px-6 py-2.5 bg-[#8e004b] hover:bg-[#b90064] text-white text-xs font-bold rounded-full shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Clear All Filters</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-stack-default">
                {sortedAndFilteredJobs.map((job) => (
                  <div
                    key={job.id}
                    className="bg-white rounded-2xl border border-[#e0bec6]/50 shadow-[0_4px_16px_rgba(90,63,71,0.05)] hover:shadow-md transition-all duration-300 flex flex-col overflow-hidden group"
                  >
                    {/* Image Header */}
                    <div className="relative h-44 w-full overflow-hidden bg-[#f1edec]">
                      <img
                        src={job.image}
                        alt={job.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                      {/* Featured / Type Badge */}
                      <div className="absolute top-3 left-3 flex gap-2">
                        {job.isFeatured && (
                          <span className="bg-[#e2007c] text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Featured
                          </span>
                        )}
                        <span className="bg-white/90 backdrop-blur-md text-[#1c1b1b] text-[10px] font-bold px-2.5 py-1 rounded-full">
                          {job.jobType}
                        </span>
                      </div>

                      {/* Bookmark Button */}
                      <button
                        onClick={() => onToggleBookmark(job.id)}
                        aria-label="Save job"
                        className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-[#8e004b] hover:bg-white transition-colors cursor-pointer shadow-sm"
                      >
                        {job.isBookmarked ? (
                          <BookmarkCheck className="w-5 h-5 fill-[#8e004b]" />
                        ) : (
                          <Bookmark className="w-5 h-5" />
                        )}
                      </button>

                      {/* Salon Overlay Info */}
                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                        <div className="flex items-center gap-2">
                          {job.salonLogo && (
                            <img
                              src={job.salonLogo}
                              alt={job.salonName}
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-full border-2 border-white object-cover shadow-sm"
                            />
                          )}
                          <div>
                            <span className="text-xs font-semibold block drop-shadow-sm">{job.salonName}</span>
                            <span className="text-[10px] text-white/80 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {job.location}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                          <span>{job.rating}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-4 flex-grow flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-[#ffd9e2] text-[#8e004b] px-2 py-0.5 rounded-md">
                            {job.category}
                          </span>
                          <span className="text-[10px] text-[#8c7077]">{job.postedDate}</span>
                        </div>

                        <h3 className="text-base font-bold text-[#1c1b1b] leading-tight mb-1 group-hover:text-[#8e004b] transition-colors">
                          {job.title}
                        </h3>

                        <p className="text-sm font-extrabold text-[#e2007c] mb-2">
                          {job.salary}
                        </p>

                        <p className="text-xs text-[#594047] line-clamp-2 leading-relaxed mb-3">
                          {job.description}
                        </p>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {job.tags.slice(0, 3).map((tag, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-semibold bg-[#ffd9e2]/60 text-[#8e004b] px-2.5 py-0.5 rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-3 border-t border-[#e0bec6]/30 flex items-center justify-between gap-2 mt-auto">
                        <span className="text-[10px] text-[#8c7077] flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {job.postedDate}
                        </span>

                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedJob(job)}
                            className="px-3 py-1.5 rounded-full text-xs font-semibold text-[#8e004b] bg-[#f1edec] hover:bg-[#ffd9e2] transition-colors cursor-pointer"
                          >
                            Details
                          </button>
                          <button
                            onClick={() => {
                              setSelectedJob(job);
                              if (onStartApplyJob) {
                                onStartApplyJob(job);
                              } else {
                                setShowApplyModal(true);
                              }
                            }}
                            className="px-4 py-1.5 rounded-full text-xs font-bold text-white bg-[#e2007c] hover:bg-[#b90064] transition-colors active:scale-95 shadow-xs cursor-pointer"
                          >
                            Apply Now
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MY APPLICATIONS */}
        {activeTab === 'applications' && (
          <div className="space-y-section-gap">
            <div className="bg-white p-margin-side rounded-2xl border border-[#e0bec6]/40 shadow-xs flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#1c1b1b]">Application Tracker</h2>
                <p className="text-xs text-[#594047]">Track your active role applications and upcoming interviews.</p>
              </div>
              <span className="px-3 py-1 bg-[#ffd9e2] text-[#8e004b] text-xs font-bold rounded-full">
                {applications.length} Active
              </span>
            </div>

            {applications.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-[#e0bec6]/40">
                <FileText className="w-12 h-12 text-[#8c7077] mx-auto mb-3 opacity-50" />
                <h3 className="text-base font-bold text-[#1c1b1b] mb-1">No applications submitted yet</h3>
                <p className="text-xs text-[#594047] mb-4">Explore luxury salon positions and submit your profile today!</p>
                <button
                  onClick={() => setActiveTab('feed')}
                  className="px-5 py-2 bg-[#e2007c] text-white text-xs font-bold rounded-full shadow-sm"
                >
                  Explore Open Roles
                </button>
              </div>
            ) : (
              <div className="space-y-stack-default">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    className="bg-white rounded-2xl p-margin-side border border-[#e0bec6]/50 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-stack-default"
                  >
                    <div className="flex items-start gap-stack-default">
                      {app.salonLogo ? (
                        <img
                          src={app.salonLogo}
                          alt={app.salonName}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-xl object-cover border border-[#e0bec6]"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-[#ffd9e2] text-[#8e004b] font-bold flex items-center justify-center text-lg">
                          {app.salonName.charAt(0)}
                        </div>
                      )}

                      <div>
                        <span className="text-xs font-semibold text-[#8e004b] block">{app.salonName}</span>
                        <h3 className="text-base font-bold text-[#1c1b1b] mb-1">{app.jobTitle}</h3>
                        <p className="text-xs text-[#594047] flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {app.location} • Applied {app.appliedDate}
                        </p>

                        {app.notes && (
                          <div className="mt-stack-sm text-xs bg-[#fdf8f8] p-stack-sm rounded-lg border border-[#e0bec6]/30 text-[#1c1b1b]">
                            <span className="font-semibold text-[#8e004b]">Note: </span>
                            {app.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col md:items-end gap-stack-sm pt-stack-sm md:pt-0 border-t md:border-t-0 border-[#e0bec6]/30">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold w-fit ${
                          app.status === 'Interview Scheduled'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : app.status === 'Under Review'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : app.status === 'Offer Extended'
                            ? 'bg-[#e2007c] text-white'
                            : 'bg-[#f1edec] text-[#594047]'
                        }`}
                      >
                        {app.status}
                      </span>

                      {app.interviewDate && (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{app.interviewDate}</span>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {app.status === 'Interview Scheduled' && onViewInvitation && (
                          <button
                            onClick={() => onViewInvitation(app)}
                            className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#8e004b] text-white hover:bg-[#b90064] transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs mt-stack-sm"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>View Invitation</span>
                          </button>
                        )}

                        {app.status === 'Offer Extended' && onViewOffer && (
                          <button
                            onClick={() => onViewOffer(app)}
                            className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#e2007c] text-white hover:bg-[#b50062] transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs mt-stack-sm"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>View Offer</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            if (onStartConversation) {
                              const convId = onStartConversation(app.jobId, userProfile.name, app.salonName);
                              setActiveConvId(convId);
                              setActiveTab('messages');
                            }
                          }}
                          className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#ffd9e2] text-[#8e004b] hover:bg-[#ffb0c8] transition-colors cursor-pointer flex items-center gap-stack-sm shadow-2xs mt-stack-sm"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Message Salon</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SAVED JOBS */}
        {activeTab === 'saved' && (
          <div className="space-y-section-gap">
            <div className="bg-white p-margin-side rounded-2xl border border-[#e0bec6]/40 shadow-xs flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#1c1b1b]">Saved Positions</h2>
                <p className="text-xs text-[#594047]">Your bookmarked salon opportunities.</p>
              </div>
              <span className="px-3 py-1 bg-[#ffd9e2] text-[#8e004b] text-xs font-bold rounded-full">
                {savedJobs.length} Saved
              </span>
            </div>

            {showSavedAd && (
              <div className="relative overflow-hidden bg-gradient-to-r from-[#ffd9e2]/20 via-[#fdf8f8] to-white rounded-2xl border border-[#e0bec6]/45 p-6 shadow-xs animate-in fade-in slide-in-from-top-4 duration-500">
                {/* Close Button */}
                <button
                  onClick={() => setShowSavedAd(false)}
                  className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[#ffd9e2]/60 text-[#594047] hover:text-[#8e004b] transition-all cursor-pointer z-10"
                  title="Dismiss advertisement"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  {/* Text Content */}
                  <div className="flex-1 space-y-3">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#8e004b] text-white text-[10px] font-extrabold uppercase tracking-wide">
                      <Sparkles className="w-3 h-3 animate-pulse text-[#ffd9e2]" />
                      <span>Partner Spotlight</span>
                    </div>

                    <h3 className="text-lg md:text-xl font-bold text-[#1c1b1b] leading-tight">
                      Dyson Professional Masterclass: Elite Styling 2026
                    </h3>
                    
                    <p className="text-xs text-[#594047] leading-relaxed max-w-xl">
                      Master advanced thermal technology, ergonomic styling, and modern precision drying with Dyson's Global Educators. Get certified and earn an exclusive <strong className="text-[#8e004b] font-bold">"Verified Advanced Stylist"</strong> badge on your Nexora profile.
                    </p>

                    <div className="flex flex-wrap items-center gap-4 pt-1">
                      <a
                        href="https://www.dyson.com/hair-care/professional/masterclass"
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 bg-[#8e004b] text-white text-xs font-bold rounded-full hover:bg-[#b90064] transition-all flex items-center gap-1.5 shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer"
                      >
                        <span>Reserve Free Seat</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <span className="text-[11px] text-[#594047] font-semibold">
                        Exclusive 15% off Dyson Professional tools for attendees
                      </span>
                    </div>
                  </div>

                  {/* Visual Asset Block */}
                  <div className="relative shrink-0 w-full md:w-48 h-32 bg-[#ffd9e2]/10 rounded-xl overflow-hidden border border-[#e0bec6]/30 flex items-center justify-center">
                    {/* Background decorative circles */}
                    <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-[#e2007c]/5 blur-lg" />
                    <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full bg-[#8e004b]/5 blur-lg" />
                    
                    <img
                      src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=300"
                      alt="Premium Hair Dryer Styling Tool"
                      className="w-full h-full object-cover opacity-90 transition-transform duration-700 hover:scale-105"
                      referrerPolicy="no-referrer"
                    />

                    {/* Tiny Floating Badge */}
                    <div className="absolute bottom-2 left-2 bg-white/95 backdrop-blur-xs border border-[#e0bec6]/40 px-2 py-1 rounded-md text-[9px] font-extrabold text-[#8e004b] shadow-2xs">
                      Nexora Certified
                    </div>
                  </div>
                </div>
              </div>
            )}

            {savedJobs.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-[#e0bec6]/40">
                <Bookmark className="w-12 h-12 text-[#8c7077] mx-auto mb-3 opacity-50" />
                <h3 className="text-base font-bold text-[#1c1b1b] mb-1">No bookmarked positions</h3>
                <p className="text-xs text-[#594047] mb-4">Click the bookmark icon on any job card to save it for later.</p>
                <button
                  onClick={() => setActiveTab('feed')}
                  className="px-5 py-2 bg-[#8e004b] text-white text-xs font-bold rounded-full shadow-sm"
                >
                  Browse Job Feed
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-stack-default">
                {savedJobs.map((job) => (
                  <div key={job.id} className="bg-white rounded-2xl border border-[#e0bec6]/50 p-stack-default flex flex-col justify-between gap-stack-sm shadow-xs">
                    <div>
                      <div className="flex justify-between items-start gap-stack-sm mb-stack-sm">
                        <div>
                          <span className="text-xs font-semibold text-[#8e004b]">{job.salonName}</span>
                          <h3 className="text-base font-bold text-[#1c1b1b]">{job.title}</h3>
                        </div>
                        <button
                          onClick={() => onToggleBookmark(job.id)}
                          aria-label="Remove bookmark"
                          className="text-[#8e004b] p-1 cursor-pointer"
                        >
                          <BookmarkCheck className="w-5 h-5 fill-[#8e004b]" />
                        </button>
                      </div>

                      <p className="text-xs font-bold text-[#e2007c] mb-stack-sm">{job.salary}</p>
                      <p className="text-xs text-[#594047] flex items-center gap-stack-sm mb-stack-default">
                        <MapPin className="w-3 h-3" /> {job.location}
                      </p>
                    </div>

                    <div className="pt-stack-sm border-t border-[#e0bec6]/30 flex gap-stack-sm">
                      <button
                        onClick={() => setSelectedJob(job)}
                        className="flex-1 py-2 rounded-full text-xs font-semibold text-[#8e004b] bg-[#f1edec] hover:bg-[#ffd9e2] transition-colors cursor-pointer"
                      >
                        Details
                      </button>
                      <button
                        onClick={() => {
                          setSelectedJob(job);
                          if (onStartApplyJob) {
                            onStartApplyJob(job);
                          } else {
                            setShowApplyModal(true);
                          }
                        }}
                        className="flex-1 py-2 rounded-full text-xs font-bold text-white bg-[#e2007c] hover:bg-[#b90064] transition-colors cursor-pointer"
                      >
                        Apply Now
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: MESSAGING */}
        {activeTab === 'messages' && (
          <div className="space-y-section-gap">
            <MessagingCenter
              currentRole="seeker"
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
          </div>
        )}

        {/* TAB 5: WORK PORTFOLIO GALLERY */}
        {activeTab === 'portfolio' && (
          <PortfolioGallery
            items={portfolioItems}
            onUpdateItems={(newItems) => setPortfolioItems(newItems)}
            isEditable={true}
          />
        )}

        {/* TAB 6: BEAUTY PROFILE */}
        {activeTab === 'profile' && (
          <SeekerProfileTab
            userProfile={userProfile}
            onUpdateProfile={onUpdateProfile}
            onLogout={onLogout}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onNavigateScreen={onNavigateScreen}
          />
        )}
      </main>

      {/* JOB DETAIL MODAL */}
      {selectedJob && !showApplyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#e0bec6] shadow-2xl animate-scale-up">
            <div className="relative h-56 w-full bg-[#f1edec]">
              <img
                src={selectedJob.image}
                alt={selectedJob.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setSelectedJob(null)}
                aria-label="Close modal"
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="absolute bottom-4 left-4 right-4 text-white flex items-end justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider bg-[#e2007c] px-2.5 py-0.5 rounded-full mb-1 inline-block">
                    {selectedJob.category}
                  </span>
                  <h2 className="text-xl font-extrabold text-white leading-tight drop-shadow-md">
                    {selectedJob.title}
                  </h2>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#fdf8f8] rounded-2xl border border-[#e0bec6]/40">
                <div>
                  <span className="text-xs font-bold text-[#8e004b]">{selectedJob.salonName}</span>
                  <p className="text-xs text-[#594047] flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5" /> {selectedJob.location}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-extrabold text-[#e2007c] block">{selectedJob.salary}</span>
                  <span className="text-[10px] text-[#8c7077] font-semibold uppercase">{selectedJob.jobType}</span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-[#1c1b1b] uppercase tracking-wider mb-2">About the Role</h3>
                <p className="text-xs text-[#594047] leading-relaxed">{selectedJob.description}</p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-[#1c1b1b] uppercase tracking-wider mb-2">Requirements</h3>
                <ul className="space-y-1.5 text-xs text-[#594047]">
                  {selectedJob.requirements.map((req, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-[#8e004b] font-bold">•</span>
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-bold text-[#1c1b1b] uppercase tracking-wider mb-2">Perks & Benefits</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedJob.benefits.map((ben, i) => (
                    <div key={i} className="p-2.5 bg-[#ffd9e2]/30 rounded-xl text-xs font-medium text-[#8e004b] flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#e2007c] flex-shrink-0" />
                      <span>{ben}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-[#e0bec6]/40 flex gap-3">
                <button
                  onClick={() => setSelectedJob(null)}
                  className="flex-1 py-3 rounded-full text-xs font-bold text-[#594047] bg-[#f1edec] hover:bg-[#e6e1e1] transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    if (onStartApplyJob && selectedJob) {
                      onStartApplyJob(selectedJob);
                    } else {
                      setShowApplyModal(true);
                    }
                  }}
                  className="flex-1 py-3 rounded-full text-xs font-bold text-white bg-[#e2007c] hover:bg-[#b90064] shadow-md transition-colors cursor-pointer"
                >
                  Apply Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 21 — APPLY JOB (Review your application) */}
      {showApplyModal && selectedJob && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 border border-[#e0bec6] shadow-2xl animate-scale-up my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start pb-4 border-b border-[#e0bec6]/30 mb-6">
              <div>
                <span className="text-[10px] font-mono tracking-wider text-[#8c7077] uppercase bg-[#f1edec] px-2 py-0.5 rounded-md">
                  /app/jobs/job/{selectedJob.id}/apply
                </span>
                <h3 className="text-xl font-bold text-[#1c1b1b] mt-1">Review your application</h3>
                <p className="text-xs text-[#594047]">Applying to <span className="font-semibold text-[#8e004b]">{selectedJob.salonName}</span> — {selectedJob.title}</p>
              </div>
              <button
                onClick={() => setShowApplyModal(false)}
                className="p-1.5 text-[#594047] hover:text-[#1c1b1b] rounded-full hover:bg-[#f1edec] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {applySuccess ? (
              <div className="py-12 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <h4 className="text-xl font-bold text-[#1c1b1b]">Application Submitted Successfully!</h4>
                <p className="text-xs text-[#594047] max-w-sm mx-auto">
                  Your candidate profile, credentials, and cover note have been securely transmitted to the hiring team at {selectedJob.salonName}.
                </p>
              </div>
            ) : (
              <form onSubmit={handleApplySubmit} className="space-y-6">
                {applications.some(app => app.jobId === selectedJob.id) && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-800 text-xs">
                    <span className="material-symbols-outlined text-amber-600 text-base mt-0.5">warning</span>
                    <div>
                      <p className="font-bold">Already Applied</p>
                      <p className="mt-0.5">You have already submitted an active application to this salon for this position.</p>
                    </div>
                  </div>
                )}

                {/* Candidate Preview Section */}
                <div className="bg-[#fdf8f8] p-4 sm:p-5 rounded-2xl border border-[#e0bec6]/50 space-y-4">
                  <h4 className="text-xs font-bold text-[#8e004b] uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-4 h-4" /> Candidate Profile Preview
                  </h4>
                  <div className="flex items-center gap-4">
                    {userProfile.avatarUrl ? (
                      <img src={userProfile.avatarUrl} alt={userProfile.name} className="w-14 h-14 rounded-full object-cover border-2 border-[#8e004b]" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-[#8e004b] text-white font-bold flex items-center justify-center text-lg">
                        {userProfile.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h5 className="text-sm font-bold text-[#1c1b1b]">{userProfile.name}</h5>
                      <p className="text-xs text-[#594047] font-medium">{userProfile.specialties?.[0] || 'Senior Beauty Professional'}</p>
                      <p className="text-[11px] text-[#8c7077] mt-0.5">{userProfile.email} • {userProfile.phone}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#e0bec6]/30 text-xs">
                    <div>
                      <span className="text-[#8c7077] block text-[11px]">Experience</span>
                      <span className="font-semibold text-[#1c1b1b]">5+ Years Professional</span>
                    </div>
                    <div>
                      <span className="text-[#8c7077] block text-[11px]">License</span>
                      <span className="font-semibold text-[#1c1b1b]">{userProfile.licenseNumber || 'CA-COS-889124'}</span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-[#8c7077] block text-[11px]">Key Skills & Specialties</span>
                      <span className="font-semibold text-[#1c1b1b]">{userProfile.specialties?.join(', ') || 'Balayage, Color Correction, Precision Cutting, Bridal Styling'}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#e0bec6]/30 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#8e004b]" />
                      <span className="font-medium text-[#1c1b1b]">Resume & Portfolio Attached</span>
                    </div>
                    <span className="font-bold text-[#e2007c] text-[11px] bg-[#ffd9e2]/50 px-2 py-1 rounded-lg">{workspaceResumeName}</span>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-[#1c1b1b] block mb-1">Expected Salary / Compensation</label>
                    <input
                      type="text"
                      value={expectedSalary}
                      onChange={(e) => setExpectedSalary(e.target.value)}
                      required
                      placeholder="e.g. $95,000 / year or $45 / hr"
                      className="w-full bg-[#fdf8f8] border border-[#e0bec6] rounded-xl p-3 text-xs text-[#1c1b1b] focus:ring-2 focus:ring-[#8e004b] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#1c1b1b] block mb-1">Availability</label>
                    <input
                      type="text"
                      value={availability}
                      onChange={(e) => setAvailability(e.target.value)}
                      required
                      placeholder="e.g. Immediate (2 weeks notice)"
                      className="w-full bg-[#fdf8f8] border border-[#e0bec6] rounded-xl p-3 text-xs text-[#1c1b1b] focus:ring-2 focus:ring-[#8e004b] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#1c1b1b] block mb-1">Optional Cover Note / Intro Message</label>
                  <textarea
                    rows={3}
                    value={coverNote}
                    onChange={(e) => setCoverNote(e.target.value)}
                    placeholder="Introduce yourself and highlight why you're a great fit..."
                    className="w-full bg-[#fdf8f8] border border-[#e0bec6] rounded-xl p-3 text-xs text-[#1c1b1b] focus:ring-2 focus:ring-[#8e004b] outline-none"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowApplyModal(false)}
                    className="flex-1 py-3 rounded-full text-xs font-bold text-[#594047] bg-[#f1edec] hover:bg-[#e6e1e1] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={applications.some(app => app.jobId === selectedJob.id)}
                    className={`flex-1 py-3 rounded-full text-xs font-bold text-white shadow-md flex items-center justify-center gap-1.5 transition-all ${
                      applications.some(app => app.jobId === selectedJob.id)
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-[#e2007c] hover:bg-[#b90064] cursor-pointer'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{applications.some(app => app.jobId === selectedJob.id) ? 'Already Applied' : 'Submit Application'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* PROFILE HEADSHOT UPLOADER & CAMERA MODAL */}
      {showImageUploader && (
        <ProfileImageUploader
          currentAvatar={userProfile.avatarUrl}
          userName={userProfile.name}
          onSaveAvatar={(newUrl) => onUpdateAvatar?.(newUrl)}
          onClose={() => setShowImageUploader(false)}
        />
      )}

      {/* SAVE SEARCH FILTER MODAL */}
      {showSaveFilterModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#e0bec6] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#e0bec6]/30">
              <div className="flex items-center gap-2 text-[#8e004b]">
                <BookmarkPlus className="w-5 h-5" />
                <h3 className="text-base font-bold text-[#1c1b1b]">Save Preferred Search Filter</h3>
              </div>
              <button
                onClick={() => setShowSaveFilterModal(false)}
                className="p-1 text-[#8c7077] hover:text-[#1c1b1b]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#594047]">
              Save this search configuration to your profile so you can quickly re-apply it anytime on future visits.
            </p>

            {/* Filter Criteria Summary */}
            <div className="bg-[#fdf8f8] p-3 rounded-2xl border border-[#e0bec6]/60 text-xs space-y-1.5">
              <div className="font-bold text-[11px] uppercase tracking-wider text-[#8e004b]">
                Included Search Criteria:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {searchQuery && (
                  <span className="px-2 py-0.5 bg-[#ffd9e2] text-[#8e004b] font-semibold text-[11px] rounded-md">
                    Keyword: &quot;{searchQuery}&quot;
                  </span>
                )}
                {selectedCategory !== 'All' && (
                  <span className="px-2 py-0.5 bg-white border border-[#e0bec6] text-[#1c1b1b] font-semibold text-[11px] rounded-md">
                    Category: {selectedCategory}
                  </span>
                )}
                {locationFilter !== 'All Locations' && (
                  <span className="px-2 py-0.5 bg-white border border-[#e0bec6] text-[#1c1b1b] font-semibold text-[11px] rounded-md">
                    Location: {locationFilter}
                  </span>
                )}
                {jobTypeFilter !== 'All Types' && (
                  <span className="px-2 py-0.5 bg-white border border-[#e0bec6] text-[#1c1b1b] font-semibold text-[11px] rounded-md">
                    Type: {jobTypeFilter}
                  </span>
                )}
                {salaryFilter !== 'All Salaries' && (
                  <span className="px-2 py-0.5 bg-white border border-[#e0bec6] text-[#1c1b1b] font-semibold text-[11px] rounded-md">
                    Salary: {salaryFilter}
                  </span>
                )}
                {selectedTag !== 'All Perks' && (
                  <span className="px-2 py-0.5 bg-white border border-[#e0bec6] text-[#1c1b1b] font-semibold text-[11px] rounded-md">
                    Perk: {selectedTag}
                  </span>
                )}
                {activeFiltersCount === 0 && (
                  <span className="text-[#8c7077] italic">All Openings Feed</span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1c1b1b] mb-1">
                Saved Search Name
              </label>
              <input
                type="text"
                value={newFilterNameInput}
                onChange={(e) => setNewFilterNameInput(e.target.value)}
                placeholder="e.g., Stylist in LA, Balayage in Beverly Hills"
                className="w-full p-2.5 bg-[#f1edec] rounded-xl border border-[#e0bec6]/60 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#e2007c]/30 text-[#1c1b1b]"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowSaveFilterModal(false)}
                className="px-4 py-2 text-xs font-bold text-[#594047] hover:bg-[#f1edec] rounded-full border border-[#e0bec6]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCurrentFilter}
                disabled={!newFilterNameInput.trim()}
                className="px-5 py-2 bg-[#8e004b] hover:bg-[#b90064] disabled:opacity-50 text-white text-xs font-bold rounded-full shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <BookmarkCheck className="w-4 h-4" /> Save to Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PUSH NOTIFICATION DRAWER / SLIDE-OVER */}
      {showNotificationDrawer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-[#fdf8f8] h-full shadow-2xl flex flex-col justify-between border-l border-[#e0bec6] animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 bg-[#8e004b] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <BellRing className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold flex items-center gap-1.5">
                    <span>Job Search Push Notifications</span>
                  </h3>
                  <p className="text-[11px] text-white/80">Matched saved search filters engine</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {alertsList.length > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-white/90 text-[11px] font-semibold flex items-center gap-1"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span className="hidden sm:inline">Read All</span>
                  </button>
                )}
                <button
                  onClick={() => setShowNotificationDrawer(false)}
                  className="p-1.5 hover:bg-white/20 rounded-full text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Notification Control Panel Bar */}
            <div className="p-3 bg-white border-b border-[#e0bec6]/60 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-[#594047] font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pushEnabled}
                    onChange={(e) => {
                      setPushEnabled(e.target.checked);
                      showToast(e.target.checked ? 'Push notifications enabled' : 'Push notifications muted');
                    }}
                    className="rounded text-[#8e004b] focus:ring-[#8e004b]"
                  />
                  <span>Push Alerts</span>
                </label>

                <label className="flex items-center gap-1.5 text-[#594047] font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={soundEnabled}
                    onChange={(e) => {
                      setSoundEnabled(e.target.checked);
                      showToast(e.target.checked ? 'Alert audio sound enabled' : 'Alert sound muted');
                    }}
                    className="rounded text-[#8e004b] focus:ring-[#8e004b]"
                  />
                  <Volume2 className="w-3.5 h-3.5 text-[#8e004b]" />
                  <span>Sound</span>
                </label>
              </div>

              {/* Simulation Trigger Button */}
              <button
                onClick={handleSimulateNewMatchAlert}
                className="px-2.5 py-1 bg-[#ffd9e2] hover:bg-[#ffb0c8] text-[#8e004b] font-bold text-[11px] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                title="Trigger a new job posting test to verify push alert matching"
              >
                <Sparkles className="w-3 h-3 text-[#e2007c]" />
                <span>Test Alert</span>
              </button>
            </div>

            {/* Notification List Content */}
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {alertsList.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <Bell className="w-12 h-12 text-[#8c7077]/40 mx-auto" />
                  <p className="text-sm font-bold text-[#1c1b1b]">No Job Match Alerts Yet</p>
                  <p className="text-xs text-[#594047] max-w-xs mx-auto leading-relaxed">
                    When new employers post jobs matching your saved search filters, instant push alerts will appear here in real time!
                  </p>
                  <button
                    onClick={handleSimulateNewMatchAlert}
                    className="mt-2 px-4 py-2 bg-[#8e004b] text-white text-xs font-bold rounded-full shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Simulate New Posting Match</span>
                  </button>
                </div>
              ) : (
                alertsList.map((alert) => {
                  const matchedJob = jobs.find((j) => j.id === alert.jobId);

                  return (
                    <div
                      key={alert.id}
                      onClick={() => handleMarkSingleRead(alert.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 relative ${
                        !alert.isRead
                          ? 'bg-white border-[#8e004b] shadow-sm ring-1 ring-[#8e004b]/20'
                          : 'bg-[#f8f4f4] border-[#e0bec6]/60 opacity-80'
                      }`}
                    >
                      {!alert.isRead && (
                        <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-[#e2007c] rounded-full animate-ping" />
                      )}

                      <div className="flex items-center justify-between gap-2 pr-4">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#8e004b] bg-[#ffd9e2] px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Radio className="w-3 h-3 text-[#e2007c]" />
                          <span>Filter: {alert.savedFilterName}</span>
                        </span>
                        <span className="text-[10px] text-[#8c7077] font-medium">{alert.matchedAt}</span>
                      </div>

                      <div>
                        <h4 className="text-xs font-extrabold text-[#1c1b1b] leading-snug">{alert.jobTitle}</h4>
                        <p className="text-[11px] font-semibold text-[#594047]">{alert.salonName} • {alert.location}</p>
                        <p className="text-[11px] font-bold text-[#8e004b] mt-0.5">{alert.salary} • {alert.category}</p>
                      </div>

                      <div className="pt-2 border-t border-[#e0bec6]/30 flex items-center justify-between gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (matchedJob) {
                              setSearchQuery(matchedJob.title);
                              setShowNotificationDrawer(false);
                              setActiveTab('feed');
                            } else {
                              setShowNotificationDrawer(false);
                              setActiveTab('feed');
                            }
                          }}
                          className="px-3 py-1 bg-[#8e004b] hover:bg-[#b90064] text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <span>View Opening</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>

                        <button
                          onClick={(e) => handleDeleteAlert(alert.id, e)}
                          className="text-[#8c7077] hover:text-rose-600 p-1 text-[11px] font-medium transition-colors cursor-pointer"
                          title="Remove alert notification"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-3 bg-[#f1edec] border-t border-[#e0bec6] flex items-center justify-between text-[11px] text-[#594047]">
              <span>Filter Engine Status: <strong className="text-emerald-700">Active</strong></span>
              <button
                onClick={() => setShowNotificationDrawer(false)}
                className="px-3 py-1 bg-white border border-[#e0bec6] font-bold rounded-lg text-[#1c1b1b] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESUME PREVIEW MODAL */}
      <ResumePreview
        isOpen={showResumePreviewModal}
        onClose={() => setShowResumePreviewModal(false)}
        resumeFileName={workspaceResumeName}
        resumeFileUrl={resumeFileUrl}
        userName={userProfile.name}
        userEmail={userProfile.email}
        userPhone={userProfile.phone}
        userRole={userProfile.primaryRole}
        userBio={userProfile.bio}
        userSkills={userProfile.skills}
        userLocation={userProfile.location}
        onDownload={() => showToast('Downloading resume PDF...')}
      />

      {/* FLOATING TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1c1b1b] text-white px-4 py-3 rounded-2xl shadow-xl border border-white/20 flex items-center gap-2.5 text-xs font-bold animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

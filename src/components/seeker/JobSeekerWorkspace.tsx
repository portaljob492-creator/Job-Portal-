import React, { useState, useEffect } from 'react';
import { JobPosting, Application, UserProfile, Conversation, ChatMessage, PortfolioItem, SavedFilter, JobAlertNotification, CandidateApplicationStatus, CandidateProfileInput, CandidateProfileSubmission } from '../../types';
import { ProfileImageUploader } from '../profile/ProfileImageUploader';
import { MessagingCenter } from '../messaging/MessagingCenter';
import { PortfolioGallery } from '../profile/PortfolioGallery';
import { BeautyNews } from './BeautyNews';
import { SeekerProfileTab } from './SeekerProfileTab';
import { ServicesGrid } from './ServicesGrid';
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
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Calendar,
  LogOut,
  Plus,
  IndianRupee,
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
  HelpCircle,
  AlertCircle
} from 'lucide-react';

const legacyCandidateStatus: Record<Application['status'], CandidateApplicationStatus> = {
  Submitted: 'Applied',
  'Under Review': 'Under Review',
  'Interview Scheduled': 'Shortlisted',
  'Offer Extended': 'Shortlisted',
  Declined: 'Rejected',
  Accepted: 'Hired',
};

const candidateStatusOf = (application: Application): CandidateApplicationStatus =>
  application.applicationStatus || legacyCandidateStatus[application.status];

const applicationDateOf = (application: Application): string => {
  if (!application.submittedAt) return application.appliedDate;
  const submitted = new Date(application.submittedAt);
  if (Number.isNaN(submitted.getTime())) return application.appliedDate;
  return submitted.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

interface JobSeekerWorkspaceProps {
  jobs: JobPosting[];
  applications: Application[];
  conversations?: Conversation[];
  messages?: ChatMessage[];
  userProfile: UserProfile;
  jobAlerts?: JobAlertNotification[];
  onToggleBookmark: (jobId: string) => void;
  onApplyJob: (job: JobPosting, coverNote: string, expectedSalary?: string, availability?: string, resumeId?: string) => Promise<void>;
  isAuthenticated: boolean;
  onRequireLogin: () => void;
  onWithdrawApplication: (applicationId: string) => Promise<void>;
  onSendMessage?: (conversationId: string, text: string, attachment?: { name: string; url: string; type: 'image' | 'file' }) => void;
  onStartConversation?: (jobId: string, targetSeekerName?: string, targetSalonName?: string) => string;
  onUpdateAvatar?: (newAvatarUrl: string | undefined) => Promise<void>;
  onUpdateProfile?: (updatedProfile: UserProfile) => Promise<void>;
  onSubmitProfile: (input: CandidateProfileInput) => Promise<CandidateProfileSubmission>;
  onMarkAlertRead?: (alertId: string) => void;
  onMarkAllAlertsRead?: () => void;
  onClearAlert?: (alertId: string) => void;
  onLogout: () => void;
  onStartApplyJob?: (job: JobPosting) => void;
  initialTab?: 'feed' | 'applications' | 'saved' | 'messages' | 'portfolio' | 'profile';
  onTabChange?: (tab: 'feed' | 'applications' | 'saved' | 'messages' | 'portfolio' | 'profile') => void;
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
  jobAlerts = [],
  onToggleBookmark,
  onApplyJob,
  isAuthenticated,
  onRequireLogin,
  onWithdrawApplication,
  onSendMessage,
  onStartConversation,
  onUpdateAvatar,
  onUpdateProfile,
  onSubmitProfile,
  onMarkAlertRead,
  onMarkAllAlertsRead,
  onClearAlert,
  onLogout,
  onStartApplyJob,
  initialTab,
  onTabChange,
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

  const navigateToTab = (tab: 'feed' | 'applications' | 'saved' | 'messages' | 'portfolio' | 'profile') => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const [activeConvId, setActiveConvId] = useState<string | undefined>(undefined);
  const [showImageUploader, setShowImageUploader] = useState<boolean>(false);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>(
    userProfile.portfolioItems || []
  );
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
  const [experienceFilter, setExperienceFilter] = useState<string>('Any Experience');
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [latestOnly, setLatestOnly] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string>('All Perks');
  const [sortBy, setSortBy] = useState<'relevant' | 'salary_high' | 'rating_high' | 'newest'>('relevant');
  const [showSavedAd, setShowSavedAd] = useState<boolean>(true);

  // Saved Search Filters State
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(
    userProfile.savedFilters || []
  );
  const [showSaveFilterModal, setShowSaveFilterModal] = useState<boolean>(false);
  const [newFilterNameInput, setNewFilterNameInput] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);

  const startVoiceSearch = () => {
    if (typeof window === 'undefined') return;
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
  const [expectedSalary, setExpectedSalary] = useState<string>('₹6,00,000 / year');
  const [availability, setAvailability] = useState<string>('Immediate (2 weeks notice)');
  const [applySuccess, setApplySuccess] = useState<boolean>(false);
  const [isApplySubmitting, setIsApplySubmitting] = useState<boolean>(false);
  const [searchApplyingJobId, setSearchApplyingJobId] = useState<string | null>(null);
  const [applicationConfirmation, setApplicationConfirmation] = useState<{ job: JobPosting; appliedDate: string } | null>(null);
  const [profileGateMessage, setProfileGateMessage] = useState<string | null>(null);
  const [withdrawingApplicationId, setWithdrawingApplicationId] = useState<string | null>(null);
  const [applicationActionError, setApplicationActionError] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile.applicationReady) setProfileGateMessage(null);
  }, [userProfile.applicationReady]);

  // Category & Filter Options
  const categories = ['All', 'Hair', 'Skincare', 'Nails', 'Lashes & Brows', 'Massage', 'Management'];
  const locations = ['All Locations', ...Array.from(new Set(jobs.map((job) => job.location).filter(Boolean)))];
  const jobTypes = ['All Types', 'Full-time', 'Part-time', 'Freelance'];
  const experienceOptions = ['Any Experience', 'Freshers', '1+ year', '3+ years', '5+ years'];
  const salaryRanges = [
    { label: 'All Salaries', value: 'All Salaries' },
    { label: '₹3 lakh+ / year', value: '₹3 lakh+' },
    { label: '₹5 lakh+ / year', value: '₹5 lakh+' },
    { label: '₹7.5 lakh+ / year', value: '₹7.5 lakh+' },
    { label: '₹10 lakh+ / year', value: '₹10 lakh+' },
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

  // Normalize Indian salary formats (annual, monthly, hourly, lakh/LPA) for filtering.
  const parseAnnualSalary = (salaryStr: string): number => {
    if (!salaryStr) return 0;
    const matches = salaryStr.replace(/,/g, '').match(/\d+(?:\.\d+)?/g);
    if (!matches?.length) return 0;
    let maxVal = Math.max(...matches.map(Number));
    const normalized = salaryStr.toLowerCase();

    if (/lpa|lakh|lac/.test(normalized)) maxVal *= 100000;
    else if (/month|\/mo\b|monthly/.test(normalized)) maxVal *= 12;
    else if (/week|\/wk\b|weekly/.test(normalized)) maxVal *= 52;
    else if (/hr|hour|hourly/.test(normalized)) maxVal *= 2000;

    // Chair-rental listings describe rent rather than earnings; use a neutral annual estimate.
    if (normalized.includes('keep 100%') || normalized.includes('chair rent')) maxVal = 600000;
    return maxVal;
  };

  const minimumExperienceMonths = (job: JobPosting): number => {
    if (job.experienceMinMonths != null) return job.experienceMinMonths;
    const experienceText = job.requirements.find((requirement) => /experience|fresher/i.test(requirement)) || '';
    if (/fresher|no experience/i.test(experienceText)) return 0;
    const years = experienceText.match(/(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)/i);
    const months = experienceText.match(/(\d+)\s*\+?\s*months?/i);
    if (years) return Math.round(Number(years[1]) * 12);
    if (months) return Number(months[1]);
    return 0;
  };

  const experienceRequired = (job: JobPosting): string => {
    const minimum = minimumExperienceMonths(job);
    const maximum = job.experienceMaxMonths;
    if ((job.freshersAllowed ?? false) && minimum === 0) return 'Freshers welcome';
    if (minimum > 0 && maximum != null && maximum >= minimum) {
      const minYears = minimum / 12;
      const maxYears = maximum / 12;
      return `${Number.isInteger(minYears) ? minYears : minYears.toFixed(1)}–${Number.isInteger(maxYears) ? maxYears : maxYears.toFixed(1)} years`;
    }
    if (minimum > 0) {
      const years = minimum / 12;
      return `${Number.isInteger(years) ? years : years.toFixed(1)}+ years`;
    }
    return job.requirements.find((requirement) => /experience|fresher/i.test(requirement)) || 'Not specified';
  };

  const jobPublishedTime = (job: JobPosting): number => {
    if (job.publishedAt) {
      const timestamp = new Date(job.publishedAt).getTime();
      if (!Number.isNaN(timestamp)) return timestamp;
    }
    const posted = job.postedDate.toLowerCase();
    if (/just now|minute|hour|today/.test(posted)) return Date.now();
    const days = posted.match(/(\d+)\s*days?/);
    if (days) return Date.now() - Number(days[1]) * 86_400_000;
    return 0;
  };

  const candidateCity = (userProfile.city || userProfile.location?.split(',')[0] || '').trim().toLowerCase();

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

    // 3. City / area
    const matchesLocation = locationFilter === 'All Locations'
      || job.location.toLowerCase().includes(locationFilter.toLowerCase());

    // 4. Full-time / Part-time / Freelance
    const matchesJobType = jobTypeFilter === 'All Types'
      || job.jobType === jobTypeFilter
      || (jobTypeFilter === 'Freelance' && ['Commission', 'Chair Rental'].includes(job.jobType));

    // 5. Salary Range
    const annualSalary = parseAnnualSalary(job.salary);
    let matchesSalary = true;
    if (salaryFilter === '₹3 lakh+') matchesSalary = annualSalary >= 300000;
    else if (salaryFilter === '₹5 lakh+') matchesSalary = annualSalary >= 500000;
    else if (salaryFilter === '₹7.5 lakh+') matchesSalary = annualSalary >= 750000;
    else if (salaryFilter === '₹10 lakh+') matchesSalary = annualSalary >= 1000000;

    // 6. Experience required
    const minimumMonths = minimumExperienceMonths(job);
    const matchesExperience = experienceFilter === 'Any Experience'
      || (experienceFilter === 'Freshers' && ((job.freshersAllowed ?? false) || minimumMonths === 0))
      || (experienceFilter === '1+ year' && minimumMonths >= 12)
      || (experienceFilter === '3+ years' && minimumMonths >= 36)
      || (experienceFilter === '5+ years' && minimumMonths >= 60);

    // 7. Nearby uses the candidate profile city; no location is guessed.
    const matchesNearby = !nearbyOnly
      || Boolean(candidateCity && job.location.toLowerCase().includes(candidateCity));

    // 8. Latest means posted within the last seven days.
    const publishedTime = jobPublishedTime(job);
    const matchesLatest = !latestOnly
      || (publishedTime > 0 && Date.now() - publishedTime <= 7 * 86_400_000);

    // Existing perk/specialty refinement remains available.
    const matchesTag =
      selectedTag === 'All Perks' ||
      job.tags.some((t) => t.toLowerCase().includes(selectedTag.toLowerCase()));

    return matchesCategory && matchesSearch && matchesLocation && matchesJobType
      && matchesSalary && matchesExperience && matchesNearby && matchesLatest && matchesTag;
  });

  // Sort Jobs
  const sortedAndFilteredJobs = [...filteredJobs].sort((a, b) => {
    if (sortBy === 'salary_high') {
      return parseAnnualSalary(b.salary) - parseAnnualSalary(a.salary);
    }
    if (sortBy === 'rating_high') {
      return b.rating - a.rating;
    }
    if (sortBy === 'newest' || latestOnly) {
      return jobPublishedTime(b) - jobPublishedTime(a);
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
    experienceFilter !== 'Any Experience',
    nearbyOnly,
    latestOnly,
    selectedTag !== 'All Perks',
    searchQuery.trim() !== ''
  ].filter(Boolean).length;

  const handleResetFilters = () => {
    setSelectedCategory('All');
    setLocationFilter('All Locations');
    setJobTypeFilter('All Types');
    setSalaryFilter('All Salaries');
    setExperienceFilter('Any Experience');
    setNearbyOnly(false);
    setLatestOnly(false);
    setSelectedTag('All Perks');
    setSearchQuery('');
    setSortBy('relevant');
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob || isApplySubmitting) return;
    const alreadyApplied = applications.some(app => app.jobId === selectedJob.id);
    if (alreadyApplied) {
      showToast('You have already submitted an application for this position.');
      return;
    }
    setIsApplySubmitting(true);
    try {
      await onApplyJob(selectedJob, coverNote, expectedSalary, availability);
      setApplySuccess(true);
      setTimeout(() => {
        setApplySuccess(false);
        setShowApplyModal(false);
      }, 1800);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to submit application. Please retry.');
    } finally {
      setIsApplySubmitting(false);
    }
  };

  const handleSearchApply = async (job: JobPosting) => {
    if (searchApplyingJobId) return;
    if (!isAuthenticated) {
      onRequireLogin();
      return;
    }
    if (!(userProfile.applicationReady ?? ((userProfile.profileCompletion || 0) >= 50))) {
      setProfileGateMessage('Please complete your candidate profile before applying.');
      setSelectedJob(null);
      navigateToTab('profile');
      return;
    }
    if (applications.some((application) => application.jobId === job.id)) {
      navigateToTab('applications');
      return;
    }

    setSearchApplyingJobId(job.id);
    try {
      // The confirmation opens only after submit_job_application returns the
      // persisted Supabase row id. The database unique key is the second layer
      // of duplicate protection behind the card-level guard above.
      await onApplyJob(job, '');
      setSelectedJob(null);
      setApplicationConfirmation({
        job,
        appliedDate: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to submit your application. Please retry.';
      if (/complete your.*profile|profile.*incomplete|PROFILE_INCOMPLETE/i.test(message)) {
        setProfileGateMessage('Please complete your candidate profile before applying.');
        setSelectedJob(null);
        navigateToTab('profile');
      } else if (/already applied|APPLICATION_ALREADY_EXISTS/i.test(message)) {
        showToast('You have already applied to this job.');
      } else {
        showToast(message);
      }
    } finally {
      setSearchApplyingJobId(null);
    }
  };

  const handleWithdrawApplication = async (application: Application) => {
    const status = candidateStatusOf(application);
    if (!['Applied', 'Under Review'].includes(status) || withdrawingApplicationId) return;
    if (!window.confirm(`Withdraw your application for ${application.jobTitle}?`)) return;
    setWithdrawingApplicationId(application.id);
    setApplicationActionError(null);
    try {
      await onWithdrawApplication(application.id);
      showToast('Application withdrawn successfully.');
    } catch (error) {
      setApplicationActionError(error instanceof Error ? error.message : 'Unable to withdraw this application. Please retry.');
    } finally {
      setWithdrawingApplicationId(null);
    }
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen text-[#0f172a] flex flex-col font-sans pb-20 md:pb-stack-default">
      {/* Top Header */}
      <header className="sticky top-0 bg-white border-b border-[#cbd5e1]/40 shadow-sm z-30 px-margin-side py-stack-default">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#6d28d9] text-white flex items-center justify-center font-bold text-xl shadow-md overflow-hidden">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuA9YCfaHhiweK-DgFXUTX5By-ZlrtM7o_48z0R1CvglhQdeBo7o43CuXSrWkbdkRD0JOPXt1SEXjDjHt4zdZm8fOv-dhvMyqdbDZUNXwmpenD2eJciah26z8NQ4rKKhffJV8gjYX4dAKtGkUZUkl0oF59mZPMl5qgGnqVkNEfaNACu_hsf0OXFq8yH8vmwqQEwxoqoq0SJgaI2EW8ndBOdaiKTgwADhial60zjXq9BxWx2H-NMVdsGgUQzUehuN6oboGQ"
                alt="Nexora Logo"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <span className="font-bold text-xl text-[#4f46e5] tracking-tight block leading-none">
                Nexora Jobs
              </span>
              <span className="text-[10px] font-semibold text-[#475569] uppercase tracking-wider">
                Beauty Talent Hub
              </span>
            </div>
          </div>

          {/* Desktop Search Bar */}
          <div className={`hidden md:flex items-center flex-1 max-w-md mx-6 bg-[#f8fafc] rounded-full px-4 py-2 ring-1 transition-all ${isListening ? 'ring-2 ring-[#4f46e5] bg-[#ede9fe]/20 animate-pulse' : 'ring-[#cbd5e1] focus-within:ring-2 focus-within:ring-[#4f46e5]'}`}>
            <Search className="w-4 h-4 text-[#64748b] mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder={isListening ? "Listening... Speak now..." : "Search by job title..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none text-xs text-[#0f172a] focus:outline-none placeholder:text-[#475569]/60"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 hover:bg-[#ede9fe] text-[#4f46e5] rounded-full transition-colors cursor-pointer ml-1"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={startVoiceSearch}
              title="Search by voice"
              className={`p-1.5 ml-1 rounded-full transition-colors cursor-pointer flex items-center justify-center ${
                isListening ? 'bg-[#4f46e5] text-white animate-bounce' : 'hover:bg-[#ede9fe] text-[#4f46e5]'
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
              className="p-2 text-[#475569] hover:text-[#4f46e5] hover:bg-[#e2e8f0] rounded-full transition-colors cursor-pointer"
            >
              <HelpCircle className="w-5 h-5 text-[#4f46e5]" />
            </button>

            {/* Job Match Notification Bell Button */}
            <button
              onClick={() => setShowNotificationDrawer(true)}
              title="Job Search Match Alerts & Push Notifications"
              className="relative p-2 text-[#475569] hover:text-[#4f46e5] hover:bg-[#e2e8f0] rounded-full transition-colors cursor-pointer"
            >
              <Bell className="w-5 h-5 text-[#4f46e5]" />
              {unreadAlertsCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#7c3aed] text-white text-[10px] font-extrabold rounded-full flex items-center justify-center animate-pulse shadow-xs">
                  {unreadAlertsCount}
                </span>
              )}
            </button>

            <div className="flex items-center gap-2 pl-2 border-l border-[#cbd5e1]/40">
              <button
                onClick={() => setShowImageUploader(true)}
                title="Change headshot"
                className="w-9 h-9 rounded-full bg-[#4f46e5] text-white font-bold flex items-center justify-center text-sm overflow-hidden border border-[#cbd5e1] hover:ring-2 hover:ring-[#4f46e5] transition-all cursor-pointer relative group"
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
                <p className="text-xs font-semibold text-[#0f172a] leading-tight">{userProfile.name}</p>
                <p className="text-[10px] text-[#475569]">Job Seeker</p>
              </div>
              <button
                onClick={onLogout}
                title="Log out"
                className="p-2 text-[#475569] hover:text-[#4f46e5] hover:bg-[#e2e8f0] rounded-full transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className={`mt-2 md:hidden flex items-center bg-[#f8fafc] rounded-full px-3 py-2 ring-1 transition-all ${isListening ? 'ring-2 ring-[#4f46e5] bg-[#ede9fe]/20 animate-pulse' : 'ring-[#cbd5e1]'}`}>
          <Search className="w-4 h-4 text-[#64748b] mr-2 flex-shrink-0" />
          <input
            type="text"
            placeholder={isListening ? "Listening..." : "Search by job title..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-[#0f172a] focus:outline-none placeholder:text-[#475569]/60"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="p-1 text-[#4f46e5]">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={startVoiceSearch}
            title="Search by voice"
            className={`p-1.5 ml-1 rounded-full transition-colors cursor-pointer flex items-center justify-center ${
              isListening ? 'bg-[#4f46e5] text-white animate-bounce' : 'hover:bg-[#ede9fe] text-[#4f46e5]'
            }`}
          >
            <Mic className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-margin-side py-section-gap flex-grow w-full">
        {/* Navigation Tabs Bar */}
        <div className="flex items-center justify-between border-b border-[#cbd5e1]/40 pb-stack-default mb-section-gap overflow-x-auto gap-stack-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateToTab('feed')}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'feed'
                  ? 'bg-[#4f46e5] text-white shadow-sm'
                  : 'bg-white text-[#475569] hover:bg-[#f8fafc] border border-[#cbd5e1]/40'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>Explore Jobs ({sortedAndFilteredJobs.length})</span>
            </button>

            <button
              onClick={() => navigateToTab('applications')}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'applications'
                  ? 'bg-[#4f46e5] text-white shadow-sm'
                  : 'bg-white text-[#475569] hover:bg-[#f8fafc] border border-[#cbd5e1]/40'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>My Applications</span>
              {applications.length > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-[#7c3aed] text-white font-bold">
                  {applications.length}
                </span>
              )}
            </button>

            <button
              onClick={() => navigateToTab('saved')}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'saved'
                  ? 'bg-[#4f46e5] text-white shadow-sm'
                  : 'bg-white text-[#475569] hover:bg-[#f8fafc] border border-[#cbd5e1]/40'
              }`}
            >
              <Bookmark className="w-4 h-4" />
              <span>Saved Jobs</span>
              {savedJobs.length > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-[#ede9fe] text-[#4f46e5] font-bold">
                  {savedJobs.length}
                </span>
              )}
            </button>

            <button
              onClick={() => navigateToTab('messages')}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'messages'
                  ? 'bg-[#4f46e5] text-white shadow-sm'
                  : 'bg-white text-[#475569] hover:bg-[#f8fafc] border border-[#cbd5e1]/40'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Messages</span>
              {conversations.reduce((acc, c) => acc + (c.unreadCountSeeker || 0), 0) > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-[#7c3aed] text-white font-bold animate-pulse">
                  {conversations.reduce((acc, c) => acc + (c.unreadCountSeeker || 0), 0)}
                </span>
              )}
            </button>

            <button
              onClick={() => navigateToTab('portfolio')}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'portfolio'
                  ? 'bg-[#4f46e5] text-white shadow-sm'
                  : 'bg-white text-[#475569] hover:bg-[#f8fafc] border border-[#cbd5e1]/40'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Work Portfolio</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#ede9fe] text-[#4f46e5] font-bold">
                {portfolioItems.length}
              </span>
            </button>

            <button
              onClick={() => navigateToTab('profile')}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-[#4f46e5] text-white shadow-sm'
                  : 'bg-white text-[#475569] hover:bg-[#f8fafc] border border-[#cbd5e1]/40'
              }`}
            >
              <UserIcon className="w-4 h-4" />
              <span>Beauty Profile</span>
            </button>
          </div>

        </div>

        {/* TAB 1: EXPLORE JOBS FEED */}
        {activeTab === 'feed' && (
          <div className="flex flex-col gap-6">
            <BeautyNews />
            {/* 12 Services Cards – requested by user */}
            <ServicesGrid
              onSelectService={(title) => {
                setSearchQuery(title);
                showToast(`Filtered by service: ${title}`);
              }}
            />
            {/* Real-Time Job Match Push Alert Banner */}
            {unreadAlertsCount > 0 && (
              <div className="bg-gradient-to-r from-[#4f46e5] via-[#5b21b6] to-[#7c3aed] text-white rounded-2xl p-4 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-white/20">
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
                    className="px-4 py-2 bg-white text-[#4f46e5] hover:bg-[#ede9fe] font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer whitespace-nowrap"
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
                <span className="text-xs font-bold text-[#0f172a] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#7c3aed]" />
                  <span>Salon Role Categories</span>
                </span>
                <span className="text-[11px] font-semibold text-[#64748b]">
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
                          ? 'bg-[#7c3aed] text-white shadow-sm'
                          : 'bg-white text-[#475569] hover:bg-[#f8fafc] border border-[#cbd5e1]/40'
                      }`}
                    >
                      <span>{cat}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          selectedCategory === cat ? 'bg-white/30 text-white' : 'bg-[#ede9fe]/60 text-[#4f46e5]'
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
                <div className="bg-[#f8fafc] p-3 rounded-2xl border border-[#ede9fe] shadow-2xs flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-bold text-[#4f46e5]">
                    <div className="flex items-center gap-1.5">
                      <BookmarkCheck className="w-4 h-4 text-[#7c3aed]" />
                      <span>Saved Search Preferences ({savedFilters.length})</span>
                    </div>
                    <button
                      onClick={() => navigateToTab('profile')}
                      className="text-[11px] font-semibold text-[#4f46e5] hover:text-[#7c3aed] hover:underline cursor-pointer transition-colors"
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
                              ? 'bg-[#4f46e5] text-white border-[#4f46e5] shadow-xs'
                              : 'bg-white text-[#0f172a] border-[#cbd5e1] hover:border-[#7c3aed] hover:bg-[#ede9fe]/40 shadow-2xs'
                          }`}
                          onClick={() => handleApplySavedFilter(sf)}
                        >
                          <Sparkles className={`w-3.5 h-3.5 ${isCurrentlyActive ? 'text-amber-300' : 'text-[#7c3aed]'}`} />
                          <span>{sf.name}</span>
                          <span className={`text-[10px] font-normal ${isCurrentlyActive ? 'text-white/80' : 'text-[#64748b]'}`}>
                            ({sf.location !== 'All Locations' ? sf.location.split(',')[0] : sf.category !== 'All' ? sf.category : 'Saved'})
                          </span>
                          <button
                            onClick={(e) => handleDeleteSavedFilter(sf.id, e)}
                            className={`ml-1 opacity-0 group-hover:opacity-100 p-0.5 rounded-full hover:bg-black/10 transition-opacity ${
                              isCurrentlyActive ? 'text-white' : 'text-[#64748b] hover:text-rose-600'
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
              <div className="bg-white p-stack-default rounded-2xl border border-[#cbd5e1]/50 shadow-xs flex flex-col gap-stack-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#cbd5e1]/30">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#4f46e5]">
                    <SlidersHorizontal className="w-4 h-4" />
                    <span>Search & Refine Filters</span>
                    {activeFiltersCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#7c3aed] text-white font-extrabold">
                        {activeFiltersCount} Active
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Save Current Search Button */}
                    <button
                      onClick={handleOpenSaveModal}
                      className="px-3 py-1 rounded-full bg-[#4f46e5] text-white hover:bg-[#6d28d9] text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                      title="Save current search criteria to profile"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      <span>Save Current Search</span>
                    </button>

                    {/* Popular quick search triggers */}
                    <div className="hidden lg:flex items-center gap-1.5 text-[11px] ml-2">
                      <span className="text-[#64748b] font-medium">Quick:</span>
                      {['Balayage', 'HydraFacial', 'Chair Rental'].map((kw) => (
                        <button
                          key={kw}
                          onClick={() => setSearchQuery(kw)}
                          className="px-2 py-0.5 rounded-md bg-[#f8fafc] hover:bg-[#ede9fe] text-[#4f46e5] font-medium border border-[#cbd5e1]/40 cursor-pointer transition-colors"
                        >
                          +{kw}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Search and filter controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5">
                  {/* Job title */}
                  <div className="relative">
                    <label htmlFor="job-title-filter" className="text-[10px] font-bold text-[#475569] uppercase block mb-1">
                      Job Title
                    </label>
                    <div className="flex items-center bg-[#f8fafc] rounded-xl px-2.5 py-1.5 border border-[#cbd5e1]">
                      <Search className="w-3.5 h-3.5 text-[#4f46e5] mr-1.5 flex-shrink-0" />
                      <input
                        id="job-title-filter"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="e.g. Hair Stylist"
                        className="w-full bg-transparent text-xs font-semibold text-[#0f172a] outline-none placeholder:text-[#64748b]"
                      />
                    </div>
                  </div>

                  {/* Category */}
                  <div className="relative">
                    <label className="text-[10px] font-bold text-[#475569] uppercase block mb-1">
                      Category
                    </label>
                    <div className="flex items-center bg-[#f8fafc] rounded-xl px-2.5 py-1.5 border border-[#cbd5e1]">
                      <Sparkles className="w-3.5 h-3.5 text-[#4f46e5] mr-1.5 flex-shrink-0" />
                      <select
                        value={selectedCategory}
                        onChange={(event) => setSelectedCategory(event.target.value)}
                        className="w-full bg-transparent text-xs font-semibold text-[#0f172a] outline-none cursor-pointer"
                      >
                        {categories.map((categoryName) => <option key={categoryName} value={categoryName}>{categoryName}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* City / Area */}
                  <div className="relative">
                    <label className="text-[10px] font-bold text-[#475569] uppercase block mb-1">
                      City / Area
                    </label>
                    <div className="flex items-center bg-[#f8fafc] rounded-xl px-2.5 py-1.5 border border-[#cbd5e1]">
                      <MapPin className="w-3.5 h-3.5 text-[#4f46e5] mr-1.5 flex-shrink-0" />
                      <select
                        value={locationFilter}
                        onChange={(e) => setLocationFilter(e.target.value)}
                        className="w-full bg-transparent text-xs font-semibold text-[#0f172a] outline-none cursor-pointer"
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
                    <label className="text-[10px] font-bold text-[#475569] uppercase block mb-1">
                      Salary Range
                    </label>
                    <div className="flex items-center bg-[#f8fafc] rounded-xl px-2.5 py-1.5 border border-[#cbd5e1]">
                      <IndianRupee className="w-3.5 h-3.5 text-[#4f46e5] mr-1.5 flex-shrink-0" />
                      <select
                        value={salaryFilter}
                        onChange={(e) => setSalaryFilter(e.target.value)}
                        className="w-full bg-transparent text-xs font-semibold text-[#0f172a] outline-none cursor-pointer"
                      >
                        {salaryRanges.map((sal) => (
                          <option key={sal.value} value={sal.value}>
                            {sal.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Experience */}
                  <div className="relative">
                    <label className="text-[10px] font-bold text-[#475569] uppercase block mb-1">
                      Experience
                    </label>
                    <div className="flex items-center bg-[#f8fafc] rounded-xl px-2.5 py-1.5 border border-[#cbd5e1]">
                      <Clock className="w-3.5 h-3.5 text-[#4f46e5] mr-1.5 flex-shrink-0" />
                      <select
                        value={experienceFilter}
                        onChange={(event) => setExperienceFilter(event.target.value)}
                        className="w-full bg-transparent text-xs font-semibold text-[#0f172a] outline-none cursor-pointer"
                      >
                        {experienceOptions.map((experience) => <option key={experience} value={experience}>{experience}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Full-time / Part-time / Freelance */}
                  <div className="relative">
                    <label className="text-[10px] font-bold text-[#475569] uppercase block mb-1">
                      Employment Type
                    </label>
                    <div className="flex items-center bg-[#f8fafc] rounded-xl px-2.5 py-1.5 border border-[#cbd5e1]">
                      <Briefcase className="w-3.5 h-3.5 text-[#4f46e5] mr-1.5 flex-shrink-0" />
                      <select
                        value={jobTypeFilter}
                        onChange={(e) => setJobTypeFilter(e.target.value)}
                        className="w-full bg-transparent text-xs font-semibold text-[#0f172a] outline-none cursor-pointer"
                      >
                        {jobTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Nearby and latest */}
                  <div className="relative">
                    <label className="text-[10px] font-bold text-[#475569] uppercase block mb-1">
                      Job Discovery
                    </label>
                    <div className="min-h-[34px] flex items-center gap-2 bg-[#f8fafc] rounded-xl px-2.5 py-1.5 border border-[#cbd5e1]">
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0f172a] cursor-pointer">
                        <input type="checkbox" checked={nearbyOnly} onChange={(event) => setNearbyOnly(event.target.checked)} className="accent-[#4f46e5]" />
                        Nearby jobs
                      </label>
                      <span className="text-[#cbd5e1]">|</span>
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0f172a] cursor-pointer">
                        <input type="checkbox" checked={latestOnly} onChange={(event) => setLatestOnly(event.target.checked)} className="accent-[#4f46e5]" />
                        Latest jobs
                      </label>
                    </div>
                  </div>

                  {/* Perk & Specialty Tag Filter */}
                  <div className="relative">
                    <label className="text-[10px] font-bold text-[#475569] uppercase block mb-1">
                      Perks & Specialties
                    </label>
                    <div className="flex items-center bg-[#f8fafc] rounded-xl px-2.5 py-1.5 border border-[#cbd5e1]">
                      <Tag className="w-3.5 h-3.5 text-[#4f46e5] mr-1.5 flex-shrink-0" />
                      <select
                        value={selectedTag}
                        onChange={(e) => setSelectedTag(e.target.value)}
                        className="w-full bg-transparent text-xs font-semibold text-[#0f172a] outline-none cursor-pointer"
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
                    <label className="text-[10px] font-bold text-[#475569] uppercase block mb-1">
                      Sort Results
                    </label>
                    <div className="flex items-center bg-[#f8fafc] rounded-xl px-2.5 py-1.5 border border-[#cbd5e1]">
                      <ArrowUpDown className="w-3.5 h-3.5 text-[#4f46e5] mr-1.5 flex-shrink-0" />
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="w-full bg-transparent text-xs font-semibold text-[#0f172a] outline-none cursor-pointer"
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
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#cbd5e1]/30">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-[11px] font-semibold text-[#475569] mr-1">Applied Filters:</span>

                      {searchQuery && (
                        <span className="inline-flex items-center gap-1 bg-[#ede9fe] text-[#4f46e5] px-2.5 py-0.5 rounded-full text-xs font-semibold">
                          Keyword: "{searchQuery}"
                          <button onClick={() => setSearchQuery('')} className="hover:text-[#6d28d9]">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}

                      {selectedCategory !== 'All' && (
                        <span className="inline-flex items-center gap-1 bg-[#ede9fe] text-[#4f46e5] px-2.5 py-0.5 rounded-full text-xs font-semibold">
                          Role: {selectedCategory}
                          <button onClick={() => setSelectedCategory('All')} className="hover:text-[#6d28d9]">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}

                      {locationFilter !== 'All Locations' && (
                        <span className="inline-flex items-center gap-1 bg-[#ede9fe] text-[#4f46e5] px-2.5 py-0.5 rounded-full text-xs font-semibold">
                          Location: {locationFilter}
                          <button onClick={() => setLocationFilter('All Locations')} className="hover:text-[#6d28d9]">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}

                      {salaryFilter !== 'All Salaries' && (
                        <span className="inline-flex items-center gap-1 bg-[#ede9fe] text-[#4f46e5] px-2.5 py-0.5 rounded-full text-xs font-semibold">
                          Salary: {salaryFilter}
                          <button onClick={() => setSalaryFilter('All Salaries')} className="hover:text-[#6d28d9]">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}

                      {jobTypeFilter !== 'All Types' && (
                        <span className="inline-flex items-center gap-1 bg-[#ede9fe] text-[#4f46e5] px-2.5 py-0.5 rounded-full text-xs font-semibold">
                          Type: {jobTypeFilter}
                          <button onClick={() => setJobTypeFilter('All Types')} className="hover:text-[#6d28d9]">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}

                      {experienceFilter !== 'Any Experience' && (
                        <span className="inline-flex items-center gap-1 bg-[#ede9fe] text-[#4f46e5] px-2.5 py-0.5 rounded-full text-xs font-semibold">
                          Experience: {experienceFilter}
                          <button onClick={() => setExperienceFilter('Any Experience')} className="hover:text-[#6d28d9]">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}

                      {nearbyOnly && (
                        <span className="inline-flex items-center gap-1 bg-[#ede9fe] text-[#4f46e5] px-2.5 py-0.5 rounded-full text-xs font-semibold">
                          Nearby jobs
                          <button onClick={() => setNearbyOnly(false)} className="hover:text-[#6d28d9]"><X className="w-3 h-3" /></button>
                        </span>
                      )}

                      {latestOnly && (
                        <span className="inline-flex items-center gap-1 bg-[#ede9fe] text-[#4f46e5] px-2.5 py-0.5 rounded-full text-xs font-semibold">
                          Latest jobs
                          <button onClick={() => setLatestOnly(false)} className="hover:text-[#6d28d9]"><X className="w-3 h-3" /></button>
                        </span>
                      )}

                      {selectedTag !== 'All Perks' && (
                        <span className="inline-flex items-center gap-1 bg-[#ede9fe] text-[#4f46e5] px-2.5 py-0.5 rounded-full text-xs font-semibold">
                          Perk: {selectedTag}
                          <button onClick={() => setSelectedTag('All Perks')} className="hover:text-[#6d28d9]">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}
                    </div>

                    <button
                      onClick={handleResetFilters}
                      className="text-xs text-[#4f46e5] font-bold hover:underline flex items-center gap-1 cursor-pointer ml-auto"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset All</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Results Count Summary Banner */}
            <div className="flex items-center justify-between text-xs text-[#475569] font-medium px-1">
              <p>
                Showing <strong className="text-[#4f46e5] font-extrabold">{sortedAndFilteredJobs.length}</strong> of{' '}
                <strong className="text-[#0f172a]">{jobs.length}</strong> luxury salon job listings
              </p>
              {sortBy !== 'relevant' && (
                <span className="text-[11px] font-semibold text-[#4f46e5] bg-[#ede9fe] px-2.5 py-0.5 rounded-full">
                  Sorted by: {sortBy === 'salary_high' ? 'Highest Compensation' : sortBy === 'rating_high' ? 'Top Rated' : 'Newest'}
                </span>
              )}
            </div>

            {/* Jobs List Grid */}
            {sortedAndFilteredJobs.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 sm:p-14 text-center border border-[#cbd5e1]/40 my-4 shadow-sm space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#ede9fe] text-[#4f46e5] flex items-center justify-center mx-auto">
                  <Sparkles className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0f172a] mb-1">No roles matched your search criteria</h3>
                  <p className="text-xs sm:text-sm text-[#475569] max-w-md mx-auto">
                    We couldn't find any salon listings matching your active filters. Try clearing your search keyword or relaxing salary & location options.
                  </p>
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  <button
                    onClick={handleResetFilters}
                    className="px-6 py-2.5 bg-[#4f46e5] hover:bg-[#6d28d9] text-white text-xs font-bold rounded-full shadow-md transition-all cursor-pointer flex items-center gap-1.5"
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
                    className="bg-white rounded-2xl border border-[#cbd5e1]/50 shadow-[0_4px_16px_rgba(15,23,42,0.05)] hover:shadow-md transition-all duration-300 flex flex-col overflow-hidden group"
                  >
                    {/* Image Header */}
                    <div className="relative h-44 w-full overflow-hidden bg-[#f1f5f9]">
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
                          <span className="bg-[#7c3aed] text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Featured
                          </span>
                        )}
                        <span className="bg-white/90 backdrop-blur-md text-[#0f172a] text-[10px] font-bold px-2.5 py-1 rounded-full">
                          {job.jobType}
                        </span>
                      </div>

                      {/* Bookmark Button */}
                      <button
                        onClick={() => onToggleBookmark(job.id)}
                        aria-label="Save job"
                        className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-[#4f46e5] hover:bg-white transition-colors cursor-pointer shadow-sm"
                      >
                        {job.isBookmarked ? (
                          <BookmarkCheck className="w-5 h-5 fill-[#4f46e5]" />
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
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-[#ede9fe] text-[#4f46e5] px-2 py-0.5 rounded-md">
                            {job.category}
                          </span>
                          <span className="text-[10px] text-[#64748b]">{job.postedDate}</span>
                        </div>

                        <h3 className="text-base font-bold text-[#0f172a] leading-tight mb-1 group-hover:text-[#4f46e5] transition-colors">
                          {job.title}
                        </h3>

                        <p className="text-sm font-extrabold text-[#7c3aed] mb-2">
                          {job.salary}
                        </p>

                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="rounded-lg bg-[#f8fafc] border border-[#cbd5e1]/30 px-2.5 py-2">
                            <p className="text-[9px] uppercase tracking-wide font-bold text-[#64748b]">Experience Required</p>
                            <p className="text-[11px] font-bold text-[#0f172a] mt-0.5">{experienceRequired(job)}</p>
                          </div>
                          <div className="rounded-lg bg-[#f8fafc] border border-[#cbd5e1]/30 px-2.5 py-2">
                            <p className="text-[9px] uppercase tracking-wide font-bold text-[#64748b]">Job Type</p>
                            <p className="text-[11px] font-bold text-[#0f172a] mt-0.5">{job.jobType}</p>
                          </div>
                        </div>

                        <p className="text-xs text-[#475569] line-clamp-2 leading-relaxed mb-3">
                          {job.description}
                        </p>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {job.tags.slice(0, 3).map((tag, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-semibold bg-[#ede9fe]/60 text-[#4f46e5] px-2.5 py-0.5 rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-3 border-t border-[#cbd5e1]/30 flex items-center justify-between gap-2 mt-auto">
                        <span className="text-[10px] text-[#64748b] flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Posted {job.postedDate}
                        </span>

                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            onClick={() => setSelectedJob(job)}
                            className="px-3 py-1.5 rounded-full text-xs font-semibold text-[#4f46e5] bg-[#f1f5f9] hover:bg-[#ede9fe] transition-colors cursor-pointer"
                          >
                            Details
                          </button>
                          {applications.some((application) => application.jobId === job.id) ? (
                            <>
                              <span className="px-3 py-1.5 rounded-full text-xs font-bold text-[#475569] bg-[#f1f5f9] border border-[#cbd5e1]">
                                Already Applied
                              </span>
                              <button
                                type="button"
                                onClick={() => navigateToTab('applications')}
                                className="px-3 py-1.5 rounded-full text-xs font-bold text-[#4f46e5] bg-[#ede9fe] hover:bg-[#c4b5fd] transition-colors"
                              >
                                View Application
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleSearchApply(job)}
                              disabled={Boolean(searchApplyingJobId)}
                              className="px-4 py-1.5 rounded-full text-xs font-bold text-white bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-60 transition-colors active:scale-95 shadow-xs cursor-pointer"
                            >
                              {searchApplyingJobId === job.id ? 'Applying…' : 'Apply Now'}
                            </button>
                          )}
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
            <div className="bg-white p-margin-side rounded-2xl border border-[#cbd5e1]/40 shadow-xs flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#0f172a]">My Applications</h2>
                <p className="text-xs text-[#475569]">See every job you applied for and track its latest hiring status.</p>
              </div>
              <span className="shrink-0 px-3 py-1 bg-[#ede9fe] text-[#4f46e5] text-xs font-bold rounded-full">
                {applications.length} Total
              </span>
            </div>

            {applicationActionError && (
              <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{applicationActionError}</span>
                <button type="button" onClick={() => setApplicationActionError(null)} className="ml-auto font-bold underline">Dismiss</button>
              </div>
            )}

            {applications.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-[#cbd5e1]/40">
                <FileText className="w-12 h-12 text-[#64748b] mx-auto mb-3 opacity-50" />
                <h3 className="text-base font-bold text-[#0f172a] mb-1">You have not applied for any job yet.</h3>
                <button
                  type="button"
                  onClick={() => navigateToTab('feed')}
                  className="mt-4 px-5 py-2.5 bg-[#7c3aed] text-white text-xs font-bold rounded-full shadow-sm hover:bg-[#6d28d9] transition-colors"
                >
                  Search Jobs
                </button>
              </div>
            ) : (
              <div className="space-y-stack-default">
                {applications.map((app) => {
                  const linkedJob = app.job || jobs.find((job) => job.id === app.jobId);
                  const candidateStatus = candidateStatusOf(app);
                  const canWithdraw = candidateStatus === 'Applied' || candidateStatus === 'Under Review';
                  const isWithdrawing = withdrawingApplicationId === app.id;
                  const statusClass = candidateStatus === 'Hired'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : candidateStatus === 'Shortlisted'
                      ? 'bg-[#ede9fe] text-[#4f46e5] border-[#c4b5fd]'
                      : candidateStatus === 'Under Review'
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : candidateStatus === 'Rejected'
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : candidateStatus === 'Withdrawn'
                            ? 'bg-slate-100 text-slate-700 border-slate-300'
                            : 'bg-[#f1f5f9] text-[#475569] border-[#cbd5e1]';
                  return (
                    <article
                      key={app.id}
                      className="bg-white rounded-2xl p-margin-side border border-[#cbd5e1]/50 shadow-sm"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-stack-default">
                        <div className="flex items-start gap-stack-default min-w-0">
                          {app.salonLogo ? (
                            <img
                              src={app.salonLogo}
                              alt={app.salonName}
                              referrerPolicy="no-referrer"
                              className="w-12 h-12 rounded-xl object-cover border border-[#cbd5e1] shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-[#ede9fe] text-[#4f46e5] font-bold flex items-center justify-center text-lg shrink-0">
                              {app.salonName.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h3 className="text-base font-bold text-[#0f172a]">{app.jobTitle}</h3>
                            <p className="text-xs font-semibold text-[#4f46e5] mt-0.5">{app.salonName}</p>
                            <p className="text-xs text-[#475569] flex items-center gap-1 mt-1">
                              <MapPin className="w-3.5 h-3.5 shrink-0" /> {app.location || 'Location not provided'}
                            </p>
                          </div>
                        </div>
                        <span aria-label={`Application Status: ${candidateStatus}`} className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold border w-fit ${statusClass}`}>
                          {candidateStatus}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-[#cbd5e1]/30">
                        <div className="rounded-xl bg-[#f8fafc] px-3 py-2.5">
                          <p className="text-[10px] uppercase tracking-wide font-bold text-[#64748b]">Salary Range</p>
                          <p className="text-xs font-bold text-[#0f172a] mt-1">{app.salaryRange || linkedJob?.salary || 'Not disclosed'}</p>
                        </div>
                        <div className="rounded-xl bg-[#f8fafc] px-3 py-2.5">
                          <p className="text-[10px] uppercase tracking-wide font-bold text-[#64748b]">Job Type</p>
                          <p className="text-xs font-bold text-[#0f172a] mt-1">{app.jobType || linkedJob?.jobType || 'Not specified'}</p>
                        </div>
                        <div className="rounded-xl bg-[#f8fafc] px-3 py-2.5">
                          <p className="text-[10px] uppercase tracking-wide font-bold text-[#64748b]">Applied Date</p>
                          <p className="text-xs font-bold text-[#0f172a] mt-1">{applicationDateOf(app)}</p>
                        </div>
                      </div>

                      {app.notes && (
                        <div className="mt-3 text-xs bg-[#f8fafc] p-stack-sm rounded-lg border border-[#cbd5e1]/30 text-[#0f172a]">
                          <span className="font-semibold text-[#4f46e5]">Update: </span>{app.notes}
                        </div>
                      )}

                      {app.interviewDate && (
                        <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg w-fit">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{app.interviewDate}</span>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 mt-4">
                        <button
                          type="button"
                          onClick={() => linkedJob ? setSelectedJob(linkedJob) : showToast('This job listing is no longer available.')}
                          className="px-4 py-2 rounded-full text-xs font-bold bg-[#4f46e5] text-white hover:bg-[#6d28d9] transition-colors flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Job
                        </button>

                        {canWithdraw && (
                          <button
                            type="button"
                            onClick={() => void handleWithdrawApplication(app)}
                            disabled={Boolean(withdrawingApplicationId)}
                            className="px-4 py-2 rounded-full text-xs font-bold border border-rose-300 text-rose-700 bg-white hover:bg-rose-50 transition-colors disabled:opacity-60 flex items-center gap-1.5"
                          >
                            <RotateCcw className={`w-3.5 h-3.5 ${isWithdrawing ? 'animate-spin' : ''}`} />
                            {isWithdrawing ? 'Withdrawing…' : 'Withdraw Application'}
                          </button>
                        )}

                        {app.status === 'Interview Scheduled' && onViewInvitation && (
                          <button
                            type="button"
                            onClick={() => onViewInvitation(app)}
                            className="px-4 py-2 rounded-full text-xs font-bold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors flex items-center gap-1.5"
                          >
                            <Calendar className="w-3.5 h-3.5" /> View Invitation
                          </button>
                        )}

                        {app.status === 'Offer Extended' && onViewOffer && (
                          <button
                            type="button"
                            onClick={() => onViewOffer(app)}
                            className="px-4 py-2 rounded-full text-xs font-bold bg-[#7c3aed] text-white hover:bg-[#6d28d9] transition-colors flex items-center gap-1.5"
                          >
                            <FileText className="w-3.5 h-3.5" /> View Offer
                          </button>
                        )}

                        {onStartConversation && candidateStatus !== 'Withdrawn' && (
                          <button
                            type="button"
                            onClick={() => {
                              const conversationId = onStartConversation(app.jobId, userProfile.name, app.salonName);
                              setActiveConvId(conversationId);
                              navigateToTab('messages');
                            }}
                            className="px-4 py-2 rounded-full text-xs font-bold bg-[#ede9fe] text-[#4f46e5] hover:bg-[#c4b5fd] transition-colors flex items-center gap-1.5"
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> Message Salon
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SAVED JOBS */}
        {activeTab === 'saved' && (
          <div className="space-y-section-gap">
            <div className="bg-white p-margin-side rounded-2xl border border-[#cbd5e1]/40 shadow-xs flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#0f172a]">Saved Positions</h2>
                <p className="text-xs text-[#475569]">Your bookmarked salon opportunities.</p>
              </div>
              <span className="px-3 py-1 bg-[#ede9fe] text-[#4f46e5] text-xs font-bold rounded-full">
                {savedJobs.length} Saved
              </span>
            </div>

            {showSavedAd && (
              <div className="relative overflow-hidden bg-gradient-to-r from-[#ede9fe]/20 via-[#f8fafc] to-white rounded-2xl border border-[#cbd5e1]/45 p-6 shadow-xs animate-in fade-in slide-in-from-top-4 duration-500">
                {/* Close Button */}
                <button
                  onClick={() => setShowSavedAd(false)}
                  className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[#ede9fe]/60 text-[#475569] hover:text-[#4f46e5] transition-all cursor-pointer z-10"
                  title="Dismiss advertisement"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  {/* Text Content */}
                  <div className="flex-1 space-y-3">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#4f46e5] text-white text-[10px] font-extrabold uppercase tracking-wide">
                      <Sparkles className="w-3 h-3 animate-pulse text-[#ede9fe]" />
                      <span>Partner Spotlight</span>
                    </div>

                    <h3 className="text-lg md:text-xl font-bold text-[#0f172a] leading-tight">
                      Dyson Professional Masterclass: Elite Styling 2026
                    </h3>

                    <p className="text-xs text-[#475569] leading-relaxed max-w-xl">
                      Master advanced thermal technology, ergonomic styling, and modern precision drying with Dyson's Global Educators. Get certified and earn an exclusive <strong className="text-[#4f46e5] font-bold">"Verified Advanced Stylist"</strong> badge on your Nexora profile.
                    </p>

                    <div className="flex flex-wrap items-center gap-4 pt-1">
                      <a
                        href="https://www.dyson.com/hair-care/professional/masterclass"
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 bg-[#4f46e5] text-white text-xs font-bold rounded-full hover:bg-[#6d28d9] transition-all flex items-center gap-1.5 shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer"
                      >
                        <span>Reserve Free Seat</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <span className="text-[11px] text-[#475569] font-semibold">
                        Exclusive 15% off Dyson Professional tools for attendees
                      </span>
                    </div>
                  </div>

                  {/* Visual Asset Block */}
                  <div className="relative shrink-0 w-full md:w-48 h-32 bg-[#ede9fe]/10 rounded-xl overflow-hidden border border-[#cbd5e1]/30 flex items-center justify-center">
                    {/* Background decorative circles */}
                    <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-[#7c3aed]/5 blur-lg" />
                    <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full bg-[#4f46e5]/5 blur-lg" />

                    <img
                      src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=300"
                      alt="Premium Hair Dryer Styling Tool"
                      className="w-full h-full object-cover opacity-90 transition-transform duration-700 hover:scale-105"
                      referrerPolicy="no-referrer"
                    />

                    {/* Tiny Floating Badge */}
                    <div className="absolute bottom-2 left-2 bg-white/95 backdrop-blur-xs border border-[#cbd5e1]/40 px-2 py-1 rounded-md text-[9px] font-extrabold text-[#4f46e5] shadow-2xs">
                      Nexora Certified
                    </div>
                  </div>
                </div>
              </div>
            )}

            {savedJobs.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-[#cbd5e1]/40">
                <Bookmark className="w-12 h-12 text-[#64748b] mx-auto mb-3 opacity-50" />
                <h3 className="text-base font-bold text-[#0f172a] mb-1">No bookmarked positions</h3>
                <p className="text-xs text-[#475569] mb-4">Click the bookmark icon on any job card to save it for later.</p>
                <button
                  onClick={() => navigateToTab('feed')}
                  className="px-5 py-2 bg-[#4f46e5] text-white text-xs font-bold rounded-full shadow-sm"
                >
                  Browse Job Feed
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-stack-default">
                {savedJobs.map((job) => (
                  <div key={job.id} className="bg-white rounded-2xl border border-[#cbd5e1]/50 p-stack-default flex flex-col justify-between gap-stack-sm shadow-xs">
                    <div>
                      <div className="flex justify-between items-start gap-stack-sm mb-stack-sm">
                        <div>
                          <span className="text-xs font-semibold text-[#4f46e5]">{job.salonName}</span>
                          <h3 className="text-base font-bold text-[#0f172a]">{job.title}</h3>
                        </div>
                        <button
                          onClick={() => onToggleBookmark(job.id)}
                          aria-label="Remove bookmark"
                          className="text-[#4f46e5] p-1 cursor-pointer"
                        >
                          <BookmarkCheck className="w-5 h-5 fill-[#4f46e5]" />
                        </button>
                      </div>

                      <p className="text-xs font-bold text-[#7c3aed] mb-stack-sm">{job.salary}</p>
                      <p className="text-xs text-[#475569] flex items-center gap-stack-sm mb-stack-default">
                        <MapPin className="w-3 h-3" /> {job.location}
                      </p>
                    </div>

                    <div className="pt-stack-sm border-t border-[#cbd5e1]/30 flex gap-stack-sm">
                      <button
                        onClick={() => setSelectedJob(job)}
                        className="flex-1 py-2 rounded-full text-xs font-semibold text-[#4f46e5] bg-[#f1f5f9] hover:bg-[#ede9fe] transition-colors cursor-pointer"
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
                        className="flex-1 py-2 rounded-full text-xs font-bold text-white bg-[#7c3aed] hover:bg-[#6d28d9] transition-colors cursor-pointer"
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
          <div className="space-y-4">
            {profileGateMessage && (
              <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{profileGateMessage}</span>
              </div>
            )}
            <SeekerProfileTab
              userProfile={userProfile}
              onUpdateProfile={onUpdateProfile}
              onSubmitProfile={onSubmitProfile}
              onLogout={onLogout}
              onNavigateTab={navigateToTab}
              onNavigateScreen={onNavigateScreen}
            />
          </div>
        )}
      </main>

      {/* SEARCH APPLICATION CONFIRMATION */}
      {applicationConfirmation && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="application-success-title">
          <div className="w-full max-w-md bg-white rounded-3xl border border-[#cbd5e1] shadow-2xl overflow-hidden animate-scale-up">
            <div className="bg-gradient-to-br from-[#4f46e5] to-[#7c3aed] px-6 py-8 text-white text-center">
              <div className="w-16 h-16 rounded-full bg-white/20 border border-white/30 mx-auto grid place-items-center mb-4">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h2 id="application-success-title" className="text-xl font-extrabold">Application submitted successfully.</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-2xl bg-[#f8fafc] border border-[#cbd5e1]/50 p-4 space-y-3">
                <div><p className="text-[10px] uppercase tracking-wide font-bold text-[#64748b]">Job Title</p><p className="text-sm font-extrabold text-[#0f172a] mt-0.5">{applicationConfirmation.job.title}</p></div>
                <div><p className="text-[10px] uppercase tracking-wide font-bold text-[#64748b]">Salon Name</p><p className="text-sm font-bold text-[#4f46e5] mt-0.5">{applicationConfirmation.job.salonName}</p></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-[10px] uppercase tracking-wide font-bold text-[#64748b]">Applied Date</p><p className="text-xs font-bold text-[#0f172a] mt-0.5">{applicationConfirmation.appliedDate}</p></div>
                  <div><p className="text-[10px] uppercase tracking-wide font-bold text-[#64748b]">Status</p><p className="text-xs font-extrabold text-emerald-700 mt-0.5">Applied</p></div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setApplicationConfirmation(null); navigateToTab('applications'); }}
                className="w-full rounded-full bg-[#7c3aed] text-white py-3 text-xs font-bold hover:bg-[#6d28d9] transition-colors"
              >
                View My Applications
              </button>
              <button
                type="button"
                onClick={() => { setApplicationConfirmation(null); navigateToTab('feed'); }}
                className="w-full rounded-full bg-white border border-[#4f46e5] text-[#4f46e5] py-3 text-xs font-bold hover:bg-[#ede9fe]/30 transition-colors"
              >
                Continue Searching
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JOB DETAIL MODAL */}
      {selectedJob && !showApplyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#cbd5e1] shadow-2xl animate-scale-up">
            <div className="relative h-56 w-full bg-[#f1f5f9]">
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
                  <span className="text-xs font-bold uppercase tracking-wider bg-[#7c3aed] px-2.5 py-0.5 rounded-full mb-1 inline-block">
                    {selectedJob.category}
                  </span>
                  <h2 className="text-xl font-extrabold text-white leading-tight drop-shadow-md">
                    {selectedJob.title}
                  </h2>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#f8fafc] rounded-2xl border border-[#cbd5e1]/40">
                <div>
                  <span className="text-xs font-bold text-[#4f46e5]">{selectedJob.salonName}</span>
                  <p className="text-xs text-[#475569] flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5" /> {selectedJob.location}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-extrabold text-[#7c3aed] block">{selectedJob.salary}</span>
                  <span className="text-[10px] text-[#64748b] font-semibold uppercase">{selectedJob.jobType}</span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-wider mb-2">About the Role</h3>
                <p className="text-xs text-[#475569] leading-relaxed">{selectedJob.description}</p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-wider mb-2">Requirements</h3>
                <ul className="space-y-1.5 text-xs text-[#475569]">
                  {selectedJob.requirements.map((req, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-[#4f46e5] font-bold">•</span>
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-wider mb-2">Perks & Benefits</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedJob.benefits.map((ben, i) => (
                    <div key={i} className="p-2.5 bg-[#ede9fe]/30 rounded-xl text-xs font-medium text-[#4f46e5] flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#7c3aed] flex-shrink-0" />
                      <span>{ben}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-[#cbd5e1]/40 flex gap-3">
                <button
                  onClick={() => setSelectedJob(null)}
                  className="flex-1 py-3 rounded-full text-xs font-bold text-[#475569] bg-[#f1f5f9] hover:bg-[#e2e8f0] transition-colors cursor-pointer"
                >
                  Close
                </button>
                {applications.some((application) => application.jobId === selectedJob.id) ? (
                  <button
                    type="button"
                    onClick={() => { setSelectedJob(null); navigateToTab('applications'); }}
                    className="flex-1 py-3 rounded-full text-xs font-bold text-[#4f46e5] bg-[#ede9fe] hover:bg-[#c4b5fd] shadow-md transition-colors cursor-pointer"
                  >
                    View Application
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={Boolean(searchApplyingJobId) || Boolean(selectedJob.approvalStatus && selectedJob.approvalStatus !== 'approved')}
                    onClick={() => void handleSearchApply(selectedJob)}
                    className="flex-1 py-3 rounded-full text-xs font-bold text-white bg-[#7c3aed] hover:bg-[#6d28d9] disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md transition-colors cursor-pointer"
                  >
                    {selectedJob.approvalStatus && selectedJob.approvalStatus !== 'approved'
                      ? 'Position Closed'
                      : searchApplyingJobId === selectedJob.id
                        ? 'Applying…'
                        : 'Apply Now'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 21 — APPLY JOB (Review your application) */}
      {showApplyModal && selectedJob && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 border border-[#cbd5e1] shadow-2xl animate-scale-up my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start pb-4 border-b border-[#cbd5e1]/30 mb-6">
              <div>
                <span className="text-[10px] font-mono tracking-wider text-[#64748b] uppercase bg-[#f1f5f9] px-2 py-0.5 rounded-md">
                  /app/jobs/job/{selectedJob.id}/apply
                </span>
                <h3 className="text-xl font-bold text-[#0f172a] mt-1">Review your application</h3>
                <p className="text-xs text-[#475569]">Applying to <span className="font-semibold text-[#4f46e5]">{selectedJob.salonName}</span> — {selectedJob.title}</p>
              </div>
              <button
                onClick={() => setShowApplyModal(false)}
                className="p-1.5 text-[#475569] hover:text-[#0f172a] rounded-full hover:bg-[#f1f5f9] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {applySuccess ? (
              <div className="py-12 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <h4 className="text-xl font-bold text-[#0f172a]">Application Submitted Successfully!</h4>
                <p className="text-xs text-[#475569] max-w-sm mx-auto">
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
                <div className="bg-[#f8fafc] p-4 sm:p-5 rounded-2xl border border-[#cbd5e1]/50 space-y-4">
                  <h4 className="text-xs font-bold text-[#4f46e5] uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-4 h-4" /> Candidate Profile Preview
                  </h4>
                  <div className="flex items-center gap-4">
                    {userProfile.avatarUrl ? (
                      <img src={userProfile.avatarUrl} alt={userProfile.name} className="w-14 h-14 rounded-full object-cover border-2 border-[#4f46e5]" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-[#4f46e5] text-white font-bold flex items-center justify-center text-lg">
                        {userProfile.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h5 className="text-sm font-bold text-[#0f172a]">{userProfile.name}</h5>
                      <p className="text-xs text-[#475569] font-medium">{userProfile.primaryRole || userProfile.specialties?.[0] || 'Role not added'}</p>
                      <p className="text-[11px] text-[#64748b] mt-0.5">{userProfile.email} • {userProfile.phone}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#cbd5e1]/30 text-xs">
                    <div>
                      <span className="text-[#64748b] block text-[11px]">Experience</span>
                      <span className="font-semibold text-[#0f172a]">{Math.floor((userProfile.totalExperienceMonths || 0) / 12)} years professional</span>
                    </div>
                    <div>
                      <span className="text-[#64748b] block text-[11px]">License</span>
                      <span className="font-semibold text-[#0f172a]">{userProfile.licenseNumber || 'Not added'}</span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-[#64748b] block text-[11px]">Key Skills & Specialties</span>
                      <span className="font-semibold text-[#0f172a]">{userProfile.skills?.join(', ') || userProfile.specialties?.join(', ') || 'No skills added'}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#cbd5e1]/30 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#4f46e5]" />
                      <span className="font-medium text-[#0f172a]">Resume attachment</span>
                    </div>
                    <span className="font-bold text-[#7c3aed] text-[11px] bg-[#ede9fe]/50 px-2 py-1 rounded-lg">Select when applying</span>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-[#0f172a] block mb-1">Expected Salary / Compensation</label>
                    <input
                      type="text"
                      value={expectedSalary}
                      onChange={(e) => setExpectedSalary(e.target.value)}
                      required
                      placeholder="e.g. ₹6,00,000 / year or ₹350 / hour"
                      className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-xl p-3 text-xs text-[#0f172a] focus:ring-2 focus:ring-[#4f46e5] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#0f172a] block mb-1">Availability</label>
                    <input
                      type="text"
                      value={availability}
                      onChange={(e) => setAvailability(e.target.value)}
                      required
                      placeholder="e.g. Immediate (2 weeks notice)"
                      className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-xl p-3 text-xs text-[#0f172a] focus:ring-2 focus:ring-[#4f46e5] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#0f172a] block mb-1">Optional Cover Note / Intro Message</label>
                  <textarea
                    rows={3}
                    value={coverNote}
                    onChange={(e) => setCoverNote(e.target.value)}
                    placeholder="Introduce yourself and highlight why you're a great fit..."
                    className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-xl p-3 text-xs text-[#0f172a] focus:ring-2 focus:ring-[#4f46e5] outline-none"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowApplyModal(false)}
                    className="flex-1 py-3 rounded-full text-xs font-bold text-[#475569] bg-[#f1f5f9] hover:bg-[#e2e8f0] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isApplySubmitting || applications.some(app => app.jobId === selectedJob.id)}
                    className={`flex-1 py-3 rounded-full text-xs font-bold text-white shadow-md flex items-center justify-center gap-1.5 transition-all ${
                      applications.some(app => app.jobId === selectedJob.id)
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-[#7c3aed] hover:bg-[#6d28d9] cursor-pointer'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{applications.some(app => app.jobId === selectedJob.id) ? 'Already Applied' : isApplySubmitting ? 'Submitting application…' : 'Submit Application'}</span>
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
          currentAvatarPath={userProfile.avatarPath}
          userName={userProfile.name}
          onSaveAvatar={(newUrl) => onUpdateAvatar
            ? onUpdateAvatar(newUrl)
            : Promise.reject(new Error('Profile photo saving is unavailable.'))}
          onClose={() => setShowImageUploader(false)}
        />
      )}

      {/* SAVE SEARCH FILTER MODAL */}
      {showSaveFilterModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#cbd5e1] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#cbd5e1]/30">
              <div className="flex items-center gap-2 text-[#4f46e5]">
                <BookmarkPlus className="w-5 h-5" />
                <h3 className="text-base font-bold text-[#0f172a]">Save Preferred Search Filter</h3>
              </div>
              <button
                onClick={() => setShowSaveFilterModal(false)}
                className="p-1 text-[#64748b] hover:text-[#0f172a]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#475569]">
              Save this search configuration to your profile so you can quickly re-apply it anytime on future visits.
            </p>

            {/* Filter Criteria Summary */}
            <div className="bg-[#f8fafc] p-3 rounded-2xl border border-[#cbd5e1]/60 text-xs space-y-1.5">
              <div className="font-bold text-[11px] uppercase tracking-wider text-[#4f46e5]">
                Included Search Criteria:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {searchQuery && (
                  <span className="px-2 py-0.5 bg-[#ede9fe] text-[#4f46e5] font-semibold text-[11px] rounded-md">
                    Keyword: &quot;{searchQuery}&quot;
                  </span>
                )}
                {selectedCategory !== 'All' && (
                  <span className="px-2 py-0.5 bg-white border border-[#cbd5e1] text-[#0f172a] font-semibold text-[11px] rounded-md">
                    Category: {selectedCategory}
                  </span>
                )}
                {locationFilter !== 'All Locations' && (
                  <span className="px-2 py-0.5 bg-white border border-[#cbd5e1] text-[#0f172a] font-semibold text-[11px] rounded-md">
                    Location: {locationFilter}
                  </span>
                )}
                {jobTypeFilter !== 'All Types' && (
                  <span className="px-2 py-0.5 bg-white border border-[#cbd5e1] text-[#0f172a] font-semibold text-[11px] rounded-md">
                    Type: {jobTypeFilter}
                  </span>
                )}
                {salaryFilter !== 'All Salaries' && (
                  <span className="px-2 py-0.5 bg-white border border-[#cbd5e1] text-[#0f172a] font-semibold text-[11px] rounded-md">
                    Salary: {salaryFilter}
                  </span>
                )}
                {selectedTag !== 'All Perks' && (
                  <span className="px-2 py-0.5 bg-white border border-[#cbd5e1] text-[#0f172a] font-semibold text-[11px] rounded-md">
                    Perk: {selectedTag}
                  </span>
                )}
                {activeFiltersCount === 0 && (
                  <span className="text-[#64748b] italic">All Openings Feed</span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0f172a] mb-1">
                Saved Search Name
              </label>
              <input
                type="text"
                value={newFilterNameInput}
                onChange={(e) => setNewFilterNameInput(e.target.value)}
                placeholder="e.g., Stylist in LA, Balayage in Beverly Hills"
                className="w-full p-2.5 bg-[#f1f5f9] rounded-xl border border-[#cbd5e1]/60 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/30 text-[#0f172a]"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowSaveFilterModal(false)}
                className="px-4 py-2 text-xs font-bold text-[#475569] hover:bg-[#f1f5f9] rounded-full border border-[#cbd5e1]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCurrentFilter}
                disabled={!newFilterNameInput.trim()}
                className="px-5 py-2 bg-[#4f46e5] hover:bg-[#6d28d9] disabled:opacity-50 text-white text-xs font-bold rounded-full shadow-md flex items-center gap-1.5 cursor-pointer"
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
          <div className="w-full max-w-md bg-[#f8fafc] h-full shadow-2xl flex flex-col justify-between border-l border-[#cbd5e1] animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 bg-[#4f46e5] text-white flex items-center justify-between">
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
            <div className="p-3 bg-white border-b border-[#cbd5e1]/60 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-[#475569] font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pushEnabled}
                    onChange={(e) => {
                      setPushEnabled(e.target.checked);
                      showToast(e.target.checked ? 'Push notifications enabled' : 'Push notifications muted');
                    }}
                    className="rounded text-[#4f46e5] focus:ring-[#4f46e5]"
                  />
                  <span>Push Alerts</span>
                </label>

                <label className="flex items-center gap-1.5 text-[#475569] font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={soundEnabled}
                    onChange={(e) => {
                      setSoundEnabled(e.target.checked);
                      showToast(e.target.checked ? 'Alert audio sound enabled' : 'Alert sound muted');
                    }}
                    className="rounded text-[#4f46e5] focus:ring-[#4f46e5]"
                  />
                  <Volume2 className="w-3.5 h-3.5 text-[#4f46e5]" />
                  <span>Sound</span>
                </label>
              </div>

            </div>

            {/* Notification List Content */}
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {alertsList.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <Bell className="w-12 h-12 text-[#64748b]/40 mx-auto" />
                  <p className="text-sm font-bold text-[#0f172a]">No Job Match Alerts Yet</p>
                  <p className="text-xs text-[#475569] max-w-xs mx-auto leading-relaxed">
                    When new employers post jobs matching your saved search filters, instant push alerts will appear here in real time!
                  </p>
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
                          ? 'bg-white border-[#4f46e5] shadow-sm ring-1 ring-[#4f46e5]/20'
                          : 'bg-[#f8fafc] border-[#cbd5e1]/60 opacity-80'
                      }`}
                    >
                      {!alert.isRead && (
                        <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-[#7c3aed] rounded-full animate-ping" />
                      )}

                      <div className="flex items-center justify-between gap-2 pr-4">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#4f46e5] bg-[#ede9fe] px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Radio className="w-3 h-3 text-[#7c3aed]" />
                          <span>Filter: {alert.savedFilterName}</span>
                        </span>
                        <span className="text-[10px] text-[#64748b] font-medium">{alert.matchedAt}</span>
                      </div>

                      <div>
                        <h4 className="text-xs font-extrabold text-[#0f172a] leading-snug">{alert.jobTitle}</h4>
                        <p className="text-[11px] font-semibold text-[#475569]">{alert.salonName} • {alert.location}</p>
                        <p className="text-[11px] font-bold text-[#4f46e5] mt-0.5">{alert.salary} • {alert.category}</p>
                      </div>

                      <div className="pt-2 border-t border-[#cbd5e1]/30 flex items-center justify-between gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (matchedJob) {
                              setSearchQuery(matchedJob.title);
                              setShowNotificationDrawer(false);
                              navigateToTab('feed');
                            } else {
                              setShowNotificationDrawer(false);
                              navigateToTab('feed');
                            }
                          }}
                          className="px-3 py-1 bg-[#4f46e5] hover:bg-[#6d28d9] text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <span>View Opening</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>

                        <button
                          onClick={(e) => handleDeleteAlert(alert.id, e)}
                          className="text-[#64748b] hover:text-rose-600 p-1 text-[11px] font-medium transition-colors cursor-pointer"
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
            <div className="p-3 bg-[#f1f5f9] border-t border-[#cbd5e1] flex items-center justify-between text-[11px] text-[#475569]">
              <span>Filter Engine Status: <strong className="text-emerald-700">Active</strong></span>
              <button
                onClick={() => setShowNotificationDrawer(false)}
                className="px-3 py-1 bg-white border border-[#cbd5e1] font-bold rounded-lg text-[#0f172a] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0f172a] text-white px-4 py-3 rounded-2xl shadow-xl border border-white/20 flex items-center gap-2.5 text-xs font-bold animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

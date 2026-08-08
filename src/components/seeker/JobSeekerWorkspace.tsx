import React, { useState } from 'react';
import { JobPosting, Application, UserProfile } from '../../types';
import { ProfileImageUploader } from '../profile/ProfileImageUploader';
import {
  Search,
  MapPin,
  Bookmark,
  BookmarkCheck,
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
  Camera
} from 'lucide-react';

interface JobSeekerWorkspaceProps {
  jobs: JobPosting[];
  applications: Application[];
  userProfile: UserProfile;
  onToggleBookmark: (jobId: string) => void;
  onApplyJob: (job: JobPosting, coverNote: string) => void;
  onUpdateAvatar?: (newAvatarUrl: string | undefined) => void;
  onSwitchRole: () => void;
  onLogout: () => void;
}

export const JobSeekerWorkspace: React.FC<JobSeekerWorkspaceProps> = ({
  jobs,
  applications,
  userProfile,
  onToggleBookmark,
  onApplyJob,
  onUpdateAvatar,
  onSwitchRole,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'feed' | 'applications' | 'saved' | 'profile'>('feed');
  const [showImageUploader, setShowImageUploader] = useState<boolean>(false);
  
  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [locationFilter, setLocationFilter] = useState<string>('All Locations');
  const [jobTypeFilter, setJobTypeFilter] = useState<string>('All Types');
  const [salaryFilter, setSalaryFilter] = useState<string>('All Salaries');
  const [selectedTag, setSelectedTag] = useState<string>('All Perks');
  const [sortBy, setSortBy] = useState<'relevant' | 'salary_high' | 'rating_high' | 'newest'>('relevant');

  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  
  // Apply Modal state
  const [showApplyModal, setShowApplyModal] = useState<boolean>(false);
  const [coverNote, setCoverNote] = useState<string>('I am very interested in this role and believe my skills and background align perfectly with your team!');
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
      onApplyJob(selectedJob, coverNote);
      setApplySuccess(true);
      setTimeout(() => {
        setApplySuccess(false);
        setShowApplyModal(false);
      }, 1800);
    }
  };

  return (
    <div className="bg-[#fdf8f8] min-h-screen text-[#1c1b1b] flex flex-col font-sans pb-20 md:pb-8">
      {/* Top Header */}
      <header className="sticky top-0 bg-white border-b border-[#e0bec6]/40 shadow-sm z-30 px-4 sm:px-6 py-3">
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
          <div className="hidden md:flex items-center flex-1 max-w-md mx-6 bg-[#fdf8f8] rounded-full px-4 py-2 ring-1 ring-[#e0bec6] focus-within:ring-2 focus-within:ring-[#8e004b] transition-all">
            <Search className="w-4 h-4 text-[#8c7077] mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search roles, salons, balayage, facialist, chair rental..."
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
          </div>

          {/* User Profile & Role Switch */}
          <div className="flex items-center gap-3">
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
        <div className="mt-2 md:hidden flex items-center bg-[#fdf8f8] rounded-full px-3 py-2 ring-1 ring-[#e0bec6]">
          <Search className="w-4 h-4 text-[#8c7077] mr-2 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search roles, salons, specialties..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-[#1c1b1b] focus:outline-none placeholder:text-[#594047]/60"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="p-1 text-[#8e004b]">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-grow w-full">
        {/* Navigation Tabs Bar */}
        <div className="flex items-center justify-between border-b border-[#e0bec6]/40 pb-3 mb-6 overflow-x-auto gap-2">
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

              {/* Advanced Multi-Facet Filters Panel */}
              <div className="bg-white p-4 rounded-2xl border border-[#e0bec6]/50 shadow-xs flex flex-col gap-3">
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

                  {/* Popular quick search triggers */}
                  <div className="hidden lg:flex items-center gap-1.5 text-[11px]">
                    <span className="text-[#8c7077] font-medium">Quick keywords:</span>
                    {['Balayage', 'HydraFacial', 'Chair Rental', 'Manager'].map((kw) => (
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                              setShowApplyModal(true);
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
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-[#e0bec6]/40 shadow-xs flex items-center justify-between">
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
              <div className="space-y-4">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    className="bg-white rounded-2xl p-5 border border-[#e0bec6]/50 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-4">
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
                          <div className="mt-2 text-xs bg-[#fdf8f8] p-2.5 rounded-lg border border-[#e0bec6]/30 text-[#1c1b1b]">
                            <span className="font-semibold text-[#8e004b]">Note: </span>
                            {app.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col md:items-end gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-[#e0bec6]/30">
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SAVED JOBS */}
        {activeTab === 'saved' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-[#e0bec6]/40 shadow-xs flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#1c1b1b]">Saved Positions</h2>
                <p className="text-xs text-[#594047]">Your bookmarked salon opportunities.</p>
              </div>
              <span className="px-3 py-1 bg-[#ffd9e2] text-[#8e004b] text-xs font-bold rounded-full">
                {savedJobs.length} Saved
              </span>
            </div>

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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {savedJobs.map((job) => (
                  <div key={job.id} className="bg-white rounded-2xl border border-[#e0bec6]/50 p-4 flex flex-col justify-between gap-3 shadow-xs">
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-2">
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

                      <p className="text-xs font-bold text-[#e2007c] mb-2">{job.salary}</p>
                      <p className="text-xs text-[#594047] flex items-center gap-1 mb-3">
                        <MapPin className="w-3 h-3" /> {job.location}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[#e0bec6]/30 flex gap-2">
                      <button
                        onClick={() => setSelectedJob(job)}
                        className="flex-1 py-2 rounded-full text-xs font-semibold text-[#8e004b] bg-[#f1edec] hover:bg-[#ffd9e2] transition-colors cursor-pointer"
                      >
                        Details
                      </button>
                      <button
                        onClick={() => {
                          setSelectedJob(job);
                          setShowApplyModal(true);
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

        {/* TAB 4: BEAUTY PROFILE */}
        {activeTab === 'profile' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#e0bec6]/40 shadow-sm text-center relative overflow-hidden">
              {/* Profile Avatar Container with Camera Overlay */}
              <div className="relative w-28 h-28 mx-auto mb-4 group">
                <div className="w-28 h-28 rounded-full bg-[#8e004b] text-white font-bold text-4xl flex items-center justify-center overflow-hidden shadow-lg border-2 border-white ring-4 ring-[#ffd9e2]">
                  {userProfile.avatarUrl ? (
                    <img
                      src={userProfile.avatarUrl}
                      alt={userProfile.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{userProfile.name.charAt(0)}</span>
                  )}
                </div>

                {/* Camera Trigger Badge */}
                <button
                  onClick={() => setShowImageUploader(true)}
                  title="Take or Upload Headshot"
                  className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-[#e2007c] hover:bg-[#b90064] text-white flex items-center justify-center shadow-md transition-all hover:scale-110 cursor-pointer border-2 border-white"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>

              <h2 className="text-xl font-bold text-[#1c1b1b]">{userProfile.name}</h2>
              <p className="text-xs font-semibold text-[#e2007c] mt-0.5 mb-2">Licensed Cosmetologist & Color Specialist</p>

              {/* Headshot Quick Action Button */}
              <div className="mt-2 mb-4">
                <button
                  onClick={() => setShowImageUploader(true)}
                  className="px-4 py-1.5 rounded-full bg-[#ffd9e2] hover:bg-[#ffb0c8] text-[#8e004b] text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{userProfile.avatarUrl ? 'Update Headshot' : 'Take Professional Headshot'}</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                <span className="px-3 py-1 bg-[#ffd9e2] text-[#8e004b] rounded-full text-xs font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> License: CA-COS-889124 (Active)
                </span>
                <span className="px-3 py-1 bg-[#f1edec] text-[#594047] rounded-full text-xs font-semibold">
                  5 Years Experience
                </span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-[#e0bec6]/40 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-[#1c1b1b] border-b border-[#e0bec6]/30 pb-2">
                Specialty Skills & Certifications
              </h3>

              <div className="flex flex-wrap gap-2">
                {['Balayage & Dimensional Color', 'Kérastase Master Certified', 'Scalp Treatments', 'Foilayage', 'Client Consultation', 'Retail Sales'].map((skill) => (
                  <span key={skill} className="px-3 py-1.5 bg-[#fdf8f8] border border-[#e0bec6] rounded-xl text-xs font-semibold text-[#1c1b1b]">
                    ✓ {skill}
                  </span>
                ))}
              </div>

              <div className="pt-4 border-t border-[#e0bec6]/30">
                <h4 className="text-xs font-bold text-[#594047] uppercase tracking-wider mb-2">Portfolio Link</h4>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[#8e004b] font-semibold flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> instagram.com/janedoe_hair
                </a>
              </div>
            </div>
          </div>
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
                  onClick={() => setShowApplyModal(true)}
                  className="flex-1 py-3 rounded-full text-xs font-bold text-white bg-[#e2007c] hover:bg-[#b90064] shadow-md transition-colors cursor-pointer"
                >
                  Apply Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* APPLY FORM MODAL */}
      {showApplyModal && selectedJob && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-[#e0bec6] shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center pb-4 border-b border-[#e0bec6]/30 mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#1c1b1b]">Apply to {selectedJob.salonName}</h3>
                <p className="text-xs text-[#594047]">{selectedJob.title}</p>
              </div>
              <button
                onClick={() => setShowApplyModal(false)}
                className="p-1 text-[#594047] hover:text-[#1c1b1b] rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {applySuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-lg font-bold text-[#1c1b1b]">Application Submitted!</h4>
                <p className="text-xs text-[#594047]">
                  Your profile and cover note have been sent to the hiring manager at {selectedJob.salonName}.
                </p>
              </div>
            ) : (
              <form onSubmit={handleApplySubmit} className="space-y-4">
                <div className="bg-[#fdf8f8] p-3 rounded-xl border border-[#e0bec6]/30 text-xs space-y-1">
                  <p><span className="font-semibold text-[#1c1b1b]">Applicant:</span> {userProfile.name}</p>
                  <p><span className="font-semibold text-[#1c1b1b]">Email:</span> {userProfile.email}</p>
                  <p><span className="font-semibold text-[#1c1b1b]">License:</span> CA-COS-889124 (Cosmetology)</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#1c1b1b] block mb-1">Cover Note / Intro Message</label>
                  <textarea
                    rows={4}
                    value={coverNote}
                    onChange={(e) => setCoverNote(e.target.value)}
                    required
                    className="w-full bg-[#fdf8f8] border border-[#e0bec6] rounded-xl p-3 text-xs text-[#1c1b1b] focus:ring-2 focus:ring-[#8e004b] outline-none"
                  />
                </div>

                <div className="p-3 bg-[#ffd9e2]/30 rounded-xl border border-[#e0bec6]/40 flex items-center justify-between text-xs">
                  <span className="font-medium text-[#8e004b]">Attached Resume & Portfolio:</span>
                  <span className="font-bold text-[#e2007c]">Jane_Doe_Beauty_CV.pdf ✓</span>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowApplyModal(false)}
                    className="flex-1 py-3 rounded-full text-xs font-bold text-[#594047] bg-[#f1edec]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-full text-xs font-bold text-white bg-[#e2007c] hover:bg-[#b90064] shadow-md flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Application</span>
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
    </div>
  );
};

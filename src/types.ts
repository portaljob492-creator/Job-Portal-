export type UserRole = 'seeker' | 'employer';

export type ScreenState = 
  | 'welcome' 
  | 'role_select' 
  | 'seeker_signup' 
  | 'employer_signup' 
  | 'login' 
  | 'otp_verify' 
  | 'forgot_password' 
  | 'reset_password' 
  | 'seeker_onboarding_step1'
  | 'seeker_onboarding_step2'
  | 'main_app'
  | 'apply_job';

export interface JobPosting {
  id: string;
  title: string;
  salonName: string;
  salonLogo?: string;
  location: string;
  image: string;
  rating: number;
  reviewsCount: number;
  salary: string;
  jobType: 'Full-time' | 'Part-time' | 'Commission' | 'Chair Rental' | 'Contract';
  category: 'Hair' | 'Skincare' | 'Nails' | 'Lashes & Brows' | 'Massage' | 'Management';
  tags: string[];
  description: string;
  requirements: string[];
  benefits: string[];
  postedDate: string;
  isBookmarked?: boolean;
  isFeatured?: boolean;
  activeApplicantsCount?: number;
}

export interface Application {
  id: string;
  jobId: string;
  jobTitle: string;
  salonName: string;
  salonLogo?: string;
  location: string;
  appliedDate: string;
  status: 'Submitted' | 'Under Review' | 'Interview Scheduled' | 'Offer Extended';
  notes?: string;
  interviewDate?: string;
  expectedSalary?: string;
  availability?: string;
}

export interface Applicant {
  id: string;
  name: string;
  appliedJobId: string;
  appliedJobTitle: string;
  email: string;
  phone: string;
  experienceYears: number;
  licenseNumber: string;
  status: 'New' | 'Shortlisted' | 'Interview Scheduled' | 'Hired' | 'Declined';
  appliedDate: string;
  coverNote?: string;
  portfolioUrl?: string;
  expectedSalary?: string;
  availability?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderRole: UserRole;
  senderName: string;
  senderAvatar?: string;
  text: string;
  timestamp: string;
  isRead?: boolean;
  attachment?: {
    name: string;
    url: string;
    type: 'image' | 'file';
  };
}

export interface Conversation {
  id: string;
  jobId: string;
  jobTitle: string;
  salonName: string;
  salonLogo?: string;
  seekerName: string;
  seekerAvatar?: string;
  seekerEmail?: string;
  employerName: string;
  employerAvatar?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCountSeeker: number;
  unreadCountEmployer: number;
  status?: 'Inquiry' | 'Interview Requested' | 'Offer Extended' | 'Archived';
}

export interface PortfolioItem {
  id: string;
  title: string;
  category: 'Hair' | 'Skin' | 'Makeup' | 'Nails' | 'Barber' | 'Other';
  imageUrl: string;
  description?: string;
  technique?: string;
  date?: string;
  isPlaceholder?: boolean;
}

export interface SavedFilter {
  id: string;
  name: string;
  searchQuery?: string;
  category?: string;
  location?: string;
  jobType?: string;
  salary?: string;
  tag?: string;
  sortBy?: 'relevant' | 'salary_high' | 'rating_high' | 'newest';
  createdAt?: string;
  notifyPush?: boolean;
  notifyEmail?: boolean;
  notifyInApp?: boolean;
  matchFrequency?: 'Instant' | 'Daily' | 'Weekly';
  lastMatchCount?: number;
}

export interface JobAlertNotification {
  id: string;
  savedFilterId: string;
  savedFilterName: string;
  jobId: string;
  jobTitle: string;
  salonName: string;
  location: string;
  salary: string;
  category: string;
  matchedAt: string;
  isRead: boolean;
}

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatarUrl?: string;
  businessName?: string;
  contactPerson?: string;
  licenseNumber?: string;
  specialties?: string[];
  bio?: string;
  portfolioItems?: PortfolioItem[];
  savedFilters?: SavedFilter[];
}

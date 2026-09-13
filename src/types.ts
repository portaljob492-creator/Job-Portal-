export type UserRole = 'seeker' | 'employer' | 'admin';

export type ScreenState = 
  | 'welcome' 
  | 'role_select' 
  | 'seeker_signup' 
  | 'employer_signup' 
  | 'signup_confirmation'
  | 'login' 
  | 'forgot_password' 
  | 'reset_password' 
  | 'seeker_onboarding_step1'
  | 'seeker_onboarding_step2'
  | 'main_app'
  | 'apply_job'
  | 'interview_invitation'
  | 'job_offer'
  | 'support'
  | 'settings'
  | 'employer_onboarding_step1'
  | 'employer_onboarding_step2'
  | 'employer_onboarding_step3'
  | 'admin_login'
  | 'admin_jobs';

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
  /** Authoritative timestamp used by Latest jobs sorting/filtering. */
  publishedAt?: string;
  isBookmarked?: boolean;
  isFeatured?: boolean;
  activeApplicantsCount?: number;
  approvalStatus?: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'paused' | 'closed' | 'expired' | 'archived';
  rejectionReason?: string;
  /** Structured values collected by the Post a Job wizard. */
  workplaceType?: 'on_site' | 'hybrid' | 'remote';
  experienceMinMonths?: number;
  experienceMaxMonths?: number;
  freshersAllowed?: boolean;
  salaryMin?: number;
  salaryMax?: number;
  payType?: 'monthly' | 'daily' | 'hourly' | 'commission';
  openings?: number;
  workingDays?: string;
  workingHours?: string;
  /** Employer-entered posting details retained with the Supabase job row. */
  businessName?: string;
  jobRole?: string;
  workLocation?: string;
  city?: string;
  area?: string;
  contactPerson?: string;
  contactMobile?: string;
  whatsappNumber?: string;
  interviewMode?: 'in_person' | 'video' | 'phone' | 'hybrid';
  postingStatus?: 'draft' | 'published';
  shopId?: string;
  createdBy?: string;
}

export type CandidateApplicationStatus = 'Applied' | 'Under Review' | 'Shortlisted' | 'Rejected' | 'Hired' | 'Withdrawn';

export interface Application {
  id: string;
  jobId: string;
  jobTitle: string;
  salonName: string;
  salonLogo?: string;
  location: string;
  salaryRange?: string;
  jobType?: JobPosting['jobType'];
  /** Full listing snapshot keeps View Job usable if it is no longer in public search results. */
  job?: JobPosting;
  appliedDate: string;
  submittedAt?: string;
  status: 'Submitted' | 'Under Review' | 'Interview Scheduled' | 'Offer Extended' | 'Declined' | 'Accepted';
  /** Candidate-facing hiring stage used by My Applications. */
  applicationStatus?: CandidateApplicationStatus;
  notes?: string;
  interviewDate?: string;
  expectedSalary?: string;
  availability?: string;
  /** Latest interview row for this application (workflow RPCs need its id). */
  interviewId?: string;
  /** Latest active offer row for this application (workflow RPCs need its id). */
  offerId?: string;
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
  status: 'New' | 'Viewed' | 'Shortlisted' | 'Interview Scheduled' | 'Offer Extended' | 'Hired' | 'Declined';
  appliedDate: string;
  coverNote?: string;
  portfolioUrl?: string;
  expectedSalary?: string;
  availability?: string;
  avatarUrl?: string;
  location?: string;
  skills?: string[];
  /** Seeker-profile id behind this application (portfolio/resume reads). */
  candidateProfileId?: string;
  /** Resume selected for this application; the path is exchanged for a short-lived URL on demand. */
  resumeFileName?: string;
  resumeStoragePath?: string;
  /** Interview rows for this application, newest first. */
  interviews?: EmployerInterview[];
}

/** One interview row as the employer workspace consumes it. */
export interface EmployerInterview {
  id: string;
  applicationId: string;
  interviewType: 'in_person' | 'video' | 'phone';
  scheduledStart: string;
  durationMinutes: number;
  locationText?: string;
  meetingUrl?: string;
  employerMessage?: string;
  candidateMessage?: string;
  status: 'requested' | 'confirmed' | 'reschedule_requested' | 'rescheduled' | 'declined' | 'cancelled' | 'completed';
}

/** One resume row owned by the signed-in seeker. */
export interface ResumeFile {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  isPrimary: boolean;
  uploadedAt: string;
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
  appliedJobTitle?: string;
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

export type CandidateExperienceLevel = 'fresher' | 'junior' | 'mid' | 'senior' | 'lead';
export type CandidateEmploymentType = 'full_time' | 'part_time' | 'internship' | 'freelance' | 'contract';

export interface CandidateExperience {
  id?: string;
  salonName: string;
  roleTitle: string;
  city?: string;
  state?: string;
  startDate: string;
  endDate?: string;
  currentlyWorking: boolean;
  description?: string;
}

export interface CandidateEducation {
  id?: string;
  courseName: string;
  institutionName?: string;
  completionYear?: number;
  description?: string;
}

export interface CandidateCertification {
  id?: string;
  certificateName: string;
  institutionName?: string;
  completionYear?: number;
  certificatePath?: string;
}

/** Complete payload behind /jobs/profile Review & Submit. */
export interface CandidateProfileInput {
  fullName: string;
  phone: string;
  avatarPath?: string;
  headline: string;
  bio?: string;
  city: string;
  state: string;
  experienceLevel: CandidateExperienceLevel;
  totalExperienceMonths: number;
  expectedSalaryMin?: number;
  expectedSalaryMax?: number;
  availableFrom?: string;
  openToRelocation: boolean;
  skills: string[];
  preferredRoles: string[];
  employmentTypes: CandidateEmploymentType[];
  experience: CandidateExperience[];
  education: CandidateEducation[];
  certifications: CandidateCertification[];
}

export interface CandidateProfileSubmission {
  candidateId: string;
  profileCompletion: number;
  applicationReady: boolean;
  submittedAt: string;
}

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  /** Renderable signed/remote URL. Never persist this field directly. */
  avatarUrl?: string;
  /** Stable private Storage path used when a profile is submitted again. */
  avatarPath?: string;
  businessName?: string;
  contactPerson?: string;
  licenseNumber?: string;
  specialties?: string[];
  skills?: string[];
  primaryRole?: string;
  location?: string;
  city?: string;
  state?: string;
  bio?: string;
  candidateId?: string;
  profileCompletion?: number;
  profileSubmittedAt?: string;
  applicationReady?: boolean;
  experienceLevel?: CandidateExperienceLevel;
  totalExperienceMonths?: number;
  expectedSalaryMin?: number;
  expectedSalaryMax?: number;
  availableFrom?: string;
  openToRelocation?: boolean;
  preferredRoles?: string[];
  employmentTypes?: CandidateEmploymentType[];
  experience?: CandidateExperience[];
  education?: CandidateEducation[];
  certifications?: CandidateCertification[];
  /** Employer brand links, surfaced from the salon profile row. */
  website?: string;
  instagram?: string;
  portfolioItems?: PortfolioItem[];
  savedFilters?: SavedFilter[];
}

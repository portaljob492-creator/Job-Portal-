export type UserRole = 'seeker' | 'employer';

export type ScreenState = 
  | 'welcome' 
  | 'role_select' 
  | 'seeker_signup' 
  | 'employer_signup' 
  | 'login' 
  | 'otp_verify' 
  | 'forgot_password' 
  | 'main_app';

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
}

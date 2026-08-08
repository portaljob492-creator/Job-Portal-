import type { Provider, User } from '@supabase/supabase-js';
import type {
  Applicant,
  Application,
  ChatMessage,
  Conversation,
  JobAlertNotification,
  JobPosting,
  PortfolioItem,
  SavedFilter,
  UserProfile,
  UserRole,
} from '../types';
import { requireSupabase } from '../lib/supabase';

const arrays = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const one = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

const backendRole = (role: UserRole) => (role === 'seeker' ? 'job_seeker' : 'employer');
const frontendRole = (role?: string | null): UserRole => (role === 'employer' ? 'employer' : 'seeker');
const portalLabel = (role: UserRole) => (role === 'seeker' ? 'Job Seeker' : 'Employer');

function portalMismatchMessage(actualBackendRole: string, requestedRole: UserRole) {
  const actualRole = frontendRole(actualBackendRole);
  return `This email is registered as a ${portalLabel(actualRole)}. Please sign in with a registered ${portalLabel(requestedRole)} email or create a new account for ${portalLabel(requestedRole)} access.`;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error
    ? error.message
    : typeof error === 'object' && error && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error || fallback);
}

function mapPortalRoleError(error: unknown, requestedRole: UserRole): Error {
  const message = errorMessage(error, 'Unable to validate portal access.');
  const match = message.match(/PORTAL_ROLE_MISMATCH:(job_seeker|employer)/);
  return match ? new Error(portalMismatchMessage(match[1], requestedRole)) : new Error(message);
}

function mapAuthError(error: unknown): Error {
  const message = errorMessage(error, 'Authentication request failed.');
  const normalized = message.toLowerCase();
  if (normalized.includes('rate limit')) {
    return new Error('Too many verification emails were requested. Please wait a few minutes, then resend once and use only the newest email.');
  }
  if (normalized.includes('invalid login credentials')) {
    return new Error('Invalid email or password. Check your credentials and selected portal.');
  }
  if (normalized.includes('email not confirmed')) {
    return new Error('Your email is not verified. Open the verification email or request a fresh link.');
  }
  return new Error(message);
}

const employmentToUi: Record<string, JobPosting['jobType']> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  internship: 'Part-time',
  contract: 'Contract',
  freelance: 'Commission',
};
const employmentToDb: Record<JobPosting['jobType'], string> = {
  'Full-time': 'full_time',
  'Part-time': 'part_time',
  Commission: 'freelance',
  'Chair Rental': 'freelance',
  Contract: 'contract',
};

function relativeDate(value?: string | null) {
  if (!value) return 'Just now';
  const date = new Date(value);
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function textList(value?: string | null): string[] {
  return value ? value.split(/\n|,|•/).map((item) => item.trim()).filter(Boolean) : [];
}

function salaryDisplay(row: any) {
  const minimum = row.salary_min == null ? null : Number(row.salary_min);
  const maximum = row.salary_max == null ? null : Number(row.salary_max);
  const suffix: Record<string, string> = {
    monthly: '/month', daily: '/day', hourly: '/hour', commission: ' + commission',
  };
  if (minimum == null && maximum == null) return 'Salary not disclosed';
  const format = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;
  const range = minimum != null && maximum != null
    ? `${format(minimum)} - ${format(maximum)}`
    : format((minimum ?? maximum)!);
  return `${range}${suffix[row.pay_type] || ''}`;
}

function category(value?: string | null): JobPosting['category'] {
  const allowed: JobPosting['category'][] = ['Hair', 'Skincare', 'Nails', 'Lashes & Brows', 'Massage', 'Management'];
  return allowed.includes(value as JobPosting['category']) ? (value as JobPosting['category']) : 'Hair';
}

function mapJob(row: any, isBookmarked = false): JobPosting {
  const salon = one<any>(row.salon);
  const location = one<any>(row.location);
  const city = row.city || location?.city || salon?.city || '';
  const state = row.state || location?.state || salon?.state || '';
  return {
    id: row.id,
    title: row.title,
    salonName: row.salon_name || salon?.name || 'Salon',
    salonLogo: row.logo_path || salon?.logo_path || undefined,
    location: [city, state].filter(Boolean).join(', '),
    image: row.image_path || row.cover_image_path || '',
    rating: Number(row.rating_average ?? salon?.rating_average ?? 0),
    reviewsCount: Number(row.review_count ?? salon?.review_count ?? 0),
    salary: salaryDisplay(row),
    jobType: employmentToUi[row.employment_type] || 'Full-time',
    category: category(row.category),
    tags: arrays<string>(row.tags),
    description: row.description || '',
    requirements: textList(row.responsibilities),
    benefits: textList(row.benefits),
    postedDate: relativeDate(row.published_at || row.created_at),
    isBookmarked,
    isFeatured: Boolean(row.salon_verified || salon?.verified),
    activeApplicantsCount: Number(row.active_applicants_count || 0),
  };
}

const applicationStatuses: Record<string, Application['status']> = {
  submitted: 'Submitted',
  viewed: 'Under Review',
  shortlisted: 'Under Review',
  interview_requested: 'Interview Scheduled',
  interview_confirmed: 'Interview Scheduled',
  interview_completed: 'Interview Scheduled',
  offer_sent: 'Offer Extended',
  offer_accepted: 'Offer Extended',
  hired: 'Offer Extended',
  rejected: 'Under Review',
  withdrawn: 'Under Review',
  position_closed: 'Under Review',
};
const applicantStatuses: Record<string, Applicant['status']> = {
  submitted: 'New',
  viewed: 'Viewed',
  shortlisted: 'Shortlisted',
  interview_requested: 'Interview Scheduled',
  interview_confirmed: 'Interview Scheduled',
  interview_completed: 'Interview Scheduled',
  offer_sent: 'Offer Extended',
  offer_accepted: 'Offer Extended',
  hired: 'Hired',
  rejected: 'Declined',
  withdrawn: 'Declined',
  position_closed: 'Declined',
};

function mapApplication(row: any): Application {
  const jobRow = one<any>(row.job);
  const job = jobRow ? mapJob(jobRow) : null;
  const interviews = arrays<any>(row.interviews).sort(
    (a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime(),
  );
  return {
    id: row.id,
    jobId: row.job_id,
    jobTitle: job?.title || 'Beauty position',
    salonName: job?.salonName || 'Salon',
    salonLogo: job?.salonLogo,
    location: job?.location || '',
    appliedDate: relativeDate(row.submitted_at),
    status: applicationStatuses[row.status] || 'Submitted',
    notes: row.employer_notes || undefined,
    interviewDate: interviews[0]?.scheduled_start
      ? new Date(interviews[0].scheduled_start).toLocaleString()
      : undefined,
    expectedSalary: row.expected_salary == null ? undefined : `₹${Number(row.expected_salary).toLocaleString('en-IN')}`,
    availability: row.available_from || undefined,
  };
}

function mapApplicant(row: any, card?: any): Applicant {
  const jobRow = one<any>(row.job);
  return {
    id: row.id,
    name: card?.full_name || 'Applicant',
    appliedJobId: row.job_id,
    appliedJobTitle: jobRow?.title || 'Beauty position',
    email: card?.email || '',
    phone: card?.phone || '',
    experienceYears: Math.floor(Number(card?.total_experience_months || 0) / 12),
    licenseNumber: '',
    status: applicantStatuses[row.status] || 'New',
    appliedDate: relativeDate(row.submitted_at),
    coverNote: row.cover_note || undefined,
    expectedSalary: row.expected_salary == null ? undefined : `₹${Number(row.expected_salary).toLocaleString('en-IN')}`,
    availability: row.available_from || undefined,
    avatarUrl: card?.avatar_path || undefined,
    location: [card?.city, card?.state].filter(Boolean).join(', ') || undefined,
    skills: arrays<string>(card?.skills),
  };
}

function mapConversation(row: any): Conversation {
  const statusMap: Record<string, Conversation['status']> = {
    inquiry: 'Inquiry', interview_requested: 'Interview Requested', offer_sent: 'Offer Extended', archived: 'Archived',
  };
  return {
    id: row.conversation_id || row.id,
    jobId: row.job_id,
    jobTitle: row.job_title || 'Beauty position',
    salonName: row.salon_name || 'Salon',
    salonLogo: row.salon_logo_path || undefined,
    seekerName: row.candidate_name || 'Job seeker',
    seekerAvatar: row.candidate_avatar_path || undefined,
    seekerEmail: row.candidate_email || undefined,
    employerName: row.employer_name || row.salon_name || 'Employer',
    employerAvatar: row.employer_avatar_path || undefined,
    lastMessage: row.last_message || 'Conversation started',
    lastMessageTime: relativeDate(row.last_message_at),
    unreadCountSeeker: Number(row.candidate_unread_count || 0),
    unreadCountEmployer: Number(row.employer_unread_count || 0),
    status: statusMap[row.status] || 'Inquiry',
  };
}

function mapMessage(row: any, summaries: any[]): ChatMessage {
  const conversation = summaries.find((item) => (item.conversation_id || item.id) === row.conversation_id);
  const isCandidate = row.sender_user_id === conversation?.candidate_user_id;
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderRole: isCandidate ? 'seeker' : 'employer',
    senderName: isCandidate ? conversation?.candidate_name || 'Job seeker' : conversation?.employer_name || 'Employer',
    senderAvatar: isCandidate ? conversation?.candidate_avatar_path || undefined : conversation?.employer_avatar_path || undefined,
    text: row.body || '',
    timestamp: relativeDate(row.created_at),
    isRead: Boolean(row.is_read),
    attachment: row.attachment || undefined,
  };
}

function mapSavedFilter(row: any): SavedFilter {
  return {
    id: row.id,
    name: row.name,
    searchQuery: row.search_query || '',
    category: row.category || 'All Categories',
    location: row.city || 'All Locations',
    jobType: row.employment_type ? employmentToUi[row.employment_type] : 'All Types',
    salary: row.salary_min == null ? 'All Salaries' : `₹${Number(row.salary_min).toLocaleString('en-IN')}+`,
    tag: 'All Perks',
    sortBy: 'relevant',
    createdAt: relativeDate(row.created_at),
    notifyPush: Boolean(row.notify_push),
    notifyEmail: Boolean(row.notify_email),
    notifyInApp: Boolean(row.notify_in_app),
    matchFrequency: row.match_frequency === 'daily' ? 'Daily' : row.match_frequency === 'weekly' ? 'Weekly' : 'Instant',
    lastMatchCount: 0,
  };
}

export interface SignUpInput {
  role: UserRole;
  email: string;
  password: string;
  name: string;
  phone?: string;
  businessName?: string;
}

export const authBackend = {
  async signUp(input: SignUpInput) {
    const client = requireSupabase();
    const email = input.email.trim();
    const requestedBackendRole = backendRole(input.role);
    const { data: existingRole, error: lookupError } = await client.rpc('job_email_portal_role', {
      p_email: email,
    });
    if (lookupError) throw lookupError;
    if (existingRole === 'job_seeker' || existingRole === 'employer') {
      if (existingRole !== requestedBackendRole) {
        throw new Error(portalMismatchMessage(existingRole, input.role));
      }

      // An unverified signup may safely request a fresh link. Confirmed users
      // receive Supabase's already-confirmed error and are directed to login.
      const { error: resendError } = await client.auth.resend({ type: 'signup', email });
      if (!resendError) {
        window.localStorage.setItem('nexora_pending_email_verification', email);
        return { user: null, session: null };
      }
      if (resendError.message.toLowerCase().includes('confirm')) {
        throw new Error(`This email is already registered as a ${portalLabel(input.role)}. Please sign in through the ${portalLabel(input.role)} portal.`);
      }
      throw mapAuthError(resendError);
    }
    if (existingRole === 'unassigned') {
      throw new Error('This email already belongs to a Nexora account. Sign in through your chosen Jobs portal to permanently assign its account type.');
    }

    const { data, error } = await client.auth.signUp({
      email,
      password: input.password,
      options: {
        emailRedirectTo: `${window.location.origin}/?verified=1`,
        data: {
          app_context: 'jobs',
          job_role: requestedBackendRole,
          role: input.role,
          full_name: input.name,
          phone: input.phone || '',
          business_name: input.businessName || '',
        },
      },
    });
    if (error) throw mapAuthError(error);

    // Supabase intentionally returns an obfuscated user for some duplicate-email
    // signups. Convert that response into the portal-specific product error.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      const { data: racedRole } = await client.rpc('job_email_portal_role', { p_email: email });
      if (racedRole === 'job_seeker' || racedRole === 'employer') {
        if (racedRole !== requestedBackendRole) throw new Error(portalMismatchMessage(racedRole, input.role));
        throw new Error(`This email is already registered as a ${portalLabel(input.role)}. Please sign in through the ${portalLabel(input.role)} portal.`);
      }
      throw new Error('An account already exists for this email. Please sign in instead.');
    }
    if (data.session) {
      window.localStorage.removeItem('nexora_pending_email_verification');
    } else {
      window.localStorage.setItem('nexora_pending_email_verification', email);
    }
    return data;
  },

  async resendSignupVerification(email: string) {
    const { error } = await requireSupabase().auth.resend({ type: 'signup', email: email.trim() });
    if (error) {
      if (error.message.toLowerCase().includes('confirm')) {
        throw new Error('This email is already verified. Go back and sign in to continue.');
      }
      throw mapAuthError(error);
    }
    window.localStorage.setItem('nexora_pending_email_verification', email.trim());
  },

  async signIn(email: string, password: string, requestedRole: UserRole) {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw mapAuthError(error);
    try {
      await this.registerRole(requestedRole);
    } catch (roleError) {
      await client.auth.signOut();
      throw mapPortalRoleError(roleError, requestedRole);
    }
    return data;
  },

  async registerRole(role: UserRole) {
    const { data, error } = await requireSupabase().rpc('job_register_role', { requested_role: backendRole(role) });
    if (error) throw mapPortalRoleError(error, role);
    if (data !== backendRole(role)) throw new Error(portalMismatchMessage(String(data), role));
    return data;
  },

  async signInWithProvider(provider: Provider, role: UserRole) {
    window.localStorage.setItem('nexora_pending_role', role);
    const { data, error } = await requireSupabase().auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) throw mapAuthError(error);
    return data;
  },

  async sendPasswordReset(email: string) {
    const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/?recovery=1`,
    });
    if (error) throw mapAuthError(error);
  },

  async updatePassword(password: string) {
    const { error } = await requireSupabase().auth.updateUser({ password });
    if (error) throw mapAuthError(error);
  },

  async signOut() {
    const { error } = await requireSupabase().auth.signOut();
    if (error) throw error;
  },
};

export async function applyPendingOAuthRole(_userId: string) {
  const pendingRole = window.localStorage.getItem('nexora_pending_role') as UserRole | null;
  if (!pendingRole) return;
  try {
    await authBackend.registerRole(pendingRole);
  } catch (error) {
    await requireSupabase().auth.signOut();
    throw mapPortalRoleError(error, pendingRole);
  } finally {
    window.localStorage.removeItem('nexora_pending_role');
  }
}

export async function getUserRole(user: User): Promise<UserRole> {
  const { data, error } = await requireSupabase().from('job_user_roles').select('role').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  if (!data?.role) throw new Error('No Jobs portal role is assigned to this account. Please sign in through the correct portal.');
  return frontendRole(data.role);
}

export async function isPortalOnboardingComplete(userId: string): Promise<boolean> {
  const { data, error } = await requireSupabase()
    .from('job_user_roles')
    .select('onboarding_completed')
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return Boolean(data.onboarding_completed);
}

export async function completeSeekerOnboarding(profile: UserProfile, selectedRoles: string[]) {
  const { data, error } = await requireSupabase().rpc('complete_job_seeker_onboarding', {
    p_headline: selectedRoles[0] || profile.primaryRole || 'Beauty professional',
    p_bio: profile.bio || '',
    p_city: '',
    p_state: '',
    p_experience_level: 'mid',
    p_total_experience_months: 0,
    p_expected_salary_min: null,
    p_expected_salary_max: null,
    p_available_from: null,
    p_open_to_relocation: false,
    p_preferred_roles: selectedRoles,
    p_employment_types: ['full_time'],
  });
  if (error) throw error;
  return data as string;
}

export interface EmployerOnboardingInput {
  businessName: string;
  contactName: string;
  address: string;
  city: string;
  state: string;
  postalCode?: string;
  businessType?: string;
  website?: string;
  instagram?: string;
}

export async function completeEmployerOnboarding(input: EmployerOnboardingInput) {
  const { data, error } = await requireSupabase().rpc('complete_job_employer_onboarding', {
    p_business_name: input.businessName,
    p_contact_name: input.contactName,
    p_address: input.address,
    p_city: input.city,
    p_state: input.state,
    p_postal_code: input.postalCode || null,
    p_business_type: input.businessType || 'salon',
    p_website_url: input.website || null,
    p_instagram_url: input.instagram || null,
  });
  if (error) throw error;
  return data as string;
}

export interface WorkspaceData {
  profile: UserProfile;
  jobs: JobPosting[];
  applications: Application[];
  applicants: Applicant[];
  conversations: Conversation[];
  messages: ChatMessage[];
  alerts: JobAlertNotification[];
}

export async function loadWorkspace(user: User, role: UserRole): Promise<WorkspaceData> {
  const client = requireSupabase();
  const applicationSelect = `*, job:job_posts!job_applications_job_id_fkey(*, salon:salons!job_posts_salon_id_fkey(*), location:job_salon_locations!job_posts_location_id_fkey(*)), interviews:job_interview_requests(*)`;

  const [profileResult, candidateResult, membershipResult, jobsResult, bookmarksResult, conversationsResult, messagesResult, filtersResult, alertsResult, applicationsResult, applicantCardsResult] = await Promise.all([
    client.from('profiles').select('id,full_name,phone,avatar_path,preferred_city,preferred_area').eq('id', user.id).single(),
    client.from('job_seeker_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    client.from('job_salon_members').select('salon_id,member_role,salon:salons!job_salon_members_salon_id_fkey(*)').eq('user_id', user.id).eq('status', 'active').limit(1).maybeSingle(),
    client.from('public_job_listings').select('*').order('published_at', { ascending: false }),
    client.from('job_saved_jobs').select('job_id').eq('user_id', user.id),
    client.rpc('get_job_conversation_summaries'),
    client.from('job_messages').select('*').order('created_at', { ascending: true }),
    client.from('job_saved_searches').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    client.from('job_notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    role === 'seeker'
      ? client.from('job_applications').select(applicationSelect).eq('candidate_user_id', user.id).order('submitted_at', { ascending: false })
      : client.from('job_applications').select(applicationSelect).order('submitted_at', { ascending: false }),
    role === 'employer' ? client.rpc('get_job_applicant_cards') : Promise.resolve({ data: [], error: null }),
  ]);

  const error = [profileResult, candidateResult, membershipResult, jobsResult, bookmarksResult, conversationsResult, messagesResult, filtersResult, alertsResult, applicationsResult, applicantCardsResult]
    .map((result: any) => result.error)
    .find(Boolean);
  if (error) throw error;

  const candidate: any = candidateResult.data;
  const [skillsResult, portfolioResult] = candidate
    ? await Promise.all([
        client.from('job_candidate_skills').select('skill:job_skills(name)').eq('candidate_id', candidate.id),
        client.from('job_portfolio_items').select('*').eq('candidate_id', candidate.id).order('sort_order'),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (skillsResult.error) throw skillsResult.error;
  if (portfolioResult.error) throw portfolioResult.error;

  const profileRow: any = profileResult.data;
  const membership: any = membershipResult.data;
  const salon = one<any>(membership?.salon);
  const savedFilters = arrays<any>(filtersResult.data).map(mapSavedFilter);
  const specialties = arrays<any>(skillsResult.data).map((row) => one<any>(row.skill)?.name).filter(Boolean) as string[];
  const portfolioItems: PortfolioItem[] = arrays<any>(portfolioResult.data).map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    imageUrl: row.image_path,
    description: row.description || undefined,
    technique: row.technique || undefined,
    date: row.item_date || undefined,
  }));

  const bookmarkedIds = new Set(arrays<any>(bookmarksResult.data).map((row) => row.job_id));
  const jobRows = arrays<any>(jobsResult.data);
  const mappedJobs = jobRows.map((row) => mapJob(row, bookmarkedIds.has(row.id)));
  const applicationRows = arrays<any>(applicationsResult.data);
  const cards = arrays<any>(applicantCardsResult.data);
  const summaries = arrays<any>(conversationsResult.data);

  const alerts: JobAlertNotification[] = arrays<any>(alertsResult.data)
    .filter((row) => row.type === 'job_match')
    .map((row) => {
      const job = mappedJobs.find((item) => item.id === row.entity_id);
      const savedSearchId = row.metadata?.saved_search_id || '';
      const savedSearch = savedFilters.find((item) => item.id === savedSearchId);
      return {
        id: row.id,
        savedFilterId: savedSearchId,
        savedFilterName: savedSearch?.name || 'Saved search',
        jobId: row.entity_id,
        jobTitle: job?.title || row.title,
        salonName: job?.salonName || '',
        location: job?.location || '',
        salary: job?.salary || '',
        category: job?.category || '',
        matchedAt: relativeDate(row.created_at),
        isRead: Boolean(row.is_read),
      };
    });

  return {
    profile: {
      name: profileRow.full_name || user.email?.split('@')[0] || 'User',
      email: user.email || '',
      phone: profileRow.phone || '',
      role,
      avatarUrl: profileRow.avatar_path || undefined,
      businessName: salon?.name || undefined,
      contactPerson: profileRow.full_name || undefined,
      specialties,
      primaryRole: candidate?.headline || specialties[0] || undefined,
      bio: candidate?.bio || undefined,
      portfolioItems,
      savedFilters,
    },
    jobs: mappedJobs,
    applications: role === 'seeker' ? applicationRows.map(mapApplication) : [],
    applicants: role === 'employer'
      ? applicationRows.map((row) => mapApplicant(row, cards.find((card) => card.application_id === row.id)))
      : [],
    conversations: summaries.map(mapConversation),
    messages: arrays<any>(messagesResult.data).map((row) => mapMessage(row, summaries)),
    alerts,
  };
}

export async function saveProfile(userId: string, profile: UserProfile) {
  const client = requireSupabase();
  const { error } = await client.from('profiles').update({
    full_name: profile.name,
    phone: profile.phone || null,
    avatar_path: profile.avatarUrl || null,
  }).eq('id', userId);
  if (error) throw error;

  if (profile.role === 'seeker') {
    const { error: candidateError } = await client.from('job_seeker_profiles').update({
      headline: profile.primaryRole || null,
      bio: profile.bio || null,
    }).eq('user_id', userId);
    if (candidateError) throw candidateError;
  } else {
    const { error: employerError } = await client.from('job_employer_profiles').update({
      display_name: profile.contactPerson || profile.name,
    }).eq('user_id', userId);
    if (employerError) throw employerError;
  }
}

export async function setBookmark(userId: string, jobId: string, bookmarked: boolean) {
  const client = requireSupabase();
  const result = bookmarked
    ? await client.from('job_saved_jobs').upsert({ user_id: userId, job_id: jobId })
    : await client.from('job_saved_jobs').delete().eq('user_id', userId).eq('job_id', jobId);
  if (result.error) throw result.error;
}

function salaryNumbers(display: string): [number | null, number | null] {
  const values = (display.match(/[\d,.]+/g) || [])
    .map((value) => Number(value.replace(/,/g, '')))
    .filter((value) => Number.isFinite(value) && value > 0);
  return [values[0] ?? null, values[1] ?? values[0] ?? null];
}

export async function createJob(_userId: string, job: JobPosting): Promise<JobPosting> {
  const client = requireSupabase();
  const { data: membership, error: membershipError } = await client
    .from('job_salon_members')
    .select('salon_id')
    .eq('user_id', _userId)
    .eq('status', 'active')
    .limit(1)
    .single();
  if (membershipError) throw membershipError;
  const { data: location } = await client
    .from('job_salon_locations')
    .select('id')
    .eq('salon_id', membership.salon_id)
    .eq('is_primary', true)
    .maybeSingle();
  const [salaryMin, salaryMax] = salaryNumbers(job.salary);
  const { data: id, error } = await client.rpc('create_job_post', {
    p_salon_id: membership.salon_id,
    p_location_id: location?.id || null,
    p_title: job.title,
    p_category: job.category,
    p_description: job.description,
    p_employment_type: employmentToDb[job.jobType],
    p_workplace_type: 'on_site',
    p_experience_min_months: 0,
    p_experience_max_months: null,
    p_freshers_allowed: true,
    p_salary_min: salaryMin,
    p_salary_max: salaryMax,
    p_pay_type: job.jobType === 'Commission' ? 'commission' : 'monthly',
    p_benefits: job.benefits.join('\n'),
    p_working_days: null,
    p_working_hours: null,
    p_openings: 1,
    p_tags: job.tags,
    p_image_path: job.image || null,
  });
  if (error) throw error;
  const { error: publishError } = await client.rpc('publish_job', { target_job_id: id });
  if (publishError) throw publishError;
  const { data: saved, error: readError } = await client.from('public_job_listings').select('*').eq('id', id).single();
  if (readError) throw readError;
  return mapJob(saved);
}

function numericValue(value?: string) {
  if (!value) return null;
  const match = value.replace(/,/g, '').match(/[\d.]+/);
  return match ? Number(match[0]) : null;
}
function dateValue(value?: string) {
  if (!value) return null;
  const match = value.match(/^\d{4}-\d{2}-\d{2}$/);
  return match ? value : null;
}

export async function createApplication(
  _userId: string,
  job: JobPosting,
  coverNote: string,
  expectedSalary?: string,
  availability?: string,
  _requestedId?: string,
) {
  const { data, error } = await requireSupabase().rpc('submit_job_application', {
    target_job_id: job.id,
    p_resume_id: null,
    p_cover_note: coverNote || null,
    p_expected_salary: numericValue(expectedSalary),
    p_available_from: dateValue(availability),
  });
  if (error) throw error;
  return (data as any).id as string;
}

export async function updateApplicationStatus(applicationId: string, status: Applicant['status']) {
  const client = requireSupabase();
  const { data: current, error: readError } = await client
    .from('job_applications').select('status').eq('id', applicationId).single();
  if (readError) throw readError;

  let currentStatus = current.status;
  if (status === 'Viewed' && currentStatus === 'submitted') {
    const { error } = await client.rpc('mark_application_viewed', { target_application_id: applicationId });
    if (error) throw error;
    return;
  }
  if (status === 'Shortlisted' || status === 'Interview Scheduled') {
    if (currentStatus === 'submitted') {
      const { error } = await client.rpc('mark_application_viewed', { target_application_id: applicationId });
      if (error) throw error;
      currentStatus = 'viewed';
    }
    if (currentStatus === 'viewed') {
      const { error } = await client.rpc('shortlist_application', { target_application_id: applicationId });
      if (error) throw error;
      currentStatus = 'shortlisted';
    }
    if (status === 'Interview Scheduled' && currentStatus === 'shortlisted') {
      const { error } = await client.rpc('create_interview_request', {
        target_application_id: applicationId,
        p_interview_type: 'in_person',
        p_scheduled_start: new Date(Date.now() + 3 * 86_400_000).toISOString(),
        p_duration_minutes: 30,
        p_location_text: 'Salon location',
        p_meeting_url: null,
        p_employer_message: 'We would like to invite you for an interview.',
      });
      if (error) throw error;
    }
    return;
  }
  if (status === 'Declined') {
    const { error } = await client.rpc('reject_application', { target_application_id: applicationId, p_reason: null });
    if (error) throw error;
    return;
  }
  if (status === 'Hired') {
    const { error } = await client.rpc('mark_candidate_hired', { target_application_id: applicationId });
    if (error) throw error;
    return;
  }
  if (status === 'Offer Extended') {
    throw new Error('Use the offer form to send salary, joining date, and offer terms.');
  }
}

export async function createConversationRecord(input: {
  id: string;
  userId: string;
  role: UserRole;
  jobId: string;
  targetSeekerEmail?: string;
}) {
  const client = requireSupabase();
  const { data: job, error: jobError } = await client.from('job_posts').select('salon_id').eq('id', input.jobId).single();
  if (jobError) throw jobError;

  let candidateUserId = input.role === 'seeker' ? input.userId : '';
  let employerUserId = input.role === 'employer' ? input.userId : '';
  if (!employerUserId) {
    const { data: member, error } = await client.from('job_salon_members').select('user_id').eq('salon_id', job.salon_id).eq('status', 'active').order('created_at').limit(1).single();
    if (error) throw error;
    employerUserId = member.user_id;
  }
  if (!candidateUserId && input.targetSeekerEmail) {
    const { data: cards, error } = await client.rpc('get_job_applicant_cards');
    if (error) throw error;
    candidateUserId = arrays<any>(cards).find((card) => card.email === input.targetSeekerEmail)?.candidate_user_id || '';
  }
  if (!candidateUserId || !employerUserId) throw new Error('Unable to identify conversation participants.');

  const { error } = await client.from('job_conversations').upsert({
    id: input.id,
    job_id: input.jobId,
    candidate_user_id: candidateUserId,
    employer_user_id: employerUserId,
    status: 'inquiry',
    last_message: 'Conversation started',
  }, { onConflict: 'job_id,candidate_user_id,employer_user_id' });
  if (error) throw error;
}

export async function sendMessageRecord(userId: string, message: ChatMessage) {
  const { error } = await requireSupabase().from('job_messages').insert({
    id: message.id,
    conversation_id: message.conversationId,
    sender_user_id: userId,
    body: message.text,
    attachment: message.attachment || null,
  });
  if (error) throw error;
}

export async function updateAlertRead(alertId: string, isRead = true) {
  const { error } = await requireSupabase().from('job_notifications').update({
    is_read: isRead,
    read_at: isRead ? new Date().toISOString() : null,
  }).eq('id', alertId);
  if (error) throw error;
}

export async function markAllAlertsRead(userId: string) {
  const { error } = await requireSupabase().from('job_notifications').update({
    is_read: true,
    read_at: new Date().toISOString(),
  }).eq('user_id', userId).eq('type', 'job_match');
  if (error) throw error;
}

export async function deleteAlert(alertId: string) {
  const { error } = await requireSupabase().from('job_notifications').delete().eq('id', alertId);
  if (error) throw error;
}

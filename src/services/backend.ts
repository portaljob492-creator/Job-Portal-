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

function mapJob(row: any, isBookmarked = false): JobPosting {
  return {
    id: row.id,
    title: row.title,
    salonName: row.salon_name,
    salonLogo: row.salon_logo_url || undefined,
    location: row.location,
    image: row.image_url || '',
    rating: Number(row.rating || 0),
    reviewsCount: Number(row.reviews_count || 0),
    salary: row.salary_display,
    jobType: row.job_type,
    category: row.category,
    tags: arrays<string>(row.tags),
    description: row.description,
    requirements: arrays<string>(row.requirements),
    benefits: arrays<string>(row.benefits),
    postedDate: relativeDate(row.created_at),
    isBookmarked,
    isFeatured: Boolean(row.is_featured),
    activeApplicantsCount: Number(row.active_applicants_count || 0),
  };
}

const applicationStatuses: Record<string, Application['status']> = {
  submitted: 'Submitted',
  new: 'Submitted',
  viewed: 'Under Review',
  under_review: 'Under Review',
  shortlisted: 'Under Review',
  interview_scheduled: 'Interview Scheduled',
  offer_extended: 'Offer Extended',
  hired: 'Offer Extended',
  declined: 'Under Review',
};

const applicantStatuses: Record<string, Applicant['status']> = {
  submitted: 'New',
  new: 'New',
  viewed: 'Viewed',
  under_review: 'Viewed',
  shortlisted: 'Shortlisted',
  interview_scheduled: 'Interview Scheduled',
  offer_extended: 'Offer Extended',
  hired: 'Hired',
  declined: 'Declined',
};

const statusToDb: Record<Applicant['status'], string> = {
  New: 'new',
  Viewed: 'viewed',
  Shortlisted: 'shortlisted',
  'Interview Scheduled': 'interview_scheduled',
  'Offer Extended': 'offer_extended',
  Hired: 'hired',
  Declined: 'declined',
};

function mapApplication(row: any): Application {
  const job = one<any>(row.job);
  return {
    id: row.id,
    jobId: row.job_id,
    jobTitle: job?.title || 'Beauty position',
    salonName: job?.salon_name || 'Salon',
    salonLogo: job?.salon_logo_url || undefined,
    location: job?.location || '',
    appliedDate: relativeDate(row.created_at),
    status: applicationStatuses[row.status] || 'Submitted',
    notes: row.notes || undefined,
    interviewDate: row.interview_at ? new Date(row.interview_at).toLocaleString() : undefined,
    expectedSalary: row.expected_salary || undefined,
    availability: row.availability || undefined,
  };
}

function mapApplicant(row: any): Applicant {
  const job = one<any>(row.job);
  const seeker = one<any>(row.seeker);
  return {
    id: row.id,
    name: seeker?.full_name || 'Applicant',
    appliedJobId: row.job_id,
    appliedJobTitle: job?.title || 'Beauty position',
    email: seeker?.email || '',
    phone: seeker?.phone || '',
    experienceYears: Number(seeker?.experience_years || 0),
    licenseNumber: seeker?.license_number || '',
    status: applicantStatuses[row.status] || 'New',
    appliedDate: relativeDate(row.created_at),
    coverNote: row.cover_note || undefined,
    portfolioUrl: seeker?.portfolio_url || undefined,
    expectedSalary: row.expected_salary || undefined,
    availability: row.availability || undefined,
    avatarUrl: seeker?.avatar_url || undefined,
    location: seeker?.location || undefined,
    skills: arrays<string>(seeker?.specialties),
  };
}

function mapConversation(row: any): Conversation {
  const job = one<any>(row.job);
  const seeker = one<any>(row.seeker);
  const employer = one<any>(row.employer);
  return {
    id: row.id,
    jobId: row.job_id,
    jobTitle: job?.title || 'Beauty position',
    salonName: job?.salon_name || 'Salon',
    salonLogo: job?.salon_logo_url || undefined,
    seekerName: seeker?.full_name || 'Job seeker',
    seekerAvatar: seeker?.avatar_url || undefined,
    seekerEmail: seeker?.email || undefined,
    employerName: employer?.full_name || job?.salon_name || 'Employer',
    employerAvatar: employer?.avatar_url || undefined,
    lastMessage: row.last_message || 'Conversation started',
    lastMessageTime: relativeDate(row.last_message_at || row.created_at),
    unreadCountSeeker: Number(row.unread_count_seeker || 0),
    unreadCountEmployer: Number(row.unread_count_employer || 0),
    status: row.status || 'Inquiry',
  };
}

function mapMessage(row: any): ChatMessage {
  const sender = one<any>(row.sender);
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderRole: (sender?.role || 'seeker') as UserRole,
    senderName: sender?.full_name || 'User',
    senderAvatar: sender?.avatar_url || undefined,
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
    location: row.location || 'All Locations',
    jobType: row.job_type || 'All Types',
    salary: row.salary || 'All Salaries',
    tag: row.tag || 'All Perks',
    sortBy: row.sort_by || 'relevant',
    createdAt: relativeDate(row.created_at),
    notifyPush: Boolean(row.notify_push),
    notifyEmail: Boolean(row.notify_email),
    notifyInApp: Boolean(row.notify_in_app),
    matchFrequency: row.match_frequency || 'Instant',
    lastMatchCount: Number(row.last_match_count || 0),
  };
}

function mapAlert(row: any): JobAlertNotification {
  const job = one<any>(row.job);
  const filter = one<any>(row.saved_filter);
  return {
    id: row.id,
    savedFilterId: row.saved_filter_id,
    savedFilterName: filter?.name || 'Saved search',
    jobId: row.job_id,
    jobTitle: job?.title || 'New job',
    salonName: job?.salon_name || 'Salon',
    location: job?.location || '',
    salary: job?.salary_display || '',
    category: job?.category || '',
    matchedAt: relativeDate(row.created_at),
    isRead: Boolean(row.is_read),
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
    const { data, error } = await requireSupabase().auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          role: input.role,
          full_name: input.name,
          phone: input.phone || '',
          business_name: input.businessName || '',
        },
      },
    });
    if (error) throw error;
    return data;
  },

  async verifySignupOtp(email: string, token: string) {
    const { data, error } = await requireSupabase().auth.verifyOtp({ email: email.trim(), token, type: 'signup' });
    if (error) throw error;
    return data;
  },

  async resendSignupOtp(email: string) {
    const { error } = await requireSupabase().auth.resend({ type: 'signup', email: email.trim() });
    if (error) throw error;
  },

  async signIn(email: string, password: string) {
    const { data, error } = await requireSupabase().auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    return data;
  },

  async signInWithProvider(provider: Provider, role: UserRole) {
    window.localStorage.setItem('nexora_pending_role', role);
    const { data, error } = await requireSupabase().auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return data;
  },

  async sendPasswordReset(email: string) {
    const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/?recovery=1`,
    });
    if (error) throw error;
  },

  async updatePassword(password: string) {
    const { error } = await requireSupabase().auth.updateUser({ password });
    if (error) throw error;
  },

  async signOut() {
    const { error } = await requireSupabase().auth.signOut();
    if (error) throw error;
  },
};

export async function applyPendingOAuthRole(_userId: string) {
  const pendingRole = window.localStorage.getItem('nexora_pending_role') as UserRole | null;
  if (!pendingRole) return;
  const { error } = await requireSupabase().rpc('claim_oauth_role', { requested_role: pendingRole });
  if (error) throw error;
  window.localStorage.removeItem('nexora_pending_role');
}

export async function getUserRole(user: User): Promise<UserRole> {
  const { data, error } = await requireSupabase().from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (error) throw error;
  return (data?.role || user.user_metadata?.role || 'seeker') as UserRole;
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
  const [profileResult, businessResult, jobsResult, bookmarksResult, conversationsResult, messagesResult, filtersResult, portfolioResult, alertsResult] =
    await Promise.all([
      client.from('profiles').select('*').eq('id', user.id).single(),
      client.from('businesses').select('*').eq('owner_id', user.id).maybeSingle(),
      client.from('jobs').select('*').eq('status', 'active').order('created_at', { ascending: false }),
      client.from('bookmarks').select('job_id').eq('user_id', user.id),
      client.from('conversations').select('*, job:jobs(*), seeker:profiles!conversations_seeker_id_fkey(*), employer:profiles!conversations_employer_id_fkey(*)').order('last_message_at', { ascending: false }),
      client.from('messages').select('*, sender:profiles!messages_sender_id_fkey(*)').order('created_at', { ascending: true }),
      client.from('saved_filters').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      client.from('portfolio_items').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      client.from('job_alerts').select('*, job:jobs(*), saved_filter:saved_filters(*)').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);

  const error = [profileResult, businessResult, jobsResult, bookmarksResult, conversationsResult, messagesResult, filtersResult, portfolioResult, alertsResult]
    .map((result) => result.error)
    .find(Boolean);
  if (error) throw error;

  const applicationsResult = role === 'employer'
    ? await client.from('applications').select('*, job:jobs!inner(*), seeker:profiles!applications_seeker_id_fkey(*)').eq('job.employer_id', user.id).order('created_at', { ascending: false })
    : await client.from('applications').select('*, job:jobs(*)').eq('seeker_id', user.id).order('created_at', { ascending: false });
  if (applicationsResult.error) throw applicationsResult.error;

  const profile: any = profileResult.data;
  const business: any = businessResult.data;
  const savedFilters = arrays<any>(filtersResult.data).map(mapSavedFilter);
  const portfolioItems: PortfolioItem[] = arrays<any>(portfolioResult.data).map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    imageUrl: row.image_url,
    description: row.description || undefined,
    technique: row.technique || undefined,
    date: row.item_date || undefined,
  }));
  const bookmarkedIds = new Set(arrays<any>(bookmarksResult.data).map((row) => row.job_id));
  const applicationRows = arrays<any>(applicationsResult.data);

  return {
    profile: {
      name: profile.full_name || user.email?.split('@')[0] || 'User',
      email: profile.email || user.email || '',
      phone: profile.phone || '',
      role: profile.role || role,
      avatarUrl: profile.avatar_url || undefined,
      businessName: business?.name || undefined,
      contactPerson: business?.contact_person || profile.full_name || undefined,
      licenseNumber: profile.license_number || undefined,
      specialties: arrays<string>(profile.specialties),
      bio: profile.bio || undefined,
      portfolioItems,
      savedFilters,
    },
    jobs: arrays<any>(jobsResult.data).map((row) => mapJob(row, bookmarkedIds.has(row.id))),
    applications: role === 'seeker' ? applicationRows.map(mapApplication) : [],
    applicants: role === 'employer' ? applicationRows.map(mapApplicant) : [],
    conversations: arrays<any>(conversationsResult.data).map(mapConversation),
    messages: arrays<any>(messagesResult.data).map(mapMessage),
    alerts: arrays<any>(alertsResult.data).map(mapAlert),
  };
}

export async function saveProfile(userId: string, profile: UserProfile) {
  const client = requireSupabase();
  const { error } = await client.from('profiles').update({
    full_name: profile.name,
    phone: profile.phone,
    avatar_url: profile.avatarUrl || null,
    license_number: profile.licenseNumber || null,
    specialties: profile.specialties || [],
    bio: profile.bio || null,
  }).eq('id', userId);
  if (error) throw error;

  if (profile.role === 'employer' && profile.businessName) {
    const { error: businessError } = await client.from('businesses').upsert({
      owner_id: userId,
      name: profile.businessName,
      contact_person: profile.contactPerson || profile.name,
    }, { onConflict: 'owner_id' });
    if (businessError) throw businessError;
  }
}

export async function setBookmark(userId: string, jobId: string, bookmarked: boolean) {
  const client = requireSupabase();
  const result = bookmarked
    ? await client.from('bookmarks').upsert({ user_id: userId, job_id: jobId })
    : await client.from('bookmarks').delete().eq('user_id', userId).eq('job_id', jobId);
  if (result.error) throw result.error;
}

export async function createJob(userId: string, job: JobPosting): Promise<JobPosting> {
  const { data, error } = await requireSupabase().from('jobs').insert({
    employer_id: userId,
    title: job.title,
    salon_name: job.salonName,
    salon_logo_url: job.salonLogo || null,
    location: job.location,
    image_url: job.image || null,
    rating: job.rating || 0,
    reviews_count: job.reviewsCount || 0,
    salary_display: job.salary,
    job_type: job.jobType,
    category: job.category,
    tags: job.tags,
    description: job.description,
    requirements: job.requirements,
    benefits: job.benefits,
    is_featured: Boolean(job.isFeatured),
    status: 'active',
  }).select('*').single();
  if (error) throw error;
  return mapJob(data);
}

export async function createApplication(
  userId: string,
  job: JobPosting,
  coverNote: string,
  expectedSalary?: string,
  availability?: string,
  requestedId?: string,
) {
  const id = requestedId || crypto.randomUUID();
  const { error } = await requireSupabase().from('applications').insert({
    id,
    job_id: job.id,
    seeker_id: userId,
    cover_note: coverNote || null,
    expected_salary: expectedSalary || null,
    availability: availability || null,
    status: 'submitted',
  });
  if (error) throw error;
  return id;
}

export async function updateApplicationStatus(applicationId: string, status: Applicant['status']) {
  const values: Record<string, unknown> = { status: statusToDb[status] };
  if (status === 'Interview Scheduled') values.interview_at = new Date(Date.now() + 259_200_000).toISOString();
  const { error } = await requireSupabase().from('applications').update(values).eq('id', applicationId);
  if (error) throw error;
}

export async function createConversationRecord(input: {
  id: string;
  userId: string;
  role: UserRole;
  jobId: string;
  targetSeekerEmail?: string;
}) {
  const client = requireSupabase();
  const { data: job, error: jobError } = await client.from('jobs').select('employer_id').eq('id', input.jobId).single();
  if (jobError) throw jobError;

  let seekerId = input.role === 'seeker' ? input.userId : '';
  if (!seekerId && input.targetSeekerEmail) {
    const { data: seeker, error: seekerError } = await client.from('profiles').select('id').eq('email', input.targetSeekerEmail).maybeSingle();
    if (seekerError) throw seekerError;
    seekerId = seeker?.id || '';
  }
  if (!seekerId) throw new Error('Unable to identify the job seeker.');

  const { error } = await client.from('conversations').upsert({
    id: input.id,
    job_id: input.jobId,
    seeker_id: seekerId,
    employer_id: job.employer_id,
    status: 'Inquiry',
    last_message: 'Conversation started',
  }, { onConflict: 'job_id,seeker_id,employer_id' });
  if (error) throw error;
}

export async function sendMessageRecord(userId: string, message: ChatMessage) {
  const { error } = await requireSupabase().from('messages').insert({
    id: message.id,
    conversation_id: message.conversationId,
    sender_id: userId,
    body: message.text,
    attachment: message.attachment || null,
  });
  if (error) throw error;
}

export async function updateAlertRead(alertId: string, isRead = true) {
  const { error } = await requireSupabase().from('job_alerts').update({ is_read: isRead }).eq('id', alertId);
  if (error) throw error;
}

export async function markAllAlertsRead(userId: string) {
  const { error } = await requireSupabase().from('job_alerts').update({ is_read: true }).eq('user_id', userId);
  if (error) throw error;
}

export async function deleteAlert(alertId: string) {
  const { error } = await requireSupabase().from('job_alerts').delete().eq('id', alertId);
  if (error) throw error;
}

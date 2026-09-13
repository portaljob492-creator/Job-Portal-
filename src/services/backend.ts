import type { Provider, Session, SupabaseClient, User } from '@supabase/supabase-js';
import type {
  Applicant,
  Application,
  CandidateApplicationStatus,
  CandidateProfileInput,
  CandidateProfileSubmission,
  ChatMessage,
  Conversation,
  EmployerInterview,
  JobAlertNotification,
  JobPosting,
  PortfolioItem,
  ResumeFile,
  SavedFilter,
  UserProfile,
  UserRole,
} from '../types';
import { requireSupabase } from '../lib/supabase';
import { toSafeMessage } from '../lib/logger';
import type { InterviewSchedulePayload } from '../lib/interviewSchedule';
import {
  MEDIA_BUCKETS,
  deleteMediaObject,
  isDataUrl,
  dataUrlToBlob,
  pickDisplayUrl,
  resolveStorageUrls,
  uploadAvatar,
  uploadPortfolioImage,
  uploadResumeObject,
} from '../lib/storageMedia';
import { clearSessionBeforeSignUp, markUserInitiatedSignOut } from '../lib/authSession';
import { decideSignInPortal, isEnterablePortalRole, normalizeStoredPortalRole } from '../lib/portalRole';
import { normalizeEmail } from '../lib/email';
import { isEmailNotConfirmedError } from '../lib/signUpOutcome';
import { validateNewPassword } from '../lib/passwordPolicy';
import type { RecoveryTokenInput } from '../lib/recoveryLink';
import {
  AuthRateLimitError,
  formatRetryCountdown,
  isRecoveryLinkRejectedError,
  isSessionInvalidError,
  parsePortalRoleMismatch,
  parseRateLimitError,
  PasswordSignInBlockedError,
  PortalRoleMismatchError,
} from '../lib/authErrors';

/**
 * Every sign-out that the app performs on purpose is flagged so the shared auth
 * store can tell a deliberate logout apart from an expired/revoked session
 * (which must route to the login screen instead of the welcome screen).
 */
async function signOutDeliberately() {
  const client = requireSupabase();
  markUserInitiatedSignOut();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

const arrays = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const one = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

const appBaseUrl = () => new URL(import.meta.env.BASE_URL, window.location.origin).toString();
const appCallbackUrl = (query = '') => `${appBaseUrl()}${query}`;
/**
 * The sign-up confirmation link returns to this app with `?confirmed=1`, which
 * is what tells the bootstrap to finish the sign-in (PKCE exchanges the code in
 * the link automatically) instead of treating the visitor as a new arrival.
 */
const confirmationRedirectUrl = () => appCallbackUrl('?confirmed=1');
const backendRole = (role: UserRole) => role === 'seeker' ? 'job_seeker' : role;
const frontendRole = (role?: string | null): UserRole => role === 'admin' ? 'admin' : role === 'employer' ? 'employer' : 'seeker';
const portalLabel = (role: UserRole) => role === 'seeker' ? 'Job Seeker' : role === 'admin' ? 'Admin' : 'Employer';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error
    ? error.message
    : typeof error === 'object' && error && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error || fallback);
}

/**
 * Converts a role-rejection signal from `job_register_role` into a structured
 * `PortalRoleMismatchError` (so the UI can offer a portal switch + prefill),
 * or falls back to the raw error. `PORTAL_ROLE_MISMATCH:unassigned` means the
 * account exists in Nexora but has no Jobs portal role yet.
 */
function mapPortalRoleError(error: unknown, requestedRole: UserRole, email = ''): Error {
  const parsed = parsePortalRoleMismatch(error, requestedRole, email);
  if (parsed) return parsed;
  const message = errorMessage(error, 'Unable to validate portal access.');
  if (/PORTAL_ROLE_MISMATCH:unassigned/i.test(message)) {
    return new Error('This email already belongs to a Nexora account without a Jobs portal role. Sign in through the Jobs portal to link it.');
  }
  return error instanceof Error ? error : new Error(message);
}

/**
 * Thrown when the recovery session behind a reset link has died mid-flow, so the
 * UI can drop the password form and offer a fresh email instead of a dead form.
 */
export class RecoverySessionLostError extends Error {
  constructor(message = 'This password reset link has expired. Request a new reset email to continue.') {
    super(message);
    this.name = 'RecoverySessionLostError';
  }
}

/**
 * Maps a raw Supabase auth failure onto the product copy the screens show.
 * Exported for `npm run test:reset`, which asserts the exact strings users see.
 */
function isInvalidLoginCredentialsError(error: unknown): boolean {
  return errorMessage(error, 'Authentication request failed.').toLowerCase().includes('invalid login credentials');
}

export function mapAuthError(error: unknown): Error {
  // Throttling first: it carries the wait time the UI counts down from, and it
  // must never be reported as a credential problem.
  const rateLimit = parseRateLimitError(error);
  if (rateLimit) {
    if (rateLimit.scope !== 'email') return rateLimit;
    // Product copy for the email quota, but still an AuthRateLimitError so the
    // screen can read `retryAfterSeconds` and run its countdown.
    return new AuthRateLimitError(
      'email',
      rateLimit.retryAfterSeconds,
      `The email provider limit has been reached. Use the newest reset email you already received, or try again in ${formatRetryCountdown(rateLimit.retryAfterSeconds)}.`,
    );
  }

  const message = errorMessage(error, 'Authentication request failed.');
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) {
    return new Error('Invalid email or password. Check your credentials and selected portal.');
  }
  if (normalized.includes('email not confirmed')) {
    return new Error('Your email is not verified. Open the verification email or request a fresh link.');
  }
  if (normalized.includes('same_password') || normalized.includes('new password should be different')) {
    return new Error('Choose a password you have not used on this account before.');
  }
  if (normalized.includes('weak_password') || normalized.includes('password should be at least')) {
    return new Error('That password is too weak. Use at least 8 characters with an uppercase letter, a lowercase letter and a number.');
  }
  if (isRecoveryLinkRejectedError(error)) {
    return new RecoverySessionLostError();
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

function mapJob(row: any, isBookmarked = false, salonLookup?: Map<string, any>): JobPosting {
  const salon = (row.salon_id && salonLookup ? salonLookup.get(row.salon_id) : null) || one<any>(row.salon);
  const location = one<any>(row.location);
  const city = row.city || location?.city || salon?.city || '';
  const state = row.state || location?.state || salon?.state || '';
  const area = row.area || '';
  const displayLocation = row.workplace_type === 'remote'
    ? 'Remote'
    : [area, city, state].filter(Boolean).join(', ');
  return {
    id: row.id,
    title: row.title,
    salonName: row.salon_name || salon?.name || 'Salon',
    salonLogo: row.logo_path || salon?.logo_path || undefined,
    location: displayLocation,
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
    publishedAt: row.published_at || row.created_at || undefined,
    workplaceType: row.workplace_type || undefined,
    experienceMinMonths: row.experience_min_months == null ? undefined : Number(row.experience_min_months),
    experienceMaxMonths: row.experience_max_months == null ? undefined : Number(row.experience_max_months),
    freshersAllowed: row.freshers_allowed == null ? undefined : Boolean(row.freshers_allowed),
    salaryMin: row.salary_min == null ? undefined : Number(row.salary_min),
    salaryMax: row.salary_max == null ? undefined : Number(row.salary_max),
    payType: row.pay_type || undefined,
    openings: row.openings == null ? undefined : Number(row.openings),
    workingDays: row.working_days || undefined,
    workingHours: row.working_hours || undefined,
    businessName: row.business_name || row.salon_name || salon?.name || undefined,
    jobRole: row.job_role || undefined,
    workLocation: row.work_location || undefined,
    city: city || undefined,
    area: area || undefined,
    contactPerson: row.contact_person || undefined,
    contactMobile: row.contact_mobile || undefined,
    whatsappNumber: row.whatsapp_number || undefined,
    interviewMode: row.interview_mode || undefined,
    postingStatus: row.status === 'approved' ? 'published' : row.status === 'draft' ? 'draft' : undefined,
    shopId: row.shop_id || row.salon_id || undefined,
    createdBy: row.created_by || undefined,
    isBookmarked,
    isFeatured: Boolean(row.salon_verified || salon?.verified),
    activeApplicantsCount: Number(row.active_applicants_count || 0),
    approvalStatus: row.status || (row.published_at ? 'approved' : undefined),
    rejectionReason: row.admin_review_reason || undefined,
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
  offer_accepted: 'Accepted',
  hired: 'Accepted',
  rejected: 'Declined',
  withdrawn: 'Declined',
  position_closed: 'Declined',
};
const candidateApplicationStatuses: Record<string, CandidateApplicationStatus> = {
  submitted: 'Applied',
  viewed: 'Under Review',
  shortlisted: 'Shortlisted',
  interview_requested: 'Shortlisted',
  interview_confirmed: 'Shortlisted',
  interview_completed: 'Shortlisted',
  offer_sent: 'Shortlisted',
  offer_accepted: 'Hired',
  hired: 'Hired',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  position_closed: 'Rejected',
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

function mapApplication(row: any, salonLookup?: Map<string, any>, ownedListing?: any): Application {
  // ownedListing comes from a narrow, role-checked RPC and remains available
  // after a job leaves public search; the normal embedded row is used otherwise.
  const jobRow = ownedListing || one<any>(row.job);
  const job = jobRow ? mapJob(jobRow, false, salonLookup) : null;
  const interviews = arrays<any>(row.interviews).sort(
    (a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime(),
  );
  // The workflow RPCs are keyed by interview/offer id, so the newest row of each
  // kind travels with the application (newest first, completed/closed excluded
  // where the action would no longer be valid).
  const openInterview = interviews.find((item) =>
    ['requested', 'confirmed', 'reschedule_requested', 'rescheduled'].includes(String(item.status)),
  );
  const offers = arrays<any>(row.offers).sort(
    (a, b) => new Date(b.sent_at || 0).getTime() - new Date(a.sent_at || 0).getTime(),
  );
  const activeOffer = offers.find((item) => ['sent', 'accepted'].includes(String(item.status)));
  // Prefer an interview that is still actionable; otherwise expose the newest
  // one so the candidate screens can still show it.
  const workflowInterview = openInterview ?? interviews[0];
  return {
    id: row.id,
    jobId: row.job_id,
    jobTitle: job?.title || 'Beauty position',
    salonName: job?.salonName || 'Salon',
    salonLogo: job?.salonLogo,
    location: job?.location || '',
    salaryRange: job?.salary,
    jobType: job?.jobType,
    job: job || undefined,
    appliedDate: relativeDate(row.submitted_at),
    submittedAt: row.submitted_at || undefined,
    status: applicationStatuses[row.status] || 'Submitted',
    applicationStatus: candidateApplicationStatuses[row.status] || 'Applied',
    notes: row.employer_notes || undefined,
    interviewDate: interviews[0]?.scheduled_start
      ? new Date(interviews[0].scheduled_start).toLocaleString()
      : undefined,
    expectedSalary: row.expected_salary == null ? undefined : `₹${Number(row.expected_salary).toLocaleString('en-IN')}`,
    availability: row.available_from || undefined,
    interviewId: workflowInterview?.id || undefined,
    interviewType: workflowInterview?.interview_type || undefined,
    interviewDurationMinutes: workflowInterview ? Number(workflowInterview.duration_minutes || 30) : undefined,
    interviewLocation: workflowInterview?.location_text || undefined,
    interviewMeetingUrl: workflowInterview?.meeting_url || undefined,
    interviewEmployerMessage: workflowInterview?.employer_message || undefined,
    offerId: activeOffer?.id || undefined,
    offerJobRole: activeOffer?.job_role || undefined,
    offerSalary: activeOffer?.salary == null ? undefined : Number(activeOffer.salary),
    offerEmploymentType: activeOffer?.employment_type || undefined,
    offerJoiningDate: activeOffer?.joining_date || undefined,
    offerNotes: activeOffer?.offer_notes || undefined,
    offerDocumentPath: activeOffer?.offer_document_path || undefined,
    offerExpiresAt: activeOffer?.expires_at || undefined,
  };
}

function mapEmployerInterview(row: any): EmployerInterview {
  return {
    id: row.id,
    applicationId: row.application_id,
    interviewType: row.interview_type,
    scheduledStart: row.scheduled_start,
    durationMinutes: Number(row.duration_minutes || 30),
    locationText: row.location_text || undefined,
    meetingUrl: row.meeting_url || undefined,
    employerMessage: row.employer_message || undefined,
    candidateMessage: row.candidate_message || undefined,
    status: row.status,
  };
}

function mapApplicant(row: any): Applicant {
  const interviews = arrays<any>(row.interviews)
    .sort((a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime())
    .map(mapEmployerInterview);
  return {
    id: row.application_id,
    name: row.candidate_name || 'Applicant',
    appliedJobId: row.job_id,
    appliedJobTitle: row.job_title || 'Beauty position',
    email: row.email || '',
    phone: row.phone || '',
    experienceYears: Math.floor(Number(row.total_experience_months || 0) / 12),
    licenseNumber: '',
    status: applicantStatuses[row.status] || 'New',
    appliedDate: relativeDate(row.submitted_at),
    coverNote: row.cover_note || undefined,
    expectedSalary: row.expected_salary == null ? undefined : `₹${Number(row.expected_salary).toLocaleString('en-IN')}`,
    availability: row.available_from || undefined,
    avatarUrl: row.avatar_path || undefined,
    location: [row.preferred_city, row.preferred_state].filter(Boolean).join(', ') || undefined,
    skills: arrays<string>(row.skills),
    candidateProfileId: row.candidate_profile_id || undefined,
    resumeFileName: row.resume_filename || undefined,
    resumeStoragePath: row.resume_storage_path || undefined,
    interviews,
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

/**
 * Supabase deliberately returns the same error for a wrong password and an
 * OAuth-only account. Do not add an anonymous email-enumeration RPC just to
 * distinguish those cases; the recovery card already offers both password
 * reset and social sign-in actions safely.
 */
async function checkOAuthOnlyAccount(_email: string): Promise<boolean> {
  return false;
}

export interface SignUpInput {
  role: UserRole;
  email: string;
  password: string;
  name: string;
  phone?: string;
  businessName?: string;
}

/**
 * Result of a successful password sign-in: the Supabase auth response plus the
 * portal role the backend granted. Portal verification runs before the password
 * check, so this always equals the requested tab; the app routes on it rather
 * than on UI state.
 */
export interface SignInResult {
  user: User | null;
  session: Session | null;
  /** Portal role granted for this session. */
  portalRole: UserRole;
}

/**
 * Reads the portal role permanently assigned to an email.
 *
 * `role` is null when the address is unknown or has no Jobs portal role yet, so
 * callers must still work without it; `raw` keeps the backend's own value
 * because `'unassigned'` drives different sign-in copy than "no such account".
 */
async function readStoredPortalRole(
  client: SupabaseClient,
  email: string,
): Promise<{ raw: string | null; role: UserRole | null }> {
  const { data, error } = await client.rpc('job_email_portal_role', { p_email: email });
  const raw = !error && typeof data === 'string' ? data.toLowerCase() : null;
  return { raw, role: normalizeStoredPortalRole(raw) };
}

export const authBackend = {
  async signUp(input: SignUpInput) {
    const client = requireSupabase();
    const email = normalizeEmail(input.email);
    const requestedBackendRole = backendRole(input.role);

    // Sign-up is an account-switch boundary and must be anonymous. Without this,
    // a JWT cached for a user that was deleted in Supabase is attached to the
    // public role lookup below; GoTrue rejects that lookup before it can create
    // the new account. Local cleanup is deterministic and needs no valid server
    // session, so users recover automatically without clearing browser data.
    await clearSessionBeforeSignUp(client);

    const { data: existingRole, error: lookupError } = await client.rpc('job_email_portal_role', {
      p_email: email,
    });
    if (lookupError) throw lookupError;
    if (existingRole === 'job_seeker' || existingRole === 'employer') {
      if (existingRole !== requestedBackendRole) {
        // The email is permanently assigned to the other portal: raise a
        // structured mismatch so the UI can offer "Switch to … Portal".
        throw new PortalRoleMismatchError({
          email,
          requestedRole: input.role,
          existingRole: frontendRole(existingRole),
        });
      }

      throw new Error(`This email is already registered as a ${portalLabel(input.role)}. Please sign in through the ${portalLabel(input.role)} portal.`);
    }
    if (existingRole === 'unassigned') {
      throw new Error('This email already belongs to a Nexora account. Sign in through your chosen Jobs portal to permanently assign its account type.');
    }

    const { data, error } = await client.auth.signUp({
      email,
      password: input.password,
      options: {
        // Where the confirmation link lands. Without this the link follows the
        // project's dashboard Site URL, which is usually not this deployment —
        // and because the client uses PKCE the code in the link can only be
        // exchanged by a page that actually runs this app.
        emailRedirectTo: confirmationRedirectUrl(),
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
        if (racedRole !== requestedBackendRole) {
          throw new PortalRoleMismatchError({
            email,
            requestedRole: input.role,
            existingRole: frontendRole(racedRole),
          });
        }
        throw new Error(`This email is already registered as a ${portalLabel(input.role)}. Please sign in through the ${portalLabel(input.role)} portal.`);
      }
      throw new Error('An account already exists for this email. Please sign in instead.');
    }
    return data;
  },

  /**
   * Password sign-in.
   *
   * `requestedRole` is the portal tab the user clicked, and it is validated
   * against the account's stored portal role *before* the password is checked:
   * a Job Seeker tab with an Employer email is refused up front with a
   * `PortalRoleMismatchError` naming the Employer portal, which the login form
   * renders as the inline card + "Switch to Employer Portal" action. On success
   * the granted role is returned so the app routes to that portal.
   */
  async signIn(email: string, password: string, requestedRole: UserRole): Promise<SignInResult> {
    const client = requireSupabase();
    const normalizedEmail = normalizeEmail(email);

    // Sign-in is an account-switch boundary just like sign-up: drop a stale
    // cached session first so a JWT for a deleted user cannot poison the
    // portal-role pre-check below ("User from sub claim in JWT does not
    // exist"). The password grant then starts from a clean anonymous state.
    await clearSessionBeforeSignUp(client);

    // Portal verification, before any password validation: one email is
    // permanently registered to exactly one portal, so a tab that does not
    // match the account's stored role is refused without authenticating.
    // Throwing the structured error (rather than a bare message) is what lets
    // the login form render the inline card and its "Switch to … Portal"
    // action. Fails open when the lookup itself fails — `resolvePortalRole`
    // then enforces the same rule authoritatively after the password check.
    const { raw: storedRoleText, role: storedRole } = await readStoredPortalRole(client, normalizedEmail);
    const decision = decideSignInPortal(storedRole, requestedRole);
    if (decision.kind === 'mismatch') {
      throw new PortalRoleMismatchError({
        email: normalizedEmail,
        requestedRole,
        existingRole: decision.existingRole,
      });
    }

    const { data, error } = await client.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error) {
      if (isEmailNotConfirmedError(error)) {
        // The credentials were right; the address simply was never confirmed.
        // Surface it as a structured error so the login screen can offer a
        // re-send instead of a sentence with no action behind it.
        throw new PasswordSignInBlockedError({
          email: normalizedEmail,
          role: requestedRole,
          reason: 'unconfirmed',
        });
      }
      if (isInvalidLoginCredentialsError(error)) {
        // The account exists, so the failure is the credential itself: a typo, a
        // forgotten password, or an account created through Google/Apple that has
        // no password at all. Throwing the structured error lets the login screen
        // offer recovery actions (reset link / social continue) instead of a
        // sentence the user has to act on by themselves.
        if (isEnterablePortalRole(storedRole)) {
          // Try to detect whether this account was created via OAuth (no local
          // password). The check is best-effort: if the RPC is not deployed the
          // message still covers the case. The UI uses the `oauthOnly` hint to
          // disable password login and show a dedicated OAuth sign-in card.
          const oauthOnly = await checkOAuthOnlyAccount(normalizedEmail);
          throw new PasswordSignInBlockedError({
            email: normalizedEmail,
            role: requestedRole,
            reason: 'wrong_password',
            oauthOnly,
          });
        }
        if (storedRoleText === 'unassigned') {
          throw new PasswordSignInBlockedError({
            email: normalizedEmail,
            role: requestedRole,
            reason: 'unassigned',
          });
        }
      }
      throw mapAuthError(error);
    }

    let portalRole: UserRole;
    try {
      portalRole = await this.resolvePortalRole(requestedRole, normalizedEmail);
    } catch (roleError) {
      // The session was created but the portal refused entry (role assigned to
      // the other portal in the meantime, deactivated account): clear the
      // tokens so no invalid/partial session survives, then surface the error.
      await signOutDeliberately();
      throw mapPortalRoleError(roleError, requestedRole, normalizedEmail);
    }
    return { ...data, portalRole };
  },

  /**
   * Portal role permanently assigned to an email, or null when the address is
   * unknown, has no portal role yet, or the lookup is unavailable. The login
   * screen uses it to verify the tab against the account before the user
   * submits; null simply leaves the form alone, so this must never block a
   * sign-in — the authoritative check is in `signIn` itself.
   */
  async lookupPortalRole(email: string): Promise<UserRole | null> {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    const { role } = await readStoredPortalRole(requireSupabase(), normalized);
    return role;
  },

  /**
   * Enters the portal for the signed-in user and returns the role granted.
   *
   * Strict, like the pre-auth check: `job_register_role` assigns the requested
   * role when the account has none yet and raises `PORTAL_ROLE_MISMATCH:<role>`
   * when it already has a different one. That makes it the authoritative
   * backstop for the cases the lookup could not settle (RPC missing, offline,
   * role assigned between the two calls) — the refusal is surfaced as the
   * structured mismatch, never retried into the other portal.
   */
  async resolvePortalRole(requestedRole: UserRole, email = ''): Promise<UserRole> {
    const { data, error } = await requireSupabase().rpc('job_register_role', {
      requested_role: backendRole(requestedRole),
    });
    if (error) throw mapPortalRoleError(error, requestedRole, email);
    return frontendRole(String(data));
  },

  async signInAdmin(email: string, password: string) {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithPassword({ email: normalizeEmail(email), password });
    if (error) throw mapAuthError(error);
    const { data: roleRow, error: roleError } = await client.from('job_user_roles').select('role').eq('user_id', data.user.id).single();
    if (roleError || roleRow?.role !== 'admin') {
      await signOutDeliberately();
      throw new Error('Admin access is restricted to approved administrator accounts.');
    }
    return data;
  },

  async signInWithProvider(provider: Provider, role: UserRole) {
    window.localStorage.setItem('nexora_pending_role', role);
    const { data, error } = await requireSupabase().auth.signInWithOAuth({
      provider,
      options: { redirectTo: appBaseUrl() },
    });
    if (error) throw mapAuthError(error);
    return data;
  },

  /**
   * Re-sends the sign-up confirmation email for an account that was created but
   * never confirmed. Uses the same redirect as sign-up so the link still lands
   * on this app.
   */
  async resendConfirmationEmail(email: string) {
    const normalized = normalizeEmail(email);
    const { error } = await requireSupabase().auth.resend({
      type: 'signup',
      email: normalized,
      options: { emailRedirectTo: confirmationRedirectUrl() },
    });
    if (error) throw mapAuthError(error);
    return { email: normalized };
  },

  async sendPasswordReset(email: string) {
    const normalized = normalizeEmail(email);
    const { error } = await requireSupabase().auth.resetPasswordForEmail(normalized, {
      redirectTo: appCallbackUrl('?recovery=1'),
    });
    if (error) throw mapAuthError(error);
    return { email: normalized };
  },

  /**
   * Completes recovery from a token the user already has (the newest reset email
   * they received) instead of asking Supabase to send another one. That is the
   * only way back in while the email provider's hourly quota is exhausted, and
   * it also works when the link was opened on another device.
   *
   * `token_hash` verifies on its own; a 6-digit OTP is verified against the
   * account's email.
   */
  async recoverWithToken(input: RecoveryTokenInput, email = '') {
    const client = requireSupabase();
    const { data, error } = await client.auth.verifyOtp(
      input.kind === 'token_hash'
        ? { token_hash: input.value, type: 'recovery' }
        : { email: normalizeEmail(email), token: input.value, type: 'recovery' },
    );
    if (error) throw mapAuthError(error);
    if (!data.session) {
      throw new RecoverySessionLostError('That code was accepted but no recovery session was returned. Request a new reset email.');
    }
    return data;
  },

  async updatePassword(password: string) {
    // Validate locally first so a rejected password is explained with the same
    // rule wording the form shows, without spending the recovery session on a
    // request the server would refuse.
    const policyError = validateNewPassword(password);
    if (policyError) throw new Error(policyError);
    const { error } = await requireSupabase().auth.updateUser({ password });
    if (error) throw mapAuthError(error);
  },

  async signOut() {
    await signOutDeliberately();
  },
};

/**
 * Assigns (or confirms) the portal role for a session that just came back from
 * Google/Apple, and returns the role that was granted — null when no provider
 * sign-in was pending.
 *
 * The provider button the user pressed recorded the requested portal, and the
 * same rule as password sign-in applies: an account that already belongs to the
 * other portal is refused with the structured mismatch, so the app can drop the
 * session and send the user to the login of the portal that owns the account.
 */
export async function applyPendingOAuthRole(_userId: string): Promise<UserRole | null> {
  const pendingRole = window.localStorage.getItem('nexora_pending_role') as UserRole | null;
  if (!pendingRole) return null;
  let email = '';
  try {
    const { data } = await requireSupabase().auth.getUser();
    email = data.user?.email ?? '';
  } catch {
    // Email is best-effort; a mismatch error without it still redirects to login.
  }
  try {
    return await authBackend.resolvePortalRole(pendingRole, email);
  } catch (error) {
    // The OAuth session is unusable for any Jobs portal (admin account, or no
    // role could be assigned): clear it before redirecting so no invalid state
    // persists.
    await signOutDeliberately();
    throw mapPortalRoleError(error, pendingRole, email);
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
    p_city: profile.city || '',
    p_state: profile.state || '',
    p_experience_level: 'fresher',
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
  description?: string;
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
  const applicationSelect = `*, job:job_posts!job_applications_job_id_fkey(*, location:job_salon_locations!job_posts_location_id_fkey(*)), interviews:job_interview_requests(*), offers:job_offers(*)`;

  // Resolve the employer's salon for their profile while keeping My Job Posts
  // actor-scoped below. `job_posts` RLS also exposes approved public listings,
  // so every employer jobs query needs an explicit ownership predicate.
  const membershipResult = await client
    .from('job_salon_members')
    .select('salon_id,member_role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (membershipResult.error) throw membershipResult.error;
  const membership: any = membershipResult.data;

  const employerJobsQuery = client
    .from('job_posts')
    .select('*, location:job_salon_locations!job_posts_location_id_fkey(*)')
    // My Job Posts is intentionally actor-scoped: salon teammates must not be
    // mixed into the signed-in employer's personal posting history.
    .eq('created_by', user.id)
    .order('created_at', { ascending: false });

  const [profileResult, candidateResult, jobsResult, bookmarksResult, conversationsResult, messagesResult, filtersResult, alertsResult, applicationsResult, applicationListingsResult, applicantCardsResult, salonProfilesResult] = await Promise.all([
    // maybeSingle: a missing profiles row (marketplace trigger lag, legacy user)
    // must degrade to defaults, never fail the whole workspace load. The Jobs
    // signup trigger best-effort ensures the row; see migration
    // 20260913000600_jobs_profile_sync.sql.
    client.from('profiles').select('id,full_name,phone,avatar_path,preferred_city,preferred_area').eq('id', user.id).maybeSingle(),
    client.from('job_seeker_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    role === 'seeker'
      ? client.from('public_job_listings').select('*').order('published_at', { ascending: false })
      : employerJobsQuery,
    client.from('job_saved_jobs').select('job_id').eq('user_id', user.id),
    client.rpc('get_job_conversation_summaries'),
    client.from('job_messages').select('*').order('created_at', { ascending: true }),
    client.from('job_saved_searches').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    client.from('job_notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    role === 'seeker'
      ? client.from('job_applications').select(applicationSelect).eq('candidate_user_id', user.id).order('submitted_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    role === 'seeker' ? client.rpc('get_my_job_application_listings') : Promise.resolve({ data: [], error: null }),
    role === 'employer' ? client.rpc('get_employer_job_applications', { target_job_id: null }) : Promise.resolve({ data: [], error: null }),
    client.from('public_job_salon_profiles').select('*'),
  ]);

  const error = [profileResult, candidateResult, jobsResult, bookmarksResult, conversationsResult, messagesResult, filtersResult, alertsResult, applicationsResult, applicationListingsResult, applicantCardsResult, salonProfilesResult]
    .map((result: any) => result.error)
    .find(Boolean);
  if (error) throw error;

  const salonMap = new Map<string, any>((salonProfilesResult.data || []).map((s: any) => [s.id, s]));

  const candidate: any = candidateResult.data;
  const [skillsResult, portfolioResult, experienceResult, educationResult, certificationsResult, preferencesResult, preferredRolesResult, employmentTypesResult] = candidate
    ? await Promise.all([
        client.from('job_candidate_skills').select('skill:job_skills(name)').eq('candidate_id', candidate.id),
        client.from('job_portfolio_items').select('*').eq('candidate_id', candidate.id).order('sort_order'),
        client.from('job_candidate_experience').select('*').eq('candidate_id', candidate.id).order('sort_order'),
        client.from('job_candidate_education').select('*').eq('candidate_id', candidate.id).order('completion_year', { ascending: false }),
        client.from('job_candidate_certifications').select('*').eq('candidate_id', candidate.id).order('completion_year', { ascending: false }),
        client.from('job_candidate_preferences').select('*').eq('candidate_id', candidate.id).maybeSingle(),
        client.from('job_candidate_preferred_roles').select('role_name').eq('candidate_id', candidate.id),
        client.from('job_candidate_employment_types').select('employment_type').eq('candidate_id', candidate.id),
      ])
    : Array.from({ length: 8 }, () => ({ data: [], error: null })) as any;
  const candidateDetailError = [skillsResult, portfolioResult, experienceResult, educationResult, certificationsResult, preferencesResult, preferredRolesResult, employmentTypesResult]
    .map((result: any) => result.error)
    .find(Boolean);
  if (candidateDetailError) throw candidateDetailError;

  const profileRow: any = profileResult.data ?? {};
  // --- Sprint 1 media: legacy base64 -> Storage, then path -> signed URL. --
  // The caller's own data-URL avatar/portfolio images move into the
  // profile-media bucket (rows updated in place); every other media path
  // resolves to a signed display URL in one batched request. All best-effort:
  // failures keep the previous value so the workspace still loads.
  const migratedAvatar = await migrateAvatarToStorageIfNeeded(
    user.id,
    profileRow.full_name || '',
    profileRow.phone || null,
    profileRow.avatar_path || null,
  );
  if (migratedAvatar) profileRow.avatar_path = migratedAvatar;
  // Keep the stable value before render-only signed URL resolution. Profile
  // submissions persist this path, never an expiring signed URL.
  const avatarStorageValue = profileRow.avatar_path || undefined;
  if (candidate) {
    await migratePortfolioToStorageIfNeeded(user.id, candidate.id, arrays<any>(portfolioResult.data));
  }
  // Own portfolio rows intentionally stay as raw storage paths: the gallery
  // resolves them for display and persists the same value back on edit, so a
  // signed URL can never leak into a save.
  const mediaResolved = await resolveWorkspaceMedia({
    avatarPaths: [
      profileRow.avatar_path,
      ...arrays<any>(applicantCardsResult.data).map((card) => card?.avatar_path),
      ...arrays<any>(conversationsResult.data).flatMap((row) => [row?.candidate_avatar_path, row?.employer_avatar_path]),
    ],
    portfolioPaths: [],
  });
  const resolveRowMedia = (row: any, key: string) => {
    if (!row || typeof row !== 'object') return;
    const display = pickDisplayUrl(row[key], mediaResolved);
    if (display) row[key] = display;
  };
  resolveRowMedia(profileRow, 'avatar_path');
  for (const row of arrays<any>(applicantCardsResult.data)) resolveRowMedia(row, 'avatar_path');
  for (const row of arrays<any>(conversationsResult.data)) {
    resolveRowMedia(row, 'candidate_avatar_path');
    resolveRowMedia(row, 'employer_avatar_path');
  }
  const salon = membership?.salon_id ? salonMap.get(membership.salon_id) : null;
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
  const preference: any = Array.isArray(preferencesResult.data)
    ? preferencesResult.data[0]
    : preferencesResult.data;
  const experience = arrays<any>(experienceResult.data).map((row) => ({
    id: row.id,
    salonName: row.salon_name,
    roleTitle: row.role_title,
    city: row.city || undefined,
    state: row.state || undefined,
    startDate: row.start_date,
    endDate: row.end_date || undefined,
    currentlyWorking: Boolean(row.currently_working),
    description: row.description || undefined,
  }));
  const education = arrays<any>(educationResult.data).map((row) => ({
    id: row.id,
    courseName: row.course_name,
    institutionName: row.institution_name || undefined,
    completionYear: row.completion_year == null ? undefined : Number(row.completion_year),
    description: row.description || undefined,
  }));
  const certifications = arrays<any>(certificationsResult.data).map((row) => ({
    id: row.id,
    certificateName: row.certificate_name,
    institutionName: row.institution_name || undefined,
    completionYear: row.completion_year == null ? undefined : Number(row.completion_year),
    certificatePath: row.certificate_path || undefined,
  }));
  const preferredRoles = arrays<any>(preferredRolesResult.data).map((row) => row.role_name).filter(Boolean);
  const employmentTypes = arrays<any>(employmentTypesResult.data).map((row) => row.employment_type).filter(Boolean);

  const bookmarkedIds = new Set(arrays<any>(bookmarksResult.data).map((row) => row.job_id));
  const jobRows = arrays<any>(jobsResult.data);
  const mappedJobs = jobRows.map((row) => mapJob(row, bookmarkedIds.has(row.id), salonMap));
  const applicationRows = arrays<any>(applicationsResult.data);
  const ownedApplicationListings = new Map<string, any>(
    arrays<any>(applicationListingsResult.data).map((row) => [row.application_id, row.listing]),
  );
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
      avatarPath: avatarStorageValue,
      businessName: salon?.name || undefined,
      contactPerson: profileRow.full_name || undefined,
      location: role === 'seeker'
        ? [candidate?.city, candidate?.state].filter(Boolean).join(', ') || undefined
        : salon && (salon.city || salon.state)
          ? [salon.city, salon.state].filter(Boolean).join(', ')
          : undefined,
      city: candidate?.city || undefined,
      state: candidate?.state || undefined,
      specialties,
      skills: specialties,
      primaryRole: candidate?.headline || specialties[0] || undefined,
      bio: candidate?.bio || salon?.description || undefined,
      candidateId: candidate?.id || undefined,
      profileCompletion: candidate == null ? 0 : Number(candidate.profile_completion || 0),
      profileSubmittedAt: candidate?.submitted_at || undefined,
      applicationReady: candidate != null && Number(candidate.profile_completion || 0) >= 50,
      experienceLevel: candidate?.experience_level || undefined,
      totalExperienceMonths: candidate == null ? 0 : Number(candidate.total_experience_months || 0),
      expectedSalaryMin: candidate?.expected_salary_min == null ? preference?.salary_min == null ? undefined : Number(preference.salary_min) : Number(candidate.expected_salary_min),
      expectedSalaryMax: candidate?.expected_salary_max == null ? preference?.salary_max == null ? undefined : Number(preference.salary_max) : Number(candidate.expected_salary_max),
      availableFrom: candidate?.available_from || preference?.available_from || undefined,
      openToRelocation: Boolean(candidate?.open_to_relocation ?? preference?.open_to_relocation),
      preferredRoles,
      employmentTypes,
      experience,
      education,
      certifications,
      website: salon?.website_url || undefined,
      instagram: salon?.instagram_url || undefined,
      portfolioItems,
      savedFilters,
    },
    jobs: mappedJobs,
    applications: role === 'seeker'
      ? applicationRows.map((row) => mapApplication(row, salonMap, ownedApplicationListings.get(row.id)))
      : [],
    applicants: role === 'employer' ? cards.map(mapApplicant) : [],
    conversations: summaries.map(mapConversation),
    messages: arrays<any>(messagesResult.data).map((row) => mapMessage(row, summaries)),
    alerts,
  };
}

export async function saveProfile(_userId: string, profile: UserProfile) {
  // One transaction for `profiles` and the role-specific row, so a failure can
  // never leave the account half-updated.
  const { error } = await requireSupabase().rpc('job_save_profile', {
    p_full_name: profile.name,
    p_phone: profile.phone || null,
    p_avatar_path: profile.avatarPath || profile.avatarUrl || null,
    p_headline: profile.role === 'seeker' ? profile.primaryRole || null : null,
    p_bio: profile.role === 'seeker' ? profile.bio || null : null,
    p_display_name: profile.role === 'employer' ? profile.contactPerson || profile.name : null,
  });
  if (error) throw error;
}

/** Uploads a candidate headshot and returns its stable private Storage path. */
export async function uploadCandidateAvatar(file: File): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) throw new Error('Your session is no longer valid. Please sign in again.');
  return uploadAvatar(userId, file);
}

/**
 * Atomic final action for the eight-step candidate profile. Every nested list
 * is replaced inside the same database transaction and the server returns the
 * authoritative id/completion/readiness shown on the confirmation screen.
 */
export async function submitCandidateProfile(input: CandidateProfileInput): Promise<CandidateProfileSubmission> {
  const { data, error } = await requireSupabase().rpc('job_submit_candidate_profile', {
    p_full_name: input.fullName,
    p_phone: input.phone,
    p_avatar_path: input.avatarPath || null,
    p_headline: input.headline,
    p_bio: input.bio || null,
    p_city: input.city,
    p_state: input.state,
    p_experience_level: input.experienceLevel,
    p_total_experience_months: input.totalExperienceMonths,
    p_expected_salary_min: input.expectedSalaryMin ?? null,
    p_expected_salary_max: input.expectedSalaryMax ?? null,
    p_available_from: input.availableFrom || null,
    p_open_to_relocation: input.openToRelocation,
    p_skills: input.skills,
    p_preferred_roles: input.preferredRoles,
    p_employment_types: input.employmentTypes,
    p_experience: input.experience.map((item, index) => ({
      salon_name: item.salonName,
      role_title: item.roleTitle,
      city: item.city || null,
      state: item.state || null,
      start_date: item.startDate,
      end_date: item.currentlyWorking ? null : item.endDate || null,
      currently_working: item.currentlyWorking,
      description: item.description || null,
      sort_order: index,
    })),
    p_education: input.education.map((item) => ({
      course_name: item.courseName,
      institution_name: item.institutionName || null,
      completion_year: item.completionYear ?? null,
      description: item.description || null,
    })),
    p_certifications: input.certifications.map((item) => ({
      certificate_name: item.certificateName,
      institution_name: item.institutionName || null,
      completion_year: item.completionYear ?? null,
      certificate_path: item.certificatePath || null,
    })),
  });
  if (error) throw error;
  const row: any = Array.isArray(data) ? data[0] : data;
  if (!row?.candidate_id) throw new Error('Profile saved, but its confirmation could not be loaded. Please retry.');
  return {
    candidateId: row.candidate_id,
    profileCompletion: Number(row.profile_completion || 0),
    applicationReady: Boolean(row.application_ready),
    submittedAt: row.submitted_at,
  };
}

/**
 * Persists every editable employer profile field in one server transaction.
 * The RPC derives the user and salon from auth.uid(); neither identity is sent
 * by the browser, and the UI receives success only after all related rows save.
 */
export async function updateEmployerProfile(profile: UserProfile): Promise<void> {
  if (profile.role !== 'employer') return;
  const location = profile.location?.trim() || '';
  const [city = '', ...stateParts] = location.split(',').map((part) => part.trim()).filter(Boolean);
  const { error } = await requireSupabase().rpc('job_update_employer_profile', {
    p_business_name: profile.businessName?.trim() || '',
    p_contact_name: (profile.contactPerson || profile.name).trim(),
    p_phone: profile.phone?.trim() || null,
    p_avatar_path: profile.avatarPath || profile.avatarUrl || null,
    p_description: profile.bio?.trim() || null,
    p_website_url: profile.website?.trim() || null,
    p_instagram_url: profile.instagram?.trim().replace(/^@+/, '') || null,
    p_city: city || null,
    p_state: stateParts.join(', ') || null,
  });
  if (error) throw error;
}

export async function setBookmark(userId: string, jobId: string, bookmarked: boolean) {
  const client = requireSupabase();
  const result = bookmarked
    ? await client.from('job_saved_jobs').upsert({ user_id: userId, job_id: jobId })
    : await client.from('job_saved_jobs').delete().eq('user_id', userId).eq('job_id', jobId);
  if (result.error) throw result.error;
}

function salaryDetails(display: string): {
  minimum: number | null;
  maximum: number | null;
  payType: 'monthly' | 'daily' | 'hourly' | 'commission';
} {
  const normalized = display.toLowerCase();
  let values = (display.replace(/,/g, '').match(/\d+(?:\.\d+)?/g) || [])
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0);

  if (/lpa|lakh|lac/.test(normalized)) values = values.map((value) => value * 100000);

  let payType: 'monthly' | 'daily' | 'hourly' | 'commission' = 'monthly';
  if (/hour|\/hr\b|hourly/.test(normalized)) payType = 'hourly';
  else if (/day|daily/.test(normalized)) payType = 'daily';
  else if (/commission/.test(normalized) && !/year|annual|lpa|lakh|lac/.test(normalized)) payType = 'commission';
  else if (/year|annual|\/yr\b|lpa|lakh|lac/.test(normalized)) {
    values = values.map((value) => Math.round(value / 12));
    payType = 'monthly';
  }

  return {
    minimum: values[0] ?? null,
    maximum: values[1] ?? values[0] ?? null,
    payType,
  };
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
  const salary = salaryDetails(job.salary);
  const { data, error } = await client.rpc('post_employer_job', {
    p_salon_id: membership.salon_id,
    p_title: job.title,
    p_business_name: job.businessName || job.salonName,
    p_category: job.category,
    p_job_role: job.jobRole || job.title,
    p_description: job.description,
    p_skills: job.requirements,
    p_experience_min_months: job.experienceMinMonths ?? 0,
    p_experience_max_months: job.experienceMaxMonths ?? null,
    p_freshers_allowed: job.freshersAllowed ?? true,
    p_salary_min: job.salaryMin ?? salary.minimum,
    p_salary_max: job.salaryMax ?? salary.maximum,
    p_pay_type: job.payType || salary.payType,
    p_employment_type: employmentToDb[job.jobType],
    p_workplace_type: job.workplaceType || 'on_site',
    p_work_location: job.workLocation || job.location,
    p_city: job.city || job.location,
    p_area: job.area || job.location,
    p_contact_person: job.contactPerson || '',
    p_contact_mobile: job.contactMobile || '',
    p_whatsapp_number: job.whatsappNumber || '',
    p_openings: job.openings ?? 1,
    p_interview_mode: job.interviewMode || 'in_person',
    p_publish_mode: job.postingStatus || 'published',
    p_benefits: job.benefits.join('\n'),
    p_working_days: job.workingDays || null,
    p_working_hours: job.workingHours || null,
    p_tags: job.tags,
    p_image_path: job.image || null,
  });
  if (error) throw error;
  const saved = Array.isArray(data) ? data[0] : data;
  if (!saved?.id) throw new Error('The job could not be confirmed after saving. Please retry.');
  const { data: salonData, error: salonError } = await client
    .from('public_job_salon_profiles')
    .select('*')
    .eq('id', saved.salon_id)
    .maybeSingle();
  if (salonError) throw salonError;
  return mapJob({ ...saved, salon: salonData });
}

export async function deleteEmployerJob(jobId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('delete_employer_job', {
    target_job_id: jobId,
  });
  if (error) throw error;
}

export async function updateJob(job: JobPosting): Promise<JobPosting> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('update_employer_job', {
    target_job_id: job.id,
    p_job: {
      title: job.title,
      businessName: job.businessName || job.salonName,
      category: job.category,
      jobRole: job.jobRole || job.title,
      description: job.description,
      skills: job.requirements,
      experienceMinMonths: job.experienceMinMonths ?? 0,
      experienceMaxMonths: job.experienceMaxMonths ?? null,
      freshersAllowed: job.freshersAllowed ?? false,
      salaryMin: job.salaryMin ?? 0,
      salaryMax: job.salaryMax ?? 0,
      payType: job.payType || 'monthly',
      employmentType: employmentToDb[job.jobType],
      workplaceType: job.workplaceType || 'on_site',
      workLocation: job.workLocation || job.location,
      city: job.city || job.location,
      area: job.area || job.location,
      contactPerson: job.contactPerson || '',
      contactMobile: job.contactMobile || '',
      whatsappNumber: job.whatsappNumber || '',
      openings: job.openings ?? 1,
      interviewMode: job.interviewMode || 'in_person',
      postingStatus: job.postingStatus || (job.approvalStatus === 'approved' ? 'published' : 'draft'),
      tags: job.tags,
      benefits: job.benefits.join('\n'),
    },
  });
  if (error) throw error;
  const saved = Array.isArray(data) ? data[0] : data;
  if (!saved?.id) throw new Error('The updated job could not be confirmed. Please retry.');
  const { data: salonData, error: salonError } = await client
    .from('public_job_salon_profiles')
    .select('*')
    .eq('id', saved.salon_id)
    .maybeSingle();
  if (salonError) throw salonError;
  return mapJob({ ...saved, salon: salonData });
}

function numericValue(value?: string) {
  if (!value) return null;
  const match = value.replace(/,/g, '').match(/[\d.]+/);
  return match ? Number(match[0]) : null;
}
function dateValue(value?: string) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const noticeDays: Record<string, number> = {
    immediate: 0,
    '15days': 15,
    '1month': 30,
    '2months': 60,
  };
  if (!(value in noticeDays)) return null;
  const available = new Date();
  available.setDate(available.getDate() + noticeDays[value]);
  return available.toISOString().slice(0, 10);
}

export async function createApplication(
  _userId: string,
  job: JobPosting,
  coverNote: string,
  expectedSalary?: string,
  availability?: string,
  _requestedId?: string,
  resumeId?: string | null,
) {
  const { data, error } = await requireSupabase().rpc('submit_job_application', {
    target_job_id: job.id,
    p_resume_id: resumeId || null,
    p_cover_note: coverNote || null,
    p_expected_salary: numericValue(expectedSalary),
    p_available_from: dateValue(availability),
  });
  if (error) throw error;
  const saved = Array.isArray(data) ? data[0] : data;
  if (!saved?.id) throw new Error('The application could not be confirmed after saving. Please retry.');
  return saved.id as string;
}

/** Walks an application to `shortlisted` (via viewed) so an interview can be requested. */
async function ensureShortlisted(applicationId: string): Promise<void> {
  const client = requireSupabase();
  const { data: current, error: readError } = await client
    .from('job_applications').select('status').eq('id', applicationId).single();
  if (readError) throw readError;
  let status = current.status as string;
  if (status === 'submitted') {
    const { error } = await client.rpc('mark_application_viewed', { target_application_id: applicationId });
    if (error) throw error;
    status = 'viewed';
  }
  if (status === 'viewed') {
    const { error } = await client.rpc('shortlist_application', { target_application_id: applicationId });
    if (error) throw error;
    status = 'shortlisted';
  }
  if (status !== 'shortlisted') {
    throw new Error('INVALID_APPLICATION_TRANSITION');
  }
}

/**
 * Employer schedules an interview from the request form. The payload carries
 * the real date/time/duration/location the employer picked — never defaults.
 */
export async function scheduleInterview(
  applicationId: string,
  schedule: InterviewSchedulePayload,
): Promise<EmployerInterview> {
  await ensureShortlisted(applicationId);
  const { data, error } = await requireSupabase().rpc('create_interview_request', {
    target_application_id: applicationId,
    ...schedule,
  });
  if (error) throw error;
  return mapEmployerInterview(data);
}

/** Employer moves an interview to a new start time (candidate is notified by the RPC). */
export async function rescheduleEmployerInterview(
  interviewId: string,
  newStartIso: string,
  reason?: string,
): Promise<EmployerInterview> {
  const { data, error } = await requireSupabase().rpc('reschedule_interview', {
    target_interview_id: interviewId,
    p_new_start: newStartIso,
    p_reason: reason || null,
  });
  if (error) throw error;
  return mapEmployerInterview(data);
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
  if (status === 'Shortlisted') {
    if (currentStatus === 'submitted') {
      const { error } = await client.rpc('mark_application_viewed', { target_application_id: applicationId });
      if (error) throw error;
      currentStatus = 'viewed';
    }
    if (currentStatus === 'viewed') {
      const { error } = await client.rpc('shortlist_application', { target_application_id: applicationId });
      if (error) throw error;
    }
    return;
  }
  if (status === 'Interview Scheduled') {
    // Interviews are only ever created from the scheduling form (real date,
    // time and location via scheduleInterview). A status flip alone cannot
    // invent them — the old hardcoded payload is gone on purpose.
    throw new Error('Use the interview form to schedule a date, time and location.');
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

/**
 * Turns a backend error into something a user can act on. Backend functions
 * raise stable codes (never stack traces or constraint names); anything that
 * still looks like raw SQL is replaced with the caller's fallback so internal
 * details can never reach the screen.
 */
const backendErrorMessages: Record<string, string> = {
  OFFER_ALREADY_ACTIVE: 'There is already an active offer for this candidate. Withdraw it before sending a new one.',
  OFFER_PENDING: 'The candidate has an open offer. Withdraw the offer before changing the application.',
  INVALID_APPLICATION_TRANSITION: 'That action is not available at this stage of the application.',
  INVALID_EMPLOYMENT_TYPE: 'Choose one of the supported employment types and try again.',
  JOB_HAS_APPLICATIONS: 'This job has applications, so it cannot be deleted. Close the posting instead.',
  JOB_NOT_PUBLISHED: 'This job is not open for applications yet.',
  JOB_NOT_FOUND: 'That job is no longer available.',
  APPLICATION_ALREADY_EXISTS: 'You have already applied to this job.',
  SALON_ACCESS_DENIED: 'You do not have access to this employer workspace.',
  PORTAL_ROLE_MISMATCH: 'This account is registered with a different portal role.',
  ROLE_NOT_ALLOWED: 'This account is not allowed to perform that action.',
  VALIDATION_ERROR: 'Please check the details you entered and try again.',
  ACCOUNT_NOT_ACTIVE: 'This account is not active. Contact support if this is unexpected.',
  CONVERSATION_ACCESS_DENIED: 'You do not have access to this conversation.',
  CONVERSATION_NOT_FOUND: 'That conversation is no longer available.',
  CANDIDATE_NOT_FOUND: 'That candidate has not applied to this job.',
  PROFILE_NOT_FOUND: 'Your profile could not be found. Please sign in again.',
  JOB_EXPIRED: 'This posting has expired and is no longer accepting applications.',
  FOREIGN_RESUME: 'Choose a resume that belongs to your profile.',
  RESUME_NOT_FOUND: 'That resume is no longer available. Refresh your resumes and try again.',
  IMMUTABLE_JOB_OWNERSHIP: 'A job cannot be reassigned to another owner or salon.',
  IMMUTABLE_APPLICATION_OWNERSHIP: 'An application cannot be reassigned to another candidate or job.',
  INVALID_JOB_TRANSITION: 'That action is not available for the job in its current state.',
  PROFILE_INCOMPLETE: 'Please complete your candidate profile before applying.',
  INVALID_INTERVIEW_TRANSITION: 'That interview can no longer be changed at this stage.',
  SALON_NOT_FOUND: 'That salon could not be found. Pick it from the search results.',
};

const looksLikeRawSql = /violates|constraint|relation "|column "|pg_|sqlstate|permission denied for|syntax error/i;

export function mapBackendError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  // A dead session must read as a session problem, never as a generic failure:
  // without this, a mid-use session death (deleted user, revoked tokens) shows
  // the call-site fallback while the user sits on a broken workspace. Recovery
  // itself stays on the auth-event path (failed refresh -> SIGNED_OUT ->
  // invalidated); this only fixes the copy on the toast the user sees first.
  // Keep this copy identical to the forced-logout message in App/authSession.
  if (isSessionInvalidError(error)) return 'Your session expired. Please sign in again.';
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const token = raw.toUpperCase();
  for (const [code, message] of Object.entries(backendErrorMessages)) {
    if (token.includes(code)) return message;
  }
  // Standard-error information hiding: unknown text passes through only when
  // it is short, sanitized (no secrets/JWTs/PII) and free of technical
  // internals — otherwise the action-oriented fallback wins.
  if (!raw.trim() || looksLikeRawSql.test(raw)) return fallback;
  return toSafeMessage(raw, fallback);
}

/**
 * Employer sends an offer. The backend moves the application to `offer_sent`,
 * which is what the candidate's offer screen reacts to.
 */
export interface JobOfferInput {
  jobRole: string;
  salary?: string | number | null;
  employmentType?: string | null;
  joiningDate?: string | null;
  offerNotes?: string | null;
  expiresAt?: string | null;
}

const numericOrNull = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * The offer form speaks display labels ('full-time', 'Chair Rental'), while the
 * database enforces the same vocabulary as job posts ('full_time'). Unknown
 * values are passed through so the backend can refuse them with a stable error
 * instead of the UI silently storing a second spelling.
 */
const offerEmploymentTypes: Record<string, string> = {
  'full-time': 'full_time',
  'full time': 'full_time',
  fulltime: 'full_time',
  full_time: 'full_time',
  'part-time': 'part_time',
  'part time': 'part_time',
  parttime: 'part_time',
  part_time: 'part_time',
  internship: 'internship',
  intern: 'internship',
  contract: 'contract',
  contractual: 'contract',
  freelance: 'freelance',
  commission: 'freelance',
  'chair rental': 'freelance',
};

const normalizeOfferEmploymentType = (value?: string | null) => {
  if (!value) return null;
  return offerEmploymentTypes[value.trim().toLowerCase()] ?? value.trim();
};

export async function sendJobOffer(applicationId: string, input: JobOfferInput) {
  const { data, error } = await requireSupabase().rpc('send_job_offer', {
    target_application_id: applicationId,
    p_job_role: input.jobRole,
    p_salary: numericOrNull(input.salary),
    p_employment_type: normalizeOfferEmploymentType(input.employmentType),
    p_joining_date: input.joiningDate || null,
    p_offer_notes: input.offerNotes || null,
    p_expires_at: input.expiresAt || null,
  });
  if (error) throw error;
  return data;
}

/**
 * Sending an offer is only allowed once the interview stage is finished. When
 * the employer has already run a confirmed interview, this closes it out so the
 * offer step is reachable without the candidate having to press anything else.
 */
export async function completeInterviewStage(applicationId: string, interviewId?: string) {
  const client = requireSupabase();
  const targetId =
    interviewId ||
    (await client
      .from('job_interview_requests')
      .select('id,status')
      .eq('application_id', applicationId)
      .eq('status', 'confirmed')
      .order('scheduled_start', { ascending: false })
      .limit(1)
      .maybeSingle()
    ).data?.id;
  if (!targetId) return false;
  const { error } = await client.rpc('complete_interview', { target_interview_id: targetId });
  if (error) throw error;
  return true;
}

export type InterviewResponse = 'accept' | 'decline' | 'reschedule';

/** Candidate responds to an interview invitation. */
export async function respondToInterview(
  interviewId: string,
  response: InterviewResponse,
  reason?: string,
) {
  const client = requireSupabase();
  if (response === 'accept') {
    const { error } = await client.rpc('accept_interview', { target_interview_id: interviewId });
    if (error) throw error;
    return;
  }
  if (response === 'decline') {
    const { error } = await client.rpc('decline_interview', {
      target_interview_id: interviewId,
      p_reason: reason || null,
    });
    if (error) throw error;
    return;
  }
  const { error } = await client.rpc('request_interview_reschedule', {
    target_interview_id: interviewId,
    p_reason: reason || 'Candidate requested a new time.',
  });
  if (error) throw error;
}

/** Candidate accepts or declines a job offer. */
export async function respondToJobOffer(offerId: string, response: 'accept' | 'decline') {
  const rpcName = response === 'accept' ? 'accept_job_offer' : 'decline_job_offer';
  const { error } = await requireSupabase().rpc(rpcName, { target_offer_id: offerId });
  if (error) throw error;
}

/** Candidate withdraws an application. A pending offer must be declined first. */
export async function withdrawApplication(applicationId: string, reason?: string) {
  const { error } = await requireSupabase().rpc('withdraw_application', {
    target_application_id: applicationId,
    p_reason: reason || null,
  });
  if (error) throw error;
}

/** Employer submits salon verification documents for admin review. */
export async function submitEmployerVerification(input: {
  salonId: string;
  businessProofPath: string;
  identityProofPath: string;
  salonProofPath?: string | null;
}) {
  const { data, error } = await requireSupabase().rpc('submit_employer_verification', {
    target_salon_id: input.salonId,
    p_business_proof_path: input.businessProofPath,
    p_identity_proof_path: input.identityProofPath,
    p_salon_proof_path: input.salonProofPath || null,
  });
  if (error) throw error;
  return data as string;
}

/** Opens a support ticket for the signed-in user. */
export async function createSupportTicket(input: {
  issueType: string;
  subject: string;
  description: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}) {
  const { data, error } = await requireSupabase().rpc('create_job_support_ticket', {
    p_issue_type: input.issueType,
    p_subject: input.subject,
    p_description: input.description,
    p_priority: input.priority || 'normal',
  });
  if (error) throw error;
  return data as string;
}

/** Employer job-lifecycle actions (approved <-> paused, or closed for good). */
export async function setJobLifecycleState(jobId: string, action: 'submit' | 'pause' | 'resume' | 'close') {
  const rpcName = action === 'submit' ? 'submit_job_for_approval'
    : action === 'pause' ? 'pause_job'
    : action === 'resume' ? 'resume_job'
    : 'close_job';
  const { error } = await requireSupabase().rpc(rpcName, { target_job_id: jobId });
  if (error) throw error;
}

/**
 * Employer sends a draft (or a rejected posting) to the admin queue. Without
 * this call a new posting stays a draft forever and never reaches moderation,
 * because `create_job_post` inserts drafts by design.
 */
export async function submitJobForApproval(jobId: string) {
  await setJobLifecycleState(jobId, 'submit');
}

export async function createConversationRecord(input: {
  id: string;
  userId: string;
  role: UserRole;
  jobId: string;
  targetSeekerEmail?: string;
}) {
  // Participants are resolved on the server: one call instead of a job lookup,
  // a membership lookup and a full applicant-card scan, and the row can only
  // name participants the caller is actually allowed to talk to.
  const { error } = await requireSupabase().rpc('job_open_conversation', {
    p_job_id: input.jobId,
    p_conversation_id: input.id,
    p_candidate_email: input.targetSeekerEmail || null,
  });
  if (error) throw error;
}

export async function sendMessageRecord(_userId: string, message: ChatMessage) {
  // The sender is taken from the session inside the RPC, so a forged user id in
  // the payload cannot post as somebody else.
  const { error } = await requireSupabase().rpc('job_send_message', {
    p_conversation_id: message.conversationId,
    p_body: message.text,
    p_attachment: message.attachment || null,
    p_message_id: message.id,
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

/* ------------------------------------------------------------------ */
/* Resumes: Storage objects + job_candidate_resumes rows.               */
/* ------------------------------------------------------------------ */

function mapResume(row: any): ResumeFile {
  return {
    id: row.id,
    fileName: row.original_filename,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size || 0),
    storagePath: row.storage_path,
    isPrimary: Boolean(row.is_primary),
    uploadedAt: row.uploaded_at,
  };
}

async function ownCandidateId(): Promise<string> {
  const { data: userData, error: userError } = await requireSupabase().auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error('Your session is no longer valid. Please sign in again.');
  const { data, error } = await requireSupabase()
    .from('job_seeker_profiles').select('id').eq('user_id', userId).single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Uploads a resume file to Storage and records it as the primary resume. */
export async function uploadResume(file: File): Promise<ResumeFile> {
  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error('Your session is no longer valid. Please sign in again.');
  const storagePath = await uploadResumeObject(userId, file);
  try {
    const { data, error } = await client.rpc('job_create_candidate_resume', {
      p_storage_path: storagePath,
      p_original_filename: file.name,
      p_mime_type: file.type,
      p_file_size: file.size,
      p_is_primary: true,
    });
    if (error) throw error;
    const saved = Array.isArray(data) ? data[0] : data;
    if (!saved?.id) throw new Error('The resume could not be confirmed after saving. Please retry.');
    return mapResume(saved);
  } catch (error) {
    // The row write failed after the object landed: remove the orphan.
    await deleteMediaObject(MEDIA_BUCKETS.resumes, storagePath);
    throw error;
  }
}

/** Newest-first resumes owned by the signed-in seeker. */
export async function listResumes(): Promise<ResumeFile[]> {
  const candidateId = await ownCandidateId();
  const { data, error } = await requireSupabase()
    .from('job_candidate_resumes').select('*').eq('candidate_id', candidateId)
    .order('is_primary', { ascending: false }).order('uploaded_at', { ascending: false });
  if (error) throw error;
  return arrays<any>(data).map(mapResume);
}

export async function setPrimaryResume(resumeId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('job_set_primary_resume', {
    target_resume_id: resumeId,
  });
  if (error) throw error;
}

export async function deleteResume(resumeId: string): Promise<void> {
  const client = requireSupabase();
  const candidateId = await ownCandidateId();
  const { data, error: readError } = await client
    .from('job_candidate_resumes').select('storage_path').eq('id', resumeId).eq('candidate_id', candidateId).single();
  if (readError) throw readError;
  const { error } = await client
    .from('job_candidate_resumes').delete().eq('id', resumeId).eq('candidate_id', candidateId);
  if (error) throw error;
  await deleteMediaObject(MEDIA_BUCKETS.resumes, (data as { storage_path: string }).storage_path);
}

/** Short-lived resume URL; Storage RLS permits only its owner or the application employer. */
export async function getResumeDownloadUrl(storagePath: string): Promise<string> {
  const { data, error } = await requireSupabase().storage.from(MEDIA_BUCKETS.resumes).createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

/** Short-lived offer-document URL; Storage RLS permits the related candidate, authorized salon team, or admin. */
export async function getOfferDocumentUrl(storagePath: string): Promise<string> {
  const { data, error } = await requireSupabase().storage.from(MEDIA_BUCKETS.offers).createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

/* ------------------------------------------------------------------ */
/* Trust & Safety: reports against real jobs and salons.                */
/* ------------------------------------------------------------------ */

export interface PublicJobHit {
  id: string;
  title: string;
  salonId: string;
  salonName: string;
  city: string;
  state: string;
}

export async function searchPublicJobs(query: string): Promise<PublicJobHit[]> {
  const needle = query.trim();
  if (needle.length < 2) return [];
  const { data, error } = await requireSupabase()
    .from('public_job_listings')
    .select('id,title,salon_id,salon_name,city,state')
    .or(`title.ilike.%${needle}%,salon_name.ilike.%${needle}%`)
    .order('published_at', { ascending: false })
    .limit(8);
  if (error) throw error;
  return arrays<any>(data).map((row) => ({
    id: row.id,
    title: row.title,
    salonId: row.salon_id,
    salonName: row.salon_name,
    city: row.city || '',
    state: row.state || '',
  }));
}

export interface PublicSalonHit {
  salonId: string;
  salonName: string;
  city: string;
  state: string;
}

export async function searchPublicSalons(query: string): Promise<PublicSalonHit[]> {
  const needle = query.trim();
  if (needle.length < 2) return [];
  const { data, error } = await requireSupabase()
    .from('public_job_listings')
    .select('salon_id,salon_name,city,state')
    .ilike('salon_name', `%${needle}%`)
    .limit(20);
  if (error) throw error;
  const seen = new Set<string>();
  const hits: PublicSalonHit[] = [];
  for (const row of arrays<any>(data)) {
    if (seen.has(row.salon_id)) continue;
    seen.add(row.salon_id);
    hits.push({ salonId: row.salon_id, salonName: row.salon_name, city: row.city || '', state: row.state || '' });
    if (hits.length >= 8) break;
  }
  return hits;
}

/** Files a persisted Trust & Safety report against a job posting. Returns the report id. */
export async function reportJobPosting(jobId: string, reason: string, details?: string): Promise<string> {
  const { data, error } = await requireSupabase().rpc('report_job', {
    target_job_id: jobId,
    p_reason: reason,
    p_details: details?.trim() || null,
  });
  if (error) throw error;
  return data as string;
}

/** Files a persisted Trust & Safety report against a salon. Returns the report id. */
export interface BlockedEmployerSummary {
  id: string;
  name: string;
  location: string;
  dateBlocked: string;
}

export async function listBlockedEmployers(): Promise<BlockedEmployerSummary[]> {
  const { data, error } = await requireSupabase()
    .from('job_blocked_employers')
    .select('salon_id,created_at,salon:salons(name,city,state)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return arrays<any>(data).map((row) => {
    const salon = one<any>(row.salon) || {};
    return {
      id: row.salon_id,
      name: salon.name || 'Employer',
      location: [salon.city, salon.state].filter(Boolean).join(', ') || 'Location not available',
      dateBlocked: new Date(row.created_at).toLocaleDateString(),
    };
  });
}

export async function unblockEmployer(salonId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('job_blocked_employers')
    .delete()
    .eq('salon_id', salonId);
  if (error) throw error;
}

export async function reportSalon(salonId: string, reason: string, details?: string): Promise<string> {
  const { data, error } = await requireSupabase().rpc('report_employer', {
    target_salon_id: salonId,
    p_reason: reason,
    p_details: details?.trim() || null,
  });
  if (error) throw error;
  return data as string;
}

/** Appends a follow-up message (optionally with an attachment path) to the caller's own ticket. */
export async function addTicketMessage(ticketId: string, message: string, attachmentPath?: string): Promise<void> {
  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error('Your session is no longer valid. Please sign in again.');
  const { error } = await client.from('job_support_messages').insert({
    ticket_id: ticketId,
    sender_user_id: userId,
    message,
    attachment_path: attachmentPath || null,
  });
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Account: genuine password change + deletion request.                 */
/* ------------------------------------------------------------------ */

/**
 * Changes the signed-in user's password. The current password is verified by
 * re-authenticating (a wrong one fails here, before anything is changed) and
 * the new one is validated against the shared policy first.
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const policyError = validateNewPassword(newPassword);
  if (policyError) throw new Error(policyError);
  if (currentPassword === newPassword) {
    throw new Error('Choose a password you have not used on this account before.');
  }
  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  const email = userData.user?.email;
  if (!email) throw new Error('Your session is no longer valid. Please sign in again.');
  const { error: verifyError } = await client.auth.signInWithPassword({ email, password: currentPassword });
  if (verifyError) {
    throw new Error('Your current password is incorrect. Check it and try again.');
  }
  const { error: updateError } = await client.auth.updateUser({ password: newPassword });
  if (updateError) throw mapAuthError(updateError);
}

/**
 * Records an account-deletion request. The RPC hides the profile immediately
 * and queues the purge; the client signs out afterwards with honest copy.
 * Returns the request id.
 */
export async function requestAccountDeletion(reason?: string): Promise<string> {
  const { data, error } = await requireSupabase().rpc('request_job_account_deletion', {
    p_reason: reason?.trim() || null,
  });
  if (error) throw error;
  return data as string;
}

/* ------------------------------------------------------------------ */
/* Portfolio: CRUD against job_portfolio_items (owner-only by RLS).     */
/* ------------------------------------------------------------------ */

export async function savePortfolioItem(item: PortfolioItem): Promise<void> {
  const candidateId = await ownCandidateId();
  const row = {
    id: item.id,
    candidate_id: candidateId,
    title: item.title,
    category: item.category,
    image_path: item.imageUrl,
    description: item.description || null,
    technique: item.technique || null,
    item_date: /^\d{4}-\d{2}-\d{2}$/.test(item.date || '') ? item.date : null,
  };
  const { error } = await requireSupabase().from('job_portfolio_items').upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

export async function deletePortfolioItem(itemId: string): Promise<void> {
  const candidateId = await ownCandidateId();
  const { error } = await requireSupabase()
    .from('job_portfolio_items').delete().eq('id', itemId).eq('candidate_id', candidateId);
  if (error) throw error;
}

/** An employer's read-only view of an applicant's portfolio (RLS: applied candidates only). */
export async function getApplicantPortfolio(applicationId: string): Promise<PortfolioItem[]> {
  const { data, error } = await requireSupabase()
    .rpc('job_get_applicant_portfolio', { target_application_id: applicationId });
  if (error) throw error;
  const rows = arrays<any>(data);
  const resolved = await resolveStorageUrls(MEDIA_BUCKETS.profileMedia, rows.map((row) => row.image_path));
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    imageUrl: pickDisplayUrl(row.image_path, resolved) || row.image_path,
    description: row.description || undefined,
    technique: row.technique || undefined,
    date: row.item_date || undefined,
  }));
}

/* ------------------------------------------------------------------ */
/* Media resolution + legacy base64 migration for the workspace load.   */
/* ------------------------------------------------------------------ */

/**
 * Moves a legacy data-URL avatar into Storage and returns the new path.
 * Returns the input unchanged when it is already a path/URL or when the
 * migration fails (the UI keeps working on the legacy value).
 */
export async function migrateAvatarToStorageIfNeeded(
  userId: string,
  fullName: string,
  phone: string | null,
  avatar: string | null | undefined,
): Promise<string | null> {
  if (!isDataUrl(avatar)) return avatar ?? null;
  try {
    const client = requireSupabase();
    const blob = dataUrlToBlob(avatar);
    const path = await uploadAvatar(userId, blob);
    // job_save_profile overwrites the role-specific columns it is given, so
    // the current values are passed straight back through: the migration must
    // change the avatar and nothing else.
    let headline: string | null = null;
    let bio: string | null = null;
    let displayName: string | null = null;
    const { data: roleRow } = await client.from('job_user_roles').select('role').eq('user_id', userId).single();
    if (roleRow?.role === 'job_seeker') {
      const { data } = await client.from('job_seeker_profiles').select('headline,bio').eq('user_id', userId).single();
      headline = data?.headline ?? null;
      bio = data?.bio ?? null;
    } else if (roleRow?.role === 'employer' || roleRow?.role === 'admin') {
      const { data } = await client.from('job_employer_profiles').select('display_name').eq('user_id', userId).single();
      displayName = data?.display_name ?? null;
    }
    const { error } = await client.rpc('job_save_profile', {
      p_full_name: fullName && fullName.trim().length >= 2 ? fullName : 'User',
      p_phone: phone || null,
      p_avatar_path: path,
      p_headline: headline,
      p_bio: bio,
      p_display_name: displayName,
    });
    if (error) throw error;
    return path;
  } catch {
    return avatar;
  }
}

/**
 * Moves legacy data-URL portfolio images into Storage, updating each row in
 * place. Best-effort per item: failures keep the legacy value.
 */
export async function migratePortfolioToStorageIfNeeded(
  userId: string,
  candidateId: string,
  rows: any[],
): Promise<void> {
  const legacy = rows.filter((row) => isDataUrl(row.image_path));
  if (legacy.length === 0) return;
  const client = requireSupabase();
  await Promise.all(legacy.map(async (row) => {
    try {
      const path = await uploadPortfolioImage(userId, dataUrlToBlob(row.image_path));
      const { error } = await client
        .from('job_portfolio_items').update({ image_path: path }).eq('id', row.id).eq('candidate_id', candidateId);
      if (error) throw error;
      row.image_path = path;
    } catch {
      // Keep the legacy data URL; the item still renders.
    }
  }));
}

/** Resolves every profile-media path in a workspace to signed display URLs. */
export async function resolveWorkspaceMedia(input: {
  avatarPaths: Array<string | null | undefined>;
  portfolioPaths: Array<string | null | undefined>;
}): Promise<Map<string, string>> {
  return resolveStorageUrls(MEDIA_BUCKETS.profileMedia, [...input.avatarPaths, ...input.portfolioPaths]);
}

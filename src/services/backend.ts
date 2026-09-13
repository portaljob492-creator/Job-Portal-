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
import { clearSessionBeforeSignUp, markUserInitiatedSignOut } from '../lib/authSession';
import { normalizeEmail } from '../lib/email';
import { isEmailNotConfirmedError } from '../lib/signUpOutcome';
import { validateNewPassword } from '../lib/passwordPolicy';
import type { RecoveryTokenInput } from '../lib/recoveryLink';
import {
  AuthRateLimitError,
  formatRetryCountdown,
  isRecoveryLinkRejectedError,
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

function portalMismatchMessage(actualBackendRole: string, requestedRole: UserRole) {
  const actualRole = frontendRole(actualBackendRole);
  return `An account with this email already exists as a ${portalLabel(actualRole)}. Please use a different email or log in.`;
}

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
    appliedDate: relativeDate(row.submitted_at),
    status: applicationStatuses[row.status] || 'Submitted',
    notes: row.employer_notes || undefined,
    interviewDate: interviews[0]?.scheduled_start
      ? new Date(interviews[0].scheduled_start).toLocaleString()
      : undefined,
    expectedSalary: row.expected_salary == null ? undefined : `₹${Number(row.expected_salary).toLocaleString('en-IN')}`,
    availability: row.available_from || undefined,
    interviewId: workflowInterview?.id || undefined,
    offerId: activeOffer?.id || undefined,
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

  async signIn(email: string, password: string, requestedRole: UserRole) {
    const client = requireSupabase();
    const normalizedEmail = normalizeEmail(email);
    const requestedBackendRole = backendRole(requestedRole);

    // Fail fast when the email is already permanently assigned to the other
    // portal: no session is created at all, so no tokens need clearing and the
    // user gets the structured mismatch error directly. Fails open on lookup
    // errors; the authoritative post-sign-in check below still applies.
    const { data: existingRole, error: lookupError } = await client.rpc('job_email_portal_role', {
      p_email: normalizedEmail,
    });
    if (!lookupError && (existingRole === 'job_seeker' || existingRole === 'employer') && existingRole !== requestedBackendRole) {
      throw new PortalRoleMismatchError({
        email: normalizedEmail,
        requestedRole,
        existingRole: frontendRole(existingRole),
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
        if (existingRole === requestedBackendRole) {
          throw new PasswordSignInBlockedError({
            email: normalizedEmail,
            role: requestedRole,
            reason: 'wrong_password',
          });
        }
        if (existingRole === 'unassigned') {
          throw new PasswordSignInBlockedError({
            email: normalizedEmail,
            role: requestedRole,
            reason: 'unassigned',
          });
        }
      }
      throw mapAuthError(error);
    }
    try {
      await this.registerRole(requestedRole, normalizedEmail);
    } catch (roleError) {
      // The session was created but the portal rejected its role: clear the
      // tokens so no invalid/partial session survives, then surface the error.
      await signOutDeliberately();
      throw mapPortalRoleError(roleError, requestedRole, normalizedEmail);
    }
    return data;
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

  async registerRole(role: UserRole, email = '') {
    const { data, error } = await requireSupabase().rpc('job_register_role', { requested_role: backendRole(role) });
    if (error) throw mapPortalRoleError(error, role, email);
    if (data !== backendRole(role)) {
      const actualRole = frontendRole(String(data));
      if (actualRole === 'seeker' || actualRole === 'employer') {
        throw new PortalRoleMismatchError({ email, requestedRole: role, existingRole: actualRole });
      }
      throw new Error(portalMismatchMessage(String(data), role));
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

export async function applyPendingOAuthRole(_userId: string) {
  const pendingRole = window.localStorage.getItem('nexora_pending_role') as UserRole | null;
  if (!pendingRole) return;
  let email = '';
  try {
    const { data } = await requireSupabase().auth.getUser();
    email = data.user?.email ?? '';
  } catch {
    // Email is best-effort; a mismatch error without it still redirects to login.
  }
  try {
    await authBackend.registerRole(pendingRole, email);
  } catch (error) {
    // The OAuth session is unusable for this portal (wrong or unassigned role):
    // clear it before redirecting so no invalid state persists.
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
  const applicationSelect = `*, job:job_posts!job_applications_job_id_fkey(*, salon:salons!job_posts_salon_id_fkey(*), location:job_salon_locations!job_posts_location_id_fkey(*)), interviews:job_interview_requests(*), offers:job_offers(*)`;

  const [profileResult, candidateResult, membershipResult, jobsResult, bookmarksResult, conversationsResult, messagesResult, filtersResult, alertsResult, applicationsResult, applicantCardsResult] = await Promise.all([
    client.from('profiles').select('id,full_name,phone,avatar_path,preferred_city,preferred_area').eq('id', user.id).single(),
    client.from('job_seeker_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    client.from('job_salon_members').select('salon_id,member_role,salon:salons!job_salon_members_salon_id_fkey(*)').eq('user_id', user.id).eq('status', 'active').limit(1).maybeSingle(),
    role === 'seeker'
      ? client.from('public_job_listings').select('*').order('published_at', { ascending: false })
      : client.from('job_posts').select('*, salon:salons!job_posts_salon_id_fkey(*), location:job_salon_locations!job_posts_location_id_fkey(*)').order('created_at', { ascending: false }),
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

export async function saveProfile(_userId: string, profile: UserProfile) {
  // One transaction for `profiles` and the role-specific row, so a failure can
  // never leave the account half-updated.
  const { error } = await requireSupabase().rpc('job_save_profile', {
    p_full_name: profile.name,
    p_phone: profile.phone || null,
    p_avatar_path: profile.avatarUrl || null,
    p_headline: profile.role === 'seeker' ? profile.primaryRole || null : null,
    p_bio: profile.role === 'seeker' ? profile.bio || null : null,
    p_display_name: profile.role === 'employer' ? profile.contactPerson || profile.name : null,
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
  const { data: location } = await client
    .from('job_salon_locations')
    .select('id')
    .eq('salon_id', membership.salon_id)
    .eq('is_primary', true)
    .maybeSingle();
  const salary = salaryDetails(job.salary);
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
    p_salary_min: salary.minimum,
    p_salary_max: salary.maximum,
    p_pay_type: salary.payType,
    p_benefits: job.benefits.join('\n'),
    p_working_days: null,
    p_working_hours: null,
    p_openings: 1,
    p_tags: job.tags,
    p_image_path: job.image || null,
  });
  if (error) throw error;
  const { data: saved, error: readError } = await client
    .from('job_posts')
    .select('*, salon:salons!job_posts_salon_id_fkey(*), location:job_salon_locations!job_posts_location_id_fkey(*)')
    .eq('id', id)
    .single();
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
};

const looksLikeRawSql = /violates|constraint|relation "|column "|pg_|sqlstate|permission denied for|syntax error/i;

export function mapBackendError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const token = raw.toUpperCase();
  for (const [code, message] of Object.entries(backendErrorMessages)) {
    if (token.includes(code)) return message;
  }
  if (!raw.trim() || looksLikeRawSql.test(raw)) return fallback;
  return raw;
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

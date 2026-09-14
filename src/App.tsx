import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScreenState, UserRole, JobPosting, Application, Applicant, UserProfile, Conversation, ChatMessage, JobAlertNotification, CandidateProfileInput, CandidateProfileSubmission } from './types';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import {
  PortalRoleMismatchError,
  extractErrorMessage,
  isActionableAuthScreenError,
  isPortalRoleMismatchError,
  isSessionInvalidError,
  isUnassignedPortalRoleError,
} from './lib/authErrors';
import { markUserInitiatedSignOut, reportSessionError, subscribeToAuthChanges } from './lib/authSession';
import type { RecoveryTokenInput } from './lib/recoveryLink';
import {
  loginPathWithPrefill,
  pathForScreen,
  resolveJobPortalRoute,
  stripLoginPrefill,
  type EmployerTab,
  type JobPortalRoute,
} from './routing';
import {
  applyPendingOAuthRole,
  authBackend,
  completeEmployerOnboarding,
  completeInterviewStage,
  completeSeekerOnboarding,
  createApplication,
  createConversationRecord,
  deleteEmployerJob,
  setJobLifecycleState,
  createJob,
  deleteAlert,
  getUserRole,
  isPortalOnboardingComplete,
  loadWorkspace,
  markAllAlertsRead,
  RecoverySessionLostError,
  rescheduleEmployerInterview,
  respondToInterview,
  respondToJobOffer,
  saveProfile,
  submitCandidateProfile,
  scheduleInterview,
  sendJobOffer,
  sendMessageRecord,
  setBookmark,
  updateAlertRead,
  updateEmployerProfile,
  updateJob,
  uploadCandidateAvatar,
  uploadResume,
  updateApplicationStatus,
  withdrawApplication,
  mapBackendError,
} from './services/backend';
import { MEDIA_BUCKETS, deleteMediaObject, isStoragePath, resolveStorageUrls } from './lib/storageMedia';
import type { InterviewSchedulePayload } from './lib/interviewSchedule';
import { formatInterviewDateTime } from './lib/interviewSchedule';
import { logger } from './lib/logger';
import { JobsWorkspaceSkeleton } from './components/ui/JobsSkeleton';

type SeekerWorkspaceTab = 'feed' | 'applications' | 'saved' | 'messages' | 'portfolio' | 'profile';
const normalizeSeekerTab = (tab: string): SeekerWorkspaceTab => tab === 'explore' ? 'feed' : tab as SeekerWorkspaceTab;

// Component imports
import { WelcomeScreen } from './components/auth/WelcomeScreen';
import { RoleSelectionScreen } from './components/auth/RoleSelectionScreen';
import { JobSeekerSignupScreen } from './components/auth/JobSeekerSignupScreen';
import { ConfirmEmailScreen } from './components/auth/ConfirmEmailScreen';
import { resolveSignUpResult } from './lib/signUpOutcome';
import { EmployerSignupScreen } from './components/auth/EmployerSignupScreen';
import { LoginScreen } from './components/auth/LoginScreen';
import { ForgotPasswordScreen } from './components/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from './components/auth/ResetPasswordScreen';
import { SeekerOnboardingStep1Screen } from './components/seeker/SeekerOnboardingStep1Screen';
import { SeekerOnboardingStep2Screen } from './components/seeker/SeekerOnboardingStep2Screen';
import { JobSeekerWorkspace } from './components/seeker/JobSeekerWorkspace';
import { ApplyJobScreen } from './components/seeker/ApplyJobScreen';
import { EmployerWorkspace } from './components/employer/EmployerWorkspace';
import { InterviewInvitationScreen } from './components/seeker/InterviewInvitationScreen';
import { JobOfferScreen } from './components/seeker/JobOfferScreen';
import { SupportScreen } from './components/seeker/SupportScreen';
import { SettingsScreen } from './components/seeker/SettingsScreen';
import { EmployerOnboardingStep1Screen } from './components/employer/EmployerOnboardingStep1Screen';
import { EmployerOnboardingStep2Screen } from './components/employer/EmployerOnboardingStep2Screen';
import { LogoutConfirmationModal } from './components/auth/LogoutConfirmationModal';
import { SupabaseConfigWarning } from './components/auth/SupabaseConfigWarning';
import { PwaInstallButton } from './components/pwa/PwaInstallButton';
import { AdminLoginScreen } from './components/admin/AdminLoginScreen';
import { AdminJobsScreen } from './components/admin/AdminJobsScreen';

export default function App() {
  const initialRoute = useRef<JobPortalRoute>(resolveJobPortalRoute()).current;
  const pendingProtectedRoute = useRef<JobPortalRoute | null>(initialRoute.protected ? initialRoute : null);
  /** The user whose workspace was already entered, so an auth event cannot re-enter it. */
  const enteredPortalUserId = useRef<string | null>(null);
  const [screen, setScreen] = useState<ScreenState>(initialRoute.protected ? (initialRoute.requiredRole === 'admin' ? 'admin_login' : 'login') : initialRoute.screen);
  const [userRole, setUserRole] = useState<UserRole>('seeker');
  const [selectedJobForApply, setSelectedJobForApply] = useState<JobPosting | null>(null);
  const [selectedApplicationForInvitation, setSelectedApplicationForInvitation] = useState<Application | null>(null);
  const [selectedApplicationForOffer, setSelectedApplicationForOffer] = useState<Application | null>(null);
  const [seekerInitialTab, setSeekerInitialTab] = useState<'feed' | 'applications' | 'saved' | 'messages' | 'portfolio' | 'profile' | undefined>(initialRoute.seekerTab);
  const [employerInitialTab, setEmployerInitialTab] = useState<EmployerTab | undefined>(initialRoute.employerTab);
  const [employerApplicationJobId, setEmployerApplicationJobId] = useState<string | undefined>(initialRoute.employerJobId);
  const [openEmployerPostJob, setOpenEmployerPostJob] = useState(Boolean(initialRoute.openPostJob));
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isBackendLoading, setIsBackendLoading] = useState(isSupabaseConfigured);
  const [backendError, setBackendError] = useState<string | null>(null);
  /** Set when sign-up succeeded but Supabase still requires the email to be confirmed. */
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<{ email: string; role: 'seeker' | 'employer' } | null>(null);
  const [passwordRecoveryState, setPasswordRecoveryState] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  /** Email shared between login → reset → login so it is never retyped. */
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [pendingOnboardingResume, setPendingOnboardingResume] = useState<File | null>(null);

  // Application Data States
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [jobAlerts, setJobAlerts] = useState<JobAlertNotification[]>([]);

  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: '',
    email: '',
    phone: '',
    role: 'seeker',
    specialties: [],
    skills: [],
    portfolioItems: [],
    savedFilters: [],
  });

  const hydrateWorkspace = useCallback(async (userId: string, expectedRole?: UserRole) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      throw new Error(extractErrorMessage(userError, 'Your session is no longer valid. Please sign in again.'));
    }
    if (!userData.user || userData.user.id !== userId) throw new Error('Your session is no longer valid.');

    let role: UserRole;
    try {
      role = await getUserRole(userData.user);
    } catch (roleError) {
      // Auto-heal missing role: if the account has no portal role row yet
      // (e.g. created by another Nexora app, or signup trigger FK guard),
      // try to assign the expected role (or the role from user_metadata, or
      // seeker as last resort) via job_register_role which also ensures the
      // shared profiles row. This turns a hard "Unable to validate your portal
      // access" into a successful entry.
      if (isUnassignedPortalRoleError(roleError)) {
        const metaRole = (userData.user.user_metadata?.role as UserRole | undefined)
          || (userData.user.user_metadata?.job_role === 'job_seeker' ? 'seeker' as UserRole : undefined)
          || (userData.user.user_metadata?.job_role as UserRole | undefined);
        const candidateRole = expectedRole || metaRole || 'seeker';
        try {
          const resolved = await authBackend.resolvePortalRole(candidateRole, userData.user.email || '');
          role = resolved;
        } catch {
          // If auto-heal fails, surface the original unassigned error so the
          // bootstrap can show the proper "No Jobs portal role" message and
          // redirect to login with prefill.
          throw roleError;
        }
      } else {
        // Wrap raw Supabase PostgREST errors (plain objects) so the UI never
        // falls back to the generic "Unable to validate your portal access."
        const msg = extractErrorMessage(roleError, 'Unable to validate your portal access.');
        throw new Error(msg);
      }
    }

    // --- AUTO-ROLE FIX ---
    // User should not need to remember seeker vs employer.
    // If the stored role is seeker/employer and the UI requested the other
    // portal, automatically use the stored role instead of throwing.
    // Only admin mismatches remain hard errors.
    if (expectedRole && role !== expectedRole) {
      const isSeekerEmployerMismatch =
        (expectedRole === 'seeker' || expectedRole === 'employer') &&
        (role === 'seeker' || role === 'employer');
      if (!isSeekerEmployerMismatch) {
        throw new PortalRoleMismatchError({
          email: userData.user.email || '',
          requestedRole: expectedRole,
          existingRole: role,
        });
      }
      // else: auto-correct – continue with the real role (role)
    }

    let workspace;
    try {
      workspace = await loadWorkspace(userData.user, role);
    } catch (wsError) {
      // Ensure workspace load failures also surface a real message, not the
      // generic fallback, and handle ACCOUNT_INACTIVE by trying a profile heal.
      const msg = mapBackendError(wsError, 'Unable to load your workspace. Please try again.');
      // If the backend says the profile is missing/inactive, a single
      // resolvePortalRole call heals it (see migration 20260913000900).
      if (/ACCOUNT_INACTIVE|PROFILE_NOT_FOUND/i.test(extractErrorMessage(wsError, ''))) {
        try {
          await authBackend.resolvePortalRole(role, userData.user.email || '');
          workspace = await loadWorkspace(userData.user, role);
        } catch {
          throw new Error(msg);
        }
      } else {
        throw new Error(msg);
      }
    }

    setCurrentUserId(userId);
    setUserRole(role);
    setUserProfile(workspace.profile);
    setJobs(workspace.jobs);
    setApplications(workspace.applications);
    setApplicants(workspace.applicants);
    setConversations(workspace.conversations);
    setMessages(workspace.messages);
    setJobAlerts(workspace.alerts);
    return role;
  }, []);

  const enterAuthenticatedPortal = useCallback(async (userId: string, expectedRole?: UserRole) => {
    enteredPortalUserId.current = userId;
    // Auth succeeded: drop the /login?role=…&email=… prefill params so the
    // dashboard URL stays clean and the prefill can't leak into later states.
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, document.title, stripLoginPrefill(window.location.pathname, window.location.search));
    }
    const role = await hydrateWorkspace(userId, expectedRole);
    const onboardingComplete = await isPortalOnboardingComplete(userId);
    if (onboardingComplete) {
      const requested = pendingProtectedRoute.current;
      pendingProtectedRoute.current = null;
      if (requested && (!requested.requiredRole || requested.requiredRole === role)) {
        if (requested.seekerTab && role === 'seeker') setSeekerInitialTab(requested.seekerTab);
        if (requested.employerTab && role === 'employer') setEmployerInitialTab(requested.employerTab);
        if (role === 'employer') {
          setEmployerApplicationJobId(requested.employerJobId);
          setOpenEmployerPostJob(Boolean(requested.openPostJob));
        }
        setScreen(requested.screen === 'login' ? 'main_app' : requested.screen);
      } else {
        setScreen('main_app');
      }
    } else {
      setScreen(role === 'seeker' ? 'seeker_onboarding_step1' : 'employer_onboarding_step1');
    }
    return role;
  }, [hydrateWorkspace]);

  useEffect(() => {
    if (!supabase) {
      setIsBackendLoading(false);
      return;
    }

    let active = true;
    let sessionEmail = '';
    let bootstrapSession: import('@supabase/supabase-js').Session | null | undefined;
    let bootstrapUser: import('@supabase/supabase-js').User | null | undefined;
    const bootstrap = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!active) return;
        bootstrapSession = data.session;
        bootstrapUser = data.session?.user;
        sessionEmail = data.session?.user?.email ?? '';

        const queryParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
        const hashParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.hash.replace(/^#/, '')) : new URLSearchParams();
        const isRecovery = queryParams.get('recovery') === '1';
        const isConfirmationReturn = queryParams.get('confirmed') === '1';
        const recoveryError = queryParams.get('error_description') || hashParams.get('error_description');
        if (isConfirmationReturn) {
          // The PKCE code from the confirmation link has been exchanged by the
          // time getSession() resolves, so a session here means the account is
          // confirmed and the normal signed-in path below handles it. No session
          // means the link was already used or opened where the exchange could
          // not happen (another browser/device): send the user to sign in with
          // an explanation instead of a bare login form.
          if (!bootstrapSession?.user) {
            setScreen('login');
            setBackendError(
              recoveryError
                ? decodeURIComponent(recoveryError.replace(/\+/g, ' '))
                : 'That confirmation link is no longer valid. Sign in, or create the account again if it was never confirmed.',
            );
            if (typeof window !== 'undefined') {
              window.history.replaceState({}, document.title, loginPathWithPrefill(undefined, sessionEmail));
            }
          }
        } else if (isRecovery) {
          setScreen('reset_password');
          if (recoveryError) {
            setPasswordRecoveryState('invalid');
            setBackendError(decodeURIComponent(recoveryError.replace(/\+/g, ' ')));
          } else if (bootstrapSession?.user) {
            setPasswordRecoveryState('valid');
          } else {
            setPasswordRecoveryState('invalid');
          }
        } else if (bootstrapSession?.user) {
          const pendingRole = await applyPendingOAuthRole(bootstrapSession.user.id);
          // A role just resolved for a returning provider sign-in wins over the
          // role recorded in user metadata: it is what the backend granted.
          await enterAuthenticatedPortal(
            bootstrapSession.user.id,
            pendingRole ?? (bootstrapSession.user.user_metadata?.role as UserRole | undefined),
          );
          if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            // Drop the one-time auth params so a reload cannot replay them.
            if (params.has('verified') || params.has('confirmed')) {
              params.delete('verified');
              params.delete('confirmed');
              const rest = params.toString();
              window.history.replaceState({}, document.title, `${window.location.pathname}${rest ? `?${rest}` : ''}`);
            }
          }
        }
      } catch (error) {
        const sessionInvalid = isSessionInvalidError(error);
        const roleMismatch = isPortalRoleMismatchError(error) ? error : null;
        // An account with a valid session but no portal role row (e.g. created
        // by another Nexora app) must re-authenticate here to get one assigned.
        const unassignedRole = !roleMismatch && isUnassignedPortalRoleError(error);
        const friendlyMessage = extractErrorMessage(error, 'Unable to validate your portal access.');
        if (sessionInvalid) {
          // Invalid/expired session: clear the unusable tokens once and route to login.
          reportSessionError(error);
        } else if ((roleMismatch || unassignedRole) && navigator.onLine) {
          // Only a wrong-portal or role-less session is cleared here — and only
          // this device's tokens. Any other bootstrap failure (transient network
          // or RPC error) leaves the persisted session untouched so a retry can
          // still succeed, and an offline launch never destroys it.
          // For unassigned roles, try one auto-heal using the pending route's
          // required role before destroying the session – this fixes the case
          // where a valid session exists but the role row was never created.
          if (unassignedRole && bootstrapUser) {
            const attemptedRole = pendingProtectedRoute.current?.requiredRole
              || (bootstrapUser.user_metadata?.role as UserRole | undefined)
              || 'seeker';
            try {
              await authBackend.resolvePortalRole(attemptedRole, bootstrapUser.email || sessionEmail);
              if (active) {
                await enterAuthenticatedPortal(bootstrapUser.id, attemptedRole);
                return;
              }
            } catch {
              // Heal failed – fall through to the sign-out path below.
            }
          }
          markUserInitiatedSignOut();
          await supabase.auth.signOut({ scope: 'local' });
        }
        if (active) {
          if (navigator.onLine) setCurrentUserId(null);
          if (roleMismatch || unassignedRole) {
            // The stored/OAuth session belongs to the other portal (or has no
            // portal role): it was cleared above. Land on the login screen with
            // the correct portal and email pre-selected instead of bouncing to
            // the welcome screen, so the user can sign in without a re-type.
            if (typeof window !== 'undefined') {
              window.history.replaceState(
                {},
                document.title,
                loginPathWithPrefill(roleMismatch?.existingRole, roleMismatch?.email || sessionEmail),
              );
            }
            setScreen('login');
            setBackendError(friendlyMessage);
          } else {
            setScreen(sessionInvalid ? 'login' : 'welcome');
            setBackendError(
              !navigator.onLine
                ? 'You are offline. The app shell and previously cached public content remain available; reconnect before making changes.'
                : sessionInvalid
                  ? 'Your session expired. Please sign in again.'
                  : friendlyMessage,
            );
          }
        }
      } finally {
        if (active) setIsBackendLoading(false);
      }
    };

    void bootstrap();
    // Shared auth store: the app registers no direct Supabase auth listener, so
    // auth events stay single-sourced alongside the location sync lifecycle.
    const unsubscribeAuth = subscribeToAuthChanges((event, session, authSnapshot) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecoveryState('valid');
        setScreen('reset_password');
      }
      if (event === 'SIGNED_IN' && session?.user) {
        // Confirming an email or returning from a provider can produce the
        // session after the bootstrap already decided the visitor was signed
        // out. Enter the portal here as well — once per user — so those flows
        // never leave a live session sitting on the welcome/login screen.
        const userId = session.user.id;
        if (enteredPortalUserId.current !== userId) {
          enteredPortalUserId.current = userId;
          void applyPendingOAuthRole(userId)
            .then((pendingRole) =>
              enterAuthenticatedPortal(
                userId,
                pendingRole ?? (session.user.user_metadata?.role as UserRole | undefined),
              ),
            )
            .catch((error) => {
              setBackendError(mapBackendError(error, 'Unable to open your workspace.'));
            });
        }
      }
      if (event === 'SIGNED_OUT') {
        enteredPortalUserId.current = null;
        setCurrentUserId(null);
        setPasswordRecoveryState('idle');
        if (authSnapshot.invalidated) {
          // Explain the forced logout with fixed friendly copy (never the raw
          // session error, which can name tokens, claims, or deleted users).
          setBackendError('Your session expired. Please sign in again.');
        }
        // An expired/revoked session returns to the login route; a deliberate
        // logout keeps the existing welcome behaviour — except when the sign-out
        // was triggered by a failed auth attempt (e.g. portal role rejection
        // clears the just-created session). In that case the user stays on the
        // auth screen they are on so the explainer + portal switch can render,
        // instead of bouncing to welcome and starting a confusing login loop.
        setScreen((current) => {
          if (authSnapshot.invalidated) return 'login';
          if (
            current === 'login' || current === 'admin_login' || current === 'role_select' ||
            current === 'seeker_signup' || current === 'employer_signup' ||
            current === 'forgot_password' || current === 'reset_password'
          ) {
            return current;
          }
          return 'welcome';
        });
      }
    });

    return () => {
      active = false;
      unsubscribeAuth();
    };
  }, [enterAuthenticatedPortal]);

  useEffect(() => {
    if (isBackendLoading) return;
    const desiredPath = pathForScreen(screen, userRole, seekerInitialTab, employerInitialTab, openEmployerPostJob, employerApplicationJobId);
    if (typeof window !== 'undefined' && window.location.pathname !== desiredPath) {
      window.history.replaceState({}, document.title, `${desiredPath}${window.location.search}`);
    }
  }, [employerApplicationJobId, employerInitialTab, isBackendLoading, openEmployerPostJob, screen, seekerInitialTab, userRole]);

  useEffect(() => {
    const handlePopState = () => {
      const route = resolveJobPortalRoute();
      if (route.protected && !currentUserId) {
        pendingProtectedRoute.current = route;
        setScreen(route.requiredRole === 'admin' ? 'admin_login' : 'login');
        return;
      }
      if (route.seekerTab) setSeekerInitialTab(route.seekerTab);
      if (route.employerTab) setEmployerInitialTab(route.employerTab);
      setEmployerApplicationJobId(route.employerJobId);
      setOpenEmployerPostJob(Boolean(route.openPostJob));
      setScreen(route.screen);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
    return () => {};
  }, [currentUserId]);

  useEffect(() => {
    if (!supabase || !currentUserId) return;
    let refreshTimer: number | undefined;
    const refresh = () => {
    if (typeof window !== 'undefined') {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        void hydrateWorkspace(currentUserId, userRole).catch((error) =>
          setBackendError(mapBackendError(error, 'Unable to refresh data.')),
        );
      }, 250);
    }
    };

    const channel = supabase
      .channel(`workspace-${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_messages' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_applications' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_notifications' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_posts' }, refresh)
      .subscribe();

    return () => {
      if (typeof window !== 'undefined') {
        window.clearTimeout(refreshTimer);
      }
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, hydrateWorkspace, userRole]);

  // Handlers
  const handleSelectRole = (role: UserRole) => {
    setUserRole(role);
    if (role === 'seeker') {
      setScreen('seeker_signup');
    } else {
      setScreen('employer_signup');
    }
  };

  const handleSeekerSignup = async (formData: { name: string; email: string; phone: string; password: string }) => {
    try {
      setUserRole('seeker');
      setUserProfile({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: 'seeker',
        specialties: [],
        skills: [],
        portfolioItems: [],
        savedFilters: [],
      });
      const { user, session } = await authBackend.signUp({
        role: 'seeker',
        email: formData.email,
        password: formData.password,
        name: formData.name,
        phone: formData.phone,
      });
      const outcome = resolveSignUpResult({ user, session });
      if (outcome.status === 'signed_in') {
        setCurrentUserId(outcome.userId);
        await hydrateWorkspace(outcome.userId, 'seeker');
        setScreen('seeker_onboarding_step1');
      } else if (outcome.status === 'confirmation_required') {
        // The account exists; Supabase is waiting for the email confirmation.
        // That is a successful sign-up, so never report it as a failure.
        setPendingConfirmationEmail({ email: formData.email, role: 'seeker' });
        setScreen('signup_confirmation');
      } else {
        throw new Error('Unable to create your account. Please try again.');
      }
    } catch (error) {
      if (isActionableAuthScreenError(error)) throw error;
      setBackendError(extractErrorMessage(error, 'Unable to create seeker account.'));
    }
  };

  const handleEmployerSignup = async (formData: { businessName: string; contactPerson: string; email: string; password: string }) => {
    try {
      setUserRole('employer');
      setUserProfile({
        name: formData.contactPerson,
        email: formData.email,
        phone: '',
        businessName: formData.businessName,
        contactPerson: formData.contactPerson,
        role: 'employer',
        portfolioItems: [],
        savedFilters: [],
      });
      const { user, session } = await authBackend.signUp({
        role: 'employer',
        email: formData.email,
        password: formData.password,
        name: formData.contactPerson,
        businessName: formData.businessName,
      });
      const outcome = resolveSignUpResult({ user, session });
      if (outcome.status === 'signed_in') {
        setCurrentUserId(outcome.userId);
        await hydrateWorkspace(outcome.userId, 'employer');
        setScreen('employer_onboarding_step1');
      } else if (outcome.status === 'confirmation_required') {
        setPendingConfirmationEmail({ email: formData.email, role: 'employer' });
        setScreen('signup_confirmation');
      } else {
        throw new Error('Unable to create your account. Please try again.');
      }
    } catch (error) {
      if (isActionableAuthScreenError(error)) throw error;
      setBackendError(extractErrorMessage(error, 'Unable to create employer account.'));
    }
  };

  const handleLoginSuccess = async (selectedRole: UserRole, email: string, password: string) => {
    try {
      const { user, portalRole } = await authBackend.signIn(email, password, selectedRole);
      if (!user) throw new Error('Login succeeded but no user session was returned.');
      try {
        // Enter the portal the backend granted for this session. Portal
        // verification already ran before the password check, so a mismatched
        // tab never gets this far — it is refused and rendered as the login
        // form's inline "Switch to … Portal" card.
        await enterAuthenticatedPortal(user.id, portalRole ?? selectedRole);
      } catch (portalError) {
        // Sign-in produced a session the portal cannot use (role mismatch or no
        // role row). Clear it so no incomplete/invalid state persists before the
        // error reaches the login screen.
        if (isPortalRoleMismatchError(portalError) || isUnassignedPortalRoleError(portalError)) {
          await authBackend.signOut().catch(() => undefined);
        }
        throw portalError;
      }
    } catch (error) {
      // The login screen renders these as cards with the next step in them
      // (switch portal, reset the password, re-send the confirmation). Swallowing
      // them here left the user with a sentence and nowhere to go.
      if (isActionableAuthScreenError(error)) throw error;
      setBackendError(extractErrorMessage(error, 'Unable to sign in. Please try again.'));
    }
  };

  /**
   * Portal role behind an email, used by the login screen to move the portal tab
   * onto the account the user is actually signing in to. Best-effort: a lookup
   * failure returns null and the tab simply stays where the user put it.
   */
  const handleResolvePortalRole = useCallback(async (email: string): Promise<UserRole | null> => {
    try {
      return await authBackend.lookupPortalRole(email);
    } catch {
      return null;
    }
  }, []);

  /** Forwards a role-mismatch from a signup screen to the prefilled portal login. */
  const handleSwitchPortalToLogin = (role: UserRole, email: string) => {
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, document.title, loginPathWithPrefill(role, email));
    }
    setScreen('login');
  };

  const handleAdminLogin = async (email: string, password: string) => {
    const { user } = await authBackend.signInAdmin(email, password);
    pendingProtectedRoute.current = { screen: 'admin_jobs', protected: true, requiredRole: 'admin' };
    await enterAuthenticatedPortal(user.id, 'admin');
  };

  const handleSocialLogin = async (provider: 'google' | 'apple', role: UserRole) => {
    await authBackend.signInWithProvider(provider, role);
  };

  const handleToggleBookmark = (jobId: string) => {
    const job = jobs.find((item) => item.id === jobId);
    const nextValue = !job?.isBookmarked;
    setJobs((prevJobs) =>
      prevJobs.map((item) => (item.id === jobId ? { ...item, isBookmarked: nextValue } : item))
    );
    if (currentUserId) {
      void setBookmark(currentUserId, jobId, nextValue).catch((error) => {
        setJobs((prevJobs) =>
          prevJobs.map((item) => (item.id === jobId ? { ...item, isBookmarked: !nextValue } : item)),
        );
        setBackendError(mapBackendError(error, 'Unable to update bookmark.'));
      });
    }
  };

  const handleApplyJob = async (job: JobPosting, coverNote: string, expectedSalary?: string, availability?: string, resumeId?: string): Promise<void> => {
    if (!currentUserId) throw new Error('Your session is no longer valid. Please sign in again.');
    setBackendError(null);
    try {
      // Confirmation is shown only after Supabase returns the persisted row id.
      // This avoids the old false-success state where an optimistic card was
      // later removed after a silent RPC failure.
      const applicationId = await createApplication(
        currentUserId,
        job,
        coverNote,
        expectedSalary,
        availability,
        undefined,
        resumeId,
      );
      const newApp: Application = {
        id: applicationId,
        jobId: job.id,
        jobTitle: job.title,
        salonName: job.salonName,
        salonLogo: job.salonLogo,
        location: job.location,
        salaryRange: job.salary,
        jobType: job.jobType,
        job,
        appliedDate: 'Just now',
        submittedAt: new Date().toISOString(),
        status: 'Submitted',
        applicationStatus: 'Applied',
        notes: 'Application received and under review by salon team.',
        expectedSalary,
        availability,
      };
      setApplications((prev) => prev.some((item) => item.id === applicationId) ? prev : [newApp, ...prev]);
    } catch (error) {
      const message = mapBackendError(error, 'Unable to submit application. Your details are still here — please retry.');
      setBackendError(message);
      if (message === 'Please complete your candidate profile before applying.') {
        setSeekerInitialTab('profile');
        setScreen('main_app');
      }
      throw new Error(message);
    }
  };

  const handleWithdrawApplication = async (applicationId: string): Promise<void> => {
    if (!currentUserId) throw new Error('Your session is no longer valid. Please sign in again.');
    try {
      await withdrawApplication(applicationId);
      // Keep the row in My Applications so the candidate retains a complete
      // history; only the withdrawal action disappears after server confirmation.
      setApplications((current) => current.map((application) =>
        application.id === applicationId
          ? {
              ...application,
              status: 'Declined',
              applicationStatus: 'Withdrawn',
              notes: 'You withdrew this application.',
            }
          : application,
      ));
    } catch (error) {
      const message = mapBackendError(error, 'Unable to withdraw this application. Please retry.');
      setBackendError(message);
      throw new Error(message);
    }
  };

  const handleAddJob = async (newJob: JobPosting) => {
    if (currentUserId) {
      try {
        const savedJob = await createJob(currentUserId, newJob);
        setJobs((prev) => [savedJob, ...prev]);
        return savedJob;
      } catch (error) {
        const message = mapBackendError(error, 'Unable to save this job post. Your details are still here — please retry.');
        setBackendError(message);
        throw new Error(message);
      }
    }

    setJobs((prev) => [newJob, ...prev]);
    return newJob;
  };

  const handleUpdateJob = async (job: JobPosting): Promise<JobPosting> => {
    try {
      const savedJob = currentUserId ? await updateJob(job) : job;
      setJobs((current) => current.map((item) => item.id === savedJob.id ? savedJob : item));
      return savedJob;
    } catch (error) {
      const message = mapBackendError(error, 'Unable to update this job. Your changes are still here — please retry.');
      setBackendError(message);
      throw new Error(message);
    }
  };

  const handleDeleteJob = async (jobId: string): Promise<void> => {
    try {
      if (!currentUserId) throw new Error('Your session is no longer valid. Please sign in again.');
      await deleteEmployerJob(jobId);
      setJobs((current) => current.filter((job) => job.id !== jobId));
    } catch (error) {
      const message = mapBackendError(error, 'Unable to delete this job. Close it instead if candidates have applied.');
      setBackendError(message);
      throw new Error(message);
    }
  };

  const handleMarkAlertRead = (alertId: string) => {
    setJobAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, isRead: true } : a))
    );
    if (currentUserId) {
      void updateAlertRead(alertId).catch((error) =>
        setBackendError(mapBackendError(error, 'Unable to update alert.')),
      );
    }
  };

  const handleMarkAllAlertsRead = () => {
    setJobAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
    if (currentUserId) {
      void markAllAlertsRead(currentUserId).catch((error) =>
        setBackendError(mapBackendError(error, 'Unable to update alerts.')),
      );
    }
  };

  const handleClearAlert = (alertId: string) => {
    setJobAlerts((prev) => prev.filter((a) => a.id !== alertId));
    if (currentUserId) {
      void deleteAlert(alertId).catch((error) =>
        setBackendError(mapBackendError(error, 'Unable to delete alert.')),
      );
    }
  };

  const handleUpdateApplicantStatus = async (applicantId: string, status: Applicant['status']): Promise<void> => {
    try {
      // The card changes only after the secured Supabase workflow confirms the
      // transition; failed writes never leave an optimistic status behind.
      if (currentUserId) await updateApplicationStatus(applicantId, status);
      setApplicants((prev) => prev.map((applicant) =>
        applicant.id === applicantId ? { ...applicant, status } : applicant,
      ));
      if (status === 'Shortlisted') {
        setApplications((prev) => prev.map((application) =>
          application.id === applicantId
            ? { ...application, status: 'Under Review', applicationStatus: 'Shortlisted' }
            : application,
        ));
      }
    } catch (error) {
      const message = mapBackendError(error, 'Unable to update applicant status.');
      setBackendError(message);
      throw new Error(message);
    }
  };

  /**
   * Employer schedules an interview from the request form. The backend
   * persists the real date/time/location; local state mirrors the returned
   * row (status + interview list + matching application).
   */
  const handleScheduleInterview = async (applicantId: string, payload: InterviewSchedulePayload) => {
    try {
      const interview = await scheduleInterview(applicantId, payload);
      setApplicants((prev) =>
        prev.map((a) =>
          a.id === applicantId
            ? { ...a, status: 'Interview Scheduled', interviews: [interview, ...(a.interviews ?? [])] }
            : a,
        ),
      );
      setApplications((prev) =>
        prev.map((app) =>
          app.id === applicantId
            ? {
                ...app,
                status: 'Interview Scheduled',
                applicationStatus: 'Shortlisted',
                interviewDate: formatInterviewDateTime(interview.scheduledStart),
                interviewId: interview.id,
                notes: 'Interview scheduled with hiring team.',
              }
            : app,
        ),
      );
    } catch (error) {
      throw new Error(mapBackendError(error, 'Unable to schedule the interview.'));
    }
  };

  /** Employer moves an interview; the patched row replaces the stored one. */
  const handleRescheduleInterview = async (interviewId: string, newStartIso: string) => {
    try {
      const interview = await rescheduleEmployerInterview(interviewId, newStartIso);
      setApplicants((prev) =>
        prev.map((a) => ({
          ...a,
          interviews: (a.interviews ?? []).map((item) => (item.id === interviewId ? interview : item)),
        })),
      );
    } catch (error) {
      throw new Error(mapBackendError(error, 'Unable to reschedule the interview.'));
    }
  };

  /** Employer marks a confirmed interview complete. */
  const handleCompleteInterview = async (interviewId: string) => {
    try {
      const owner = applicants.find((a) => (a.interviews ?? []).some((item) => item.id === interviewId));
      const interview = owner?.interviews?.find((item) => item.id === interviewId);
      if (!owner || !interview) throw new Error('That interview is no longer available.');
      await completeInterviewStage(owner.id, interviewId);
      setApplicants((prev) =>
        prev.map((a) => ({
          ...a,
          interviews: (a.interviews ?? []).map((item) =>
            item.id === interviewId ? { ...item, status: 'completed' } : item,
          ),
        })),
      );
    } catch (error) {
      throw new Error(mapBackendError(error, 'Unable to complete the interview.'));
    }
  };

  /**
   * Employer sends an offer. The interview stage is closed first when a
   * confirmed interview exists, because `send_job_offer` only accepts an
   * application in the `interview_completed` state.
   */
  const handleSendOffer = (
    applicantId: string,
    details: { jobRole: string; salary?: string; employmentType?: string; joiningDate?: string; offerNotes?: string },
    interviewId?: string,
  ) => {
    if (!currentUserId) return;
    void (async () => {
      try {
        await completeInterviewStage(applicantId, interviewId);
        await sendJobOffer(applicantId, {
          jobRole: details.jobRole,
          salary: details.salary,
          employmentType: details.employmentType,
          joiningDate: details.joiningDate,
          offerNotes: details.offerNotes,
        });
        setApplicants((prev) =>
          prev.map((a) => (a.id === applicantId ? { ...a, status: 'Offer Extended' } : a)),
        );
      } catch (error) {
        setBackendError(mapBackendError(error, 'Unable to send the offer.'));
      }
    })();
  };

  /** Candidate answers an interview invitation (accept / decline / reschedule). */
  const handleInterviewResponse = async (applicationId: string, action: 'accept' | 'decline' | 'reschedule', reason?: string): Promise<void> => {
    if (!currentUserId) throw new Error('Your session is no longer valid. Please sign in again.');
    const application = applications.find((app) => app.id === applicationId);
    if (!application?.interviewId) throw new Error('This interview is no longer available. Refresh your applications and try again.');
    try {
      await respondToInterview(application.interviewId, action, reason);
      setApplications((prev) =>
        prev.map((app) =>
          app.id === applicationId
            ? {
                ...app,
                status: action === 'accept' ? 'Interview Scheduled' : 'Under Review',
                applicationStatus: 'Shortlisted',
                notes:
                  action === 'decline'
                    ? 'Declined current interview invitation. Awaiting further updates.'
                    : action === 'reschedule'
                      ? 'Reschedule requested with the hiring team.'
                      : 'Interview accepted. Looking forward to meeting you!',
              }
            : app,
        ),
      );
    } catch (error) {
      const message = mapBackendError(error, 'Unable to update the interview. Please retry.');
      setBackendError(message);
      throw new Error(message);
    }
  };

  /** Candidate answers a job offer. Hiring is completed by the employer. */
  const handleOfferResponse = async (applicationId: string, action: 'accept' | 'decline', reason?: string): Promise<void> => {
    if (!currentUserId) throw new Error('Your session is no longer valid. Please sign in again.');
    const application = applications.find((app) => app.id === applicationId);
    if (!application?.offerId) throw new Error('This offer is no longer available. Refresh your applications and try again.');
    try {
      await respondToJobOffer(application.offerId, action);
      setApplications((prev) =>
        prev.map((app) =>
          app.id === applicationId
            ? {
                ...app,
                status: action === 'accept' ? 'Accepted' : 'Declined',
                applicationStatus: action === 'accept' ? 'Hired' : 'Rejected',
                notes:
                  action === 'accept'
                    ? 'Offer accepted. Thank you!'
                    : `Offer declined. Reason: ${reason || 'None specified'}`,
              }
            : app,
        ),
      );
    } catch (error) {
      const message = mapBackendError(error, 'Unable to update the job offer. Please retry.');
      setBackendError(message);
      throw new Error(message);
    }
  };

  const handleSendMessage = (conversationId: string, text: string, attachment?: { name: string; url: string; type: 'image' | 'file' }) => {    const newMsg: ChatMessage = {
      id: currentUserId ? crypto.randomUUID() : `msg-${Date.now()}`,
      conversationId,
      senderRole: userRole,
      senderName: userRole === 'seeker' ? userProfile.name : (userProfile.businessName || userProfile.name),
      senderAvatar: userProfile.avatarUrl,
      text,
      timestamp: 'Just now',
      attachment
    };

    setMessages((prev) => [...prev, newMsg]);

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === conversationId) {
          return {
            ...c,
            lastMessage: text || (attachment ? `Sent an attachment: ${attachment.name}` : ''),
            lastMessageTime: 'Just now',
            unreadCountSeeker: userRole === 'employer' ? c.unreadCountSeeker + 1 : c.unreadCountSeeker,
            unreadCountEmployer: userRole === 'seeker' ? c.unreadCountEmployer + 1 : c.unreadCountEmployer
          };
        }
        return c;
      })
    );

    if (currentUserId) {
      void sendMessageRecord(currentUserId, newMsg).catch((error) => {
        setMessages((prev) => prev.filter((message) => message.id !== newMsg.id));
        setBackendError(mapBackendError(error, 'Unable to send message.'));
      });
    }
  };

  const handleJobAction = (jobId: string, action: 'submit' | 'pause' | 'resume' | 'close') => {
    // Moderation and lifecycle changes go through the RPCs, so the server
    // decides who may do what and what the status becomes.
    const labels: Record<typeof action, string> = {
      submit: 'Unable to submit this job for approval.',
      pause: 'Unable to pause this job.',
      resume: 'Unable to resume this job.',
      close: 'Unable to close this position.',
    };
    void setJobLifecycleState(jobId, action)
      .then(async () => {
        if (currentUserId) await hydrateWorkspace(currentUserId);
      })
      .catch((error) => setBackendError(mapBackendError(error, labels[action])));
  };

  const handleStartConversation = (jobId: string, targetSeekerName?: string, targetSalonName?: string): string => {
    const job = jobs.find((j) => j.id === jobId);

    // Look for existing conversation
    const existing = conversations.find((c) => {
      if (userRole === 'seeker') {
        return c.jobId === jobId && (c.salonName === (targetSalonName || job?.salonName));
      } else {
        return c.jobId === jobId && c.seekerName === targetSeekerName;
      }
    });

    if (existing) {
      return existing.id;
    }

    const newConvId = currentUserId ? crypto.randomUUID() : `conv-${Date.now()}`;
    const targetApplicant = applicants.find((applicant) => applicant.name === targetSeekerName);
    const newConv: Conversation = {
      id: newConvId,
      jobId,
      jobTitle: job?.title || 'Beauty Position',
      salonName: targetSalonName || job?.salonName || 'Beauty Group',
      salonLogo: job?.salonLogo,
      seekerName: targetSeekerName || userProfile.name,
      seekerEmail: userRole === 'seeker' ? userProfile.email : targetApplicant?.email,
      employerName: `${job?.salonName || 'Salon'} Director`,
      lastMessage: 'Conversation started',
      lastMessageTime: 'Just now',
      unreadCountSeeker: 0,
      unreadCountEmployer: 0,
      status: 'Inquiry'
    };

    setConversations((prev) => [newConv, ...prev]);
    if (currentUserId) {
      void createConversationRecord({
        id: newConvId,
        userId: currentUserId,
        role: userRole,
        jobId,
        targetSeekerEmail: newConv.seekerEmail,
      }).catch((error) => {
        setConversations((prev) => prev.filter((conversation) => conversation.id !== newConvId));
        setBackendError(mapBackendError(error, 'Unable to start conversation.'));
      });
    }
    return newConvId;
  };

  const handleCandidateProfileSubmit = async (input: CandidateProfileInput): Promise<CandidateProfileSubmission> => {
    if (!currentUserId) throw new Error('Your session is no longer valid. Please sign in again.');
    try {
      const result = await submitCandidateProfile(input);
      // Re-read every profile relation after the transaction. The confirmation
      // uses the RPC result immediately, while the rest of the workspace gets
      // the same authoritative data (including the stable candidate id).
      await hydrateWorkspace(currentUserId, 'seeker');
      return result;
    } catch (error) {
      throw new Error(mapBackendError(error, 'We could not submit your profile. Your entries are still here — please retry.'));
    }
  };

  const handleProfileUpdate = async (updatedProfile: UserProfile): Promise<void> => {
    if (!currentUserId) throw new Error('Your session is no longer valid. Please sign in again.');
    setBackendError(null);
    // Client-side validation to avoid server VALIDATION_ERROR
    const trimmedName = updatedProfile.name?.trim() || '';
    if (trimmedName.length < 2) {
      const msg = 'Name must be at least 2 characters';
      setBackendError(msg);
      throw new Error(msg);
    }
    if (updatedProfile.role === 'employer') {
      const biz = updatedProfile.businessName?.trim() || '';
      const contact = (updatedProfile.contactPerson || updatedProfile.name || '').trim();
      if (biz.length < 2) {
        const msg = 'Business name must be at least 2 characters';
        setBackendError(msg);
        throw new Error(msg);
      }
      if (contact.length < 2) {
        const msg = 'Contact person must be at least 2 characters';
        setBackendError(msg);
        throw new Error(msg);
      }
    }

    try {
      if (updatedProfile.role === 'employer') {
        try {
          await updateEmployerProfile(updatedProfile);
        } catch (empError) {
          // Only the shared profiles row can be healed by the generic save. A
          // salon failure must surface instead: falling back here would silently
          // drop the business name, location, website and Instagram while the
          // modal still reported "Profile updated successfully".
          const sig = `${(empError as any)?.code ?? ''} ${(empError as any)?.message ?? ''}`;
          if (/PROFILE_NOT_FOUND/i.test(sig)) {
            await saveProfile(currentUserId, updatedProfile);
          } else {
            throw empError;
          }
        }
      } else {
        await saveProfile(currentUserId, updatedProfile);
      }
      setUserProfile(updatedProfile);
    } catch (error) {
      // The toast is intentionally generic; keep the raw backend failure in the
      // console so the reason (validation, RLS, missing column, …) is visible.
      logger('profile').error('profile update failed', error, {
        role: updatedProfile.role,
        rpc: updatedProfile.role === 'employer' ? 'job_update_employer_profile' : 'job_save_profile',
      });
      const message = mapBackendError(error, 'Unable to save profile. Please retry.');
      setBackendError(message);
      throw new Error(message);
    }
  };

  const handleAvatarUpdate = async (avatarUrl: string | undefined): Promise<void> => {
    if (!currentUserId) throw new Error('Your session is no longer valid. Please sign in again.');
    const path = avatarUrl && isStoragePath(avatarUrl) ? avatarUrl : undefined;
    const updatedProfile: UserProfile = {
      ...userProfile,
      avatarUrl: path ? undefined : avatarUrl,
      avatarPath: path,
    };
    try {
      if (updatedProfile.role === 'employer') {
        try {
          await updateEmployerProfile(updatedProfile);
        } catch (e) {
          const sig = (e as any)?.message || '';
          if (/SALON_ACCESS_DENIED|SALON_NOT_FOUND|PROFILE_NOT_FOUND/i.test(sig)) {
            await saveProfile(currentUserId, updatedProfile);
          } else {
            throw e;
          }
        }
      } else {
        await saveProfile(currentUserId, updatedProfile);
      }
      if (path) {
        const resolved = await resolveStorageUrls(MEDIA_BUCKETS.profileMedia, [path]);
        setUserProfile({ ...updatedProfile, avatarUrl: resolved.get(path), avatarPath: path });
      } else {
        setUserProfile(updatedProfile);
      }
    } catch (error) {
      logger('profile').error('avatar update failed', error, { role: updatedProfile.role });
      const message = mapBackendError(error, 'Unable to save profile photo. Please retry.');
      setBackendError(message);
      throw new Error(message);
    }
  };

  const handleRecoveredPasswordUpdate = async (password: string) => {
    if (passwordRecoveryState !== 'valid') {
      throw new Error('This password reset link is invalid or expired. Request a new reset email.');
    }
    try {
      await authBackend.updatePassword(password);
    } catch (updateError) {
      // The recovery session died while the form was open (60-minute expiry,
      // or the token was reused). Show the "request a new email" panel instead
      // of leaving the user on a form that can never submit.
      if (updateError instanceof RecoverySessionLostError) setPasswordRecoveryState('invalid');
      throw updateError;
    }
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  /**
   * Recovery from a token the user already holds (the newest reset email in
   * their inbox). Sends no email, so it works while the provider's hourly
   * quota is exhausted and when the link was opened on another device.
   */
  const handleRecoverWithToken = async (token: RecoveryTokenInput, email: string) => {
    const { user } = await authBackend.recoverWithToken(token, email);
    if (!user) throw new Error('That code was accepted but no account was returned.');
    setPasswordRecoveryState('valid');
    // The recovery session knows the real account email; carry it back to the
    // login screen so the user can sign in with the new password immediately.
    if (user.email) {
      setRecoveryEmail(user.email);
      setLoginEmail(user.email);
    }
    setScreen('reset_password');
    // Keep the recovery marker so a reload returns to the reset form, and drop
    // any stale PKCE params that would fail a second exchange.
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, document.title, `${window.location.pathname}?recovery=1`);
    }
  };

  const exitPasswordRecovery = async (target: 'login' | 'forgot_password') => {
    try {
      await authBackend.signOut();
    } finally {
      setPasswordRecoveryState('idle');
      window.history.replaceState({}, document.title, window.location.pathname);
      if (target === 'login' && recoveryEmail) setLoginEmail(recoveryEmail);
      setScreen(target);
    }
  };

  const handleLogout = () => {
    setIsLogoutModalOpen(true);
  };

  const confirmLogout = () => {
    setIsLogoutModalOpen(false);
    if (currentUserId) {
      void authBackend.signOut().catch((error) =>
        setBackendError(extractErrorMessage(error, 'Unable to sign out.')),
      );
    } else {
      setScreen('welcome');
    }
  };

  if (isBackendLoading) return <JobsWorkspaceSkeleton />;

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans antialiased">
      {!isSupabaseConfigured && <SupabaseConfigWarning />}
      {backendError && (
        <div role="alert" className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] w-[min(92vw,560px)] rounded-xl border border-rose-200 bg-white px-4 py-3 shadow-xl flex items-start gap-3">
          <p className="flex-1 text-xs font-semibold text-rose-700">{backendError}</p>
          <button type="button" onClick={() => setBackendError(null)} className="text-xs font-bold text-rose-700 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <PwaInstallButton />

      <LogoutConfirmationModal
        isOpen={isLogoutModalOpen}
        onConfirm={confirmLogout}
        onCancel={() => setIsLogoutModalOpen(false)}
      />

      {screen === 'admin_login' && <AdminLoginScreen onLogin={handleAdminLogin} onBack={() => setScreen('welcome')} />}
      {screen === 'admin_jobs' && <AdminJobsScreen onLogout={() => void authBackend.signOut()} />}

      {/* SCREEN 1: WELCOME */}
      {screen === 'welcome' && (
        <WelcomeScreen
          onGetStarted={() => setScreen('role_select')}
          onLogin={() => setScreen('login')}
        />
      )}

      {/* SCREEN 2: ROLE SELECTION */}
      {screen === 'role_select' && (
        <RoleSelectionScreen
          onSelectRole={handleSelectRole}
          onBack={() => setScreen('welcome')}
        />
      )}

      {/* SCREEN 3: JOB SEEKER SIGNUP */}
      {screen === 'seeker_signup' && (
        <JobSeekerSignupScreen
          onSubmit={handleSeekerSignup}
          onSocialSignup={(provider) => handleSocialLogin(provider, 'seeker')}
          onBack={() => setScreen('role_select')}
          onLogin={() => setScreen('login')}
          onSwitchPortal={handleSwitchPortalToLogin}
        />
      )}

      {/* SCREEN 3b: SIGNUP CONFIRMATION (account created, waiting for the email) */}
      {screen === 'signup_confirmation' && (
        <ConfirmEmailScreen
          email={pendingConfirmationEmail?.email || ''}
          role={pendingConfirmationEmail?.role || 'seeker'}
          onResend={async (email) => { await authBackend.resendConfirmationEmail(email); }}
          onBackToLogin={() => setScreen('login')}
        />
      )}

      {/* SCREEN 4: EMPLOYER SIGNUP */}
      {screen === 'employer_signup' && (
        <EmployerSignupScreen
          onSubmit={handleEmployerSignup}
          onBack={() => setScreen('role_select')}
          onLogin={() => setScreen('login')}
          onSwitchPortal={handleSwitchPortalToLogin}
        />
      )}

      {/* SCREEN 5: LOGIN */}
      {screen === 'login' && (
        <LoginScreen
          onLoginSuccess={handleLoginSuccess}
          onSocialLogin={handleSocialLogin}
          onResolvePortalRole={handleResolvePortalRole}
          onSignUp={() => setScreen('role_select')}
          onResendConfirmation={async (email) => { await authBackend.resendConfirmationEmail(email); }}
          onSendResetLink={async (email) => { await authBackend.sendPasswordReset(email); }}
          initialEmail={loginEmail}
          onForgotPassword={(email) => {
            const trimmed = (email || '').trim().toLowerCase();
            setRecoveryEmail(trimmed);
            setPasswordRecoveryState('idle');
            setScreen('forgot_password');
          }}
        />
      )}

      {/* SCREEN 08: FORGOT PASSWORD */}
      {screen === 'forgot_password' && (
        <ForgotPasswordScreen
          initialEmail={recoveryEmail}
          onBackToLogin={() => {
            if (recoveryEmail) setLoginEmail(recoveryEmail);
            setScreen('login');
          }}
          onSendResetLink={async (email) => {
            setRecoveryEmail((email || '').trim().toLowerCase());
            await authBackend.sendPasswordReset(email);
          }}
          onVerifyRecoveryToken={handleRecoverWithToken}
        />
      )}

      {/* SCREEN 09: RESET PASSWORD */}
      {screen === 'reset_password' && (
        <ResetPasswordScreen
          recoveryState={passwordRecoveryState === 'idle' ? 'invalid' : passwordRecoveryState}
          onBackToLogin={() => void exitPasswordRecovery('login')}
          onRequestNewLink={() => void exitPasswordRecovery('forgot_password')}
          onUpdatePassword={handleRecoveredPasswordUpdate}
          onSuccessLogin={() => void exitPasswordRecovery('login')}
        />
      )}

      {/* SCREEN 10: JOB SEEKER ONBOARDING STEP 1 */}
      {screen === 'seeker_onboarding_step1' && (
        <SeekerOnboardingStep1Screen
          initialData={{
            fullName: userProfile.name,
            email: userProfile.email,
            mobile: userProfile.phone,
            city: userProfile.city,
            state: userProfile.state,
            avatarUrl: userProfile.avatarUrl,
          }}
          onBack={() => setScreen('seeker_signup')}
          onNext={async (stepData) => {
            let uploadedAvatarPath: string | undefined;
            try {
              if (stepData.avatarFile) uploadedAvatarPath = await uploadCandidateAvatar(stepData.avatarFile);
              await handleProfileUpdate({
                ...userProfile,
                name: stepData.fullName || userProfile.name,
                // The authenticated email is read-only in this form.
                email: userProfile.email,
                phone: stepData.mobile || userProfile.phone,
                city: stepData.city || undefined,
                state: stepData.state || undefined,
                avatarUrl: uploadedAvatarPath ? undefined : userProfile.avatarUrl,
                avatarPath: uploadedAvatarPath || userProfile.avatarPath,
              });
              if (uploadedAvatarPath && userProfile.avatarPath && userProfile.avatarPath !== uploadedAvatarPath) {
                await deleteMediaObject(MEDIA_BUCKETS.profileMedia, userProfile.avatarPath);
              }
              setPendingOnboardingResume(stepData.resumeFile || null);
              setScreen('seeker_onboarding_step2');
            } catch (error) {
              if (uploadedAvatarPath) {
                await deleteMediaObject(MEDIA_BUCKETS.profileMedia, uploadedAvatarPath);
              }
              throw error;
            }
          }}
        />
      )}

      {/* SCREEN 11: JOB SEEKER ONBOARDING STEP 2 */}
      {screen === 'seeker_onboarding_step2' && (
        <SeekerOnboardingStep2Screen
          initialRoles={userProfile.primaryRole ? [userProfile.primaryRole] : []}
          onBack={() => setScreen('seeker_onboarding_step1')}
          onNext={async (selectedRoles) => {
            const updatedProfile: UserProfile = {
              ...userProfile,
              primaryRole: selectedRoles[0],
              specialties: Array.from(new Set([selectedRoles[0], ...(userProfile.specialties || [])])),
            };
            try {
              if (!currentUserId) throw new Error('Your session is no longer valid. Please sign in again.');
              await completeSeekerOnboarding(updatedProfile, selectedRoles);
              if (pendingOnboardingResume) await uploadResume(pendingOnboardingResume);
              setPendingOnboardingResume(null);
              await hydrateWorkspace(currentUserId, 'seeker');
              setScreen('main_app');
            } catch (error) {
              const message = mapBackendError(error, 'Unable to complete onboarding. Your details are still here — please retry.');
              setBackendError(message);
              throw new Error(message);
            }
          }}
        />
      )}

      {/* SCREEN 12: EMPLOYER ONBOARDING STEP 1 */}
      {screen === 'employer_onboarding_step1' && (
        <EmployerOnboardingStep1Screen
          contactName={userProfile.contactPerson || userProfile.name}
          onBack={() => setScreen('employer_signup')}
          onContinue={async (businessData) => {
            try {
              if (!currentUserId) throw new Error('Your session is no longer valid. Please sign in again.');
              await completeEmployerOnboarding(businessData);
              await handleProfileUpdate({
                ...userProfile,
                businessName: businessData.businessName,
                contactPerson: businessData.contactName || userProfile.contactPerson,
                name: businessData.contactName || userProfile.name,
                location: [businessData.city, businessData.state].filter(Boolean).join(', '),
                city: businessData.city,
                state: businessData.state,
                bio: businessData.description || undefined,
                website: businessData.website || undefined,
                instagram: businessData.instagram?.replace(/^@+/, '') || undefined,
              });
              setScreen('employer_onboarding_step2');
            } catch (error) {
              const message = mapBackendError(error, 'Unable to complete business setup. Please retry.');
              setBackendError(message);
              throw new Error(message);
            }
          }}
        />
      )}

      {/* SCREEN 13: EMPLOYER ONBOARDING STEP 2 */}
      {screen === 'employer_onboarding_step2' && (
        <EmployerOnboardingStep2Screen
          onBack={() => setScreen('employer_onboarding_step1')}
          onContinue={() => setScreen('main_app')}
        />
      )}

      {/* SCREEN 8: MAIN WORKSPACE */}
      {screen === 'main_app' && (
        <>
          {userRole === 'seeker' ? (
            <JobSeekerWorkspace
              jobs={jobs}
              applications={applications}
              conversations={conversations}
              messages={messages}
              userProfile={userProfile}
              jobAlerts={jobAlerts}
              onToggleBookmark={handleToggleBookmark}
              onApplyJob={handleApplyJob}
              isAuthenticated={Boolean(currentUserId)}
              onRequireLogin={() => {
                pendingProtectedRoute.current = resolveJobPortalRoute('/jobs/search');
                setScreen('login');
              }}
              onWithdrawApplication={handleWithdrawApplication}
              onSendMessage={handleSendMessage}
              onStartConversation={handleStartConversation}
              onUpdateAvatar={handleAvatarUpdate}
              onUpdateProfile={handleProfileUpdate}
              onSubmitProfile={handleCandidateProfileSubmit}
              onMarkAlertRead={handleMarkAlertRead}
              onMarkAllAlertsRead={handleMarkAllAlertsRead}
              onClearAlert={handleClearAlert}
              onNavigateScreen={(target) => setScreen(target)}
              onLogout={handleLogout}
              onStartApplyJob={(job) => {
                if (!currentUserId) {
                  pendingProtectedRoute.current = resolveJobPortalRoute('/jobs/search');
                  setScreen('login');
                  return;
                }
                if (!(userProfile.applicationReady ?? ((userProfile.profileCompletion || 0) >= 50))) {
                  setBackendError('Please complete your candidate profile before applying.');
                  setSeekerInitialTab('profile');
                  return;
                }
                setSelectedJobForApply(job);
                setScreen('apply_job');
              }}
              onViewInvitation={(app) => {
                setSelectedApplicationForInvitation(app);
                setScreen('interview_invitation');
              }}
              onViewOffer={(app) => {
                setSelectedApplicationForOffer(app);
                setScreen('job_offer');
              }}
              initialTab={seekerInitialTab}
              onTabChange={setSeekerInitialTab}
            />
          ) : (
            <EmployerWorkspace
              jobs={jobs}
              applicants={applicants}
              conversations={conversations}
              messages={messages}
              userProfile={userProfile}
              onAddJob={handleAddJob}
              onUpdateJob={handleUpdateJob}
              onUpdateApplicantStatus={handleUpdateApplicantStatus}
              onScheduleInterview={handleScheduleInterview}
              onRescheduleInterview={handleRescheduleInterview}
              onCompleteInterview={handleCompleteInterview}
              onSendOffer={handleSendOffer}
              onSendMessage={handleSendMessage}
              onStartConversation={handleStartConversation}
              onUpdateAvatar={handleAvatarUpdate}
              onUpdateProfile={handleProfileUpdate}
              onDeleteJob={handleDeleteJob}
              onJobAction={handleJobAction}
              initialTab={employerInitialTab}
              initialJobId={employerApplicationJobId}
              openPostJobOnMount={openEmployerPostJob}
              onPostJobFlowExit={(destination = 'jobs', jobId) => {
                setOpenEmployerPostJob(false);
                setEmployerApplicationJobId(jobId);
                setEmployerInitialTab(destination);
              }}
              onLogout={handleLogout}
            />
          )}
        </>
      )}

      {/* SCREEN 21 — APPLY JOB */}
      {screen === 'apply_job' && (
        <ApplyJobScreen
          jobs={jobs}
          selectedJob={selectedJobForApply}
          applications={applications}
          userProfile={userProfile}
          onApplyJob={handleApplyJob}
          onBack={() => setScreen('main_app')}
          onNavigateToApplications={() => {
            setSeekerInitialTab('applications');
            setScreen('main_app');
          }}
        />
      )}

      {/* SCREEN: INTERVIEW INVITATION */}
      {screen === 'interview_invitation' && (
        <InterviewInvitationScreen
          jobs={jobs}
          applications={applications}
          selectedApplication={selectedApplicationForInvitation}
          onInterviewResponse={handleInterviewResponse}
          onBack={() => {
            setSeekerInitialTab('applications');
            setScreen('main_app');
          }}
          onNavigateTab={(tab) => {
            setSeekerInitialTab(normalizeSeekerTab(tab));
            setScreen('main_app');
          }}
        />
      )}

      {/* SCREEN: JOB OFFER */}
      {screen === 'job_offer' && (
        <JobOfferScreen
          jobs={jobs}
          applications={applications}
          selectedApplication={selectedApplicationForOffer}
          onOfferResponse={handleOfferResponse}
          onBack={() => {
            setSeekerInitialTab('applications');
            setScreen('main_app');
          }}
          onNavigateTab={(tab) => {
            setSeekerInitialTab(normalizeSeekerTab(tab));
            setScreen('main_app');
          }}
        />
      )}

      {/* SCREEN 32 — SUPPORT */}
      {screen === 'support' && (
        <SupportScreen
          userEmail={userProfile.email}
          onBack={() => setScreen('main_app')}
          onNavigateTab={(tab) => {
            setSeekerInitialTab(normalizeSeekerTab(tab));
            setScreen('main_app');
          }}
        />
      )}

      {/* SCREEN 34 — SETTINGS */}
      {screen === 'settings' && (
        <SettingsScreen
          onBack={() => setScreen('main_app')}
          onLogout={handleLogout}
          onNavigateTab={(tab) => {
            setSeekerInitialTab(normalizeSeekerTab(tab));
            setScreen('main_app');
          }}
          userProfile={userProfile}
          onUpdateProfile={handleProfileUpdate}
        />
      )}
    </div>
  );
}

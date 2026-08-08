import React, { useCallback, useEffect, useState } from 'react';
import { ScreenState, UserRole, JobPosting, Application, Applicant, UserProfile, Conversation, ChatMessage, JobAlertNotification } from './types';
import { INITIAL_JOBS, INITIAL_APPLICATIONS, INITIAL_APPLICANTS, INITIAL_CONVERSATIONS, INITIAL_MESSAGES, INITIAL_PORTFOLIO_ITEMS, INITIAL_SAVED_FILTERS, INITIAL_JOB_ALERTS } from './data/mockData';
import { processNewJobForAlerts } from './utils/jobAlertMatcher';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import {
  applyPendingOAuthRole,
  authBackend,
  completeEmployerOnboarding,
  completeSeekerOnboarding,
  createApplication,
  createConversationRecord,
  createJob,
  deleteAlert,
  getUserRole,
  isPortalOnboardingComplete,
  loadWorkspace,
  markAllAlertsRead,
  saveProfile,
  sendMessageRecord,
  setBookmark,
  updateAlertRead,
  updateApplicationStatus,
} from './services/backend';

// Component imports
import { WelcomeScreen } from './components/auth/WelcomeScreen';
import { RoleSelectionScreen } from './components/auth/RoleSelectionScreen';
import { JobSeekerSignupScreen } from './components/auth/JobSeekerSignupScreen';
import { EmployerSignupScreen } from './components/auth/EmployerSignupScreen';
import { LoginScreen } from './components/auth/LoginScreen';
import { OtpVerifyScreen } from './components/auth/OtpVerifyScreen';
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

export default function App() {
  const [screen, setScreen] = useState<ScreenState>('welcome');
  const [userRole, setUserRole] = useState<UserRole>('seeker');
  const [selectedJobForApply, setSelectedJobForApply] = useState<JobPosting | null>(null);
  const [selectedApplicationForInvitation, setSelectedApplicationForInvitation] = useState<Application | null>(null);
  const [selectedApplicationForOffer, setSelectedApplicationForOffer] = useState<Application | null>(null);
  const [seekerInitialTab, setSeekerInitialTab] = useState<'feed' | 'applications' | 'saved' | 'messages' | 'portfolio' | 'profile' | undefined>(undefined);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isBackendLoading, setIsBackendLoading] = useState(isSupabaseConfigured);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [passwordRecoveryState, setPasswordRecoveryState] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');

  // Application Data States
  const [jobs, setJobs] = useState<JobPosting[]>(INITIAL_JOBS);
  const [applications, setApplications] = useState<Application[]>(INITIAL_APPLICATIONS);
  const [applicants, setApplicants] = useState<Applicant[]>(INITIAL_APPLICANTS);
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [jobAlerts, setJobAlerts] = useState<JobAlertNotification[]>(INITIAL_JOB_ALERTS);

  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '(555) 000-0000',
    role: 'seeker',
    businessName: 'Nexora Beauty Group',
    contactPerson: 'Sarah Jenkins',
    licenseNumber: 'CA-COS-889124',
    specialties: ['Balayage', 'Color Specialist', 'Facials'],
    portfolioItems: INITIAL_PORTFOLIO_ITEMS,
    savedFilters: INITIAL_SAVED_FILTERS,
  });

  const hydrateWorkspace = useCallback(async (userId: string, _expectedRole?: UserRole) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!userData.user || userData.user.id !== userId) throw new Error('Your session is no longer valid.');

    const role = await getUserRole(userData.user);
    const workspace = await loadWorkspace(userData.user, role);
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
    const role = await hydrateWorkspace(userId, expectedRole);
    const onboardingComplete = await isPortalOnboardingComplete(userId);
    if (onboardingComplete) {
      setScreen('main_app');
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
    const bootstrap = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!active) return;

        const queryParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const isRecovery = queryParams.get('recovery') === '1';
        const recoveryError = queryParams.get('error_description') || hashParams.get('error_description');
        if (isRecovery) {
          setScreen('reset_password');
          if (recoveryError) {
            setPasswordRecoveryState('invalid');
            setBackendError(decodeURIComponent(recoveryError.replace(/\+/g, ' ')));
          } else if (data.session?.user) {
            setPasswordRecoveryState('valid');
          } else {
            setPasswordRecoveryState('invalid');
          }
        } else if (data.session?.user) {
          await applyPendingOAuthRole(data.session.user.id);
          window.localStorage.removeItem('nexora_pending_email_verification');
          await enterAuthenticatedPortal(data.session.user.id, data.session.user.user_metadata?.role as UserRole | undefined);
          if (new URLSearchParams(window.location.search).has('verified')) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }
      } catch (error) {
        await supabase.auth.signOut();
        if (active) {
          setCurrentUserId(null);
          setScreen('welcome');
          setBackendError(error instanceof Error ? error.message : 'Unable to validate your portal access.');
        }
      } finally {
        if (active) setIsBackendLoading(false);
      }
    };

    void bootstrap();
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecoveryState('valid');
        setScreen('reset_password');
      }
      if (event === 'SIGNED_IN' && session?.user && window.localStorage.getItem('nexora_pending_email_verification')) {
        window.localStorage.removeItem('nexora_pending_email_verification');
        void enterAuthenticatedPortal(session.user.id).catch((error) => {
          setBackendError(error instanceof Error ? error.message : 'Unable to finish email verification.');
        });
      }
      if (event === 'SIGNED_OUT') {
        setCurrentUserId(null);
        setPasswordRecoveryState('idle');
        setScreen('welcome');
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [enterAuthenticatedPortal]);

  useEffect(() => {
    if (!supabase || !currentUserId) return;
    let refreshTimer: number | undefined;
    const refresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        void hydrateWorkspace(currentUserId, userRole).catch((error) =>
          setBackendError(error instanceof Error ? error.message : 'Unable to refresh data.'),
        );
      }, 250);
    };

    const channel = supabase
      .channel(`workspace-${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_messages' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_applications' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_notifications' }, refresh)
      .subscribe();

    return () => {
      window.clearTimeout(refreshTimer);
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
    setUserRole('seeker');
    setUserProfile((prev) => ({
      ...prev,
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      role: 'seeker',
    }));
    const { user, session } = await authBackend.signUp({
      role: 'seeker',
      email: formData.email,
      password: formData.password,
      name: formData.name,
      phone: formData.phone,
    });
    if (session && user) {
      setCurrentUserId(user.id);
      await hydrateWorkspace(user.id, 'seeker');
      setScreen('seeker_onboarding_step1');
    } else {
      setScreen('otp_verify');
    }
  };

  const handleEmployerSignup = async (formData: { businessName: string; contactPerson: string; email: string; password: string }) => {
    setUserRole('employer');
    setUserProfile((prev) => ({
      ...prev,
      name: formData.contactPerson,
      email: formData.email,
      businessName: formData.businessName,
      contactPerson: formData.contactPerson,
      role: 'employer',
    }));
    const { user, session } = await authBackend.signUp({
      role: 'employer',
      email: formData.email,
      password: formData.password,
      name: formData.contactPerson,
      businessName: formData.businessName,
    });
    if (session && user) {
      setCurrentUserId(user.id);
      await hydrateWorkspace(user.id, 'employer');
      setScreen('employer_onboarding_step1');
    } else {
      setScreen('otp_verify');
    }
  };

  const handleLoginSuccess = async (selectedRole: UserRole, email: string, password: string) => {
    const { user } = await authBackend.signIn(email, password, selectedRole);
    if (!user) throw new Error('Login succeeded but no user session was returned.');
    await enterAuthenticatedPortal(user.id, selectedRole);
  };

  const handleSocialLogin = async (provider: 'google' | 'apple', role: UserRole) => {
    await authBackend.signInWithProvider(provider, role);
  };

  const handleEmailVerificationCheck = async () => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session?.user) {
      throw new Error('Email is not verified yet. Open the newest verification email and click “Confirm email address”, then try again.');
    }
    window.localStorage.removeItem('nexora_pending_email_verification');
    await enterAuthenticatedPortal(data.session.user.id, userRole);
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
        setBackendError(error instanceof Error ? error.message : 'Unable to update bookmark.');
      });
    }
  };

  const handleApplyJob = (job: JobPosting, coverNote: string, expectedSalary?: string, availability?: string) => {
    const applicationId = currentUserId ? crypto.randomUUID() : `app-${Date.now()}`;

    // Add to Seeker applications
    const newApp: Application = {
      id: applicationId,
      jobId: job.id,
      jobTitle: job.title,
      salonName: job.salonName,
      salonLogo: job.salonLogo,
      location: job.location,
      appliedDate: 'Just now',
      status: 'Submitted',
      notes: 'Application received and under review by salon team.',
      expectedSalary,
      availability,
    };

    setApplications((prev) => [newApp, ...prev]);

    // Add to Employer applicant candidate pipeline
    const newApplicant: Applicant = {
      id: `cand-${Date.now()}`,
      name: userProfile.name,
      appliedJobId: job.id,
      appliedJobTitle: job.title,
      email: userProfile.email,
      phone: userProfile.phone,
      experienceYears: 5,
      licenseNumber: 'CA-COS-889124',
      status: 'New',
      appliedDate: 'Just now',
      coverNote,
      portfolioUrl: 'instagram.com/janedoe_hair',
      expectedSalary,
      availability,
    };

    setApplicants((prev) => [newApplicant, ...prev]);

    if (currentUserId) {
      void createApplication(
        currentUserId,
        job,
        coverNote,
        expectedSalary,
        availability,
        applicationId,
      ).catch((error) => {
        setApplications((prev) => prev.filter((application) => application.id !== applicationId));
        setApplicants((prev) => prev.filter((applicant) => applicant.id !== newApplicant.id));
        setBackendError(error instanceof Error ? error.message : 'Unable to submit application.');
      });
    }
  };

  const handleAddJob = (newJob: JobPosting) => {
    if (currentUserId) {
      void createJob(currentUserId, newJob)
        .then((savedJob) => setJobs((prev) => [savedJob, ...prev]))
        .catch((error) => setBackendError(error instanceof Error ? error.message : 'Unable to publish job.'));
      return;
    }

    setJobs((prev) => [newJob, ...prev]);

    // Demo-mode alert matcher. Supabase creates these through a database trigger.
    const matchedAlerts = processNewJobForAlerts(newJob, userProfile.savedFilters || INITIAL_SAVED_FILTERS);
    if (matchedAlerts.length > 0) {
      setJobAlerts((prev) => [...matchedAlerts, ...prev]);
    }
  };

  const handleMarkAlertRead = (alertId: string) => {
    setJobAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, isRead: true } : a))
    );
    if (currentUserId) {
      void updateAlertRead(alertId).catch((error) =>
        setBackendError(error instanceof Error ? error.message : 'Unable to update alert.'),
      );
    }
  };

  const handleMarkAllAlertsRead = () => {
    setJobAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
    if (currentUserId) {
      void markAllAlertsRead(currentUserId).catch((error) =>
        setBackendError(error instanceof Error ? error.message : 'Unable to update alerts.'),
      );
    }
  };

  const handleClearAlert = (alertId: string) => {
    setJobAlerts((prev) => prev.filter((a) => a.id !== alertId));
    if (currentUserId) {
      void deleteAlert(alertId).catch((error) =>
        setBackendError(error instanceof Error ? error.message : 'Unable to delete alert.'),
      );
    }
  };

  const handleUpdateApplicantStatus = (applicantId: string, status: Applicant['status']) => {
    setApplicants((prev) =>
      prev.map((a) => (a.id === applicantId ? { ...a, status } : a))
    );

    // Also sync Seeker applications if matching
    if (currentUserId) {
      void updateApplicationStatus(applicantId, status).catch((error) =>
        setBackendError(error instanceof Error ? error.message : 'Unable to update applicant status.'),
      );
    }

    setApplications((prev) =>
      prev.map((app) => {
        if (status === 'Interview Scheduled') {
          return {
            ...app,
            status: 'Interview Scheduled',
            interviewDate: 'Tue, Aug 12 • 2:00 PM',
            notes: 'Interview scheduled with hiring team.',
          };
        }
        if (status === 'Shortlisted') {
          return { ...app, status: 'Under Review' };
        }
        return app;
      })
    );
  };

  const handleSendMessage = (conversationId: string, text: string, attachment?: { name: string; url: string; type: 'image' | 'file' }) => {
    const newMsg: ChatMessage = {
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
        setBackendError(error instanceof Error ? error.message : 'Unable to send message.');
      });
    }
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
        setBackendError(error instanceof Error ? error.message : 'Unable to start conversation.');
      });
    }
    return newConvId;
  };

  const handleProfileUpdate = (updatedProfile: UserProfile) => {
    setUserProfile(updatedProfile);
    if (currentUserId) {
      void saveProfile(currentUserId, updatedProfile).catch((error) =>
        setBackendError(error instanceof Error ? error.message : 'Unable to save profile.'),
      );
    }
  };

  const handleAvatarUpdate = (avatarUrl: string | undefined) => {
    const updatedProfile = { ...userProfile, avatarUrl };
    setUserProfile(updatedProfile);
    if (currentUserId) {
      void saveProfile(currentUserId, updatedProfile).catch((error) =>
        setBackendError(error instanceof Error ? error.message : 'Unable to save profile photo.'),
      );
    }
  };

  const handleRecoveredPasswordUpdate = async (password: string) => {
    if (passwordRecoveryState !== 'valid') {
      throw new Error('This password reset link is invalid or expired. Request a new reset email.');
    }
    await authBackend.updatePassword(password);
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  const exitPasswordRecovery = async (target: 'login' | 'forgot_password') => {
    try {
      await authBackend.signOut();
    } finally {
      setPasswordRecoveryState('idle');
      window.history.replaceState({}, document.title, window.location.pathname);
      setScreen(target);
    }
  };

  const handleLogout = () => {
    if (currentUserId) {
      void authBackend.signOut().catch((error) =>
        setBackendError(error instanceof Error ? error.message : 'Unable to sign out.'),
      );
    } else {
      setScreen('welcome');
    }
  };

  if (isBackendLoading) {
    return (
      <div className="min-h-screen bg-[#fdf8f8] flex items-center justify-center text-[#8e004b]">
        <div className="text-center space-y-3">
          <div className="mx-auto h-9 w-9 rounded-full border-4 border-[#ffd9e2] border-t-[#e2007c] animate-spin" />
          <p className="text-sm font-semibold">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdf8f8] font-sans antialiased">
      {backendError && (
        <div role="alert" className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] w-[min(92vw,560px)] rounded-xl border border-rose-200 bg-white px-4 py-3 shadow-xl flex items-start gap-3">
          <p className="flex-1 text-xs font-semibold text-rose-700">{backendError}</p>
          <button type="button" onClick={() => setBackendError(null)} className="text-xs font-bold text-rose-700 hover:underline">
            Dismiss
          </button>
        </div>
      )}

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
        />
      )}

      {/* SCREEN 4: EMPLOYER SIGNUP */}
      {screen === 'employer_signup' && (
        <EmployerSignupScreen
          onSubmit={handleEmployerSignup}
          onBack={() => setScreen('role_select')}
          onLogin={() => setScreen('login')}
        />
      )}

      {/* SCREEN 5: LOGIN */}
      {screen === 'login' && (
        <LoginScreen
          onLoginSuccess={handleLoginSuccess}
          onSocialLogin={handleSocialLogin}
          onSignUp={() => setScreen('role_select')}
          onForgotPassword={() => {
            setPasswordRecoveryState('idle');
            setScreen('forgot_password');
          }}
        />
      )}

      {/* SCREEN 6 & 07: EMAIL VERIFICATION */}
      {screen === 'otp_verify' && (
        <OtpVerifyScreen
          email={userProfile.email}
          onCheckVerified={handleEmailVerificationCheck}
          onResend={() => authBackend.resendSignupVerification(userProfile.email)}
          onBack={() => setScreen('login')}
          onChangeContact={() => setScreen(userRole === 'seeker' ? 'seeker_signup' : 'employer_signup')}
        />
      )}

      {/* SCREEN 08: FORGOT PASSWORD */}
      {screen === 'forgot_password' && (
        <ForgotPasswordScreen
          onBackToLogin={() => setScreen('login')}
          onSendResetLink={(email) => authBackend.sendPasswordReset(email)}
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
            avatarUrl: userProfile.avatarUrl,
          }}
          onBack={() => setScreen('otp_verify')}
          onNext={(stepData) => {
            handleProfileUpdate({
              ...userProfile,
              name: stepData.fullName || userProfile.name,
              email: stepData.email || userProfile.email,
              phone: stepData.mobile || userProfile.phone,
              avatarUrl: stepData.avatarUrl || userProfile.avatarUrl,
            });
            setScreen('seeker_onboarding_step2');
          }}
        />
      )}

      {/* SCREEN 11: JOB SEEKER ONBOARDING STEP 2 */}
      {screen === 'seeker_onboarding_step2' && (
        <SeekerOnboardingStep2Screen
          initialRoles={userProfile.primaryRole ? [userProfile.primaryRole] : ['Makeup Artist', 'Skin Therapist']}
          onBack={() => setScreen('seeker_onboarding_step1')}
          onNext={async (selectedRoles) => {
            const updatedProfile = selectedRoles.length > 0
              ? {
                  ...userProfile,
                  primaryRole: selectedRoles[0],
                  specialties: Array.from(new Set([selectedRoles[0], ...(userProfile.specialties || [])])),
                }
              : userProfile;
            handleProfileUpdate(updatedProfile);
            try {
              if (currentUserId) await completeSeekerOnboarding(updatedProfile, selectedRoles);
              setScreen('main_app');
            } catch (error) {
              setBackendError(error instanceof Error ? error.message : 'Unable to complete onboarding.');
            }
          }}
        />
      )}

      {/* SCREEN 12: EMPLOYER ONBOARDING STEP 1 */}
      {screen === 'employer_onboarding_step1' && (
        <EmployerOnboardingStep1Screen
          contactName={userProfile.contactPerson || userProfile.name}
          onBack={() => setScreen('otp_verify')}
          onContinue={async (businessData) => {
            try {
              if (currentUserId) await completeEmployerOnboarding(businessData);
              handleProfileUpdate({ ...userProfile, businessName: businessData.businessName });
              setScreen('employer_onboarding_step2');
            } catch (error) {
              setBackendError(error instanceof Error ? error.message : 'Unable to complete business setup.');
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
              onSendMessage={handleSendMessage}
              onStartConversation={handleStartConversation}
              onUpdateAvatar={handleAvatarUpdate}
              onUpdateProfile={handleProfileUpdate}
              onMarkAlertRead={handleMarkAlertRead}
              onMarkAllAlertsRead={handleMarkAllAlertsRead}
              onClearAlert={handleClearAlert}
              onNavigateScreen={(target) => setScreen(target)}
              onLogout={handleLogout}
              onStartApplyJob={(job) => {
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
            />
          ) : (
            <EmployerWorkspace
              jobs={jobs}
              applicants={applicants}
              conversations={conversations}
              messages={messages}
              userProfile={userProfile}
              onAddJob={handleAddJob}
              onUpdateApplicantStatus={handleUpdateApplicantStatus}
              onSendMessage={handleSendMessage}
              onStartConversation={handleStartConversation}
              onUpdateAvatar={handleAvatarUpdate}
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
          onUpdateApplicationStatus={(appId, status, notes) => {
            setApplications((prev) =>
              prev.map((app) => (app.id === appId ? { ...app, status, notes } : app))
            );
          }}
          onBack={() => {
            setSeekerInitialTab('applications');
            setScreen('main_app');
          }}
          onNavigateTab={(tab) => {
            setSeekerInitialTab(tab);
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
          onUpdateApplicationStatus={(appId, status, notes) => {
            setApplications((prev) =>
              prev.map((app) => (app.id === appId ? { ...app, status, notes } : app))
            );
          }}
          onBack={() => {
            setSeekerInitialTab('applications');
            setScreen('main_app');
          }}
          onNavigateTab={(tab) => {
            setSeekerInitialTab(tab);
            setScreen('main_app');
          }}
        />
      )}

      {/* SCREEN 32 — SUPPORT */}
      {screen === 'support' && (
        <SupportScreen
          onBack={() => setScreen('main_app')}
          onNavigateTab={(tab) => {
            setSeekerInitialTab(tab);
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
            setSeekerInitialTab(tab);
            setScreen('main_app');
          }}
        />
      )}
    </div>
  );
}

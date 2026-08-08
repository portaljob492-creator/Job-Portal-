import React, { useState } from 'react';
import { ScreenState, UserRole, JobPosting, Application, Applicant, UserProfile, Conversation, ChatMessage, JobAlertNotification } from './types';
import { INITIAL_JOBS, INITIAL_APPLICATIONS, INITIAL_APPLICANTS, INITIAL_CONVERSATIONS, INITIAL_MESSAGES, INITIAL_PORTFOLIO_ITEMS, INITIAL_SAVED_FILTERS, INITIAL_JOB_ALERTS } from './data/mockData';
import { processNewJobForAlerts } from './utils/jobAlertMatcher';

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
import { EmployerWorkspace } from './components/employer/EmployerWorkspace';
import { NavigationToolbar } from './components/NavigationToolbar';

export default function App() {
  const [screen, setScreen] = useState<ScreenState>('welcome');
  const [userRole, setUserRole] = useState<UserRole>('seeker');

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

  // Handlers
  const handleSelectRole = (role: UserRole) => {
    setUserRole(role);
    if (role === 'seeker') {
      setScreen('seeker_signup');
    } else {
      setScreen('employer_signup');
    }
  };

  const handleSeekerSignup = (formData: { name: string; email: string; phone: string }) => {
    setUserRole('seeker');
    setUserProfile((prev) => ({
      ...prev,
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      role: 'seeker',
    }));
    setScreen('otp_verify');
  };

  const handleEmployerSignup = (formData: { businessName: string; contactPerson: string; email: string }) => {
    setUserRole('employer');
    setUserProfile((prev) => ({
      ...prev,
      name: formData.contactPerson,
      email: formData.email,
      businessName: formData.businessName,
      contactPerson: formData.contactPerson,
      role: 'employer',
    }));
    setScreen('otp_verify');
  };

  const handleLoginSuccess = (role: UserRole) => {
    setUserRole(role);
    setUserProfile((prev) => ({ ...prev, role }));
    setScreen('main_app');
  };

  const handleOtpVerified = () => {
    if (userRole === 'seeker') {
      setScreen('seeker_onboarding_step1');
    } else {
      setScreen('main_app');
    }
  };

  const handleToggleBookmark = (jobId: string) => {
    setJobs((prevJobs) =>
      prevJobs.map((j) => (j.id === jobId ? { ...j, isBookmarked: !j.isBookmarked } : j))
    );
  };

  const handleApplyJob = (job: JobPosting, coverNote: string) => {
    // Add to Seeker applications
    const newApp: Application = {
      id: `app-${Date.now()}`,
      jobId: job.id,
      jobTitle: job.title,
      salonName: job.salonName,
      salonLogo: job.salonLogo,
      location: job.location,
      appliedDate: 'Just now',
      status: 'Submitted',
      notes: 'Application received and under review by salon team.',
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
    };

    setApplicants((prev) => [newApplicant, ...prev]);
  };

  const handleAddJob = (newJob: JobPosting) => {
    setJobs((prev) => [newJob, ...prev]);

    // Push notification alert engine: Check matches against user's saved search filters
    const matchedAlerts = processNewJobForAlerts(newJob, userProfile.savedFilters || INITIAL_SAVED_FILTERS);
    if (matchedAlerts.length > 0) {
      setJobAlerts((prev) => [...matchedAlerts, ...prev]);
    }
  };

  const handleMarkAlertRead = (alertId: string) => {
    setJobAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, isRead: true } : a))
    );
  };

  const handleMarkAllAlertsRead = () => {
    setJobAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
  };

  const handleClearAlert = (alertId: string) => {
    setJobAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  const handleUpdateApplicantStatus = (applicantId: string, status: Applicant['status']) => {
    setApplicants((prev) =>
      prev.map((a) => (a.id === applicantId ? { ...a, status } : a))
    );

    // Also sync Seeker applications if matching
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
      id: `msg-${Date.now()}`,
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

    const newConvId = `conv-${Date.now()}`;
    const newConv: Conversation = {
      id: newConvId,
      jobId,
      jobTitle: job?.title || 'Beauty Position',
      salonName: targetSalonName || job?.salonName || 'Beauty Group',
      salonLogo: job?.salonLogo,
      seekerName: targetSeekerName || userProfile.name,
      seekerEmail: userProfile.email,
      employerName: `${job?.salonName || 'Salon'} Director`,
      lastMessage: 'Conversation started',
      lastMessageTime: 'Just now',
      unreadCountSeeker: 0,
      unreadCountEmployer: 0,
      status: 'Inquiry'
    };

    setConversations((prev) => [newConv, ...prev]);
    return newConvId;
  };

  const handleQuickDemo = (role: UserRole) => {
    setUserRole(role);
    setUserProfile((prev) => ({ ...prev, role }));
    setScreen('main_app');
  };

  const handleNavigateToolbar = (targetScreen: ScreenState, role?: UserRole) => {
    if (role) {
      setUserRole(role);
      setUserProfile((prev) => ({ ...prev, role }));
    }
    setScreen(targetScreen);
  };

  return (
    <div className="min-h-screen bg-[#fdf8f8] font-sans antialiased">
      {/* SCREEN 1: WELCOME */}
      {screen === 'welcome' && (
        <WelcomeScreen
          onGetStarted={() => setScreen('role_select')}
          onLogin={() => setScreen('login')}
          onQuickDemo={handleQuickDemo}
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
          onSignUp={() => setScreen('role_select')}
          onForgotPassword={() => setScreen('forgot_password')}
        />
      )}

      {/* SCREEN 6 & 07: OTP VERIFICATION */}
      {screen === 'otp_verify' && (
        <OtpVerifyScreen
          email={userProfile.email}
          phone="(555) 000-1234"
          onVerify={handleOtpVerified}
          onBack={() => setScreen('login')}
          onChangeContact={() => setScreen('seeker_signup')}
        />
      )}

      {/* SCREEN 08: FORGOT PASSWORD */}
      {screen === 'forgot_password' && (
        <ForgotPasswordScreen
          onBackToLogin={() => setScreen('login')}
          onNavigateToResetPassword={() => setScreen('reset_password')}
        />
      )}

      {/* SCREEN 09: RESET PASSWORD */}
      {screen === 'reset_password' && (
        <ResetPasswordScreen
          onBackToLogin={() => setScreen('login')}
          onSuccessLogin={() => setScreen('login')}
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
            setUserProfile((prev) => ({
              ...prev,
              name: stepData.fullName || prev.name,
              email: stepData.email || prev.email,
              phone: stepData.mobile || prev.phone,
              avatarUrl: stepData.avatarUrl || prev.avatarUrl,
            }));
            setScreen('seeker_onboarding_step2');
          }}
        />
      )}

      {/* SCREEN 11: JOB SEEKER ONBOARDING STEP 2 */}
      {screen === 'seeker_onboarding_step2' && (
        <SeekerOnboardingStep2Screen
          initialRoles={userProfile.primaryRole ? [userProfile.primaryRole] : ['Makeup Artist', 'Skin Therapist']}
          onBack={() => setScreen('seeker_onboarding_step1')}
          onNext={(selectedRoles) => {
            if (selectedRoles.length > 0) {
              setUserProfile((prev) => ({
                ...prev,
                primaryRole: selectedRoles[0],
              }));
            }
            setScreen('main_app');
          }}
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
              onUpdateAvatar={(url) => setUserProfile((prev) => ({ ...prev, avatarUrl: url }))}
              onMarkAlertRead={handleMarkAlertRead}
              onMarkAllAlertsRead={handleMarkAllAlertsRead}
              onClearAlert={handleClearAlert}
              onSwitchRole={() => {
                setUserRole('employer');
                setUserProfile((prev) => ({ ...prev, role: 'employer' }));
              }}
              onLogout={() => setScreen('welcome')}
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
              onUpdateAvatar={(url) => setUserProfile((prev) => ({ ...prev, avatarUrl: url }))}
              onSwitchRole={() => {
                setUserRole('seeker');
                setUserProfile((prev) => ({ ...prev, role: 'seeker' }));
              }}
              onLogout={() => setScreen('welcome')}
            />
          )}
        </>
      )}

      {/* Floating Toolbar to preview any screen easily */}
      <NavigationToolbar
        currentScreen={screen}
        currentRole={userRole}
        onNavigate={handleNavigateToolbar}
      />
    </div>
  );
}

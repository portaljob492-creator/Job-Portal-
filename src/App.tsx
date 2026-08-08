import React, { useState } from 'react';
import { ScreenState, UserRole, JobPosting, Application, Applicant, UserProfile } from './types';
import { INITIAL_JOBS, INITIAL_APPLICATIONS, INITIAL_APPLICANTS } from './data/mockData';

// Component imports
import { WelcomeScreen } from './components/auth/WelcomeScreen';
import { RoleSelectionScreen } from './components/auth/RoleSelectionScreen';
import { JobSeekerSignupScreen } from './components/auth/JobSeekerSignupScreen';
import { EmployerSignupScreen } from './components/auth/EmployerSignupScreen';
import { LoginScreen } from './components/auth/LoginScreen';
import { OtpVerifyScreen } from './components/auth/OtpVerifyScreen';
import { ForgotPasswordScreen } from './components/auth/ForgotPasswordScreen';
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

  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '(555) 000-0000',
    role: 'seeker',
    businessName: 'Nexora Beauty Group',
    contactPerson: 'Sarah Jenkins',
    licenseNumber: 'CA-COS-889124',
    specialties: ['Balayage', 'Color Specialist', 'Facials'],
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
    setScreen('main_app');
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

      {/* SCREEN 6: OTP VERIFY */}
      {screen === 'otp_verify' && (
        <OtpVerifyScreen
          email={userProfile.email}
          onVerify={handleOtpVerified}
          onBack={() => setScreen('login')}
        />
      )}

      {/* SCREEN 7: FORGOT PASSWORD */}
      {screen === 'forgot_password' && (
        <ForgotPasswordScreen onBackToLogin={() => setScreen('login')} />
      )}

      {/* SCREEN 8: MAIN WORKSPACE */}
      {screen === 'main_app' && (
        <>
          {userRole === 'seeker' ? (
            <JobSeekerWorkspace
              jobs={jobs}
              applications={applications}
              userProfile={userProfile}
              onToggleBookmark={handleToggleBookmark}
              onApplyJob={handleApplyJob}
              onUpdateAvatar={(url) => setUserProfile((prev) => ({ ...prev, avatarUrl: url }))}
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
              userProfile={userProfile}
              onAddJob={handleAddJob}
              onUpdateApplicantStatus={handleUpdateApplicantStatus}
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

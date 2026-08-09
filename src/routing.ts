import type { ScreenState, UserRole } from './types';

export type SeekerTab = 'feed' | 'applications' | 'saved' | 'messages' | 'portfolio' | 'profile';
export interface JobPortalRoute {
  screen: ScreenState;
  protected: boolean;
  seekerTab?: SeekerTab;
  requiredRole?: UserRole;
}

export const JOB_PORTAL_BASE = import.meta.env.BASE_URL.replace(/\/$/, '') || '';
export const jobPortalPath = (suffix = '') => `${JOB_PORTAL_BASE}/${suffix.replace(/^\/+/, '')}`.replace(/\/$/, '') || '/';

export function resolveJobPortalRoute(pathname = window.location.pathname): JobPortalRoute {
  const base = JOB_PORTAL_BASE;
  let relative = pathname;
  if (base && relative.startsWith(base)) relative = relative.slice(base.length);
  relative = `/${relative.replace(/^\/+|\/+$/g, '')}`;
  if (relative === '/') return { screen: 'welcome', protected: false };
  if (relative === '/login') return { screen: 'login', protected: false };
  if (relative === '/signup') return { screen: 'role_select', protected: false };
  if (relative.startsWith('/signup/seeker')) return { screen: 'seeker_signup', protected: false };
  if (relative.startsWith('/signup/employer')) return { screen: 'employer_signup', protected: false };
  if (relative === '/forgot-password') return { screen: 'forgot_password', protected: false };
  if (relative === '/reset-password') return { screen: 'reset_password', protected: false };
  if (relative.startsWith('/dashboard/seeker')) return { screen: 'main_app', protected: true, requiredRole: 'seeker', seekerTab: 'feed' };
  if (relative.startsWith('/dashboard/employer')) return { screen: 'main_app', protected: true, requiredRole: 'employer' };
  if (relative.startsWith('/employer')) return { screen: 'main_app', protected: true, requiredRole: 'employer' };
  if (relative.startsWith('/profile')) return { screen: 'main_app', protected: true, requiredRole: 'seeker', seekerTab: 'profile' };
  if (relative.startsWith('/applications')) return { screen: 'main_app', protected: true, requiredRole: 'seeker', seekerTab: 'applications' };
  if (relative.startsWith('/messages')) return { screen: 'main_app', protected: true, seekerTab: 'messages' };
  if (relative.startsWith('/saved')) return { screen: 'main_app', protected: true, requiredRole: 'seeker', seekerTab: 'saved' };
  if (relative.startsWith('/portfolio')) return { screen: 'main_app', protected: true, requiredRole: 'seeker', seekerTab: 'portfolio' };
  if (relative.startsWith('/interviews')) return { screen: 'interview_invitation', protected: true };
  if (relative.startsWith('/offers')) return { screen: 'job_offer', protected: true };
  if (relative.startsWith('/support')) return { screen: 'support', protected: true };
  if (relative.startsWith('/settings')) return { screen: 'settings', protected: true };
  if (relative.startsWith('/jobs/apply')) return { screen: 'apply_job', protected: true, requiredRole: 'seeker', seekerTab: 'feed' };
  if (relative.startsWith('/jobs')) return { screen: 'main_app', protected: true, requiredRole: 'seeker', seekerTab: 'feed' };
  if (relative.startsWith('/admin/jobs')) return { screen: 'admin_jobs', protected: true, requiredRole: 'admin' };
  if (relative.startsWith('/admin')) return { screen: 'admin_login', protected: false, requiredRole: 'admin' };
  return { screen: 'welcome', protected: false };
}

export function pathForScreen(screen: ScreenState, role: UserRole, seekerTab?: SeekerTab) {
  if (screen === 'welcome') return jobPortalPath();
  if (screen === 'role_select') return jobPortalPath('signup');
  if (screen === 'seeker_signup') return jobPortalPath('signup/seeker');
  if (screen === 'employer_signup') return jobPortalPath('signup/employer');
  if (screen === 'login') return jobPortalPath('login');
  if (screen === 'forgot_password') return jobPortalPath('forgot-password');
  if (screen === 'reset_password') return jobPortalPath('reset-password');
  if (screen === 'apply_job') return jobPortalPath('jobs/apply');
  if (screen === 'interview_invitation') return jobPortalPath('interviews');
  if (screen === 'job_offer') return jobPortalPath('offers');
  if (screen === 'support') return jobPortalPath('support');
  if (screen === 'settings') return jobPortalPath('settings');
  if (screen === 'admin_login') return jobPortalPath('admin');
  if (screen === 'admin_jobs') return jobPortalPath('admin/jobs');
  if (screen === 'main_app') {
    if (role === 'employer') return jobPortalPath('dashboard/employer');
    const tabPaths: Record<SeekerTab, string> = {
      feed: 'dashboard/seeker', applications: 'applications', saved: 'saved', messages: 'messages', portfolio: 'portfolio', profile: 'profile',
    };
    return jobPortalPath(tabPaths[seekerTab || 'feed']);
  }
  return jobPortalPath();
}

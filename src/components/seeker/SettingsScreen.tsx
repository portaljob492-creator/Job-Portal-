import React, { useState } from 'react';
import { 
  ArrowLeft, 
  User, 
  Bell, 
  Shield, 
  Globe, 
  Key, 
  Ban, 
  FileText, 
  Lock, 
  UserX, 
  LogOut, 
  Check, 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  Info,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';

interface SettingsScreenProps {
  onBack: () => void;
  onLogout: () => void;
  onNavigateTab?: (tab: 'feed' | 'applications' | 'saved' | 'messages' | 'portfolio' | 'profile') => void;
}

interface BlockedEmployer {
  id: string;
  name: string;
  location: string;
  dateBlocked: string;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onBack,
  onLogout,
  onNavigateTab,
}) => {
  // Navigation / Active View State ('account' | 'notifications' | 'privacy' | 'language' | 'password' | 'blocked' | 'terms' | 'policy' | null)
  const [activeSection, setActiveSection] = useState<
    'account' | 'notifications' | 'privacy' | 'language' | 'password' | 'blocked' | 'terms' | 'policy' | null
  >(null);

  // Account Settings state
  const [fullName, setFullName] = useState('Jane Doe');
  const [email, setEmail] = useState('jane.doe@example.com');
  const [phone, setPhone] = useState('(555) 342-9988');
  const [licenseNumber, setLicenseNumber] = useState('CA-COS-889124');
  const [contactMethod, setContactMethod] = useState<'email' | 'phone' | 'both'>('both');

  // Notifications toggles
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [pushInterviews, setPushInterviews] = useState(true);
  const [smsMessages, setSmsMessages] = useState(true);
  const [newsletter, setNewsletter] = useState(false);

  // Privacy toggles
  const [profileVisibility, setProfileVisibility] = useState<'public' | 'applied_only' | 'private'>('applied_only');
  const [resumeDownloadable, setResumeDownloadable] = useState(true);
  const [anonymizeAnalytics, setAnonymizeAnalytics] = useState(false);

  // Language selection
  const [language, setLanguage] = useState('en');

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Blocked employers list
  const [blockedEmployers, setBlockedEmployers] = useState<BlockedEmployer[]>([
    { id: 'be-1', name: 'Velvet Hair Salon', location: 'Los Angeles, CA', dateBlocked: 'June 14, 2026' },
    { id: 'be-2', name: 'Elite Nails Spa', location: 'Santa Monica, CA', dateBlocked: 'July 02, 2026' },
    { id: 'be-3', name: 'Glow Esthetics Group', location: 'Beverly Hills, CA', dateBlocked: 'July 28, 2026' },
  ]);

  // Modals / Confirmation dialogues
  const [employerToUnblock, setEmployerToUnblock] = useState<BlockedEmployer | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  
  // Feedback System
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    triggerToast('✅ Account changes saved successfully.');
    setActiveSection(null);
  };

  const handleUpdateNotifications = (key: string, value: boolean) => {
    if (key === 'email') setEmailAlerts(value);
    if (key === 'push') setPushInterviews(value);
    if (key === 'sms') setSmsMessages(value);
    if (key === 'newsletter') setNewsletter(value);
    triggerToast('🔔 Notification preferences updated.');
  };

  const handleUpdatePrivacy = (key: string, value: any) => {
    if (key === 'visibility') setProfileVisibility(value);
    if (key === 'resume') setResumeDownloadable(value);
    if (key === 'analytics') setAnonymizeAnalytics(value);
    triggerToast('🔒 Privacy configurations saved.');
  };

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    triggerToast(`🌐 Language changed to ${
      lang === 'en' ? 'English' : 
      lang === 'es' ? 'Español' : 
      lang === 'vi' ? 'Tiếng Việt' : 
      lang === 'tg' ? 'Tagalog' : 
      lang === 'fr' ? 'Français' : 'Deutsch'
    }.`);
    setActiveSection(null);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      triggerToast('⚠️ Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      triggerToast('⚠️ New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      triggerToast('⚠️ New passwords do not match.');
      return;
    }
    triggerToast('🔑 Password changed successfully.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setActiveSection(null);
  };

  const handleUnblockEmployer = (employer: BlockedEmployer) => {
    setBlockedEmployers(prev => prev.filter(emp => emp.id !== employer.id));
    setEmployerToUnblock(null);
    triggerToast(`🔓 Unblocked ${employer.name}.`);
  };

  const handleDeleteAccount = () => {
    if (deleteConfirmationText !== 'DELETE') {
      triggerToast('⚠️ Verification mismatch. Please type DELETE.');
      return;
    }
    triggerToast('🛑 Account scheduled for deletion.');
    setShowDeleteModal(false);
    setTimeout(() => {
      onLogout();
    }, 1500);
  };

  const getLanguageName = (code: string) => {
    switch (code) {
      case 'en': return 'English';
      case 'es': return 'Español';
      case 'vi': return 'Tiếng Việt';
      case 'tg': return 'Tagalog';
      case 'fr': return 'Français';
      case 'de': return 'Deutsch';
      default: return 'English';
    }
  };

  const handleHeaderBack = () => {
    if (activeSection !== null) {
      setActiveSection(null);
    } else {
      onBack();
    }
  };

  return (
    <div className="min-h-screen bg-[#fdf8f8] text-[#1c1b1b] relative select-none font-body-md pb-[100px]">
      
      {/* TopAppBar */}
      <header className="sticky top-0 bg-[#fdf8f8] border-b border-[#e0bec6]/30 px-margin-side h-16 w-full flex justify-between items-center z-50">
        <button 
          onClick={handleHeaderBack}
          className="text-on-surface hover:bg-[#ece7e7] transition-colors active:scale-95 duration-100 p-2 rounded-full flex items-center justify-center -ml-2 cursor-pointer"
          aria-label="Go back"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-screen-title text-xl font-bold text-[#8e004b] absolute left-1/2 -translate-x-1/2">
          {activeSection === 'account' && 'Account Settings'}
          {activeSection === 'notifications' && 'Notifications'}
          {activeSection === 'privacy' && 'Privacy Settings'}
          {activeSection === 'language' && 'Language Preference'}
          {activeSection === 'password' && 'Change Password'}
          {activeSection === 'blocked' && 'Blocked Employers'}
          {activeSection === 'terms' && 'Terms & Conditions'}
          {activeSection === 'policy' && 'Privacy Policy'}
          {activeSection === null && 'Settings'}
        </h1>
        <div className="w-10"></div> {/* Spacer for symmetry */}
      </header>

      {/* Main Content Canvas */}
      <main className="w-full max-w-2xl mx-auto px-margin-side pt-8 flex flex-col gap-8">
        
        {/* ==============================================
            MAIN CATEGORIES LIST (rendered if activeSection is null)
            ============================================== */}
        {activeSection === null && (
          <div className="space-y-8 animate-in fade-in duration-200">
            
            {/* General Section */}
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-bold text-primary uppercase tracking-wider px-2">General</h2>
              <div className="bg-white rounded-2xl border border-outline-variant shadow-[0_4px_12px_rgba(90,63,71,0.05)] overflow-hidden">
                
                {/* Account row */}
                <button 
                  onClick={() => setActiveSection('account')}
                  className="w-full flex items-center justify-between p-4 hover:bg-[#f7f2f2] transition-colors active:bg-[#f1edec] border-b border-[#e0bec6]/30 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#ece7e7] flex items-center justify-center text-[#8e004b]">
                      <span className="material-symbols-outlined">person</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-[#1c1b1b]">Account</p>
                      <p className="text-[11px] text-[#594047] font-medium">Personal info & details</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[#8c7077]">chevron_right</span>
                </button>

                {/* Notifications row */}
                <button 
                  onClick={() => setActiveSection('notifications')}
                  className="w-full flex items-center justify-between p-4 hover:bg-[#f7f2f2] transition-colors active:bg-[#f1edec] border-b border-[#e0bec6]/30 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#ece7e7] flex items-center justify-center text-[#8e004b]">
                      <span className="material-symbols-outlined">notifications</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-[#1c1b1b]">Notifications</p>
                      <p className="text-[11px] text-[#594047] font-medium">Push & email alerts</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[#8c7077]">chevron_right</span>
                </button>

                {/* Language row */}
                <button 
                  onClick={() => setActiveSection('language')}
                  className="w-full flex items-center justify-between p-4 hover:bg-[#f7f2f2] transition-colors active:bg-[#f1edec] text-left cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#ece7e7] flex items-center justify-center text-[#8e004b]">
                      <span className="material-symbols-outlined">language</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-[#1c1b1b]">Language</p>
                      <p className="text-[11px] text-[#594047] font-medium">{getLanguageName(language)}</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[#8c7077]">chevron_right</span>
                </button>

              </div>
            </section>

            {/* Security & Privacy Section */}
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-bold text-primary uppercase tracking-wider px-2">Security & Privacy</h2>
              <div className="bg-white rounded-2xl border border-outline-variant shadow-[0_4px_12px_rgba(90,63,71,0.05)] overflow-hidden">
                
                {/* Change Password row */}
                <button 
                  onClick={() => setActiveSection('password')}
                  className="w-full flex items-center justify-between p-4 hover:bg-[#f7f2f2] transition-colors active:bg-[#f1edec] border-b border-[#e0bec6]/30 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#ece7e7] flex items-center justify-center text-[#8e004b]">
                      <span className="material-symbols-outlined">lock</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-[#1c1b1b]">Change Password</p>
                      <p className="text-[11px] text-[#594047] font-medium">Update credentials securely</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[#8c7077]">chevron_right</span>
                </button>

                {/* Privacy row */}
                <button 
                  onClick={() => setActiveSection('privacy')}
                  className="w-full flex items-center justify-between p-4 hover:bg-[#f7f2f2] transition-colors active:bg-[#f1edec] border-b border-[#e0bec6]/30 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#ece7e7] flex items-center justify-center text-[#8e004b]">
                      <span className="material-symbols-outlined">visibility</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-[#1c1b1b]">Privacy</p>
                      <p className="text-[11px] text-[#594047] font-medium">Profile visibility & sharing</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[#8c7077]">chevron_right</span>
                </button>

                {/* Blocked Employers row */}
                <button 
                  onClick={() => setActiveSection('blocked')}
                  className="w-full flex items-center justify-between p-4 hover:bg-[#f7f2f2] transition-colors active:bg-[#f1edec] text-left cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#ece7e7] flex items-center justify-center text-[#8e004b]">
                      <span className="material-symbols-outlined">block</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-[#1c1b1b]">Blocked Employers</p>
                      <p className="text-[11px] text-[#594047] font-medium">Hidden profiles</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[#8c7077]">chevron_right</span>
                </button>

              </div>
            </section>

            {/* Legal Section */}
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-bold text-primary uppercase tracking-wider px-2">Legal</h2>
              <div className="bg-white rounded-2xl border border-outline-variant shadow-[0_4px_12px_rgba(90,63,71,0.05)] overflow-hidden">
                
                {/* Terms & Conditions row */}
                <button 
                  onClick={() => setActiveSection('terms')}
                  className="w-full flex items-center justify-between p-4 hover:bg-[#f7f2f2] transition-colors active:bg-[#f1edec] border-b border-[#e0bec6]/30 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#ece7e7] flex items-center justify-center text-[#8e004b]">
                      <span className="material-symbols-outlined">description</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-[#1c1b1b]">Terms & Conditions</p>
                      <p className="text-[11px] text-[#594047] font-medium">Read user agreement terms</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[#8c7077]">chevron_right</span>
                </button>

                {/* Privacy Policy row */}
                <button 
                  onClick={() => setActiveSection('policy')}
                  className="w-full flex items-center justify-between p-4 hover:bg-[#f7f2f2] transition-colors active:bg-[#f1edec] text-left cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#ece7e7] flex items-center justify-center text-[#8e004b]">
                      <span className="material-symbols-outlined">policy</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-[#1c1b1b]">Privacy Policy</p>
                      <p className="text-[11px] text-[#594047] font-medium">Read privacy statements</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[#8c7077]">chevron_right</span>
                </button>

              </div>
            </section>

            {/* Danger Zone Section */}
            <section className="flex flex-col gap-3 mt-4">
              <button 
                onClick={() => setShowLogoutModal(true)}
                className="w-full h-12 flex items-center justify-center gap-2 bg-white border border-[#e0bec6] text-[#1c1b1b] font-semibold text-sm rounded-full hover:bg-[#f7f2f2] active:scale-[0.98] transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[#594047]">logout</span>
                Log Out
              </button>
              
              <button 
                onClick={() => setShowDeleteModal(true)}
                className="w-full h-12 flex items-center justify-center gap-2 bg-[#ffdad6] text-[#ba1a1a] font-semibold text-sm rounded-full hover:bg-rose-100 active:scale-[0.98] transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined">delete_forever</span>
                Delete Account
              </button>
            </section>

          </div>
        )}

        {/* ==============================================
            1. ACCOUNT SECTION DETAIL
            ============================================== */}
        {activeSection === 'account' && (
          <div className="bg-white p-6 rounded-2xl border border-[#e0bec6]/40 shadow-xs animate-in slide-in-from-right duration-200">
            <div className="border-b border-[#e0bec6]/25 pb-4 mb-6">
              <h2 className="text-base font-bold text-[#1c1b1b] flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary">person</span>
                <span>Account Information</span>
              </h2>
              <p className="text-xs text-[#594047] mt-1 font-medium">Review and update your primary communication credentials and licensure details.</p>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#1c1b1b]">Full Name</label>
                  <input 
                    type="text" 
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-[#f1edec]/75 border-transparent focus:border-[#8e004b] focus:bg-white focus:ring-1 focus:ring-[#8e004b] rounded-xl py-3.5 px-4 text-xs font-semibold text-[#1c1b1b] outline-none transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#1c1b1b]">Email Address</label>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#f1edec]/75 border-transparent focus:border-[#8e004b] focus:bg-white focus:ring-1 focus:ring-[#8e004b] rounded-xl py-3.5 px-4 text-xs font-semibold text-[#1c1b1b] outline-none transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#1c1b1b]">Mobile Number</label>
                  <input 
                    type="text" 
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-[#f1edec]/75 border-transparent focus:border-[#8e004b] focus:bg-white focus:ring-1 focus:ring-[#8e004b] rounded-xl py-3.5 px-4 text-xs font-semibold text-[#1c1b1b] outline-none transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#1c1b1b]">Cosmetology License No.</label>
                  <input 
                    type="text" 
                    required
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    className="w-full bg-[#f1edec]/75 border-transparent focus:border-[#8e004b] focus:bg-white focus:ring-1 focus:ring-[#8e004b] rounded-xl py-3.5 px-4 text-xs font-semibold text-[#1c1b1b] outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#1c1b1b]">Preferred Contact Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['email', 'phone', 'both'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setContactMethod(method)}
                      className={`py-3 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        contactMethod === method 
                          ? 'bg-[#ffd9e2] text-[#8e004b] border-[#8e004b] shadow-2xs' 
                          : 'border-[#e0bec6] bg-transparent text-[#594047] hover:bg-[#ffd9e2]/10'
                      }`}
                    >
                      {method === 'email' ? 'Email Only' : method === 'phone' ? 'Phone Only' : 'Both'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-[#e0bec6]/25 flex gap-3">
                <button
                  type="button"
                  onClick={() => setActiveSection(null)}
                  className="flex-1 py-3 border border-[#e0bec6] hover:bg-[#f7f2f2] font-bold text-xs text-[#594047] rounded-full transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#b90064] text-white font-bold text-xs rounded-full hover:bg-[#8e004b] transition-all cursor-pointer text-center shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ==============================================
            2. NOTIFICATIONS SECTION DETAIL
            ============================================== */}
        {activeSection === 'notifications' && (
          <div className="bg-white p-6 rounded-2xl border border-[#e0bec6]/40 shadow-xs animate-in slide-in-from-right duration-200 space-y-6">
            <div className="border-b border-[#e0bec6]/25 pb-4">
              <h2 className="text-base font-bold text-[#1c1b1b] flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary">notifications</span>
                <span>Notification Preferences</span>
              </h2>
              <p className="text-xs text-[#594047] mt-1 font-medium">Configure how and when you receive updates regarding job postings and direct salon invites.</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-[#fdf8f8] rounded-xl border border-[#e0bec6]/20">
                <div className="pr-4">
                  <span className="block text-xs font-bold text-[#1c1b1b]">Job Match Alerts</span>
                  <span className="block text-[11px] text-[#594047] mt-0.5 font-medium leading-relaxed">Receive daily alerts matching your beauty specializations and locations.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                  <input 
                    type="checkbox" 
                    checked={emailAlerts} 
                    onChange={(e) => handleUpdateNotifications('email', e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-10 h-5 bg-[#e0bec6] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#b90064]"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#fdf8f8] rounded-xl border border-[#e0bec6]/20">
                <div className="pr-4">
                  <span className="block text-xs font-bold text-[#1c1b1b]">Interview Invites</span>
                  <span className="block text-[11px] text-[#594047] mt-0.5 font-medium leading-relaxed">Get immediate sms or email when salon manager schedules an audition or meeting.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                  <input 
                    type="checkbox" 
                    checked={pushInterviews} 
                    onChange={(e) => handleUpdateNotifications('push', e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-10 h-5 bg-[#e0bec6] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#b90064]"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#fdf8f8] rounded-xl border border-[#e0bec6]/20">
                <div className="pr-4">
                  <span className="block text-xs font-bold text-[#1c1b1b]">Direct Messages SMS</span>
                  <span className="block text-[11px] text-[#594047] mt-0.5 font-medium leading-relaxed">Mirror direct chat logs to your phone so you never miss an urgent Salon conversation.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                  <input 
                    type="checkbox" 
                    checked={smsMessages} 
                    onChange={(e) => handleUpdateNotifications('sms', e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-10 h-5 bg-[#e0bec6] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#b90064]"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#fdf8f8] rounded-xl border border-[#e0bec6]/20">
                <div className="pr-4">
                  <span className="block text-xs font-bold text-[#1c1b1b]">Nexora Trend Letters</span>
                  <span className="block text-[11px] text-[#594047] mt-0.5 font-medium leading-relaxed">Periodic insights on local beauty expos, training workshops and licensing regulations.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                  <input 
                    type="checkbox" 
                    checked={newsletter} 
                    onChange={(e) => handleUpdateNotifications('newsletter', e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-10 h-5 bg-[#e0bec6] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#b90064]"></div>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-[#e0bec6]/25">
              <button
                onClick={() => setActiveSection(null)}
                className="w-full py-3.5 bg-[#b90064] text-white font-bold text-xs rounded-full hover:bg-[#8e004b] transition-all cursor-pointer text-center shadow-md"
              >
                Back to Settings
              </button>
            </div>
          </div>
        )}

        {/* ==============================================
            3. LANGUAGE SECTION DETAIL
            ============================================== */}
        {activeSection === 'language' && (
          <div className="bg-white p-6 rounded-2xl border border-[#e0bec6]/40 shadow-xs animate-in slide-in-from-right duration-200 space-y-6">
            <div className="border-b border-[#e0bec6]/25 pb-4">
              <h2 className="text-base font-bold text-[#1c1b1b] flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary">language</span>
                <span>Language & Locale</span>
              </h2>
              <p className="text-xs text-[#594047] mt-1 font-medium">Select your primary interface translation language for jobs details, filters, and logs.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: 'en', label: 'English (US)', flag: '🇺🇸', local: 'Primary system language' },
                { id: 'es', label: 'Español', flag: '🇲🇽', local: 'Traducción al español' },
                { id: 'vi', label: 'Tiếng Việt', flag: '🇻🇳', local: 'Ngôn ngữ tiếng Việt' },
                { id: 'tg', label: 'Tagalog', flag: '🇵🇭', local: 'Pagsasalin sa Tagalog' },
                { id: 'fr', label: 'Français', flag: '🇫🇷', local: 'Langue française' },
                { id: 'de', label: 'Deutsch', flag: '🇩🇪', local: 'Deutsche Übersetzung' },
              ].map((langObj) => (
                <div
                  key={langObj.id}
                  onClick={() => handleLanguageChange(langObj.id)}
                  className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                    language === langObj.id 
                      ? 'bg-[#ffd9e2]/30 border-[#8e004b] font-bold' 
                      : 'border-[#e0bec6]/30 bg-white hover:bg-[#ffd9e2]/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl leading-none">{langObj.flag}</span>
                    <div>
                      <span className="block text-xs font-bold text-[#1c1b1b]">{langObj.label}</span>
                      <span className="block text-[9px] text-[#8c7077] font-medium">{langObj.local}</span>
                    </div>
                  </div>
                  {language === langObj.id && (
                    <Check className="w-4 h-4 text-[#8e004b] shrink-0" />
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2">
              <button
                onClick={() => setActiveSection(null)}
                className="w-full py-3 border border-[#e0bec6] text-[#594047] hover:bg-[#f7f2f2] font-bold text-xs rounded-full transition-all cursor-pointer text-center"
              >
                Back to Settings
              </button>
            </div>
          </div>
        )}

        {/* ==============================================
            4. PASSWORD SECTION DETAIL
            ============================================== */}
        {activeSection === 'password' && (
          <div className="bg-white p-6 rounded-2xl border border-[#e0bec6]/40 shadow-xs animate-in slide-in-from-right duration-200">
            <div className="border-b border-[#e0bec6]/25 pb-4 mb-6">
              <h2 className="text-base font-bold text-[#1c1b1b] flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary">lock</span>
                <span>Change Password</span>
              </h2>
              <p className="text-xs text-[#594047] mt-1 font-medium">Keep your credentials up to date. We recommend utilizing secure, unique combinations.</p>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#1c1b1b]">Current Password</label>
                <div className="relative">
                  <input 
                    type={showCurrentPass ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#f1edec]/75 border-transparent focus:border-[#8e004b] focus:bg-white focus:ring-1 focus:ring-[#8e004b] rounded-xl py-3.5 px-4 text-xs font-semibold text-[#1c1b1b] placeholder:text-[#8c7077]/60 outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8c7077] hover:text-[#8e004b] p-1.5 cursor-pointer"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#1c1b1b]">New Password</label>
                <div className="relative">
                  <input 
                    type={showNewPass ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full bg-[#f1edec]/75 border-transparent focus:border-[#8e004b] focus:bg-white focus:ring-1 focus:ring-[#8e004b] rounded-xl py-3.5 px-4 text-xs font-semibold text-[#1c1b1b] placeholder:text-[#8c7077]/60 outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8c7077] hover:text-[#8e004b] p-1.5 cursor-pointer"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#1c1b1b]">Confirm New Password</label>
                <div className="relative">
                  <input 
                    type={showConfirmPass ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    className="w-full bg-[#f1edec]/75 border-transparent focus:border-[#8e004b] focus:bg-white focus:ring-1 focus:ring-[#8e004b] rounded-xl py-3.5 px-4 text-xs font-semibold text-[#1c1b1b] placeholder:text-[#8c7077]/60 outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8c7077] hover:text-[#8e004b] p-1.5 cursor-pointer"
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setActiveSection(null)}
                  className="flex-1 py-3 border border-[#e0bec6] hover:bg-[#f7f2f2] font-bold text-xs text-[#594047] rounded-full transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#b90064] text-white font-bold text-xs rounded-full hover:bg-[#8e004b] transition-all cursor-pointer text-center shadow-md"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ==============================================
            5. PRIVACY SECTION DETAIL
            ============================================== */}
        {activeSection === 'privacy' && (
          <div className="bg-white p-6 rounded-2xl border border-[#e0bec6]/40 shadow-xs animate-in slide-in-from-right duration-200 space-y-6">
            <div className="border-b border-[#e0bec6]/25 pb-4">
              <h2 className="text-base font-bold text-[#1c1b1b] flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary">visibility</span>
                <span>Privacy & Searchability</span>
              </h2>
              <p className="text-xs text-[#594047] mt-1 font-medium">Control who can discover your portfolio galleries and reach out directly with recruitment invitations.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#1c1b1b]">Profile Directory Visibility</label>
                <div className="space-y-2">
                  {[
                    { id: 'public', title: 'Public Directory', desc: 'Any verified beauty salon on Nexora can search and view your full portfolio.' },
                    { id: 'applied_only', title: 'Only Employers I Apply To', desc: 'Your profile remains hidden until you formally submit a job application.' },
                    { id: 'private', title: 'Fully Private / Inactive', desc: 'Hidden from everyone. Ideal when you have secured a role and aren’t searching.' },
                  ].map((option) => (
                    <div 
                      key={option.id}
                      onClick={() => handleUpdatePrivacy('visibility', option.id)}
                      className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                        profileVisibility === option.id 
                          ? 'bg-[#ffd9e2]/30 border-[#8e004b]' 
                          : 'border-[#e0bec6]/40 hover:bg-[#ffd9e2]/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${profileVisibility === option.id ? 'border-[#8e004b]' : 'border-[#e0bec6]'}`}>
                          {profileVisibility === option.id && <div className="w-2.5 h-2.5 rounded-full bg-[#8e004b]" />}
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-[#1c1b1b]">{option.title}</span>
                          <span className="block text-[10px] text-[#8c7077] mt-0.5 leading-relaxed font-medium">{option.desc}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#fdf8f8] rounded-xl border border-[#e0bec6]/20 mt-2">
                <div className="pr-4">
                  <span className="block text-xs font-bold text-[#1c1b1b]">Allow Direct Resume Download</span>
                  <span className="block text-[11px] text-[#594047] mt-0.5 font-medium leading-relaxed">Let salon hiring managers download your PDF copy immediately when browsing your profile page.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                  <input 
                    type="checkbox" 
                    checked={resumeDownloadable} 
                    onChange={(e) => handleUpdatePrivacy('resume', e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-10 h-5 bg-[#e0bec6] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#b90064]"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#fdf8f8] rounded-xl border border-[#e0bec6]/20">
                <div className="pr-4">
                  <span className="block text-xs font-bold text-[#1c1b1b]">Anonymized Aggregates</span>
                  <span className="block text-[11px] text-[#594047] mt-0.5 font-medium leading-relaxed">Sanitize name elements from local salary reports and high-level stylist statistics.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                  <input 
                    type="checkbox" 
                    checked={anonymizeAnalytics} 
                    onChange={(e) => handleUpdatePrivacy('analytics', e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-10 h-5 bg-[#e0bec6] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#b90064]"></div>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-[#e0bec6]/25">
              <button
                onClick={() => setActiveSection(null)}
                className="w-full py-3.5 bg-[#b90064] text-white font-bold text-xs rounded-full hover:bg-[#8e004b] transition-all cursor-pointer text-center shadow-md"
              >
                Back to Settings
              </button>
            </div>
          </div>
        )}

        {/* ==============================================
            6. BLOCKED EMPLOYERS SECTION DETAIL
            ============================================== */}
        {activeSection === 'blocked' && (
          <div className="bg-white p-6 rounded-2xl border border-[#e0bec6]/40 shadow-xs animate-in slide-in-from-right duration-200 space-y-6">
            <div className="border-b border-[#e0bec6]/25 pb-4">
              <h2 className="text-base font-bold text-[#1c1b1b] flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary">block</span>
                <span>Blocked Employers</span>
              </h2>
              <p className="text-xs text-[#594047] mt-1 font-medium">Salons and aesthetic studios added to this list won't see your profile, browse portfolios, or contact you inside the chat pipeline.</p>
            </div>

            {blockedEmployers.length === 0 ? (
              <div className="py-12 text-center bg-[#fdf8f8] rounded-xl border border-dashed border-[#e0bec6] p-6">
                <span className="material-symbols-outlined text-[#8c7077]/40 text-4xl mb-2">block</span>
                <p className="text-xs font-bold text-[#1c1b1b]">No blocked employers</p>
                <p className="text-[11px] text-[#594047] mt-0.5 font-medium">You can block individual salons from their profile pages or direct message threads.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {blockedEmployers.map((emp) => (
                  <div 
                    key={emp.id}
                    className="flex items-center justify-between p-4 bg-[#fdf8f8] rounded-xl border border-[#e0bec6]/30 hover:border-[#8e004b]/30 transition-all"
                  >
                    <div>
                      <span className="block text-xs font-bold text-[#1c1b1b]">{emp.name}</span>
                      <span className="block text-[11px] text-[#594047] mt-0.5 font-medium">{emp.location} • Blocked {emp.dateBlocked}</span>
                    </div>
                    <button
                      onClick={() => setEmployerToUnblock(emp)}
                      className="px-4 py-2 text-[11px] font-bold text-[#8e004b] bg-[#ffd9e2]/60 hover:bg-[#ffd9e2] rounded-full transition-all cursor-pointer shrink-0"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={() => setActiveSection(null)}
                className="w-full py-3 border border-[#e0bec6] text-[#594047] hover:bg-[#f7f2f2] font-bold text-xs rounded-full transition-all cursor-pointer text-center"
              >
                Back to Settings
              </button>
            </div>
          </div>
        )}

        {/* ==============================================
            7. TERMS & CONDITIONS SECTION DETAIL
            ============================================== */}
        {activeSection === 'terms' && (
          <div className="bg-white p-6 rounded-2xl border border-[#e0bec6]/40 shadow-xs animate-in slide-in-from-right duration-200 space-y-6">
            <div className="border-b border-[#e0bec6]/25 pb-4">
              <h2 className="text-base font-bold text-[#1c1b1b] flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary">description</span>
                <span>Terms & Conditions</span>
              </h2>
              <p className="text-xs text-[#594047] mt-1 font-medium">Please read the system use terms and licensing truth agreements below.</p>
            </div>

            <div className="bg-[#fdf8f8] rounded-2xl border border-[#e0bec6]/30 p-5 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar text-xs text-[#594047] leading-relaxed font-medium">
              <div>
                <h4 className="font-bold text-[#1c1b1b] mb-1">1. Acceptance of Terms</h4>
                <p>By creating a job seeker profile or employer account on Nexora Jobs, you acknowledge and agree to comply with these terms, our safety standards, and all local cosmetological licensing boards. If you disagree, you must immediately terminate platform access.</p>
              </div>

              <div>
                <h4 className="font-bold text-[#1c1b1b] mb-1">2. Job Seeker Licensing & Truthfulness</h4>
                <p>Job seekers warrant that all credentials, salon experience claims, cosmetology school histories, and active state licenses provided are truthful and owned by the profile host. Nexora reserves the right to request proof or instantly suspend accounts for fraudulent claims.</p>
              </div>

              <div>
                <h4 className="font-bold text-[#1c1b1b] mb-1">3. Employer Communications & Respect</h4>
                <p>Salons and hiring managers agree to treat applicants with absolute professionalism. Harassment, discriminatory language, unlicensed operations solicitation, or bait-and-switch salary descriptions will trigger systematic blacklists.</p>
              </div>

              <div>
                <h4 className="font-bold text-[#1c1b1b] mb-1">4. Liability Limitations</h4>
                <p>Nexora serves strictly as a hiring and networking platform. We do not act as employer, contract partner, or broker. We hold no liability for workplace safety, contract discrepancies, or salon interactions post-hire.</p>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setActiveSection(null)}
                className="w-full py-3.5 bg-[#b90064] text-white font-bold text-xs rounded-full hover:bg-[#8e004b] transition-all cursor-pointer text-center shadow-md"
              >
                Back to Settings
              </button>
            </div>
          </div>
        )}

        {/* ==============================================
            8. PRIVACY POLICY SECTION DETAIL
            ============================================== */}
        {activeSection === 'policy' && (
          <div className="bg-white p-6 rounded-2xl border border-[#e0bec6]/40 shadow-xs animate-in slide-in-from-right duration-200 space-y-6">
            <div className="border-b border-[#e0bec6]/25 pb-4">
              <h2 className="text-base font-bold text-[#1c1b1b] flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary">policy</span>
                <span>Privacy Policy</span>
              </h2>
              <p className="text-xs text-[#594047] mt-1 font-medium">Review how Nexora indexes and protects your professional portfolios.</p>
            </div>

            <div className="bg-[#fdf8f8] rounded-2xl border border-[#e0bec6]/30 p-5 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar text-xs text-[#594047] leading-relaxed font-medium">
              <div>
                <h4 className="font-bold text-[#1c1b1b] mb-1">1. What Information We Gather</h4>
                <p>We collect and index names, contact numbers, email profiles, cosmetology license IDs, salon portfolios, and interactive resume uploads. We additionally collect session timestamps to optimize direct chat channels.</p>
              </div>

              <div>
                <h4 className="font-bold text-[#1c1b1b] mb-1">2. How We Display Information</h4>
                <p>Your portfolio images, specialties, and bio are searchable depending on your profile visibility preferences ('Public' vs 'Applied Only'). Your exact mobile number and license digit are protected and only shown to salons holding active applications.</p>
              </div>

              <div>
                <h4 className="font-bold text-[#1c1b1b] mb-1">3. Data Integrity & Third-Party Sharing</h4>
                <p>Nexora never sells, licenses, or aggregates personal identification to cosmetic retail networks or third-party marketing brokers. All data transfers exist purely to connect stylists with active hiring managers.</p>
              </div>

              <div>
                <h4 className="font-bold text-[#1c1b1b] mb-1">4. Secure Purging Options</h4>
                <p>You can adjust profile indexing or permanently remove all records, portfolio images, and chat listings instantly through the Delete Account portal inside settings.</p>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setActiveSection(null)}
                className="w-full py-3.5 bg-[#b90064] text-white font-bold text-xs rounded-full hover:bg-[#8e004b] transition-all cursor-pointer text-center shadow-md"
              >
                Back to Settings
              </button>
            </div>
          </div>
        )}

      </main>

      {/* BLOCK 1: Confirmation dialogue for UNBLOCKING */}
      {employerToUnblock && (
        <div className="fixed inset-0 bg-[#1c1b1b]/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-[#e0bec6]/30 shadow-2xl space-y-4">
            <div className="flex items-start gap-3 text-[#1c1b1b]">
              <div className="w-10 h-10 rounded-full bg-[#ffd9e2] flex items-center justify-center text-[#8e004b] shrink-0">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold">Unblock Employer?</h4>
                <p className="text-[10px] text-[#594047] mt-1 leading-relaxed font-medium">
                  Are you sure you want to unblock <strong className="text-[#1c1b1b]">{employerToUnblock.name}</strong>? They will immediately regain ability to search your profile, view portfolio, and initiate chat listings.
                </p>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2 text-[10px] font-bold">
              <button
                onClick={() => setEmployerToUnblock(null)}
                className="px-4 py-2 text-[#594047] hover:bg-[#f1edec] rounded-full transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUnblockEmployer(employerToUnblock)}
                className="px-4 py-2 bg-[#8e004b] hover:bg-[#b90064] text-white rounded-full transition-colors cursor-pointer"
              >
                Confirm Unblock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BLOCK 2: Confirmation dialogue for LOGGING OUT (Destructive Action 1) */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex justify-center items-end pb-0 md:pb-8 md:items-center md:pt-8 animate-in fade-in duration-200">
          {/* Dimming Overlay */}
          <div 
            onClick={() => setShowLogoutModal(false)}
            className="absolute inset-0 bg-[#1c1b1b]/40 backdrop-blur-xs"
          />
          
          {/* Sheet Container */}
          <div className="relative bg-white w-full max-w-md rounded-t-[24px] md:rounded-[24px] shadow-[0_-8px_24px_rgba(90,63,71,0.1)] md:shadow-[0_12px_32px_rgba(90,63,71,0.15)] overflow-hidden flex flex-col transform transition-transform duration-300 translate-y-0 z-10 animate-in slide-in-from-bottom duration-200">
            {/* Drag Handle (Mobile only) */}
            <div className="w-full flex justify-center pt-4 pb-2 md:hidden">
              <div className="w-12 h-1.5 bg-[#e0bec6] rounded-full"></div>
            </div>
            
            {/* Content Area */}
            <div className="px-5 pt-4 pb-8 flex flex-col gap-4">
              {/* Header */}
              <div className="flex flex-col gap-2 text-center md:text-left pt-2 md:pt-6">
                <div className="mx-auto md:mx-0 w-16 h-16 bg-[#ffdad6] text-[#93000a] rounded-full flex items-center justify-center mb-2">
                  <span className="material-symbols-outlined text-[32px]">logout</span>
                </div>
                <h2 className="text-lg font-bold text-[#1c1b1b]">Log out of Nexora Jobs?</h2>
                <p className="text-sm text-[#594047] font-medium leading-relaxed">You'll need to log in again to access your profile and applications.</p>
              </div>
              
              {/* Actions */}
              <div className="flex flex-col gap-2 mt-4">
                <button 
                  onClick={() => {
                    setShowLogoutModal(false);
                    onLogout();
                  }}
                  className="w-full h-12 bg-[#e2007c] hover:bg-[#b50062] text-white font-semibold text-sm rounded-full transition-colors active:scale-[0.98] cursor-pointer"
                >
                  Log Out
                </button>
                <button 
                  onClick={() => setShowLogoutModal(false)}
                  className="w-full h-12 bg-transparent border border-[#e0bec6] hover:bg-[#f7f2f2] text-[#8e004b] font-semibold text-sm rounded-full transition-colors active:scale-[0.98] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BLOCK 3: Confirmation dialogue for DELETING ACCOUNT (Destructive Action 2) */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex justify-center items-end pb-0 md:pb-8 md:items-center md:pt-8 animate-in fade-in duration-200">
          {/* Dimming Overlay */}
          <div 
            onClick={() => setShowDeleteModal(false)}
            className="absolute inset-0 bg-[#1c1b1b]/40 backdrop-blur-xs"
          />
          
          {/* Sheet Container */}
          <div className="relative bg-white w-full max-w-md rounded-t-[24px] md:rounded-[24px] shadow-[0_-8px_24px_rgba(90,63,71,0.1)] md:shadow-[0_12px_32px_rgba(90,63,71,0.15)] overflow-hidden flex flex-col transform transition-transform duration-300 translate-y-0 z-10 animate-in slide-in-from-bottom duration-200">
            {/* Drag Handle (Mobile only) */}
            <div className="w-full flex justify-center pt-4 pb-2 md:hidden">
              <div className="w-12 h-1.5 bg-[#e0bec6] rounded-full"></div>
            </div>
            
            {/* Content Area */}
            <div className="px-5 pt-4 pb-8 flex flex-col gap-4">
              {/* Header */}
              <div className="flex flex-col gap-2 text-center md:text-left pt-2 md:pt-6">
                <div className="mx-auto md:mx-0 w-16 h-16 bg-[#ffdad6] text-[#ba1a1a] rounded-full flex items-center justify-center mb-2">
                  <span className="material-symbols-outlined text-[32px]">delete_forever</span>
                </div>
                <h2 className="text-lg font-bold text-[#ba1a1a]">Permanently Delete Account?</h2>
                <p className="text-sm text-[#594047] font-medium leading-relaxed">
                  This action is <strong className="text-[#ba1a1a]">irreversible</strong>. By completing this, you will permanently purge your beauty resume, portfolio galleries, chat logs, and active application pipelines from Nexora databases.
                </p>
              </div>

              <div className="bg-[#ffdad6]/40 border border-[#ffdad6] p-4 rounded-xl text-xs text-[#93000a] space-y-1 text-left">
                <span className="font-bold">Warning Highlights:</span>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>All active conversations with hiring salons will be permanently lost.</li>
                  <li>Your cosmetology verified credentials cannot be recovered.</li>
                  <li>Hiring salons will see you as a 'Deactivated Stylist'.</li>
                </ul>
              </div>

              <div className="space-y-2 text-left">
                <p className="text-xs font-bold text-[#1c1b1b]">To verify deletion, type <span className="text-[#ba1a1a] font-extrabold">DELETE</span> below:</p>
                <input 
                  type="text"
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                  placeholder="Type DELETE"
                  className="w-full bg-[#ffdad6]/20 border border-[#e0bec6] focus:border-[#ba1a1a] focus:bg-white focus:ring-1 focus:ring-[#ba1a1a] rounded-xl py-3 px-4 text-xs font-bold text-[#ba1a1a] placeholder:text-[#ba1a1a]/30 outline-none transition-colors"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 mt-4">
                <button 
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmationText !== 'DELETE'}
                  className="w-full h-12 bg-[#ba1a1a] hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-full transition-colors active:scale-[0.98] cursor-pointer"
                >
                  Delete Permanently
                </button>
                <button 
                  onClick={() => {
                    setDeleteConfirmationText('');
                    setShowDeleteModal(false);
                  }}
                  className="w-full h-12 bg-transparent border border-[#e0bec6] hover:bg-[#f7f2f2] text-[#8e004b] font-semibold text-sm rounded-full transition-colors active:scale-[0.98] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Simulated Toast Overlay */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1c1b1b]/95 text-white px-5 py-4 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-2.5 text-xs font-bold text-center whitespace-nowrap animate-bounce">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
};

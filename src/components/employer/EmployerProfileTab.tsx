import React, { useEffect, useRef, useState } from 'react';
import {
  Building2,
  MapPin,
  Edit,
  Share,
  ShieldCheck,
  Settings,
  LogOut,
  ChevronRight,
  UserCircle,
  CheckCircle2,
  X,
  Check,
  Globe,
  AtSign,
  Plus,
  Trash2,
  Upload,
  FileText,
  AlertCircle,
  Clock,
  Lock,
  Eye,
  EyeOff,
  Briefcase,
} from 'lucide-react';
import type { UserProfile } from '../../types';
import { jobPortalPath } from '../../routing';
import {
  changePassword,
  deleteEmployerLocation,
  getEmployerVerificationStatus,
  getOwnSalonId,
  listEmployerLocations,
  mapBackendError,
  requestAccountDeletion,
  saveEmployerHiringSettings,
  saveEmployerLocation,
  submitEmployerVerification,
} from '../../services/backend';
import { uploadEmployerVerificationDoc } from '../../lib/storageMedia';
import { requireSupabase } from '../../lib/supabase';
import { validateNewPassword } from '../../lib/passwordPolicy';

interface EmployerProfileTabProps {
  userProfile: UserProfile;
  onUpdateAvatar?: (url: string) => void;
  onUpdateProfile?: (updated: UserProfile) => Promise<void>;
  onLogout?: () => void;
}

interface LocationItem {
  id: string;
  salonId: string;
  label: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode?: string;
  isPrimary: boolean;
}

const slugifyBusinessName = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'profile';

const employerPublicProfileUrl = (businessName?: string) => {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}${jobPortalPath(`salon/${slugifyBusinessName(businessName || '')}`)}`;
};

const canNativeShare = () => {
  if (typeof navigator === 'undefined') return false;
  if (typeof (navigator as Navigator & { share?: unknown }).share !== 'function') return false;
  if (typeof window === 'undefined') return true;
  return Boolean(
    window.matchMedia?.('(pointer: coarse)').matches ||
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent),
  );
};

const inputClassName =
  'w-full bg-white border border-[#cbd5e1] rounded-xl px-4 py-3 text-sm font-medium text-[#0f172a] placeholder:text-[#64748b]/70 outline-none focus:border-[#4f46e5] focus:ring-1 focus:ring-[#4f46e5] transition-all';

export const EmployerProfileTab: React.FC<EmployerProfileTabProps> = ({
  userProfile,
  onUpdateAvatar,
  onUpdateProfile,
  onLogout,
}) => {
  // Modal states
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLocationsOpen, setIsLocationsOpen] = useState(false);
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);
  const [isHiringSettingsOpen, setIsHiringSettingsOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);

  // Edit Business Profile Form state
  const [businessName, setBusinessName] = useState('');
  const [location, setLocation] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Locations state
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [newLocLabel, setNewLocLabel] = useState('');
  const [newLocAddress, setNewLocAddress] = useState('');
  const [newLocCity, setNewLocCity] = useState('');
  const [newLocState, setNewLocState] = useState('');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isSavingLocation, setIsSavingLocation] = useState(false);

  // Verification state
  const [verificationStatus, setVerificationStatus] = useState<string>('unverified');
  const [verificationNotes, setVerificationNotes] = useState<string>('');
  const [businessDocFile, setBusinessDocFile] = useState<File | null>(null);
  const [identityDocFile, setIdentityDocFile] = useState<File | null>(null);
  const [salonProofFile, setSalonProofFile] = useState<File | null>(null);
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Hiring Settings state
  const [jobsEnabled, setJobsEnabled] = useState(true);
  const [defaultInterviewMode, setDefaultInterviewMode] = useState('in_person');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Delete Account state
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const triggerToast = (msg: string) => {
    window.clearTimeout(toastTimer.current);
    setToastMessage(msg);
    toastTimer.current = window.setTimeout(() => setToastMessage(null), 3000);
  };

  // Populate Edit Modal
  useEffect(() => {
    if (!isEditOpen) return;
    setBusinessName(userProfile.businessName || '');
    setLocation(userProfile.location || '');
    setContactPerson(userProfile.contactPerson || userProfile.name || '');
    setPhone(userProfile.phone || '');
    setBio(userProfile.bio || '');
    setWebsite(userProfile.website || '');
    setInstagram(userProfile.instagram || '');
    setSaveError(null);
  }, [isEditOpen, userProfile]);

  // Load Locations when locations modal opens
  useEffect(() => {
    if (!isLocationsOpen) return;
    let mounted = true;
    setIsLoadingLocations(true);
    setLocationError(null);
    void listEmployerLocations().then((items) => {
      if (mounted) {
        setLocations(items);
        setIsLoadingLocations(false);
      }
    });
    return () => { mounted = false; };
  }, [isLocationsOpen]);

  // Load Verification Status when verification modal opens
  useEffect(() => {
    if (!isVerificationOpen) return;
    let mounted = true;
    void getEmployerVerificationStatus().then((v) => {
      if (mounted && v) {
        setVerificationStatus(v.status);
        setVerificationNotes(v.reviewNotes || '');
      }
    });
    return () => { mounted = false; };
  }, [isVerificationOpen]);

  // Global Escape & Scroll Lock
  const anyModalOpen = isEditOpen || isLocationsOpen || isVerificationOpen || isHiringSettingsOpen || isChangePasswordOpen || isDeleteModalOpen || isPolicyOpen;
  useEffect(() => {
    if (!anyModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsEditOpen(false);
        setIsLocationsOpen(false);
        setIsVerificationOpen(false);
        setIsHiringSettingsOpen(false);
        setIsChangePasswordOpen(false);
        setIsDeleteModalOpen(false);
        setIsPolicyOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [anyModalOpen]);

  // Handle Edit Profile Save
  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSavingProfile) return;
    const trimmedBusinessName = businessName.trim();
    const trimmedContact = contactPerson.trim();
    if (!trimmedBusinessName) {
      setSaveError('Business name is required.');
      return;
    }
    if (trimmedContact.length < 2) {
      setSaveError('Contact person name must be at least 2 characters.');
      return;
    }
    setIsSavingProfile(true);
    setSaveError(null);
    try {
      if (!onUpdateProfile) throw new Error('Profile saving is unavailable. Reload the page and try again.');
      await onUpdateProfile({
        ...userProfile,
        businessName: trimmedBusinessName,
        location: location.trim(),
        contactPerson: trimmedContact,
        name: trimmedContact,
        phone: phone.trim(),
        bio: bio.trim(),
        website: website.trim(),
        instagram: instagram.trim().replace(/^@+/, ''),
      });
      setIsEditOpen(false);
      triggerToast('Profile updated successfully');
    } catch (err) {
      console.error('PROFILE_SAVE_FAILED:', err);
      setSaveError(mapBackendError(err, 'Unable to save the employer profile. Please retry.'));
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle Add Location
  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingLocation) return;
    if (!newLocCity.trim() || !newLocState.trim()) {
      setLocationError('City and state are required.');
      return;
    }
    setIsSavingLocation(true);
    setLocationError(null);
    try {
      await saveEmployerLocation({
        label: newLocLabel.trim() || 'Branch',
        addressLine1: newLocAddress.trim() || newLocCity.trim(),
        city: newLocCity.trim(),
        state: newLocState.trim(),
        isPrimary: locations.length === 0,
      });
      const updated = await listEmployerLocations();
      setLocations(updated);
      setIsAddingLocation(false);
      setNewLocLabel('');
      setNewLocAddress('');
      setNewLocCity('');
      setNewLocState('');
      triggerToast('Location added successfully');
    } catch (err) {
      setLocationError(mapBackendError(err, 'Unable to save location. Please retry.'));
    } finally {
      setIsSavingLocation(false);
    }
  };

  // Handle Delete Location
  const handleDeleteLocation = async (id: string) => {
    try {
      await deleteEmployerLocation(id);
      setLocations((prev) => prev.filter((item) => item.id !== id));
      triggerToast('Location removed');
    } catch (err) {
      setLocationError(mapBackendError(err, 'Unable to remove location.'));
    }
  };

  // Handle Submit Verification Documents
  const handleSubmitVerificationDocs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingVerification) return;
    if (!businessDocFile || !identityDocFile) {
      setVerificationError('Please upload both Business Proof and Identity Proof documents.');
      return;
    }
    setIsSubmittingVerification(true);
    setVerificationError(null);
    try {
      const client = requireSupabase();
      const { data: userData } = await client.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('AUTH_REQUIRED');
      const salonId = await getOwnSalonId();
      if (!salonId) throw new Error('SALON_NOT_FOUND');

      const businessPath = await uploadEmployerVerificationDoc(userId, businessDocFile, 'business');
      const identityPath = await uploadEmployerVerificationDoc(userId, identityDocFile, 'identity');
      const salonProofPath = salonProofFile ? await uploadEmployerVerificationDoc(userId, salonProofFile, 'salon') : null;

      await submitEmployerVerification({
        salonId,
        businessProofPath: businessPath,
        identityProofPath: identityPath,
        salonProofPath,
      });

      setVerificationStatus('pending');
      setIsVerificationOpen(false);
      triggerToast('Verification documents submitted for review!');
    } catch (err) {
      setVerificationError(mapBackendError(err, 'Unable to submit verification documents. Please retry.'));
    } finally {
      setIsSubmittingVerification(false);
    }
  };

  // Handle Hiring Settings Save
  const handleSaveHiringSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingSettings) return;
    setIsSavingSettings(true);
    setSettingsError(null);
    try {
      await saveEmployerHiringSettings({ jobsEnabled });
      setIsHiringSettingsOpen(false);
      triggerToast('Hiring settings saved successfully');
    } catch (err) {
      setSettingsError(mapBackendError(err, 'Unable to save settings.'));
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Handle Password Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isChangingPassword) return;
    const policyErr = validateNewPassword(newPassword);
    if (policyErr) {
      setPasswordError(policyErr);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    setIsChangingPassword(true);
    setPasswordError(null);
    try {
      await changePassword(currentPassword, newPassword);
      setIsChangePasswordOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      triggerToast('Password changed successfully');
    } catch (err) {
      setPasswordError(mapBackendError(err, 'Unable to change password. Check your current password.'));
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Handle Account Deletion
  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDeletingAccount) return;
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm.');
      return;
    }
    setIsDeletingAccount(true);
    setDeleteError(null);
    try {
      await requestAccountDeletion(deleteReason);
      setIsDeleteModalOpen(false);
      triggerToast('Account scheduled for deletion.');
      if (onLogout) onLogout();
    } catch (err) {
      setDeleteError(mapBackendError(err, 'Unable to submit deletion request.'));
      setIsDeletingAccount(false);
    }
  };

  const handleShareProfile = async () => {
    if (isSharing) return;
    setIsSharing(true);
    const name = userProfile.businessName || 'Our salon';
    const url = employerPublicProfileUrl(userProfile.businessName);
    const title = `${name} on Nexora Jobs`;
    const text = `Check out ${name} on Nexora Jobs`;
    try {
      if (canNativeShare()) {
        try {
          await (
            navigator as Navigator & {
              share: (data: { title: string; text: string; url: string }) => Promise<void>;
            }
          ).share({ title, text, url });
          triggerToast('Profile shared!');
          return;
        } catch (shareError) {
          if (shareError instanceof DOMException && shareError.name === 'AbortError') return;
        }
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const fallback = document.createElement('textarea');
        fallback.value = url;
        fallback.setAttribute('readonly', '');
        fallback.style.position = 'fixed';
        fallback.style.opacity = '0';
        document.body.appendChild(fallback);
        fallback.select();
        try {
          document.execCommand('copy');
        } finally {
          fallback.remove();
        }
      }
      triggerToast('Profile link copied to clipboard!');
    } catch {
      triggerToast('Unable to copy the profile link');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <>
      <div className="max-w-md mx-auto px-5 pt-6 pb-32 space-y-8 w-full animate-in fade-in duration-300">
        {/* Profile Header Section */}
        <section className="flex flex-col items-center text-center space-y-4">
          <div className="relative">
            <button
              type="button"
              onClick={() => onUpdateAvatar?.(userProfile.avatarUrl || '')}
              aria-label="Change business logo"
              className="block w-24 h-24 rounded-full border-4 border-[#f8fafc] shadow-sm overflow-hidden bg-white cursor-pointer hover:ring-2 hover:ring-[#7c3aed]/40 active:scale-95 transition-all"
            >
              {userProfile.avatarUrl ? (
                <img
                  src={userProfile.avatarUrl}
                  alt={userProfile.businessName || 'Employer logo'}
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-[#4f46e5]">
                  {(userProfile.businessName || userProfile.name || 'E').charAt(0).toUpperCase()}
                </span>
              )}
            </button>
            <div className="absolute bottom-0 right-0 bg-[#7c3aed] text-white rounded-full p-1 shadow-md border-2 border-[#f8fafc] pointer-events-none">
              <CheckCircle2 className="w-4 h-4" fill="currentColor" color="white" />
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-[18px] font-semibold text-[#0f172a] flex items-center justify-center gap-2">
              {userProfile.businessName || 'Employer profile'}
            </h2>
            <p className="text-[16px] text-[#475569] flex items-center justify-center gap-1">
              <MapPin className="w-[18px] h-[18px]" />
              {userProfile.location || 'Location not added'}
            </p>
          </div>

          <div className="flex gap-4 w-full">
            <button
              type="button"
              onClick={() => setIsEditOpen(true)}
              aria-label="Edit profile"
              className="flex-1 bg-white border border-[#cbd5e1] text-[#4f46e5] text-[13px] font-medium py-2.5 rounded-full hover:bg-[#e2e8f0] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <Edit className="w-[18px] h-[18px]" />
              Edit Profile
            </button>
            <button
              type="button"
              onClick={() => void handleShareProfile()}
              aria-label="Share profile"
              disabled={isSharing}
              className="flex-1 bg-white border border-[#cbd5e1] text-[#0f172a] text-[13px] font-medium py-2.5 rounded-full hover:bg-[#e2e8f0] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-60"
            >
              <Share className="w-[18px] h-[18px]" />
              Share
            </button>
          </div>
        </section>

        {/* Action Lists */}
        <section className="space-y-4">
          {/* Business & Settings Group */}
          <div className="bg-white rounded-xl border border-[#cbd5e1] shadow-[0_4px_12px_rgba(15,23,42,0.02)] overflow-hidden">
            <ul className="divide-y divide-[#cbd5e1]/30">
              <li>
                <button
                  type="button"
                  onClick={() => setIsEditOpen(true)}
                  className="w-full flex items-center p-4 hover:bg-[#f8fafc] transition-colors active:bg-[#e2e8f0] cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-[#4f46e5]/10 flex items-center justify-center text-[#4f46e5] mr-4 shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-[13px] font-medium text-[#0f172a]">Business Information</h3>
                    <p className="text-xs text-[#475569] mt-0.5">Manage your salon details and brand</p>
                  </div>
                  <ChevronRight className="text-[#475569]/50 w-5 h-5" />
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setIsLocationsOpen(true)}
                  className="w-full flex items-center p-4 hover:bg-[#f8fafc] transition-colors active:bg-[#e2e8f0] cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-[#4f46e5]/10 flex items-center justify-center text-[#4f46e5] mr-4 shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-[13px] font-medium text-[#0f172a]">Business Locations</h3>
                    <p className="text-xs text-[#475569] mt-0.5">Manage multiple branches</p>
                  </div>
                  <ChevronRight className="text-[#475569]/50 w-5 h-5" />
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setIsVerificationOpen(true)}
                  className="w-full flex items-center p-4 hover:bg-[#f8fafc] transition-colors active:bg-[#e2e8f0] cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-[#4f46e5]/10 flex items-center justify-center text-[#4f46e5] mr-4 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-[13px] font-medium text-[#0f172a]">Verification</h3>
                    <p className="text-xs text-[#475569] mt-0.5">Business documents & status</p>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full mr-2 ${
                    verificationStatus === 'verified' ? 'bg-emerald-100 text-emerald-800' :
                    verificationStatus === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {verificationStatus === 'verified' ? 'Verified' : verificationStatus === 'pending' ? 'Pending' : 'Unverified'}
                  </span>
                  <ChevronRight className="text-[#475569]/50 w-5 h-5" />
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setIsHiringSettingsOpen(true)}
                  className="w-full flex items-center p-4 hover:bg-[#f8fafc] transition-colors active:bg-[#e2e8f0] cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-[#4f46e5]/10 flex items-center justify-center text-[#4f46e5] mr-4 shrink-0">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-[13px] font-medium text-[#0f172a]">Hiring Settings</h3>
                    <p className="text-xs text-[#475569] mt-0.5">Job preferences & notifications</p>
                  </div>
                  <ChevronRight className="text-[#475569]/50 w-5 h-5" />
                </button>
              </li>
            </ul>
          </div>

          {/* Security Section */}
          <div className="bg-white rounded-xl border border-[#cbd5e1] shadow-[0_4px_12px_rgba(15,23,42,0.02)] overflow-hidden">
            <ul className="divide-y divide-[#cbd5e1]/30">
              <li>
                <button
                  type="button"
                  onClick={() => setIsChangePasswordOpen(true)}
                  className="w-full flex items-center p-4 hover:bg-[#f8fafc] transition-colors active:bg-[#e2e8f0] cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-[#f8fafc] flex items-center justify-center text-[#0f172a] mr-4 shrink-0">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-[13px] font-medium text-[#0f172a]">Change Password</h3>
                  </div>
                  <ChevronRight className="text-[#475569]/50 w-5 h-5" />
                </button>
              </li>
            </ul>
          </div>

          {/* Legal Section */}
          <div className="bg-white rounded-xl border border-[#cbd5e1] shadow-[0_4px_12px_rgba(15,23,42,0.02)] overflow-hidden">
            <ul className="divide-y divide-[#cbd5e1]/30">
              <li>
                <button
                  type="button"
                  onClick={() => setIsPolicyOpen(true)}
                  className="w-full flex items-center p-4 hover:bg-[#f8fafc] transition-colors active:bg-[#e2e8f0] cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-[#f8fafc] flex items-center justify-center text-[#0f172a] mr-4 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-[13px] font-medium text-[#0f172a]">Terms & Privacy Policy</h3>
                  </div>
                  <ChevronRight className="text-[#475569]/50 w-5 h-5" />
                </button>
              </li>
            </ul>
          </div>

          {/* Account Controls */}
          <div className="bg-white rounded-xl border border-[#cbd5e1] shadow-[0_4px_12px_rgba(15,23,42,0.02)] overflow-hidden">
            <ul className="divide-y divide-[#cbd5e1]/30">
              <li>
                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full flex items-center p-4 hover:bg-[#f8fafc] transition-colors active:bg-[#e2e8f0] cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-[#f8fafc] flex items-center justify-center text-[#ba1a1a] mr-4 shrink-0">
                    <LogOut className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-[13px] font-medium text-[#ba1a1a]">Log Out</h3>
                  </div>
                </button>
              </li>
            </ul>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              className="w-full flex items-center justify-center p-3 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100/60 transition-colors text-[#ba1a1a] font-semibold text-xs cursor-pointer gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete Employer Account
            </button>
          </div>
        </section>
      </div>

      {/* MODAL 1: Edit Profile Modal */}
      {isEditOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-[#0f172a]/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsEditOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Edit business profile"
        >
          <div
            className="w-full sm:max-w-lg bg-[#f8fafc] rounded-t-3xl sm:rounded-3xl border border-[#cbd5e1] shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#cbd5e1]/60 shrink-0">
              <h2 className="text-lg font-bold text-[#0f172a]">Edit Business Profile</h2>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                aria-label="Close edit profile"
                className="p-2 text-[#475569] hover:text-[#0f172a] rounded-full hover:bg-[#f1f5f9] active:scale-95 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="overflow-y-auto px-5 py-5 space-y-6">
              {saveError && (
                <p role="alert" className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  {saveError}
                </p>
              )}

              {/* Business */}
              <fieldset className="space-y-4">
                <legend className="text-xs font-bold text-[#4f46e5] uppercase tracking-wide mb-1">
                  Business
                </legend>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="employer-business-name" className="text-xs font-bold text-[#0f172a]">
                    Business Name
                  </label>
                  <input
                    id="employer-business-name"
                    type="text"
                    autoFocus
                    value={businessName}
                    onChange={(event) => setBusinessName(event.target.value)}
                    placeholder="e.g. The Glamour Studio"
                    className={inputClassName}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="employer-location" className="text-xs font-bold text-[#0f172a]">
                    Location
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4f46e5] w-4 h-4 pointer-events-none" />
                    <input
                      id="employer-location"
                      type="text"
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                      placeholder="City, State"
                      className={`${inputClassName} pl-9`}
                    />
                  </div>
                </div>
              </fieldset>

              {/* Contact Info */}
              <fieldset className="space-y-4">
                <legend className="text-xs font-bold text-[#4f46e5] uppercase tracking-wide mb-1">
                  Contact Info
                </legend>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="employer-contact-person" className="text-xs font-bold text-[#0f172a]">
                    Contact Person
                  </label>
                  <input
                    id="employer-contact-person"
                    type="text"
                    value={contactPerson}
                    onChange={(event) => setContactPerson(event.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className={inputClassName}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="employer-email" className="text-xs font-bold text-[#0f172a]">
                    Login Email
                  </label>
                  <input
                    id="employer-email"
                    type="email"
                    value={userProfile.email || ''}
                    readOnly
                    disabled
                    title="Your login email can't be changed here"
                    className={`${inputClassName} bg-[#f1f5f9] text-[#475569] cursor-not-allowed`}
                  />
                  <p className="text-[11px] text-[#64748b]">Your login email can&apos;t be changed here.</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="employer-phone" className="text-xs font-bold text-[#0f172a]">
                    Phone
                  </label>
                  <input
                    id="employer-phone"
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="(555) 000-0000"
                    className={inputClassName}
                  />
                </div>
              </fieldset>

              {/* Brand Details */}
              <fieldset className="space-y-4">
                <legend className="text-xs font-bold text-[#4f46e5] uppercase tracking-wide mb-1">
                  Brand Details
                </legend>
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label htmlFor="employer-bio" className="text-xs font-bold text-[#0f172a]">
                      About the Business
                    </label>
                    <span className="text-[10px] text-[#475569] font-bold">{bio.length} / 500</span>
                  </div>
                  <textarea
                    id="employer-bio"
                    rows={4}
                    maxLength={500}
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                    placeholder="Services, atmosphere, and what makes your business unique…"
                    className={`${inputClassName} resize-none`}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="employer-website" className="text-xs font-bold text-[#0f172a]">
                    Website
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4f46e5] w-4 h-4 pointer-events-none" />
                    <input
                      id="employer-website"
                      type="url"
                      value={website}
                      onChange={(event) => setWebsite(event.target.value)}
                      placeholder="https://www.yourstudio.com"
                      className={`${inputClassName} pl-9`}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="employer-instagram" className="text-xs font-bold text-[#0f172a]">
                    Instagram
                  </label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4f46e5] w-4 h-4 pointer-events-none" />
                    <input
                      id="employer-instagram"
                      type="text"
                      value={instagram}
                      onChange={(event) => setInstagram(event.target.value)}
                      placeholder="yourstudio"
                      className={`${inputClassName} pl-9`}
                    />
                  </div>
                </div>
              </fieldset>

              <div className="flex gap-3 pt-1 pb-2 sticky bottom-0 bg-[#f8fafc]/95 backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="flex-1 px-5 py-3 border border-[#64748b] hover:bg-[#f1f5f9] rounded-full text-[#475569] text-xs font-bold active:scale-95 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="flex-1 px-5 py-3 bg-[#4f46e5] hover:bg-[#6d28d9] text-white rounded-full text-xs font-bold active:scale-95 transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingProfile ? 'Saving…' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Business Locations Modal */}
      {isLocationsOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-[#0f172a]/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsLocationsOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Business Locations"
        >
          <div
            className="w-full sm:max-w-lg bg-[#f8fafc] rounded-t-3xl sm:rounded-3xl border border-[#cbd5e1] shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#cbd5e1]/60 shrink-0">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#4f46e5]" />
                <h2 className="text-lg font-bold text-[#0f172a]">Business Locations</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsLocationsOpen(false)}
                className="p-2 text-[#475569] hover:text-[#0f172a] rounded-full hover:bg-[#f1f5f9] transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5 space-y-5">
              {locationError && (
                <p role="alert" className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  {locationError}
                </p>
              )}

              {/* Locations List */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wide">Branches & Locations</h3>
                {isLoadingLocations ? (
                  <p className="text-xs text-[#64748b] py-4 text-center">Loading locations…</p>
                ) : locations.length === 0 ? (
                  <div className="p-4 rounded-xl border border-[#cbd5e1] bg-white text-center">
                    <p className="text-sm font-semibold text-[#0f172a]">{userProfile.location || 'Main Location'}</p>
                    <p className="text-xs text-[#64748b] mt-1">Primary business address</p>
                  </div>
                ) : (
                  locations.map((loc) => (
                    <div key={loc.id} className="p-4 rounded-xl border border-[#cbd5e1] bg-white flex items-center justify-between gap-3 shadow-sm">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[#0f172a]">{loc.label}</span>
                          {loc.isPrimary && (
                            <span className="bg-[#ede9fe] text-[#4f46e5] text-[10px] font-bold px-2 py-0.5 rounded-full">Primary</span>
                          )}
                        </div>
                        <p className="text-xs text-[#475569] mt-1">{loc.addressLine1}, {loc.city}, {loc.state}</p>
                      </div>
                      {!loc.isPrimary && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteLocation(loc.id)}
                          aria-label={`Delete ${loc.label}`}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Add Location Form */}
              {isAddingLocation ? (
                <form onSubmit={handleSaveLocation} className="p-4 rounded-2xl border border-[#4f46e5]/30 bg-white space-y-3 shadow-md">
                  <h4 className="text-xs font-bold text-[#4f46e5] uppercase">Add New Branch Location</h4>
                  <input
                    type="text"
                    value={newLocLabel}
                    onChange={(e) => setNewLocLabel(e.target.value)}
                    placeholder="Branch Name (e.g. Bandra Branch)"
                    className={inputClassName}
                  />
                  <input
                    type="text"
                    value={newLocAddress}
                    onChange={(e) => setNewLocAddress(e.target.value)}
                    placeholder="Address Line 1"
                    className={inputClassName}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      value={newLocCity}
                      onChange={(e) => setNewLocCity(e.target.value)}
                      placeholder="City (Required)"
                      className={inputClassName}
                    />
                    <input
                      type="text"
                      required
                      value={newLocState}
                      onChange={(e) => setNewLocState(e.target.value)}
                      placeholder="State (Required)"
                      className={inputClassName}
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingLocation(false)}
                      className="flex-1 py-2 text-xs font-bold text-[#64748b] border rounded-full hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingLocation}
                      className="flex-1 py-2 text-xs font-bold text-white bg-[#4f46e5] hover:bg-[#6d28d9] rounded-full cursor-pointer disabled:opacity-60"
                    >
                      {isSavingLocation ? 'Saving…' : 'Save Branch'}
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingLocation(true)}
                  className="w-full py-3 border-2 border-dashed border-[#4f46e5]/40 hover:border-[#4f46e5] rounded-xl text-xs font-bold text-[#4f46e5] flex items-center justify-center gap-2 transition-all cursor-pointer bg-white"
                >
                  <Plus className="w-4 h-4" />
                  Add Another Location
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Business Verification Modal */}
      {isVerificationOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-[#0f172a]/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsVerificationOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Business Verification"
        >
          <div
            className="w-full sm:max-w-lg bg-[#f8fafc] rounded-t-3xl sm:rounded-3xl border border-[#cbd5e1] shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#cbd5e1]/60 shrink-0">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#4f46e5]" />
                <h2 className="text-lg font-bold text-[#0f172a]">Business Verification</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsVerificationOpen(false)}
                className="p-2 text-[#475569] hover:text-[#0f172a] rounded-full hover:bg-[#f1f5f9] transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5 space-y-5">
              {/* Status Banner */}
              <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                verificationStatus === 'verified' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
                verificationStatus === 'pending' ? 'bg-amber-50 border-amber-200 text-amber-900' :
                'bg-[#ede9fe] border-[#cbd5e1] text-[#312e81]'
              }`}>
                {verificationStatus === 'verified' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : verificationStatus === 'pending' ? (
                  <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-[#4f46e5] shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="text-xs font-bold uppercase">
                    Status: {verificationStatus === 'verified' ? 'Verified Employer' : verificationStatus === 'pending' ? 'Under Review' : 'Verification Required'}
                  </h4>
                  <p className="text-xs mt-1 leading-relaxed">
                    {verificationStatus === 'verified'
                      ? 'Your business has been verified. Verified employers get up to 3x more applications and candidate trust.'
                      : verificationStatus === 'pending'
                        ? 'Your documents have been submitted and are under review by our team (typically 24-48 hours).'
                        : 'Upload business proof and government ID to earn the Verified Employer badge.'}
                  </p>
                  {verificationNotes && (
                    <p className="text-xs font-semibold mt-2 bg-white/60 p-2 rounded-lg border">
                      Review Note: {verificationNotes}
                    </p>
                  )}
                </div>
              </div>

              {verificationError && (
                <p role="alert" className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  {verificationError}
                </p>
              )}

              {/* Upload Form */}
              {verificationStatus !== 'verified' && (
                <form onSubmit={handleSubmitVerificationDocs} className="space-y-4">
                  {/* Business Proof */}
                  <div className="p-4 rounded-xl bg-white border border-[#cbd5e1] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#0f172a]">1. Business Registration / Tax Proof</span>
                      <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full">Required</span>
                    </div>
                    <p className="text-[11px] text-[#64748b]">GST Certificate, Shop Act License, or Trade License (PDF, JPG, PNG)</p>
                    <label className="flex items-center gap-2 p-3 border-2 border-dashed border-[#cbd5e1] hover:border-[#4f46e5] rounded-xl cursor-pointer bg-[#f8fafc] text-xs font-semibold text-[#4f46e5]">
                      <Upload className="w-4 h-4" />
                      <span>{businessDocFile ? businessDocFile.name : 'Select Business Document'}</span>
                      <input
                        type="file"
                        accept=".pdf,image/jpeg,image/png,image/webp"
                        onChange={(e) => setBusinessDocFile(e.target.files?.[0] || null)}
                        className="sr-only"
                      />
                    </label>
                  </div>

                  {/* Identity Proof */}
                  <div className="p-4 rounded-xl bg-white border border-[#cbd5e1] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#0f172a]">2. Owner Government ID</span>
                      <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full">Required</span>
                    </div>
                    <p className="text-[11px] text-[#64748b]">Aadhaar Card, Passport, or PAN of the business owner</p>
                    <label className="flex items-center gap-2 p-3 border-2 border-dashed border-[#cbd5e1] hover:border-[#4f46e5] rounded-xl cursor-pointer bg-[#f8fafc] text-xs font-semibold text-[#4f46e5]">
                      <Upload className="w-4 h-4" />
                      <span>{identityDocFile ? identityDocFile.name : 'Select Government ID'}</span>
                      <input
                        type="file"
                        accept=".pdf,image/jpeg,image/png,image/webp"
                        onChange={(e) => setIdentityDocFile(e.target.files?.[0] || null)}
                        className="sr-only"
                      />
                    </label>
                  </div>

                  {/* Salon Proof */}
                  <div className="p-4 rounded-xl bg-white border border-[#cbd5e1] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#0f172a]">3. Salon Photo / Lease Agreement</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">Optional</span>
                    </div>
                    <p className="text-[11px] text-[#64748b]">Photos of salon interior/exterior or rental agreement</p>
                    <label className="flex items-center gap-2 p-3 border-2 border-dashed border-[#cbd5e1] hover:border-[#4f46e5] rounded-xl cursor-pointer bg-[#f8fafc] text-xs font-semibold text-[#4f46e5]">
                      <Upload className="w-4 h-4" />
                      <span>{salonProofFile ? salonProofFile.name : 'Select Salon Photo'}</span>
                      <input
                        type="file"
                        accept=".pdf,image/jpeg,image/png,image/webp"
                        onChange={(e) => setSalonProofFile(e.target.files?.[0] || null)}
                        className="sr-only"
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingVerification}
                    className="w-full py-3.5 bg-[#4f46e5] hover:bg-[#6d28d9] text-white font-bold text-xs rounded-full shadow-md transition-all cursor-pointer disabled:opacity-60"
                  >
                    {isSubmittingVerification ? 'Uploading & Submitting…' : 'Submit Documents for Verification'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Hiring Settings Modal */}
      {isHiringSettingsOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-[#0f172a]/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsHiringSettingsOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Hiring Settings"
        >
          <div
            className="w-full sm:max-w-lg bg-[#f8fafc] rounded-t-3xl sm:rounded-3xl border border-[#cbd5e1] shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#cbd5e1]/60 shrink-0">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#4f46e5]" />
                <h2 className="text-lg font-bold text-[#0f172a]">Hiring Settings</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsHiringSettingsOpen(false)}
                className="p-2 text-[#475569] hover:text-[#0f172a] rounded-full hover:bg-[#f1f5f9] transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHiringSettings} className="overflow-y-auto px-5 py-5 space-y-5">
              {settingsError && (
                <p role="alert" className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  {settingsError}
                </p>
              )}

              <div className="p-4 rounded-xl bg-white border border-[#cbd5e1] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#0f172a]">Accept New Applications</h4>
                    <p className="text-[11px] text-[#64748b] mt-0.5">Enable candidates to apply to active postings</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={jobsEnabled}
                    onChange={(e) => setJobsEnabled(e.target.checked)}
                    className="h-5 w-5 rounded text-[#4f46e5] focus:ring-[#4f46e5] cursor-pointer"
                  />
                </div>

                <div className="pt-3 border-t border-[#f1f5f9] flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#0f172a]">Default Interview Mode</label>
                  <select
                    value={defaultInterviewMode}
                    onChange={(e) => setDefaultInterviewMode(e.target.value)}
                    className={inputClassName}
                  >
                    <option value="in_person">In-Person at Salon</option>
                    <option value="video">Video Call / Online</option>
                    <option value="phone">Phone Screening</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingSettings}
                className="w-full py-3.5 bg-[#4f46e5] hover:bg-[#6d28d9] text-white font-bold text-xs rounded-full shadow-md transition-all cursor-pointer disabled:opacity-60"
              >
                {isSavingSettings ? 'Saving Settings…' : 'Save Hiring Settings'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Change Password Modal */}
      {isChangePasswordOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-[#0f172a]/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsChangePasswordOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Change Password"
        >
          <div
            className="w-full sm:max-w-md bg-[#f8fafc] rounded-t-3xl sm:rounded-3xl border border-[#cbd5e1] shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#cbd5e1]/60 shrink-0">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#4f46e5]" />
                <h2 className="text-lg font-bold text-[#0f172a]">Change Password</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsChangePasswordOpen(false)}
                className="p-2 text-[#475569] hover:text-[#0f172a] rounded-full hover:bg-[#f1f5f9] transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="overflow-y-auto px-5 py-5 space-y-4">
              {passwordError && (
                <p role="alert" className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  {passwordError}
                </p>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#0f172a]">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`${inputClassName} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#0f172a]"
                  >
                    {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#0f172a]">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`${inputClassName} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#0f172a]"
                  >
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-[#64748b]">Minimum 8 characters with uppercase, lowercase and a number.</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#0f172a]">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className={inputClassName}
                />
              </div>

              <button
                type="submit"
                disabled={isChangingPassword}
                className="w-full py-3.5 bg-[#4f46e5] hover:bg-[#6d28d9] text-white font-bold text-xs rounded-full shadow-md transition-all cursor-pointer disabled:opacity-60"
              >
                {isChangingPassword ? 'Updating Password…' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: Delete Account Modal */}
      {isDeleteModalOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-[#0f172a]/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsDeleteModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Delete Account"
        >
          <div
            className="w-full sm:max-w-md bg-[#f8fafc] rounded-t-3xl sm:rounded-3xl border border-[#cbd5e1] shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#cbd5e1]/60 shrink-0 bg-rose-50/50">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-[#ba1a1a]" />
                <h2 className="text-lg font-bold text-[#ba1a1a]">Delete Employer Account</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="p-2 text-[#475569] hover:text-[#0f172a] rounded-full hover:bg-[#f1f5f9] transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDeleteAccount} className="overflow-y-auto px-5 py-5 space-y-4">
              <p className="text-xs text-[#475569] leading-relaxed">
                Deleting your employer account permanently removes your business profile, listings, and closes active applications. This action is irreversible.
              </p>

              {deleteError && (
                <p role="alert" className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  {deleteError}
                </p>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#0f172a]">Reason for leaving (Optional)</label>
                <textarea
                  rows={2}
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Tell us why you're closing this account…"
                  className={`${inputClassName} resize-none`}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#ba1a1a]">Type DELETE to confirm</label>
                <input
                  type="text"
                  required
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className={`${inputClassName} border-rose-300 focus:border-rose-600 focus:ring-rose-600`}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-3 border border-[#cbd5e1] rounded-full text-xs font-bold text-[#475569] hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeletingAccount || deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
                  className="flex-1 py-3 bg-[#ba1a1a] hover:bg-rose-800 text-white rounded-full text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isDeletingAccount ? 'Deleting…' : 'Delete Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: Terms & Privacy Policy Modal */}
      {isPolicyOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-[#0f172a]/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsPolicyOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Terms and Privacy Policy"
        >
          <div
            className="w-full sm:max-w-lg bg-[#f8fafc] rounded-t-3xl sm:rounded-3xl border border-[#cbd5e1] shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#cbd5e1]/60 shrink-0">
              <h2 className="text-lg font-bold text-[#0f172a]">Terms & Privacy Policy</h2>
              <button
                type="button"
                onClick={() => setIsPolicyOpen(false)}
                className="p-2 text-[#475569] hover:text-[#0f172a] rounded-full hover:bg-[#f1f5f9] transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5 space-y-4 text-xs text-[#475569] leading-relaxed">
              <h3 className="text-sm font-bold text-[#0f172a]">1. Employer Terms of Service</h3>
              <p>
                Nexora Jobs is a verified marketplace connecting beauty employers with qualified candidates. Employers agree to post only legitimate job vacancies, adhere to Indian employment laws, and treat applicant personal data with strict confidentiality.
              </p>
              <h3 className="text-sm font-bold text-[#0f172a]">2. Privacy Policy & Data Protection</h3>
              <p>
                In compliance with the Digital Personal Data Protection Act (DPDP), candidate contact information and resume data are accessible solely for hiring purposes. We do not sell or share business contact records with third parties.
              </p>
              <h3 className="text-sm font-bold text-[#0f172a]">3. Account Removal & Erasure</h3>
              <p>
                Employers may request account deletion at any time through this dashboard. Verified data will be anonymized or purged according to regulatory requirements.
              </p>
              <button
                type="button"
                onClick={() => setIsPolicyOpen(false)}
                className="w-full py-3 bg-[#4f46e5] text-white rounded-full font-bold text-xs mt-4 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[80] bg-[#0f172a] text-white px-4 py-3 rounded-2xl shadow-xl border border-white/20 flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-bottom-2 duration-200 max-w-[92vw]"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="truncate">{toastMessage}</span>
        </div>
      )}
    </>
  );
};

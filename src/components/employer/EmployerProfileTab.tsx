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
} from 'lucide-react';
import type { UserProfile } from '../../types';
import { jobPortalPath } from '../../routing';
import { mapBackendError } from '../../services/backend';

interface EmployerProfileTabProps {
  userProfile: UserProfile;
  onUpdateAvatar?: (url: string) => void;
  onUpdateProfile?: (updated: UserProfile) => Promise<void>;
  onLogout?: () => void;
}

const slugifyBusinessName = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'profile';

/**
 * Canonical public URL for the employer's salon page. It is stable (derived
 * from the business name) and clipboard-friendly; the portal can mount the
 * matching public route on it as a follow-up.
 */
const employerPublicProfileUrl = (businessName?: string) => {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}${jobPortalPath(`salon/${slugifyBusinessName(businessName || '')}`)}`;
};

/** Native share sheet only where it makes sense: share-capable mobile browsers. */
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
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);

  // Edit-form state. Re-populated from the existing employer data every time
  // the modal opens (see the effect below), never left stale.
  const [businessName, setBusinessName] = useState('');
  const [location, setLocation] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const triggerToast = (msg: string) => {
    window.clearTimeout(toastTimer.current);
    setToastMessage(msg);
    toastTimer.current = window.setTimeout(() => setToastMessage(null), 3000);
  };

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

  // Escape-to-close + scroll lock while the modal is open.
  useEffect(() => {
    if (!isEditOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsEditOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isEditOpen]);

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
        // The employer display name mirrors the contact person (same convention
        // as sign-up and the workspace loader).
        name: trimmedContact,
        phone: phone.trim(),
        bio: bio.trim(),
        website: website.trim(),
        instagram: instagram.trim().replace(/^@+/, ''),
      });
      setIsEditOpen(false);
      triggerToast('Profile updated successfully');
    } catch (error) {
      setSaveError(mapBackendError(error, 'Unable to save the employer profile. Please retry.'));
    } finally {
      setIsSavingProfile(false);
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
          // A dismissed sheet is intentional — stop quietly. Anything else
          // falls through to the clipboard path below.
          if (shareError instanceof DOMException && shareError.name === 'AbortError') return;
        }
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // The Clipboard API needs a secure context — legacy fallback for older
        // browsers / non-HTTPS origins.
        const fallback = document.createElement('textarea');
        fallback.value = url;
        fallback.setAttribute('readonly', '');
        fallback.style.position = 'fixed';
        fallback.style.opacity = '0';
        document.body.appendChild(fallback);
        fallback.select();
        try {
          const copied = document.execCommand('copy');
          if (!copied) throw new Error('copy failed');
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
              className="flex-1 bg-white border border-[#cbd5e1] text-[#4f46e5] text-[13px] font-medium py-2.5 rounded-full hover:bg-[#e2e8f0] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Edit className="w-[18px] h-[18px]" />
              Edit Profile
            </button>
            <button
              type="button"
              onClick={() => void handleShareProfile()}
              aria-label="Share profile"
              disabled={isSharing}
              className="flex-1 bg-white border border-[#cbd5e1] text-[#4f46e5] text-[13px] font-medium py-2.5 rounded-full hover:bg-[#e2e8f0] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
            >
              <Share className="w-[18px] h-[18px]" />
              {isSharing ? 'Sharing…' : 'Share Profile'}
            </button>
          </div>
        </section>

        {/* Menu Sections */}
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
                    <Building2 className="w-5 h-5" fill="currentColor" color="transparent" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-[13px] font-medium text-[#0f172a]">Business Information</h3>
                    <p className="text-xs text-[#475569] mt-0.5">Manage your salon details and brand</p>
                  </div>
                  <ChevronRight className="text-[#475569]/50 w-5 h-5" />
                </button>
              </li>
              <li>
                <button className="w-full flex items-center p-4 hover:bg-[#f8fafc] transition-colors active:bg-[#e2e8f0] cursor-pointer">
                  <div className="w-10 h-10 rounded-full bg-[#4f46e5]/10 flex items-center justify-center text-[#4f46e5] mr-4 shrink-0">
                    <MapPin className="w-5 h-5" fill="currentColor" color="transparent" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-[13px] font-medium text-[#0f172a]">Business Locations</h3>
                    <p className="text-xs text-[#475569] mt-0.5">Manage multiple branches</p>
                  </div>
                  <ChevronRight className="text-[#475569]/50 w-5 h-5" />
                </button>
              </li>
              <li>
                <button className="w-full flex items-center p-4 hover:bg-[#f8fafc] transition-colors active:bg-[#e2e8f0] cursor-pointer">
                  <div className="w-10 h-10 rounded-full bg-[#4f46e5]/10 flex items-center justify-center text-[#4f46e5] mr-4 shrink-0">
                    <ShieldCheck className="w-5 h-5" fill="currentColor" color="transparent" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-[13px] font-medium text-[#0f172a]">Verification</h3>
                    <p className="text-xs text-[#475569] mt-0.5">Business documents & status</p>
                  </div>
                  <ChevronRight className="text-[#475569]/50 w-5 h-5" />
                </button>
              </li>
              <li>
                <button className="w-full flex items-center p-4 hover:bg-[#f8fafc] transition-colors active:bg-[#e2e8f0] cursor-pointer">
                  <div className="w-10 h-10 rounded-full bg-[#4f46e5]/10 flex items-center justify-center text-[#4f46e5] mr-4 shrink-0">
                    <Settings className="w-5 h-5" fill="currentColor" color="transparent" />
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
                <button className="w-full flex items-center p-4 hover:bg-[#f8fafc] transition-colors active:bg-[#e2e8f0] cursor-pointer">
                  <div className="w-10 h-10 rounded-full bg-[#f8fafc] flex items-center justify-center text-[#0f172a] mr-4 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
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
                <button className="w-full flex items-center p-4 hover:bg-[#f8fafc] transition-colors active:bg-[#e2e8f0] cursor-pointer">
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

          {/* Danger Zone */}
          <div className="bg-white rounded-xl border border-[#ffdad6] shadow-[0_4px_12px_rgba(15,23,42,0.02)] overflow-hidden mt-6">
            <button
              onClick={onLogout}
              className="w-full flex items-center p-4 hover:bg-[#ffdad6]/30 transition-colors active:bg-[#ffdad6]/50 cursor-pointer border-b border-[#ffdad6]/30"
            >
              <div className="w-10 h-10 rounded-full bg-[#ba1a1a]/10 flex items-center justify-center text-[#ba1a1a] mr-4 shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-[13px] font-medium text-[#ba1a1a]">Log Out</h3>
              </div>
            </button>
            <button className="w-full flex items-center p-4 hover:bg-[#ffdad6]/30 transition-colors active:bg-[#ffdad6]/50 cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-[#ba1a1a]/10 flex items-center justify-center text-[#ba1a1a] mr-4 shrink-0">
                <UserCircle className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-[13px] font-medium text-[#ba1a1a]">Delete Employer Account</h3>
              </div>
            </button>
          </div>
        </section>
      </div>

      {/* Edit Profile Modal */}
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

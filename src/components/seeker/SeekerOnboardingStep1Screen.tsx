import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, Edit2, FileText, Upload } from 'lucide-react';
import { assertImageFile, assertResumeFile } from '../../lib/storageMedia';
import { mapBackendError } from '../../services/backend';

export interface SeekerOnboardingPersonalData {
  fullName: string;
  email: string;
  mobile: string;
  city: string;
  state: string;
  avatarFile?: File;
  resumeFile?: File;
}

interface SeekerOnboardingStep1ScreenProps {
  initialData?: {
    fullName?: string;
    email?: string;
    mobile?: string;
    city?: string;
    state?: string;
    avatarUrl?: string;
    resumeFileName?: string;
  };
  onBack: () => void;
  onNext: (data: SeekerOnboardingPersonalData) => Promise<void>;
}

export const SeekerOnboardingStep1Screen: React.FC<SeekerOnboardingStep1ScreenProps> = ({
  initialData,
  onBack,
  onNext,
}) => {
  const [fullName, setFullName] = useState(initialData?.fullName || '');
  const [email] = useState(initialData?.email || '');
  const [mobile, setMobile] = useState(initialData?.mobile || '');
  const [city, setCity] = useState(initialData?.city || '');
  const [state, setState] = useState(initialData?.state || '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialData?.avatarUrl || null);
  const [avatarFile, setAvatarFile] = useState<File | undefined>();
  const [resumeFile, setResumeFile] = useState<File | undefined>();
  const [resumeFileName, setResumeFileName] = useState<string>(initialData?.resumeFileName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => () => {
    if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        assertImageFile(file);
        setSaveError(null);
        setAvatarFile(file);
        setAvatarPreview(URL.createObjectURL(file));
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Choose a valid profile image.');
        e.target.value = '';
      }
    }
  };

  const handleResumeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        assertResumeFile(file);
        setSaveError(null);
        setResumeFile(file);
        setResumeFileName(file.name);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Choose a valid resume file.');
        e.target.value = '';
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    const trimmedName = fullName.trim();
    if (trimmedName.length < 2) {
      setSaveError('Full name must be at least 2 characters');
      return;
    }
    if (mobile.trim().length < 8) {
      setSaveError('Please enter a valid mobile number');
      return;
    }
    if (city.trim().length < 2) {
      setSaveError('City must be at least 2 characters');
      return;
    }
    if (state.trim().length < 2) {
      setSaveError('State must be at least 2 characters');
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      await onNext({
        fullName: trimmedName,
        email,
        mobile: mobile.trim(),
        city: city.trim(),
        state: state.trim(),
        avatarFile,
        resumeFile,
      });
    } catch (error) {
      setSaveError(mapBackendError(error, 'Unable to save these details. Please retry.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-[#f8fafc] text-[#0f172a] min-h-screen flex flex-col font-sans antialiased">
      {/* TopAppBar Header */}
      <header className="bg-white shadow-[0_4px_12px_rgba(15,23,42,0.05)] sticky top-0 z-50 flex justify-between items-center px-5 h-16 w-full border-b border-[#e2e8f0]">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="p-2 -ml-2 rounded-full hover:bg-[#e2e8f0] transition-colors active:scale-95 text-[#475569] hover:text-[#4f46e5] flex items-center justify-center cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <h1 className="font-extrabold text-xl text-[#4f46e5] tracking-tight">Nexora Jobs</h1>

        <div className="w-10" />
      </header>

      {/* Main Content Area */}
      <main className="flex-grow px-5 py-6 max-w-2xl mx-auto w-full flex flex-col gap-6">

        {/* Progress Indicator */}
        <section aria-label="Onboarding Progress" className="w-full">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-[#475569] uppercase tracking-wider">
              Step 1 of 7
            </span>
            <span className="text-xs font-bold text-[#4f46e5]">
              Personal Info
            </span>
          </div>
          <div
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={14}
            role="progressbar"
            className="w-full bg-[#e2e8f0] rounded-full h-2 overflow-hidden"
          >
            <div
              className="bg-[#6d28d9] h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: '14.28%' }}
            />
          </div>
        </section>

        {/* Form Content */}
        <section className="flex flex-col gap-4 bg-white border border-[#cbd5e1] rounded-2xl p-6 sm:p-8 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <div className="text-center mb-2">
            <h2 className="text-2xl font-extrabold text-[#0f172a]">
              Tell us about yourself
            </h2>
            <p className="text-sm text-[#475569] mt-1 leading-relaxed">
              Let's start with the basics to build your professional profile.
            </p>
          </div>

          {/* Profile Photo Upload */}
          <div className="flex flex-col items-center gap-2 mb-4">
            <div className="relative group cursor-pointer">
              <div className="w-24 h-24 rounded-full bg-[#f1f5f9] border-2 border-dashed border-[#cbd5e1] flex items-center justify-center overflow-hidden transition-all group-hover:border-[#6d28d9] group-hover:bg-[#e2e8f0]">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Profile preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-8 h-8 text-[#64748b] group-hover:text-[#6d28d9] transition-colors" />
                )}
                <input
                  id="profile-photo"
                  type="file"
                  accept="image/*"
                  aria-label="Upload profile photo"
                  onChange={handlePhotoUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-[#6d28d9] text-white rounded-full p-1.5 shadow-md">
                <Edit2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <span className="text-xs font-bold text-[#475569]">Upload Photo</span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Required Fields */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#0f172a]" htmlFor="full-name">
                Full Name <span className="text-rose-600">*</span>
              </label>
              <input
                id="full-name"
                name="full-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full bg-[#f1f5f9] text-[#0f172a] border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#6d28d9] focus:bg-white transition-all placeholder:text-[#64748b]/60 outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#0f172a]" htmlFor="email">
                Email Address <span className="text-rose-600">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                readOnly
                placeholder="jane@example.com"
                className="w-full bg-[#f1f5f9] text-[#0f172a] border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#6d28d9] focus:bg-white transition-all placeholder:text-[#64748b]/60 outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#0f172a]" htmlFor="mobile">
                Mobile Number <span className="text-rose-600">*</span>
              </label>
              <input
                id="mobile"
                name="mobile"
                type="tel"
                required
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full bg-[#f1f5f9] text-[#0f172a] border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#6d28d9] focus:bg-white transition-all placeholder:text-[#64748b]/60 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#0f172a]" htmlFor="city">
                  City <span className="text-rose-600">*</span>
                </label>
                <input
                  id="city"
                  name="city"
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="New York"
                  className="w-full bg-[#f1f5f9] text-[#0f172a] border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#6d28d9] focus:bg-white transition-all placeholder:text-[#64748b]/60 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#0f172a]" htmlFor="state">
                  State <span className="text-rose-600">*</span>
                </label>
                <input
                  id="state"
                  name="state"
                  type="text"
                  required
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="NY"
                  className="w-full bg-[#f1f5f9] text-[#0f172a] border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#6d28d9] focus:bg-white transition-all placeholder:text-[#64748b]/60 outline-none"
                />
              </div>
            </div>

            <div className="h-px bg-[#e2e8f0] my-2 w-full" />

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#0f172a]" htmlFor="resume-upload">
                Professional Resume / CV (PDF, DOC)
              </label>
              <div className="relative flex items-center bg-[#f1f5f9] rounded-xl px-4 py-3 border border-dashed border-[#cbd5e1] hover:border-[#6d28d9] transition-colors cursor-pointer group">
                <FileText className="w-5 h-5 text-[#4f46e5] mr-3 flex-shrink-0" />
                <div className="flex-1 truncate">
                  <p className="text-xs font-bold text-[#0f172a] truncate">
                    {resumeFileName || 'Upload your resume'}
                  </p>
                  <p className="text-[10px] text-[#64748b]">
                    PDF, DOC, DOCX up to 5MB
                  </p>
                </div>
                <div className="flex items-center gap-1.5 bg-[#ede9fe] text-[#4f46e5] px-3 py-1.5 rounded-lg text-xs font-bold shadow-2xs group-hover:bg-[#c4b5fd] transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Browse</span>
                </div>
                <input
                  id="resume-upload"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleResumeUpload}
                  aria-label="Upload resume or CV"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>

            {/* Action Area */}
            <div className="mt-6 flex flex-col gap-2">
              {saveError && <p role="alert" className="text-sm font-semibold text-rose-700">{saveError}</p>}
              <button
                type="submit"
                disabled={isSaving}
                className="w-full bg-[#7c3aed] hover:bg-[#4f46e5] text-white rounded-full py-3.5 px-6 font-extrabold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>{isSaving ? 'Saving…' : 'Continue'}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
              <p className="text-center text-xs text-[#475569] mt-1 font-medium">
                By continuing, you agree to our Terms of Service.
              </p>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
};

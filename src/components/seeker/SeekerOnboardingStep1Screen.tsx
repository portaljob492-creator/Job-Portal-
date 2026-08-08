import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, Edit2, MapPin, Calendar, ChevronDown, CheckCircle2, FileText, Upload } from 'lucide-react';

interface SeekerOnboardingStep1ScreenProps {
  initialData?: {
    fullName?: string;
    email?: string;
    mobile?: string;
    city?: string;
    state?: string;
    currentLocation?: string;
    dob?: string;
    gender?: string;
    avatarUrl?: string;
    resumeFileName?: string;
  };
  onBack: () => void;
  onNext: (data: any) => void;
}

export const SeekerOnboardingStep1Screen: React.FC<SeekerOnboardingStep1ScreenProps> = ({
  initialData,
  onBack,
  onNext,
}) => {
  const [fullName, setFullName] = useState(initialData?.fullName || 'Jane Doe');
  const [email, setEmail] = useState(initialData?.email || 'jane@example.com');
  const [mobile, setMobile] = useState(initialData?.mobile || '+1 (555) 000-0000');
  const [city, setCity] = useState(initialData?.city || 'New York');
  const [state, setState] = useState(initialData?.state || 'NY');
  const [currentLocation, setCurrentLocation] = useState(initialData?.currentLocation || 'SoHo, New York, NY');
  const [dob, setDob] = useState(initialData?.dob || '');
  const [gender, setGender] = useState(initialData?.gender || '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialData?.avatarUrl || null);
  const [resumeFileName, setResumeFileName] = useState<string>(initialData?.resumeFileName || 'Jane_Doe_Resume_2026.pdf');

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatarPreview(url);
    }
  };

  const handleResumeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setResumeFileName(file.name);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext({
      fullName,
      email,
      mobile,
      city,
      state,
      currentLocation,
      dob,
      gender,
      avatarUrl: avatarPreview,
      resumeFileName,
    });
  };

  // Helper for date display format (MM/DD/YYYY)
  const formatDobDisplay = (dateString: string) => {
    if (!dateString) return 'MM/DD/YYYY';
    const [year, month, day] = dateString.split('-');
    if (year && month && day) return `${month}/${day}/${year}`;
    return dateString;
  };

  return (
    <div className="bg-[#fdf8f8] text-[#1c1b1b] min-h-screen flex flex-col font-sans antialiased">
      {/* TopAppBar Header */}
      <header className="bg-white shadow-[0_4px_12px_rgba(90,63,71,0.05)] sticky top-0 z-50 flex justify-between items-center px-5 h-16 w-full border-b border-[#e6e1e1]">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="p-2 -ml-2 rounded-full hover:bg-[#e6e1e1] transition-colors active:scale-95 text-[#594047] hover:text-[#8e004b] flex items-center justify-center cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <h1 className="font-extrabold text-xl text-[#8e004b] tracking-tight">Nexora Jobs</h1>

        <div className="w-10" />
      </header>

      {/* Main Content Area */}
      <main className="flex-grow px-5 py-6 max-w-2xl mx-auto w-full flex flex-col gap-6">
        
        {/* Progress Indicator */}
        <section aria-label="Onboarding Progress" className="w-full">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-[#594047] uppercase tracking-wider">
              Step 1 of 7
            </span>
            <span className="text-xs font-bold text-[#8e004b]">
              Personal Info
            </span>
          </div>
          <div
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={14}
            role="progressbar"
            className="w-full bg-[#e6e1e1] rounded-full h-2 overflow-hidden"
          >
            <div
              className="bg-[#b90064] h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: '14.28%' }}
            />
          </div>
        </section>

        {/* Form Content */}
        <section className="flex flex-col gap-4 bg-white border border-[#e0bec6] rounded-2xl p-6 sm:p-8 shadow-[0_8px_24px_rgba(90,63,71,0.06)]">
          <div className="text-center mb-2">
            <h2 className="text-2xl font-extrabold text-[#1c1b1b]">
              Tell us about yourself
            </h2>
            <p className="text-sm text-[#594047] mt-1 leading-relaxed">
              Let's start with the basics to build your professional profile.
            </p>
          </div>

          {/* Profile Photo Upload */}
          <div className="flex flex-col items-center gap-2 mb-4">
            <div className="relative group cursor-pointer">
              <div className="w-24 h-24 rounded-full bg-[#f1edec] border-2 border-dashed border-[#e0bec6] flex items-center justify-center overflow-hidden transition-all group-hover:border-[#b90064] group-hover:bg-[#ece7e7]">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Profile preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-8 h-8 text-[#8c7077] group-hover:text-[#b90064] transition-colors" />
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
              <div className="absolute -bottom-1 -right-1 bg-[#b90064] text-white rounded-full p-1.5 shadow-md">
                <Edit2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <span className="text-xs font-bold text-[#594047]">Upload Photo</span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Required Fields */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#1c1b1b]" htmlFor="full-name">
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
                className="w-full bg-[#f1edec] text-[#1c1b1b] border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#b90064] focus:bg-white transition-all placeholder:text-[#8c7077]/60 outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#1c1b1b]" htmlFor="email">
                Email Address <span className="text-rose-600">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                className="w-full bg-[#f1edec] text-[#1c1b1b] border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#b90064] focus:bg-white transition-all placeholder:text-[#8c7077]/60 outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#1c1b1b]" htmlFor="mobile">
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
                className="w-full bg-[#f1edec] text-[#1c1b1b] border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#b90064] focus:bg-white transition-all placeholder:text-[#8c7077]/60 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#1c1b1b]" htmlFor="city">
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
                  className="w-full bg-[#f1edec] text-[#1c1b1b] border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#b90064] focus:bg-white transition-all placeholder:text-[#8c7077]/60 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#1c1b1b]" htmlFor="state">
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
                  className="w-full bg-[#f1edec] text-[#1c1b1b] border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#b90064] focus:bg-white transition-all placeholder:text-[#8c7077]/60 outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 relative">
              <label className="text-xs font-bold text-[#1c1b1b]" htmlFor="current-location">
                Current Location <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#8c7077] pointer-events-none" />
                <input
                  id="current-location"
                  name="current-location"
                  type="text"
                  required
                  value={currentLocation}
                  onChange={(e) => setCurrentLocation(e.target.value)}
                  placeholder="Search location..."
                  className="w-full bg-[#f1edec] text-[#1c1b1b] border-none rounded-xl pl-11 pr-4 py-3 text-sm focus:ring-2 focus:ring-[#b90064] focus:bg-white transition-all placeholder:text-[#8c7077]/60 outline-none"
                />
              </div>
            </div>

            <div className="h-px bg-[#e6e1e1] my-2 w-full" />

            {/* Optional Fields */}
            <h3 className="font-extrabold text-base text-[#1c1b1b] mt-1">
              Additional Information (Optional)
            </h3>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#1c1b1b]" htmlFor="dob">
                Date of Birth
              </label>
              <div className="relative">
                <input
                  id="dob"
                  name="dob"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full bg-[#f1edec] text-[#1c1b1b] border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#b90064] focus:bg-white transition-all appearance-none [&::-webkit-calendar-picker-indicator]:opacity-0 absolute inset-0 z-10 cursor-pointer"
                />
                <div className="w-full bg-[#f1edec] rounded-xl px-4 py-3 flex items-center justify-between text-sm text-[#1c1b1b]">
                  <span className={dob ? 'text-[#1c1b1b] font-medium' : 'text-[#8c7077]'}>
                    {formatDobDisplay(dob)}
                  </span>
                  <Calendar className="w-4 h-4 text-[#8c7077]" />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#1c1b1b]" htmlFor="resume-upload">
                Professional Resume / CV (PDF, DOC)
              </label>
              <div className="relative flex items-center bg-[#f1edec] rounded-xl px-4 py-3 border border-dashed border-[#e0bec6] hover:border-[#b90064] transition-colors cursor-pointer group">
                <FileText className="w-5 h-5 text-[#8e004b] mr-3 flex-shrink-0" />
                <div className="flex-1 truncate">
                  <p className="text-xs font-bold text-[#1c1b1b] truncate">
                    {resumeFileName || 'Upload your resume'}
                  </p>
                  <p className="text-[10px] text-[#8c7077]">
                    PDF, DOC, DOCX up to 10MB
                  </p>
                </div>
                <div className="flex items-center gap-1.5 bg-[#ffd9e2] text-[#8e004b] px-3 py-1.5 rounded-lg text-xs font-bold shadow-2xs group-hover:bg-[#ffb0c8] transition-colors">
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
              <button
                type="submit"
                className="w-full bg-[#e2007c] hover:bg-[#8e004b] text-white rounded-full py-3.5 px-6 font-extrabold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-5 h-5" />
              </button>
              <p className="text-center text-xs text-[#594047] mt-1 font-medium">
                By continuing, you agree to our Terms of Service.
              </p>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
};

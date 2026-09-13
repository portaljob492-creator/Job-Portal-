import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Camera,
  Check,
  CheckCircle2,
  Download,
  FileText,
  GraduationCap,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import type {
  CandidateCertification,
  CandidateEducation,
  CandidateEmploymentType,
  CandidateExperience,
  CandidateExperienceLevel,
  CandidateProfileInput,
  CandidateProfileSubmission,
  ResumeFile,
  UserProfile,
} from '../../types';
import {
  deleteResume,
  getResumeDownloadUrl,
  listResumes,
  mapBackendError,
  setPrimaryResume,
  uploadCandidateAvatar,
  uploadResume,
} from '../../services/backend';

interface SeekerProfileTabProps {
  userProfile: UserProfile;
  onUpdateProfile?: (updated: UserProfile) => Promise<void>;
  onSubmitProfile: (input: CandidateProfileInput) => Promise<CandidateProfileSubmission>;
  onLogout?: () => void;
  onNavigateTab?: (tab: 'feed' | 'applications' | 'saved' | 'messages' | 'portfolio' | 'profile') => void;
  onNavigateScreen?: (screen: any) => void;
}

const STEPS = [
  { label: 'Personal', icon: User },
  { label: 'Contact', icon: MapPin },
  { label: 'Education', icon: GraduationCap },
  { label: 'Experience', icon: Briefcase },
  { label: 'Skills', icon: Sparkles },
  { label: 'Preferred Job', icon: Check },
  { label: 'Documents', icon: FileText },
  { label: 'Review & Submit', icon: CheckCircle2 },
] as const;

const EMPLOYMENT_TYPES: Array<{ value: CandidateEmploymentType; label: string }> = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'internship', label: 'Internship' },
  { value: 'contract', label: 'Contract' },
  { value: 'freelance', label: 'Freelance / Commission' },
];

const fieldClass = 'w-full bg-[#fdf8f8] text-[#1c1b1b] border border-[#e0bec6]/70 rounded-xl px-3 py-3 focus:outline-none focus:ring-1 focus:ring-[#8e004b] focus:border-[#8e004b] text-xs font-semibold';
const labelClass = 'text-xs font-bold text-[#1c1b1b]';
const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const numberOrUndefined = (value: string) => value.trim() === '' ? undefined : Number(value);

export const SeekerProfileTab: React.FC<SeekerProfileTabProps> = ({
  userProfile,
  onSubmitProfile,
  onNavigateTab,
}) => {
  const [isEditing, setIsEditing] = useState(!userProfile.profileSubmittedAt);
  const [step, setStep] = useState(0);
  const [submission, setSubmission] = useState<CandidateProfileSubmission | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Step 1 — Personal
  const [fullName, setFullName] = useState(userProfile.name || '');
  const [headline, setHeadline] = useState(userProfile.primaryRole || '');
  const [bio, setBio] = useState(userProfile.bio || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploadedAvatarPath, setUploadedAvatarPath] = useState<string | undefined>(userProfile.avatarPath);
  const avatarPreview = useMemo(
    () => avatarFile ? URL.createObjectURL(avatarFile) : userProfile.avatarUrl,
    [avatarFile, userProfile.avatarUrl],
  );
  useEffect(() => () => { if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview); }, [avatarPreview]);

  // Step 2 — Contact
  const [phone, setPhone] = useState(userProfile.phone || '');
  const [city, setCity] = useState(userProfile.city || userProfile.location?.split(',')[0]?.trim() || '');
  const [state, setState] = useState(userProfile.state || userProfile.location?.split(',').slice(1).join(',').trim() || '');

  // Steps 3/4 — Education and experience
  const [education, setEducation] = useState<CandidateEducation[]>(userProfile.education || []);
  const [educationDraft, setEducationDraft] = useState({ courseName: '', institutionName: '', completionYear: '' });
  const [experience, setExperience] = useState<CandidateExperience[]>(userProfile.experience || []);
  const [experienceLevel, setExperienceLevel] = useState<CandidateExperienceLevel>(userProfile.experienceLevel || 'fresher');
  const [totalExperienceMonths, setTotalExperienceMonths] = useState(userProfile.totalExperienceMonths || 0);
  const [experienceDraft, setExperienceDraft] = useState({
    roleTitle: '', salonName: '', city: '', state: '', startDate: '', endDate: '', currentlyWorking: false, description: '',
  });

  // Step 5 — Skills
  const [skills, setSkills] = useState<string[]>(userProfile.skills || userProfile.specialties || []);
  const [skillDraft, setSkillDraft] = useState('');

  // Step 6 — Preferred job
  const [preferredRoles, setPreferredRoles] = useState<string[]>(userProfile.preferredRoles?.length ? userProfile.preferredRoles : userProfile.primaryRole ? [userProfile.primaryRole] : []);
  const [roleDraft, setRoleDraft] = useState('');
  const [employmentTypes, setEmploymentTypes] = useState<CandidateEmploymentType[]>(userProfile.employmentTypes?.length ? userProfile.employmentTypes : ['full_time']);
  const [salaryMin, setSalaryMin] = useState(userProfile.expectedSalaryMin?.toString() || '');
  const [salaryMax, setSalaryMax] = useState(userProfile.expectedSalaryMax?.toString() || '');
  const [availableFrom, setAvailableFrom] = useState(userProfile.availableFrom || '');
  const [openToRelocation, setOpenToRelocation] = useState(Boolean(userProfile.openToRelocation));

  // Step 7 — Documents
  const [certifications, setCertifications] = useState<CandidateCertification[]>(userProfile.certifications || []);
  const [certificationDraft, setCertificationDraft] = useState({ certificateName: '', institutionName: '', completionYear: '' });
  const [resumes, setResumes] = useState<ResumeFile[]>([]);
  const [resumesLoading, setResumesLoading] = useState(true);
  const [pendingResume, setPendingResume] = useState<File | null>(null);
  const [uploadedResumeId, setUploadedResumeId] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResumesLoading(true);
    listResumes()
      .then((rows) => { if (!cancelled) setResumes(rows); })
      .catch((error) => { if (!cancelled) setDocumentError(mapBackendError(error, 'Unable to load your resumes.')); })
      .finally(() => { if (!cancelled) setResumesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const triggerToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 3500);
  };

  const addEducation = () => {
    if (!educationDraft.courseName.trim()) return;
    setEducation((current) => [...current, {
      id: newId('edu'),
      courseName: educationDraft.courseName.trim(),
      institutionName: educationDraft.institutionName.trim() || undefined,
      completionYear: numberOrUndefined(educationDraft.completionYear),
    }]);
    setEducationDraft({ courseName: '', institutionName: '', completionYear: '' });
  };

  const addExperience = () => {
    if (!experienceDraft.roleTitle.trim() || !experienceDraft.salonName.trim() || !experienceDraft.startDate) return;
    setExperience((current) => [...current, {
      id: newId('exp'),
      roleTitle: experienceDraft.roleTitle.trim(),
      salonName: experienceDraft.salonName.trim(),
      city: experienceDraft.city.trim() || undefined,
      state: experienceDraft.state.trim() || undefined,
      startDate: experienceDraft.startDate,
      endDate: experienceDraft.currentlyWorking ? undefined : experienceDraft.endDate || undefined,
      currentlyWorking: experienceDraft.currentlyWorking,
      description: experienceDraft.description.trim() || undefined,
    }]);
    setExperienceDraft({ roleTitle: '', salonName: '', city: '', state: '', startDate: '', endDate: '', currentlyWorking: false, description: '' });
  };

  const addSkill = () => {
    const value = skillDraft.trim();
    if (value && !skills.some((item) => item.toLowerCase() === value.toLowerCase())) setSkills((current) => [...current, value]);
    setSkillDraft('');
  };

  const addRole = () => {
    const value = roleDraft.trim();
    if (value && !preferredRoles.some((item) => item.toLowerCase() === value.toLowerCase())) setPreferredRoles((current) => [...current, value]);
    setRoleDraft('');
  };

  const addCertification = () => {
    if (!certificationDraft.certificateName.trim()) return;
    setCertifications((current) => [...current, {
      id: newId('cert'),
      certificateName: certificationDraft.certificateName.trim(),
      institutionName: certificationDraft.institutionName.trim() || undefined,
      completionYear: numberOrUndefined(certificationDraft.completionYear),
    }]);
    setCertificationDraft({ certificateName: '', institutionName: '', completionYear: '' });
  };

  const validateStep = (target = step): string | null => {
    if (target === 0 && (fullName.trim().length < 2 || headline.trim().length < 2)) return 'Add your full name and professional role to continue.';
    if (target === 1 && (phone.trim().length < 5 || city.trim().length < 2 || state.trim().length < 2)) return 'Add a valid phone number, city and state to continue.';
    if (target === 3 && experienceLevel !== 'fresher' && totalExperienceMonths < 1) return 'Add your total experience or choose Fresher.';
    if (target === 4 && skills.length === 0) return 'Add at least one professional skill.';
    if (target === 5 && (preferredRoles.length === 0 || employmentTypes.length === 0)) return 'Add at least one preferred role and employment type.';
    const min = numberOrUndefined(salaryMin);
    const max = numberOrUndefined(salaryMax);
    if (target === 5 && min != null && max != null && min > max) return 'Maximum salary must be greater than minimum salary.';
    return null;
  };

  const goNext = () => {
    const error = validateStep();
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    setStep((current) => Math.min(7, current + 1));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    for (const index of [0, 1, 3, 4, 5]) {
      const error = validateStep(index);
      if (error) {
        setStep(index);
        setValidationError(error);
        return;
      }
    }
    setIsSubmitting(true);
    setSubmitError(null);
    setValidationError(null);
    setDocumentError(null);
    try {
      let avatarPath = uploadedAvatarPath || userProfile.avatarPath;
      if (avatarFile && !uploadedAvatarPath) {
        avatarPath = await uploadCandidateAvatar(avatarFile);
        setUploadedAvatarPath(avatarPath);
      }
      if (pendingResume && !uploadedResumeId) {
        const resume = await uploadResume(pendingResume);
        setUploadedResumeId(resume.id);
        setResumes((current) => [resume, ...current.map((item) => ({ ...item, isPrimary: false }))]);
      }

      const result = await onSubmitProfile({
        fullName: fullName.trim(),
        phone: phone.trim(),
        avatarPath,
        headline: headline.trim(),
        bio: bio.trim() || undefined,
        city: city.trim(),
        state: state.trim(),
        experienceLevel,
        totalExperienceMonths,
        expectedSalaryMin: numberOrUndefined(salaryMin),
        expectedSalaryMax: numberOrUndefined(salaryMax),
        availableFrom: availableFrom || undefined,
        openToRelocation,
        skills,
        preferredRoles,
        employmentTypes,
        experience,
        education,
        certifications,
      });
      setSubmission(result);
      setIsEditing(false);
      triggerToast('Profile submitted successfully. You can now apply for jobs.');
    } catch (error) {
      setSubmitError(mapBackendError(error, 'We could not submit your profile. Your entries are still here — please retry.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openResume = async (resume: ResumeFile) => {
    try {
      window.open(await getResumeDownloadUrl(resume.storagePath), '_blank', 'noopener,noreferrer');
    } catch (error) {
      setDocumentError(mapBackendError(error, 'Unable to open your resume.'));
    }
  };

  const removeResume = async (resume: ResumeFile) => {
    if (!window.confirm(`Remove ${resume.fileName} from your profile?`)) return;
    try {
      await deleteResume(resume.id);
      setResumes((current) => current.filter((item) => item.id !== resume.id));
    } catch (error) {
      setDocumentError(mapBackendError(error, 'Unable to remove your resume.'));
    }
  };

  const makePrimary = async (resume: ResumeFile) => {
    try {
      await setPrimaryResume(resume.id);
      setResumes((current) => current.map((item) => ({ ...item, isPrimary: item.id === resume.id })));
    } catch (error) {
      setDocumentError(mapBackendError(error, 'Unable to update your primary resume.'));
    }
  };

  const confirmed = submission || (userProfile.profileSubmittedAt && userProfile.candidateId ? {
    candidateId: userProfile.candidateId,
    profileCompletion: userProfile.profileCompletion || 0,
    applicationReady: Boolean(userProfile.applicationReady),
    submittedAt: userProfile.profileSubmittedAt,
  } : null);

  if (!isEditing && confirmed) {
    return (
      <div className="max-w-3xl mx-auto py-4">
        <section className="bg-white rounded-3xl border border-[#e0bec6]/60 shadow-[0_8px_30px_rgba(90,63,71,0.08)] overflow-hidden">
          <div className="bg-gradient-to-br from-[#8e004b] to-[#e2007c] px-6 py-10 text-white text-center">
            <div className="w-20 h-20 rounded-full bg-white/20 border border-white/30 mx-auto flex items-center justify-center mb-5">
              <CheckCircle2 className="w-11 h-11" />
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold">Your candidate profile has been submitted successfully.</h1>
            <p className="text-white/85 text-sm mt-2">Employers can now review your verified candidate details.</p>
          </div>
          <div className="p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-4 pb-6 border-b border-[#e0bec6]/50">
              {userProfile.avatarUrl || avatarPreview ? (
                <img src={userProfile.avatarUrl || avatarPreview} alt={fullName} className="w-16 h-16 rounded-full object-cover border-2 border-[#ffd9e2]" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-[#ffd9e2] text-[#8e004b] flex items-center justify-center text-xl font-extrabold">{fullName.charAt(0)}</div>
              )}
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#8c7077] font-bold">Candidate Name</p>
                <h2 className="text-xl font-extrabold text-[#1c1b1b]">{fullName}</h2>
                <p className="text-xs text-[#594047]">{headline}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#fdf8f8] rounded-2xl border border-[#e0bec6]/50 p-4">
                <p className="text-[10px] uppercase tracking-wider text-[#8c7077] font-bold">Profile Completion Status</p>
                <p className="text-lg font-extrabold text-[#8e004b] mt-1">{confirmed.profileCompletion}% Complete</p>
              </div>
              <div className="bg-[#fdf8f8] rounded-2xl border border-[#e0bec6]/50 p-4">
                <p className="text-[10px] uppercase tracking-wider text-[#8c7077] font-bold">Application Ready Status</p>
                <p className={`text-lg font-extrabold mt-1 ${confirmed.applicationReady ? 'text-emerald-700' : 'text-amber-700'}`}>{confirmed.applicationReady ? 'Ready to Apply' : 'Needs Updates'}</p>
              </div>
              <div className="bg-[#fdf8f8] rounded-2xl border border-[#e0bec6]/50 p-4 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-[#8c7077] font-bold">Profile ID / Candidate ID</p>
                <p className="text-xs font-mono font-bold text-[#1c1b1b] mt-2 truncate" title={confirmed.candidateId}>{confirmed.candidateId}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button onClick={() => onNavigateTab?.('feed')} className="rounded-full bg-[#e2007c] text-white px-5 py-3 text-xs font-bold hover:bg-[#b50062] transition-colors">Search Jobs</button>
              <button onClick={() => onNavigateTab?.('applications')} className="rounded-full bg-[#8e004b] text-white px-5 py-3 text-xs font-bold hover:bg-[#b90064] transition-colors">View My Applications</button>
              <button onClick={() => { setSubmission(null); setIsEditing(true); setStep(0); }} className="rounded-full bg-white border border-[#8e004b] text-[#8e004b] px-5 py-3 text-xs font-bold hover:bg-[#ffd9e2]/20 transition-colors flex items-center justify-center gap-2"><Pencil className="w-4 h-4" /> Edit Profile</button>
            </div>
          </div>
        </section>
        {toastMessage && <Toast message={toastMessage} />}
      </div>
    );
  }

  if (!isEditing) {
    return (
      <div className="bg-white rounded-2xl border border-[#e0bec6]/50 p-10 text-center">
        <User className="w-12 h-12 mx-auto text-[#8e004b]" />
        <h2 className="text-xl font-extrabold mt-3">Complete your candidate profile</h2>
        <p className="text-sm text-[#594047] mt-1">Finish all eight steps before applying to employers.</p>
        <button onClick={() => setIsEditing(true)} className="mt-5 px-6 py-3 rounded-full bg-[#e2007c] text-white text-xs font-bold">Start Profile</button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-28">
      <section className="bg-white rounded-2xl border border-[#e0bec6]/50 shadow-sm overflow-hidden">
        <header className="px-5 md:px-7 pt-6 pb-4 border-b border-[#e0bec6]/40">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-[#e2007c]">Candidate Profile</p>
              <h1 className="text-xl md:text-2xl font-extrabold text-[#1c1b1b]">Complete your professional profile</h1>
              <p className="text-xs text-[#594047] mt-1">Step {step + 1} of 8 · Your details stay in this form if submission fails.</p>
            </div>
            <span className="shrink-0 rounded-full bg-[#ffd9e2] text-[#8e004b] px-3 py-1 text-xs font-bold">{Math.round(((step + 1) / 8) * 100)}%</span>
          </div>
          <div className="mt-5 flex gap-2 overflow-x-auto no-scrollbar pb-1" aria-label="Profile steps">
            {STEPS.map(({ label, icon: Icon }, index) => (
              <button
                key={label}
                type="button"
                onClick={() => { if (index <= step) { setStep(index); setValidationError(null); } }}
                className={`min-w-[112px] px-3 py-2 rounded-xl border text-left transition-colors ${index === step ? 'bg-[#8e004b] border-[#8e004b] text-white' : index < step ? 'bg-[#ffd9e2]/30 border-[#e0bec6] text-[#8e004b]' : 'bg-[#fdf8f8] border-[#e0bec6]/60 text-[#8c7077]'}`}
              >
                <Icon className="w-4 h-4 mb-1" />
                <span className="block text-[10px] font-bold whitespace-nowrap">{index + 1}. {label}</span>
              </button>
            ))}
          </div>
          <div className="h-1 bg-[#f1edec] mt-4 rounded-full overflow-hidden"><div className="h-full bg-[#e2007c] transition-all" style={{ width: `${((step + 1) / 8) * 100}%` }} /></div>
        </header>

        <div className="p-5 md:p-7 min-h-[410px]">
          {step === 0 && (
            <Step title="Personal" description="Tell employers who you are and what you do.">
              <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                <div className="relative shrink-0">
                  {avatarPreview ? <img src={avatarPreview} alt="Profile preview" className="w-28 h-28 rounded-full object-cover border-4 border-[#ffd9e2]" /> : <div className="w-28 h-28 rounded-full bg-[#ffd9e2] text-[#8e004b] grid place-items-center text-3xl font-bold">{fullName.charAt(0) || <User />}</div>}
                  <label className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-[#e2007c] text-white grid place-items-center border-2 border-white cursor-pointer" title="Choose profile image">
                    <Camera className="w-4 h-4" /><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { setAvatarFile(event.target.files?.[0] || null); setUploadedAvatarPath(undefined); }} />
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-4 flex-1 w-full">
                  <Field label="Full Name *"><input className={fieldClass} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" /></Field>
                  <Field label="Professional Role *"><input className={fieldClass} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Senior Hair Stylist" /></Field>
                </div>
              </div>
              <Field label={`Professional Bio (${bio.length}/500)`}><textarea rows={5} maxLength={500} className={fieldClass} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Describe your experience, style and career goals…" /></Field>
            </Step>
          )}

          {step === 1 && (
            <Step title="Contact" description="These details are linked to your signed-in account.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Email"><input className={`${fieldClass} opacity-70`} value={userProfile.email} readOnly /></Field>
                <Field label="Phone Number *"><input className={fieldClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" /></Field>
                <Field label="City *"><input className={fieldClass} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Mumbai" /></Field>
                <Field label="State *"><input className={fieldClass} value={state} onChange={(e) => setState(e.target.value)} placeholder="Maharashtra" /></Field>
              </div>
            </Step>
          )}

          {step === 2 && (
            <Step title="Education" description="Add beauty school, degree or professional training. This step is optional.">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#fdf8f8] p-4 rounded-2xl border border-[#e0bec6]/40">
                <input className={fieldClass} value={educationDraft.courseName} onChange={(e) => setEducationDraft({ ...educationDraft, courseName: e.target.value })} placeholder="Course / qualification" />
                <input className={fieldClass} value={educationDraft.institutionName} onChange={(e) => setEducationDraft({ ...educationDraft, institutionName: e.target.value })} placeholder="Institution" />
                <input type="number" min="1950" max="2200" className={fieldClass} value={educationDraft.completionYear} onChange={(e) => setEducationDraft({ ...educationDraft, completionYear: e.target.value })} placeholder="Completion year" />
                <button type="button" onClick={addEducation} className="sm:col-span-3 justify-self-start px-4 py-2 rounded-full bg-[#8e004b] text-white text-xs font-bold flex items-center gap-1"><Plus className="w-4 h-4" /> Add Education</button>
              </div>
              <RecordList empty="No education added yet." items={education.map((item) => ({ id: item.id!, title: item.courseName, subtitle: [item.institutionName, item.completionYear].filter(Boolean).join(' · ') }))} onRemove={(id) => setEducation((current) => current.filter((item) => item.id !== id))} />
            </Step>
          )}

          {step === 3 && (
            <Step title="Experience" description="Add your experience level and relevant salon work.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Experience Level"><select className={fieldClass} value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value as CandidateExperienceLevel)}><option value="fresher">Fresher</option><option value="junior">Junior</option><option value="mid">Mid-level</option><option value="senior">Senior</option><option value="lead">Lead / Manager</option></select></Field>
                <Field label="Total Experience (months)"><input type="number" min="0" className={fieldClass} value={totalExperienceMonths} onChange={(e) => setTotalExperienceMonths(Math.max(0, Number(e.target.value)))} /></Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#fdf8f8] p-4 rounded-2xl border border-[#e0bec6]/40">
                <input className={fieldClass} value={experienceDraft.roleTitle} onChange={(e) => setExperienceDraft({ ...experienceDraft, roleTitle: e.target.value })} placeholder="Role title" />
                <input className={fieldClass} value={experienceDraft.salonName} onChange={(e) => setExperienceDraft({ ...experienceDraft, salonName: e.target.value })} placeholder="Salon / company" />
                <input className={fieldClass} value={experienceDraft.city} onChange={(e) => setExperienceDraft({ ...experienceDraft, city: e.target.value })} placeholder="City" />
                <input className={fieldClass} value={experienceDraft.state} onChange={(e) => setExperienceDraft({ ...experienceDraft, state: e.target.value })} placeholder="State" />
                <Field label="Start date"><input type="date" className={fieldClass} value={experienceDraft.startDate} onChange={(e) => setExperienceDraft({ ...experienceDraft, startDate: e.target.value })} /></Field>
                <Field label="End date"><input type="date" disabled={experienceDraft.currentlyWorking} className={fieldClass} value={experienceDraft.endDate} onChange={(e) => setExperienceDraft({ ...experienceDraft, endDate: e.target.value })} /></Field>
                <label className="sm:col-span-2 flex items-center gap-2 text-xs font-semibold text-[#594047]"><input type="checkbox" checked={experienceDraft.currentlyWorking} onChange={(e) => setExperienceDraft({ ...experienceDraft, currentlyWorking: e.target.checked, endDate: '' })} /> I currently work here</label>
                <textarea className={`${fieldClass} sm:col-span-2`} rows={2} value={experienceDraft.description} onChange={(e) => setExperienceDraft({ ...experienceDraft, description: e.target.value })} placeholder="Responsibilities and achievements" />
                <button type="button" onClick={addExperience} className="sm:col-span-2 justify-self-start px-4 py-2 rounded-full bg-[#8e004b] text-white text-xs font-bold flex items-center gap-1"><Plus className="w-4 h-4" /> Add Experience</button>
              </div>
              <RecordList empty="No work history added yet." items={experience.map((item) => ({ id: item.id!, title: item.roleTitle, subtitle: `${item.salonName} · ${item.startDate}${item.currentlyWorking ? ' – Present' : item.endDate ? ` – ${item.endDate}` : ''}` }))} onRemove={(id) => setExperience((current) => current.filter((item) => item.id !== id))} />
            </Step>
          )}

          {step === 4 && (
            <Step title="Skills" description="Add at least one skill employers can match with their jobs.">
              <div className="flex gap-2"><input className={fieldClass} value={skillDraft} onChange={(e) => setSkillDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }} placeholder="e.g. Balayage, Nail Art, Facials" /><button type="button" onClick={addSkill} className="px-5 rounded-xl bg-[#8e004b] text-white text-xs font-bold">Add</button></div>
              <div className="flex flex-wrap gap-2">{skills.map((skill) => <span key={skill} className="px-3 py-2 rounded-full bg-[#ffd9e2] text-[#8e004b] text-xs font-bold flex items-center gap-2">{skill}<button type="button" onClick={() => setSkills((current) => current.filter((item) => item !== skill))}><Trash2 className="w-3 h-3" /></button></span>)}</div>
            </Step>
          )}

          {step === 5 && (
            <Step title="Preferred Job" description="Set the roles, work types and compensation you prefer.">
              <div className="flex gap-2"><input className={fieldClass} value={roleDraft} onChange={(e) => setRoleDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRole(); } }} placeholder="e.g. Senior Colorist" /><button type="button" onClick={addRole} className="px-5 rounded-xl bg-[#8e004b] text-white text-xs font-bold">Add Role</button></div>
              <div className="flex flex-wrap gap-2">{preferredRoles.map((role) => <span key={role} className="px-3 py-2 rounded-full bg-[#ffd9e2] text-[#8e004b] text-xs font-bold flex items-center gap-2">{role}<button type="button" onClick={() => setPreferredRoles((current) => current.filter((item) => item !== role))}><Trash2 className="w-3 h-3" /></button></span>)}</div>
              <div><p className={`${labelClass} mb-2`}>Employment Types *</p><div className="flex flex-wrap gap-2">{EMPLOYMENT_TYPES.map((type) => <label key={type.value} className={`px-3 py-2 rounded-full border text-xs font-bold cursor-pointer ${employmentTypes.includes(type.value) ? 'bg-[#8e004b] border-[#8e004b] text-white' : 'bg-white border-[#e0bec6] text-[#594047]'}`}><input type="checkbox" className="sr-only" checked={employmentTypes.includes(type.value)} onChange={() => setEmploymentTypes((current) => current.includes(type.value) ? current.filter((item) => item !== type.value) : [...current, type.value])} />{type.label}</label>)}</div></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Minimum expected salary"><input type="number" min="0" className={fieldClass} value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} placeholder="30000" /></Field>
                <Field label="Maximum expected salary"><input type="number" min="0" className={fieldClass} value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} placeholder="60000" /></Field>
                <Field label="Available from"><input type="date" className={fieldClass} value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} /></Field>
                <label className="flex items-center gap-3 rounded-xl bg-[#fdf8f8] border border-[#e0bec6]/60 p-3 text-xs font-bold"><input type="checkbox" checked={openToRelocation} onChange={(e) => setOpenToRelocation(e.target.checked)} /> Open to relocation</label>
              </div>
            </Step>
          )}

          {step === 6 && (
            <Step title="Documents" description="Upload a resume and add certifications if available. Files upload securely when you submit.">
              <label className="border-2 border-dashed border-[#e0bec6] rounded-2xl p-6 text-center cursor-pointer hover:border-[#8e004b] block">
                <Upload className="w-8 h-8 text-[#8e004b] mx-auto" /><p className="text-xs font-bold mt-2">{pendingResume ? pendingResume.name : 'Choose PDF, DOC or DOCX resume (max 5MB)'}</p>
                <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => { setPendingResume(e.target.files?.[0] || null); setUploadedResumeId(null); }} />
              </label>
              {resumesLoading ? <p className="text-xs text-[#594047]">Loading resumes…</p> : resumes.map((resume) => <div key={resume.id} className="flex items-center gap-3 rounded-xl border border-[#e0bec6]/60 p-3"><FileText className="w-5 h-5 text-[#8e004b]" /><div className="min-w-0 flex-1"><p className="text-xs font-bold truncate">{resume.fileName}</p><button type="button" onClick={() => void makePrimary(resume)} disabled={resume.isPrimary} className="text-[10px] text-[#8e004b] font-bold disabled:text-emerald-700">{resume.isPrimary ? 'Primary resume' : 'Make primary'}</button></div><button type="button" onClick={() => void openResume(resume)}><Download className="w-4 h-4 text-[#594047]" /></button><button type="button" onClick={() => void removeResume(resume)}><Trash2 className="w-4 h-4 text-rose-600" /></button></div>)}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#fdf8f8] p-4 rounded-2xl border border-[#e0bec6]/40">
                <input className={fieldClass} value={certificationDraft.certificateName} onChange={(e) => setCertificationDraft({ ...certificationDraft, certificateName: e.target.value })} placeholder="Certification name" />
                <input className={fieldClass} value={certificationDraft.institutionName} onChange={(e) => setCertificationDraft({ ...certificationDraft, institutionName: e.target.value })} placeholder="Issuer" />
                <input type="number" min="1950" max="2200" className={fieldClass} value={certificationDraft.completionYear} onChange={(e) => setCertificationDraft({ ...certificationDraft, completionYear: e.target.value })} placeholder="Year" />
                <button type="button" onClick={addCertification} className="sm:col-span-3 justify-self-start px-4 py-2 rounded-full bg-[#8e004b] text-white text-xs font-bold flex items-center gap-1"><Plus className="w-4 h-4" /> Add Certification</button>
              </div>
              <RecordList empty="No certifications added yet." items={certifications.map((item) => ({ id: item.id!, title: item.certificateName, subtitle: [item.institutionName, item.completionYear].filter(Boolean).join(' · ') }))} onRemove={(id) => setCertifications((current) => current.filter((item) => item.id !== id))} />
              {documentError && <ErrorCard message={documentError} />}
            </Step>
          )}

          {step === 7 && (
            <Step title="Review & Submit" description="Review the summary below. You can return to any completed step before submitting.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Summary title="Personal" value={`${fullName} · ${headline}`} onEdit={() => setStep(0)} />
                <Summary title="Contact" value={`${phone} · ${city}, ${state}`} onEdit={() => setStep(1)} />
                <Summary title="Education" value={`${education.length} entr${education.length === 1 ? 'y' : 'ies'}`} onEdit={() => setStep(2)} />
                <Summary title="Experience" value={`${experienceLevel} · ${totalExperienceMonths} months · ${experience.length} positions`} onEdit={() => setStep(3)} />
                <Summary title="Skills" value={skills.join(', ') || 'None'} onEdit={() => setStep(4)} />
                <Summary title="Preferred Job" value={`${preferredRoles.join(', ')} · ${employmentTypes.length} work types`} onEdit={() => setStep(5)} />
                <Summary title="Documents" value={`${pendingResume ? 'New resume selected' : resumes.length ? `${resumes.length} resume(s)` : 'No resume'} · ${certifications.length} certification(s)`} onEdit={() => setStep(6)} />
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4"><p className="text-xs font-extrabold text-emerald-800">Application Ready</p><p className="text-[11px] text-emerald-700 mt-1">After a successful database confirmation you can apply to open jobs.</p></div>
              </div>
              {submitError && <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4" role="alert"><div className="flex gap-2"><AlertCircle className="w-5 h-5 text-rose-700 shrink-0" /><div><p className="text-xs font-extrabold text-rose-800">Profile submission failed</p><p className="text-xs text-rose-700 mt-1">{submitError}</p></div></div><button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting} className="mt-3 px-4 py-2 rounded-full bg-rose-700 text-white text-xs font-bold flex items-center gap-2"><RotateCcw className="w-4 h-4" /> Retry Submission</button></div>}
            </Step>
          )}

          {validationError && <ErrorCard message={validationError} />}
        </div>
      </section>

      <div className="fixed bottom-20 sm:bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#e0bec6]/50 p-4 shadow-[0_-4px_12px_rgba(90,63,71,0.06)]">
        <div className="max-w-4xl mx-auto flex justify-between gap-3">
          <button type="button" onClick={() => { if (step > 0) setStep((current) => current - 1); else if (confirmed) setIsEditing(false); }} disabled={step === 0 && !confirmed} className="px-5 py-3 rounded-full border border-[#8c7077] text-[#594047] text-xs font-bold disabled:opacity-40 flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button>
          {step < 7 ? <button type="button" onClick={goNext} className="px-7 py-3 rounded-full bg-[#e2007c] text-white text-xs font-bold flex items-center gap-2">Continue <ArrowRight className="w-4 h-4" /></button> : <button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting} className="min-w-[220px] px-7 py-3 rounded-full bg-[#e2007c] disabled:opacity-70 text-white text-xs font-bold flex items-center justify-center gap-2">{isSubmitting ? <><LoaderCircle className="w-4 h-4 animate-spin" /> Submitting your profile...</> : <><CheckCircle2 className="w-4 h-4" /> Submit Profile</>}</button>}
        </div>
      </div>
      {toastMessage && <Toast message={toastMessage} />}
    </div>
  );
};

const Step: React.FC<{ title: string; description: string; children: React.ReactNode }> = ({ title, description, children }) => <div className="space-y-5 animate-in fade-in duration-200"><div><h2 className="text-lg font-extrabold text-[#1c1b1b]">{title}</h2><p className="text-xs text-[#594047] mt-1">{description}</p></div>{children}</div>;
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => <label className="flex flex-col gap-1.5"><span className={labelClass}>{label}</span>{children}</label>;
const ErrorCard: React.FC<{ message: string }> = ({ message }) => <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 flex gap-2 text-xs font-semibold text-rose-700"><AlertCircle className="w-4 h-4 shrink-0" />{message}</div>;
const Toast: React.FC<{ message: string }> = ({ message }) => <div role="status" className="fixed bottom-24 right-6 z-[80] bg-[#1c1b1b] text-white px-4 py-3 rounded-2xl shadow-xl border border-white/20 flex items-center gap-2 text-xs font-bold"><CheckCircle2 className="w-4 h-4 text-emerald-400" />{message}</div>;
const RecordList: React.FC<{ empty: string; items: Array<{ id: string; title: string; subtitle: string }>; onRemove: (id: string) => void }> = ({ empty, items, onRemove }) => items.length === 0 ? <p className="rounded-xl border border-dashed border-[#e0bec6] p-4 text-center text-xs text-[#8c7077]">{empty}</p> : <div className="space-y-2">{items.map((item) => <div key={item.id} className="rounded-xl border border-[#e0bec6]/60 p-3 flex items-start gap-3"><div className="flex-1 min-w-0"><p className="text-xs font-bold text-[#1c1b1b]">{item.title}</p><p className="text-[11px] text-[#594047] mt-0.5">{item.subtitle}</p></div><button type="button" onClick={() => onRemove(item.id)} className="text-rose-600 p-1"><Trash2 className="w-4 h-4" /></button></div>)}</div>;
const Summary: React.FC<{ title: string; value: string; onEdit: () => void }> = ({ title, value, onEdit }) => <div className="rounded-2xl bg-[#fdf8f8] border border-[#e0bec6]/60 p-4"><div className="flex justify-between gap-2"><p className="text-xs font-extrabold text-[#8e004b]">{title}</p><button type="button" onClick={onEdit} className="text-[10px] font-bold text-[#b50062]">Edit</button></div><p className="text-[11px] text-[#594047] mt-1 break-words">{value}</p></div>;

import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  Loader2,
  MapPin,
  Plus,
  Store,
  X,
} from 'lucide-react';
import { JobPosting } from '../../types';
import { mapBackendError } from '../../services/backend';

interface PostJobWizardProps {
  onClose: () => void;
  onComplete: (job: Partial<JobPosting>) => Promise<JobPosting>;
  onViewJobPosts: () => void;
  onViewApplications: () => void;
  onPostAnother: () => void;
  initialJob?: JobPosting | null;
  initialBusinessName?: string;
  initialContactPerson?: string;
  initialContactMobile?: string;
  initialCity?: string;
  initialArea?: string;
}

type InterviewMode = NonNullable<JobPosting['interviewMode']>;
type PostingStatus = NonNullable<JobPosting['postingStatus']>;

const inputClass = 'w-full rounded-lg border border-[#cbd5e1] bg-[#f8fafc] px-4 py-3 text-base text-[#0f172a] outline-none transition-all placeholder:text-[#64748b] focus:border-[#4f46e5] focus:bg-white focus:ring-1 focus:ring-[#4f46e5]';
const labelClass = 'text-[13px] font-semibold text-[#0f172a]';

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className={labelClass} htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

function digits(value: string) {
  return value.replace(/\D/g, '');
}

export const PostJobWizard: React.FC<PostJobWizardProps> = ({
  onClose,
  onComplete,
  onViewJobPosts,
  onViewApplications,
  onPostAnother,
  initialJob,
  initialBusinessName = '',
  initialContactPerson = '',
  initialContactMobile = '',
  initialCity = '',
  initialArea = '',
}) => {
  const totalSteps = 5;
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savedJob, setSavedJob] = useState<JobPosting | null>(null);

  const [title, setTitle] = useState(initialJob?.title || '');
  const [businessName, setBusinessName] = useState(initialJob?.businessName || initialJob?.salonName || initialBusinessName);
  const [category, setCategory] = useState<JobPosting['category']>(initialJob?.category || 'Hair');
  const [jobRole, setJobRole] = useState(initialJob?.jobRole || initialJob?.title || '');
  const [description, setDescription] = useState(initialJob?.description || '');

  const [skills, setSkills] = useState<string[]>(initialJob?.requirements || []);
  const [skillInput, setSkillInput] = useState('');
  const [minExp, setMinExp] = useState(String((initialJob?.experienceMinMonths || 0) / 12));
  const [maxExp, setMaxExp] = useState(String((initialJob?.experienceMaxMonths ?? 24) / 12));
  const [freshersAllowed, setFreshersAllowed] = useState(initialJob?.freshersAllowed || false);
  const [minSalary, setMinSalary] = useState(initialJob?.salaryMin == null ? '' : String(initialJob.salaryMin));
  const [maxSalary, setMaxSalary] = useState(initialJob?.salaryMax == null ? '' : String(initialJob.salaryMax));
  const [payType, setPayType] = useState<NonNullable<JobPosting['payType']>>(initialJob?.payType || 'monthly');
  const [jobType, setJobType] = useState<JobPosting['jobType']>(initialJob?.jobType || 'Full-time');

  const [workplaceType, setWorkplaceType] = useState<NonNullable<JobPosting['workplaceType']>>(initialJob?.workplaceType || 'on_site');
  const [workLocation, setWorkLocation] = useState(initialJob?.workLocation || '');
  const [city, setCity] = useState(initialJob?.city || initialCity);
  const [area, setArea] = useState(initialJob?.area || initialArea);
  const [openings, setOpenings] = useState(String(initialJob?.openings || 1));

  const [contactPerson, setContactPerson] = useState(initialJob?.contactPerson || initialContactPerson);
  const [contactMobile, setContactMobile] = useState(initialJob?.contactMobile || initialContactMobile);
  const [whatsappNumber, setWhatsappNumber] = useState(initialJob?.whatsappNumber || initialContactMobile);
  const [interviewMode, setInterviewMode] = useState<InterviewMode>(initialJob?.interviewMode || 'in_person');
  const [postingStatus, setPostingStatus] = useState<PostingStatus>(initialJob ? (initialJob.postingStatus || (initialJob.approvalStatus === 'approved' ? 'published' : 'draft')) : 'published');

  const salarySuffix: Record<NonNullable<JobPosting['payType']>, string> = {
    monthly: '/month',
    daily: '/day',
    hourly: '/hour',
    commission: ' commission',
  };
  const formattedSalary = minSalary && maxSalary
    ? `₹${Number(minSalary).toLocaleString('en-IN')} - ₹${Number(maxSalary).toLocaleString('en-IN')}${salarySuffix[payType]}`
    : 'Not entered';
  const displayLocation = workplaceType === 'remote' ? 'Remote' : [area, city].filter(Boolean).join(', ');

  const addSkill = (value: string) => {
    const skill = value.trim();
    if (skill && !skills.some((item) => item.toLowerCase() === skill.toLowerCase())) {
      setSkills((current) => [...current, skill]);
    }
    setSkillInput('');
  };

  const validateStep = (targetStep = step) => {
    if (targetStep === 1) {
      if (title.trim().length < 2) return 'Enter a valid job title.';
      if (businessName.trim().length < 2) return 'Enter your business or salon name.';
      if (jobRole.trim().length < 2) return 'Enter the job role.';
      if (description.trim().length < 20) return 'Add a job description of at least 20 characters.';
    }
    if (targetStep === 2) {
      if (skills.length === 0) return 'Add at least one required skill.';
      if (Number(maxExp) < Number(minExp)) return 'Maximum experience must be greater than minimum experience.';
      if (!minSalary || !maxSalary || Number(minSalary) <= 0 || Number(maxSalary) <= 0) return 'Enter a valid salary range.';
      if (Number(maxSalary) < Number(minSalary)) return 'Maximum salary must be greater than minimum salary.';
    }
    if (targetStep === 3) {
      if (workLocation.trim().length < 2) return 'Enter the work location.';
      if (city.trim().length < 2) return 'Enter the city.';
      if (area.trim().length < 2) return 'Enter the area.';
      if (!Number.isInteger(Number(openings)) || Number(openings) < 1 || Number(openings) > 1000) return 'Enter a valid number of openings.';
    }
    if (targetStep === 4) {
      if (contactPerson.trim().length < 2) return 'Enter the contact person name.';
      if (digits(contactMobile).length < 7 || digits(contactMobile).length > 15) return 'Enter a valid contact mobile number.';
      if (digits(whatsappNumber).length < 7 || digits(whatsappNumber).length > 15) return 'Enter a valid WhatsApp number.';
    }
    return null;
  };

  const handleNext = () => {
    const error = validateStep();
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    setStep((current) => Math.min(totalSteps, current + 1));
  };

  const validateAll = () => {
    for (let current = 1; current <= 4; current += 1) {
      const error = validateStep(current);
      if (error) return error;
    }
    return null;
  };

  const handleComplete = async () => {
    if (isSubmitting) return;
    const error = validateAll();
    if (error) {
      setSubmitError(error);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const now = new Date().toISOString();
      const result = await onComplete({
        ...(initialJob ? { id: initialJob.id } : {}),
        title: title.trim(),
        salonName: businessName.trim(),
        businessName: businessName.trim(),
        category,
        jobRole: jobRole.trim(),
        description: description.trim(),
        requirements: skills,
        experienceMinMonths: Number(minExp) * 12,
        experienceMaxMonths: Number(maxExp) * 12,
        freshersAllowed,
        salary: formattedSalary,
        salaryMin: Number(minSalary),
        salaryMax: Number(maxSalary),
        payType,
        jobType,
        workplaceType,
        workLocation: workLocation.trim(),
        location: displayLocation,
        city: city.trim(),
        area: area.trim(),
        contactPerson: contactPerson.trim(),
        contactMobile: contactMobile.trim(),
        whatsappNumber: whatsappNumber.trim(),
        openings: Number(openings),
        interviewMode,
        postingStatus,
        approvalStatus: postingStatus === 'published' ? 'approved' : 'draft',
        postedDate: 'Just now',
        publishedAt: now,
        tags: ['New Listing'],
        benefits: ['Benefits discussed during interview'],
      });
      setSavedJob(result);
      setStep(6);
    } catch (caught) {
      setSubmitError(mapBackendError(caught, 'Unable to save this job. Your details are still here — please retry.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForAnotherJob = () => {
    onPostAnother();
    setTitle('');
    setJobRole('');
    setDescription('');
    setSkills([]);
    setSkillInput('');
    setMinExp('0');
    setMaxExp('2');
    setFreshersAllowed(false);
    setMinSalary('');
    setMaxSalary('');
    setWorkLocation('');
    setOpenings('1');
    setPostingStatus('published');
    setSavedJob(null);
    setSubmitError(null);
    setValidationError(null);
    setStep(1);
  };

  const renderStep1 = () => (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h2 className="text-xl font-semibold text-[#0f172a]">Job details</h2>
        <p className="mt-1 text-sm text-[#475569]">Tell candidates about the role and your business.</p>
      </div>
      <Field label="Job Title" id="job-title">
        <input id="job-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Senior Hair Stylist" className={inputClass} />
      </Field>
      <Field label="Business / Salon Name" id="business-name">
        <input id="business-name" value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Your registered business name" className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" id="job-category">
          <div className="relative">
            <select id="job-category" value={category} onChange={(event) => setCategory(event.target.value as JobPosting['category'])} className={`${inputClass} appearance-none pr-10`}>
              {(['Hair', 'Skincare', 'Nails', 'Lashes & Brows', 'Massage', 'Management'] as JobPosting['category'][]).map((value) => <option key={value}>{value}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#475569]" />
          </div>
        </Field>
        <Field label="Job Role" id="job-role">
          <input id="job-role" value={jobRole} onChange={(event) => setJobRole(event.target.value)} placeholder="e.g. Lead Stylist" className={inputClass} />
        </Field>
      </div>
      <Field label="Job Description" id="job-description">
        <textarea id="job-description" rows={6} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the work, responsibilities and ideal candidate..." className={inputClass} />
      </Field>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-7 animate-in fade-in duration-200">
      <div>
        <h2 className="text-xl font-semibold text-[#0f172a]">Requirements and salary</h2>
        <p className="mt-1 text-sm text-[#475569]">Set clear experience, skill and pay expectations.</p>
      </div>
      <Field label="Skills Required" id="skill-input">
        <div className="flex gap-2">
          <input
            id="skill-input"
            value={skillInput}
            onChange={(event) => setSkillInput(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addSkill(skillInput); } }}
            placeholder="Type a skill and press Enter"
            className={inputClass}
          />
          <button type="button" onClick={() => addSkill(skillInput)} className="rounded-lg bg-[#ede9fe] px-4 text-[#4f46e5] hover:bg-[#ddd6fe]" aria-label="Add skill"><Plus className="h-5 w-5" /></button>
        </div>
        {skills.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {skills.map((skill) => (
              <span key={skill} className="inline-flex items-center gap-1 rounded-full border border-[#c4b5fd] bg-[#ede9fe] px-3 py-1.5 text-[13px] font-semibold text-[#312e81]">
                {skill}
                <button type="button" onClick={() => setSkills((current) => current.filter((item) => item !== skill))} aria-label={`Remove ${skill}`}><X className="h-4 w-4" /></button>
              </span>
            ))}
          </div>
        )}
      </Field>
      <section className="rounded-xl border border-[#cbd5e1] bg-white p-4">
        <h3 className={labelClass}>Experience Required</h3>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <Field label="Minimum years" id="minimum-experience"><input id="minimum-experience" type="number" min="0" max="50" value={minExp} onChange={(event) => setMinExp(event.target.value)} className={inputClass} /></Field>
          <Field label="Maximum years" id="maximum-experience"><input id="maximum-experience" type="number" min="0" max="50" value={maxExp} onChange={(event) => setMaxExp(event.target.value)} className={inputClass} /></Field>
        </div>
        <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm font-medium text-[#475569]">
          <input type="checkbox" checked={freshersAllowed} onChange={(event) => setFreshersAllowed(event.target.checked)} className="h-4 w-4 accent-[#7c3aed]" /> Freshers can apply
        </label>
      </section>
      <section className="rounded-xl border border-[#cbd5e1] bg-white p-4">
        <h3 className={labelClass}>Salary Range</h3>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <Field label="Minimum" id="minimum-salary"><input id="minimum-salary" type="number" min="0" value={minSalary} onChange={(event) => setMinSalary(event.target.value)} placeholder="20000" className={inputClass} /></Field>
          <Field label="Maximum" id="maximum-salary"><input id="maximum-salary" type="number" min="0" value={maxSalary} onChange={(event) => setMaxSalary(event.target.value)} placeholder="35000" className={inputClass} /></Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(['monthly', 'daily', 'hourly', 'commission'] as const).map((value) => (
            <label key={value} className="cursor-pointer">
              <input type="radio" name="pay-type" value={value} checked={payType === value} onChange={() => setPayType(value)} className="peer sr-only" />
              <span className="inline-flex rounded-full border border-[#cbd5e1] px-4 py-2 text-[13px] font-medium capitalize text-[#475569] peer-checked:border-[#4f46e5] peer-checked:bg-[#ede9fe] peer-checked:text-[#4f46e5]">{value}</span>
            </label>
          ))}
        </div>
      </section>
      <div>
        <h3 className={labelClass}>Job Type</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {(['Full-time', 'Part-time', 'Contract', 'Commission'] as JobPosting['jobType'][]).map((value) => (
            <label key={value} className="cursor-pointer">
              <input type="radio" name="job-type" checked={jobType === value} onChange={() => setJobType(value)} className="peer sr-only" />
              <span className="inline-flex rounded-full border border-[#cbd5e1] px-4 py-2 text-[13px] font-medium text-[#475569] peer-checked:border-[#4f46e5] peer-checked:bg-[#ede9fe] peer-checked:text-[#4f46e5]">{value === 'Commission' ? 'Freelance' : value}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-7 animate-in fade-in duration-200">
      <div>
        <h2 className="text-xl font-semibold text-[#0f172a]">Location and openings</h2>
        <p className="mt-1 text-sm text-[#475569]">Help candidates understand where the work happens.</p>
      </div>
      <div>
        <h3 className={labelClass}>Workplace Type</h3>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {([['on_site', 'On-site'], ['hybrid', 'Hybrid'], ['remote', 'Remote']] as const).map(([value, label]) => (
            <label key={value} className="cursor-pointer">
              <input type="radio" name="workplace-type" checked={workplaceType === value} onChange={() => { setWorkplaceType(value); if (value === 'remote' && !workLocation) setWorkLocation('Remote'); }} className="peer sr-only" />
              <span className="flex justify-center rounded-lg border border-[#cbd5e1] bg-white px-2 py-4 text-sm font-medium text-[#475569] peer-checked:border-[#4f46e5] peer-checked:bg-[#ede9fe] peer-checked:text-[#4f46e5]">{label}</span>
            </label>
          ))}
        </div>
      </div>
      <Field label="Work Location" id="work-location">
        <input id="work-location" value={workLocation} onChange={(event) => setWorkLocation(event.target.value)} placeholder="Building, street or Remote" className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="City" id="job-city"><input id="job-city" value={city} onChange={(event) => setCity(event.target.value)} placeholder="e.g. Jaipur" className={inputClass} /></Field>
        <Field label="Area" id="job-area"><input id="job-area" value={area} onChange={(event) => setArea(event.target.value)} placeholder="e.g. C-Scheme" className={inputClass} /></Field>
      </div>
      <Field label="Number of Openings" id="job-openings">
        <input id="job-openings" type="number" min="1" max="1000" value={openings} onChange={(event) => setOpenings(event.target.value)} className={inputClass} />
      </Field>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-7 animate-in fade-in duration-200">
      <div>
        <h2 className="text-xl font-semibold text-[#0f172a]">Contact and publishing</h2>
        <p className="mt-1 text-sm text-[#475569]">Set the contact details, interview mode and job status.</p>
      </div>
      <Field label="Contact Person" id="contact-person"><input id="contact-person" value={contactPerson} onChange={(event) => setContactPerson(event.target.value)} placeholder="Full name" className={inputClass} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact Mobile" id="contact-mobile"><input id="contact-mobile" type="tel" value={contactMobile} onChange={(event) => setContactMobile(event.target.value)} placeholder="+91 98765 43210" className={inputClass} /></Field>
        <Field label="WhatsApp Number" id="whatsapp-number"><input id="whatsapp-number" type="tel" value={whatsappNumber} onChange={(event) => setWhatsappNumber(event.target.value)} placeholder="+91 98765 43210" className={inputClass} /></Field>
      </div>
      <div>
        <h3 className={labelClass}>Interview Mode</h3>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([['in_person', 'In-person'], ['video', 'Video'], ['phone', 'Phone'], ['hybrid', 'Hybrid']] as const).map(([value, label]) => (
            <label key={value} className="cursor-pointer">
              <input type="radio" name="interview-mode" checked={interviewMode === value} onChange={() => setInterviewMode(value)} className="peer sr-only" />
              <span className="flex justify-center rounded-lg border border-[#cbd5e1] bg-white px-2 py-3 text-[13px] font-medium text-[#475569] peer-checked:border-[#4f46e5] peer-checked:bg-[#ede9fe] peer-checked:text-[#4f46e5]">{label}</span>
            </label>
          ))}
        </div>
      </div>
      <section className="rounded-xl border border-[#cbd5e1] bg-white p-4">
        <h3 className={labelClass}>Status: Draft / Published</h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {([['draft', 'Draft'], ['published', 'Published']] as const).map(([value, label]) => (
            <label key={value} className="cursor-pointer">
              <input type="radio" name="posting-status" checked={postingStatus === value} onChange={() => setPostingStatus(value)} className="peer sr-only" />
              <span className="flex flex-col rounded-lg border border-[#cbd5e1] p-4 text-[#475569] peer-checked:border-[#4f46e5] peer-checked:bg-[#ede9fe] peer-checked:text-[#4f46e5]">
                <strong className="text-sm">{label}</strong>
                <span className="mt-1 text-xs">{value === 'published' ? 'Visible to candidates immediately' : 'Keep private and publish later'}</span>
              </span>
            </label>
          ))}
        </div>
      </section>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h2 className="text-xl font-semibold text-[#0f172a]">Review your job post</h2>
        <p className="mt-1 text-sm text-[#475569]">Confirm the details before saving them to your account.</p>
      </div>
      <section className="overflow-hidden rounded-xl border border-[#cbd5e1] bg-white shadow-sm">
        <div className="bg-gradient-to-r from-[#ede9fe] to-[#ddd6fe] p-6">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#7c3aed] shadow-sm"><Store className="h-6 w-6" /></div>
          <h3 className="text-xl font-bold text-[#312e81]">{title}</h3>
          <p className="mt-1 text-sm font-medium text-[#475569]">{businessName} · {jobRole}</p>
        </div>
        <dl className="grid gap-4 p-5 sm:grid-cols-2">
          {[
            ['Category', category],
            ['Location', displayLocation],
            ['Salary', formattedSalary],
            ['Experience', `${minExp}–${maxExp} years`],
            ['Job Type', jobType === 'Commission' ? 'Freelance' : jobType],
            ['Openings', openings],
            ['Interview Mode', interviewMode.replace('_', ' ')],
            ['Status', postingStatus === 'published' ? 'Published' : 'Draft'],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">{label}</dt>
              <dd className="mt-1 text-sm font-semibold capitalize text-[#0f172a]">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );

  const renderConfirmation = () => {
    const published = (savedJob?.postingStatus || postingStatus) === 'published' || savedJob?.approvalStatus === 'approved';
    const postedDate = new Date(savedJob?.publishedAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return (
      <div className="flex min-h-full flex-1 flex-col items-center justify-center py-10 animate-in zoom-in-95 duration-300">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-14 w-14" /></div>
        <div className="mt-6 text-center">
          <h1 className="text-2xl font-bold text-[#4f46e5]">{initialJob ? 'Your job post has been updated successfully.' : published ? 'Your job post has been published successfully.' : 'Your job post has been saved as a draft.'}</h1>
          <p className="mt-2 text-sm text-[#475569]">{published ? 'Candidates can now find and apply to this role.' : 'You can publish this job later from My Posted Jobs.'}</p>
        </div>
        <dl className="mt-7 w-full rounded-xl border border-[#cbd5e1] bg-white p-5 shadow-sm">
          {[
            ['Job Title', savedJob?.title || title],
            ['Location', savedJob?.location || displayLocation],
            ['Salary', savedJob?.salary || formattedSalary],
            ['Job Status', published ? 'Published' : 'Draft'],
            ['Posted Date', postedDate],
          ].map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4 border-b border-[#f1f5f9] py-3 last:border-0">
              <dt className="text-sm font-medium text-[#475569]">{label}</dt>
              <dd className="text-right text-sm font-bold text-[#0f172a]">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-7 grid w-full gap-3 sm:grid-cols-2">
          <button type="button" onClick={onViewJobPosts} className="rounded-full bg-[#7c3aed] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#6d28d9]">View My Job Posts</button>
          <button type="button" onClick={resetForAnotherJob} className="rounded-full border border-[#cbd5e1] bg-white px-5 py-3 text-sm font-bold text-[#4f46e5] hover:bg-[#f1f5f9]">Post Another Job</button>
          <button type="button" onClick={onViewApplications} className="rounded-full border border-[#cbd5e1] bg-white px-5 py-3 text-sm font-bold text-[#4f46e5] hover:bg-[#f1f5f9] sm:col-span-2">View Applications</button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-y-auto bg-[#f8fafc] animate-in slide-in-from-bottom-4 duration-300">
      {step !== 6 && (
        <header className="sticky top-0 z-50 bg-[#f8fafc] shadow-sm">
          <div className="relative mx-auto flex h-16 w-full max-w-2xl items-center justify-between px-5">
            <button type="button" onClick={step > 1 ? () => { setValidationError(null); setStep((current) => current - 1); } : onClose} className="-ml-2 rounded-full p-2 text-[#475569] hover:bg-[#e2e8f0]" aria-label={step > 1 ? 'Previous step' : 'Close post job form'}><ArrowLeft className="h-6 w-6" /></button>
            <h1 className="absolute left-1/2 -translate-x-1/2 text-xl font-semibold text-[#4f46e5]">{initialJob ? 'Edit Job' : 'Post a Job'}</h1>
            <span className="text-[13px] font-medium text-[#475569]">Step {step}/{totalSteps}</span>
          </div>
          <div className="h-1 w-full bg-[#e2e8f0]"><div className="h-full bg-[#7c3aed] transition-all" style={{ width: `${(step / totalSteps) * 100}%` }} /></div>
        </header>
      )}

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-6">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
        {step === 6 && renderConfirmation()}

        {step !== 6 && (
          <div className="mt-auto border-t border-[#cbd5e1]/50 pt-6">
            {(validationError || submitError) && <div role="alert" className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{validationError || submitError}</div>}
            <button
              type="button"
              onClick={step < totalSteps ? handleNext : () => void handleComplete()}
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#7c3aed] py-4 text-lg font-semibold text-white shadow-sm transition-all hover:bg-[#6d28d9] disabled:cursor-wait disabled:opacity-70"
            >
              {step < totalSteps ? <>Continue <ArrowRight className="h-5 w-5" /></> : isSubmitting ? <><Loader2 className="h-5 w-5 animate-spin" /> {initialJob ? 'Saving changes…' : 'Posting job…'}</> : <><BriefcaseBusiness className="h-5 w-5" /> {initialJob ? 'Save Changes' : 'Post Job'}</>}
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

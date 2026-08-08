import React, { useState } from 'react';
import { ArrowLeft, ChevronDown, Store, MapPin, Home, ArrowRight, Search, X, Plus, Gift, Banknote, ShieldPlus, Clock, Calendar } from 'lucide-react';
import { JobPosting } from '../../types';

interface PostJobWizardProps {
  onClose: () => void;
  onComplete: (job: Partial<JobPosting>) => void;
}

export const PostJobWizard: React.FC<PostJobWizardProps> = ({ onClose, onComplete }) => {
  const [step, setStep] = useState(1);
  const totalSteps = 5;

  // Form State - Step 1
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('hair');
  const [openings, setOpenings] = useState('1');
  const [jobType, setJobType] = useState('full-time');
  const [workplaceType, setWorkplaceType] = useState('on-site');

  // Form State - Step 2
  const [minExp, setMinExp] = useState('1');
  const [maxExp, setMaxExp] = useState('5');
  const [fresherAllowed, setFresherAllowed] = useState(false);
  const [skills, setSkills] = useState<string[]>(['Hair Styling', 'Coloring', 'Scalp Treatment']);
  const [skillInput, setSkillInput] = useState('');

  // Form State - Step 3
  const [minSalary, setMinSalary] = useState('');
  const [maxSalary, setMaxSalary] = useState('');
  const [payType, setPayType] = useState('Yearly');
  const [incentives, setIncentives] = useState(true);
  const [tipsAllowed, setTipsAllowed] = useState(true);
  const [fullBenefits, setFullBenefits] = useState(false);
  const [benefitsDesc, setBenefitsDesc] = useState('');

  // Form State - Step 4
  const [description, setDescription] = useState('');
  const [responsibilities, setResponsibilities] = useState('');
  const [workingDays, setWorkingDays] = useState('Mon-Fri');
  const [workingHours, setWorkingHours] = useState('9:00 AM - 6:00 PM');
  const [joiningDate, setJoiningDate] = useState('');
  const [weeklyOff, setWeeklyOff] = useState('Sunday');

  const suggestedSkills = ['Balayage', 'Keratin', 'Customer Service'];

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else if (step === 5) {
      setStep(6);
    }
  };

  const handleComplete = () => {
    onComplete({
      title,
      category: category === 'hair' ? 'Hair' : category === 'color' ? 'Hair' : 'Nails', // Map properly in real app
      jobType: jobType === 'full-time' ? 'Full-time' : jobType === 'part-time' ? 'Part-time' : 'Commission',
      location: workplaceType === 'remote' ? 'Remote' : 'Beverly Hills, CA',
      salary: minSalary && maxSalary ? `$${minSalary} - $${maxSalary}/${payType === 'Yearly' ? 'yr' : payType === 'Monthly' ? 'mo' : 'hr'}` : '$60,000 - $85,000/yr',
      description: description || 'Detailed description here...',
      requirements: skills,
      benefits: fullBenefits ? ['Full Benefits', ...tipsAllowed ? ['Tips Allowed'] : []] : ['Benefits'],
    });
  };

  const handleAddSkill = (skill: string) => {
    if (skill.trim() && !skills.includes(skill.trim())) {
      setSkills([...skills, skill.trim()]);
    }
    setSkillInput('');
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter(s => s !== skillToRemove));
  };

  const renderStep1 = () => (
    <div className="flex flex-col gap-8 animate-in fade-in duration-200">
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[#1c1b1b]">Basic Details</h2>
          <p className="text-base text-[#594047]">Let's start with the essential information about the role.</p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-medium text-[#1c1b1b]" htmlFor="job-title">Job Title</label>
          <input
            id="job-title"
            type="text"
            placeholder="e.g. Senior Hair Stylist"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-[#fdf8f8] border border-[#e0bec6] rounded-lg px-4 py-3 text-base text-[#1c1b1b] placeholder:text-[#594047] focus:bg-white focus:border-[#8e004b] focus:ring-1 focus:ring-[#8e004b] transition-all outline-none shadow-sm"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-medium text-[#1c1b1b]" htmlFor="category">Category</label>
          <div className="relative">
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-[#fdf8f8] border border-[#e0bec6] rounded-lg px-4 py-3 pr-10 text-base text-[#1c1b1b] focus:bg-white focus:border-[#8e004b] focus:ring-1 focus:ring-[#8e004b] transition-all outline-none shadow-sm appearance-none cursor-pointer"
            >
              <option value="" disabled>Select a category</option>
              <option value="hair">Hair Styling</option>
              <option value="color">Hair Coloring</option>
              <option value="nails">Nail Care</option>
              <option value="spa">Spa & Massage</option>
              <option value="management">Salon Management</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#594047]">
              <ChevronDown className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 w-1/2">
          <label className="text-[13px] font-medium text-[#1c1b1b]" htmlFor="openings">Number of Openings</label>
          <input
            id="openings"
            type="number"
            min="1"
            value={openings}
            onChange={(e) => setOpenings(e.target.value)}
            className="w-full bg-[#fdf8f8] border border-[#e0bec6] rounded-lg px-4 py-3 text-base text-[#1c1b1b] focus:bg-white focus:border-[#8e004b] focus:ring-1 focus:ring-[#8e004b] transition-all outline-none shadow-sm"
          />
        </div>
      </section>

      <hr className="border-[#e0bec6] opacity-50" />

      <section className="flex flex-col gap-4">
        <h3 className="text-[13px] font-medium text-[#1c1b1b]">Job Type</h3>
        <div className="flex flex-wrap gap-3">
          {['full-time', 'part-time', 'internship', 'contract', 'freelance'].map((type) => (
            <label key={type} className="cursor-pointer group">
              <input
                type="radio"
                name="job-type"
                value={type}
                checked={jobType === type}
                onChange={() => setJobType(type)}
                className="peer sr-only"
              />
              <span className="inline-flex items-center justify-center px-4 py-2 border border-[#e0bec6] rounded-full text-[13px] text-[#594047] bg-[#fdf8f8] peer-checked:bg-[#ffd9e2] peer-checked:text-[#8e004b] peer-checked:border-[#8e004b] peer-checked:font-semibold transition-all hover:bg-[#ece7e7] peer-focus-visible:ring-2 peer-focus-visible:ring-[#8e004b] peer-focus-visible:ring-offset-2 capitalize">
                {type.replace('-', ' ')}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4 pb-8">
        <h3 className="text-[13px] font-medium text-[#1c1b1b]">Workplace Type</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'on-site', label: 'On-site', icon: Store },
            { id: 'hybrid', label: 'Hybrid', icon: MapPin },
            { id: 'remote', label: 'Remote', icon: Home },
          ].map((type) => (
            <label key={type.id} className="cursor-pointer group">
              <input
                type="radio"
                name="workplace-type"
                value={type.id}
                checked={workplaceType === type.id}
                onChange={() => setWorkplaceType(type.id)}
                className="peer sr-only"
              />
              <div className="flex flex-col items-center justify-center p-4 border border-[#e0bec6] rounded-lg bg-[#fdf8f8] peer-checked:bg-[#ffd9e2] peer-checked:border-[#8e004b] peer-checked:shadow-sm transition-all hover:bg-[#ece7e7] text-[#594047] peer-checked:text-[#8e004b] gap-2 h-24">
                <type.icon className="w-6 h-6" />
                <span className="text-[13px] peer-checked:font-semibold">{type.label}</span>
              </div>
            </label>
          ))}
        </div>
      </section>
    </div>
  );

  const renderStep2 = () => (
    <div className="flex flex-col gap-8 animate-in fade-in duration-200">
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-[#1c1b1b] mb-2 tracking-tight">Skills & Experience</h2>
        <p className="text-[#594047]">Define the qualifications needed for this role.</p>
      </div>

      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold text-[#1c1b1b]">Experience Required</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-medium text-[#594047]" htmlFor="min-exp">Minimum Experience</label>
            <div className="relative">
              <select
                id="min-exp"
                value={minExp}
                onChange={(e) => setMinExp(e.target.value)}
                className="w-full bg-[#fdf8f8] border border-[#e0bec6] rounded-lg px-4 py-3 text-[#1c1b1b] focus:bg-white focus:border-[#8e004b] focus:ring-1 focus:ring-[#8e004b] transition-all outline-none shadow-sm appearance-none cursor-pointer"
              >
                <option value="0">0 Years</option>
                <option value="1">1 Year</option>
                <option value="2">2 Years</option>
                <option value="3">3+ Years</option>
              </select>
              <ChevronDown className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-[#594047] pointer-events-none" />
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-medium text-[#594047]" htmlFor="max-exp">Maximum Experience</label>
            <div className="relative">
              <select
                id="max-exp"
                value={maxExp}
                onChange={(e) => setMaxExp(e.target.value)}
                className="w-full bg-[#fdf8f8] border border-[#e0bec6] rounded-lg px-4 py-3 text-[#1c1b1b] focus:bg-white focus:border-[#8e004b] focus:ring-1 focus:ring-[#8e004b] transition-all outline-none shadow-sm appearance-none cursor-pointer"
              >
                <option value="1">1 Year</option>
                <option value="2">2 Years</option>
                <option value="3">3 Years</option>
                <option value="5">5 Years</option>
                <option value="10">10+ Years</option>
              </select>
              <ChevronDown className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-[#594047] pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-white border border-[#e0bec6] rounded-lg mt-2">
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold text-[#1c1b1b]">Freshers can apply</span>
            <span className="text-[13px] text-[#594047]">Allow candidates with 0 years experience</span>
          </div>
          <button
            type="button"
            onClick={() => setFresherAllowed(!fresherAllowed)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8e004b] focus-visible:ring-offset-2 ${
              fresherAllowed ? 'bg-[#b90064]' : 'bg-[#e6e1e1]'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                fresherAllowed ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold text-[#1c1b1b]">Skills</h3>
        
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#594047] pointer-events-none" />
            <input
              type="text"
              placeholder="Search skills..."
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSkill(skillInput);
                }
              }}
              className="w-full bg-[#fdf8f8] border border-[#e0bec6] rounded-lg pl-10 pr-4 py-3 text-[#1c1b1b] placeholder:text-[#8c7077] focus:bg-white focus:border-[#8e004b] focus:ring-1 focus:ring-[#8e004b] transition-all outline-none shadow-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {skills.map((skill) => (
            <div key={skill} className="flex items-center bg-[#ffd9e2] text-[#3e001e] px-3 py-1.5 rounded-full text-[13px] font-medium border border-[#ffb0c8]/50">
              {skill}
              <button
                type="button"
                onClick={() => handleRemoveSkill(skill)}
                className="ml-1 text-[#8e004b] hover:text-[#ba1a1a] transition-colors focus:outline-none cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-[#e0bec6]/50">
          <p className="text-[13px] text-[#594047] mb-3">Suggested for this role:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedSkills.filter(s => !skills.includes(s)).map((skill) => (
              <button
                key={skill}
                type="button"
                onClick={() => handleAddSkill(skill)}
                className="flex items-center gap-1 px-3 py-1.5 border border-[#e0bec6] rounded-full text-[13px] font-medium text-[#1c1b1b] hover:bg-[#ece7e7] hover:border-[#8c7077] transition-colors cursor-pointer"
              >
                {skill} <Plus className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );

  const renderStep3 = () => (
    <div className="flex flex-col gap-8 animate-in fade-in duration-200">
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-[#1c1b1b] mb-2 tracking-tight">Salary & Benefits</h2>
        <p className="text-[#594047]">Detail the compensation package to attract the best talent.</p>
      </div>

      <section className="bg-white rounded-xl p-4 md:p-6 border border-[#e0bec6] shadow-[0_4px_12px_rgba(90,63,71,0.02)]">
        <h3 className="text-lg font-semibold text-[#1c1b1b] mb-4">Salary Range</h3>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-medium text-[#594047]" htmlFor="min-salary">Minimum</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8c7077]">$</span>
                <input
                  id="min-salary"
                  type="number"
                  placeholder="45,000"
                  value={minSalary}
                  onChange={(e) => setMinSalary(e.target.value)}
                  className="w-full bg-[#fdf8f8] border border-transparent rounded-lg py-3 pl-8 pr-3 text-[#1c1b1b] focus:bg-white focus:border-[#8e004b] focus:ring-1 focus:ring-[#8e004b] transition-colors outline-none"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-medium text-[#594047]" htmlFor="max-salary">Maximum</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8c7077]">$</span>
                <input
                  id="max-salary"
                  type="number"
                  placeholder="60,000"
                  value={maxSalary}
                  onChange={(e) => setMaxSalary(e.target.value)}
                  className="w-full bg-[#fdf8f8] border border-transparent rounded-lg py-3 pl-8 pr-3 text-[#1c1b1b] focus:bg-white focus:border-[#8e004b] focus:ring-1 focus:ring-[#8e004b] transition-colors outline-none"
                />
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 pt-2">
            <span className="text-[13px] font-medium text-[#594047]">Pay Type</span>
            <div className="flex flex-wrap gap-2">
              {['Yearly', 'Monthly', 'Hourly', 'Commission'].map((type) => (
                <label key={type} className="cursor-pointer">
                  <input
                    type="radio"
                    name="pay_type"
                    value={type}
                    checked={payType === type}
                    onChange={() => setPayType(type)}
                    className="peer sr-only"
                  />
                  <span className="inline-flex items-center justify-center px-4 py-2 rounded-full border border-[#e0bec6] text-[#594047] text-[13px] font-medium peer-checked:bg-[#b50062] peer-checked:text-white peer-checked:border-[#b50062] transition-all hover:bg-[#ece7e7]">
                    {type}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl p-4 md:p-6 border border-[#e0bec6] shadow-[0_4px_12px_rgba(90,63,71,0.02)]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-[#1c1b1b]">Additional Perks</h3>
          <span className="text-[13px] text-[#8c7077]">Optional</span>
        </div>
        
        <div className="flex flex-col divide-y divide-[#e6e1e1]">
          {/* Incentives */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#fdf8f8] flex items-center justify-center text-[#b50062]">
                <Gift className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[#1c1b1b]">Incentives</p>
                <p className="text-[13px] text-[#594047]">Performance bonuses, retail commission</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIncentives(!incentives)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8e004b] focus-visible:ring-offset-2 ${
                incentives ? 'bg-[#b90064]' : 'bg-[#e6e1e1]'
              }`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${incentives ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          
          {/* Tips Allowed */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#fdf8f8] flex items-center justify-center text-[#b50062]">
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[#1c1b1b]">Tips Allowed</p>
                <p className="text-[13px] text-[#594047]">Clients can leave gratuity</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTipsAllowed(!tipsAllowed)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8e004b] focus-visible:ring-offset-2 ${
                tipsAllowed ? 'bg-[#b90064]' : 'bg-[#e6e1e1]'
              }`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${tipsAllowed ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Full Benefits */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#fdf8f8] flex items-center justify-center text-[#b50062]">
                <ShieldPlus className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[#1c1b1b]">Full Benefits</p>
                <p className="text-[13px] text-[#594047]">Health, Dental, Vision</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFullBenefits(!fullBenefits)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8e004b] focus-visible:ring-offset-2 ${
                fullBenefits ? 'bg-[#b90064]' : 'bg-[#e6e1e1]'
              }`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${fullBenefits ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-4 mt-2 border-t border-[#e6e1e1]">
          <label className="text-[13px] font-medium text-[#594047]" htmlFor="benefits-desc">Benefits Description</label>
          <textarea
            id="benefits-desc"
            rows={3}
            placeholder="Elaborate on the perks of working with your team..."
            value={benefitsDesc}
            onChange={(e) => setBenefitsDesc(e.target.value)}
            className="w-full bg-[#fdf8f8] border border-transparent rounded-lg p-3 text-[#1c1b1b] focus:bg-white focus:border-[#8e004b] focus:ring-1 focus:ring-[#8e004b] transition-colors resize-none outline-none"
          />
        </div>
      </section>
    </div>
  );

  const renderStep4 = () => (
    <div className="flex flex-col gap-8 animate-in fade-in duration-200">
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-[#1c1b1b] mb-2 tracking-tight">Job Details</h2>
        <p className="text-[#594047]">Describe the role and schedule.</p>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-medium text-[#594047]" htmlFor="job-description">Job Description</label>
          <textarea
            id="job-description"
            rows={5}
            placeholder="Describe the role and your salon..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-[#fdf8f8] border border-[#e0bec6] rounded-lg p-3 text-[#1c1b1b] focus:bg-white focus:border-[#8e004b] focus:ring-1 focus:ring-[#8e004b] transition-all resize-none outline-none shadow-sm"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-medium text-[#594047]" htmlFor="responsibilities">Responsibilities</label>
          <textarea
            id="responsibilities"
            rows={5}
            placeholder="List key daily tasks..."
            value={responsibilities}
            onChange={(e) => setResponsibilities(e.target.value)}
            className="w-full bg-[#fdf8f8] border border-[#e0bec6] rounded-lg p-3 text-[#1c1b1b] focus:bg-white focus:border-[#8e004b] focus:ring-1 focus:ring-[#8e004b] transition-all resize-none outline-none shadow-sm"
          />
        </div>
      </section>

      <hr className="border-[#e0bec6] opacity-50" />

      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold text-[#1c1b1b]">Working Schedule</h3>
        
        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-medium text-[#594047]">Working Days</label>
          <div className="flex flex-wrap gap-2">
            {['Mon-Fri', 'Mon-Sat', 'Flexible', 'Custom'].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setWorkingDays(days)}
                className={`px-4 py-2 rounded-full border text-[13px] font-medium transition-colors cursor-pointer ${
                  workingDays === days
                    ? 'bg-[#ffd9e2] text-[#8e004b] border-[#ffb0c8]'
                    : 'bg-[#fdf8f8] border-[#e0bec6] text-[#594047] hover:bg-[#ece7e7]'
                }`}
              >
                {days}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-medium text-[#594047]" htmlFor="working-hours">Working Hours</label>
            <div className="relative">
              <Clock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8c7077] pointer-events-none" />
              <input
                id="working-hours"
                type="text"
                placeholder="9:00 AM - 6:00 PM"
                value={workingHours}
                onChange={(e) => setWorkingHours(e.target.value)}
                className="w-full bg-[#fdf8f8] border border-[#e0bec6] rounded-lg py-3 pl-10 pr-3 text-[#1c1b1b] focus:bg-white focus:border-[#8e004b] focus:ring-1 focus:ring-[#8e004b] transition-colors outline-none shadow-sm"
              />
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-medium text-[#594047]" htmlFor="joining-date">Joining Date</label>
            <div className="relative">
              <Calendar className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8c7077] pointer-events-none" />
              <input
                id="joining-date"
                type="date"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                className="w-full bg-[#fdf8f8] border border-[#e0bec6] rounded-lg py-3 pl-10 pr-3 text-[#1c1b1b] focus:bg-white focus:border-[#8e004b] focus:ring-1 focus:ring-[#8e004b] transition-colors outline-none shadow-sm appearance-none"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-medium text-[#594047]" htmlFor="weekly-off">Weekly Off</label>
          <div className="relative">
            <select
              id="weekly-off"
              value={weeklyOff}
              onChange={(e) => setWeeklyOff(e.target.value)}
              className="w-full bg-[#fdf8f8] border border-[#e0bec6] rounded-lg p-3 text-[#1c1b1b] focus:bg-white focus:border-[#8e004b] focus:ring-1 focus:ring-[#8e004b] transition-colors outline-none shadow-sm appearance-none pr-10 cursor-pointer"
            >
              <option value="Sunday">Sunday</option>
              <option value="Saturday & Sunday">Saturday & Sunday</option>
              <option value="Monday">Monday</option>
              <option value="Rotating">Rotating</option>
            </select>
            <ChevronDown className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-[#594047] pointer-events-none" />
          </div>
        </div>
      </section>
    </div>
  );

  const renderStep5 = () => (
    <div className="flex flex-col gap-8 animate-in fade-in duration-200">
      <section className="space-y-2">
        <h2 className="text-xl md:text-2xl font-bold text-[#1c1b1b] tracking-tight">Review your job</h2>
        <p className="text-[#594047]">Here is a preview of exactly how your job will appear to candidates.</p>
      </section>

      <div className="bg-white rounded-lg border border-[#e0bec6] shadow-[0_4px_12px_rgba(90,63,71,0.05)] p-4 md:p-6 overflow-hidden relative">
        <div className="h-48 -mx-4 md:-mx-6 -mt-4 md:-mt-6 mb-4 bg-[#e6e1e1] relative overflow-hidden flex items-center justify-center">
          <div className="w-full h-full bg-gradient-to-r from-[#ffd9e2] to-[#ffcbd9] opacity-50 absolute inset-0"></div>
          <div className="absolute bottom-4 left-4 bg-white rounded-lg p-2 shadow-sm border border-[#e0bec6] flex items-center justify-center">
            <Store className="w-8 h-8 text-[#b50062]" />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-[18px] font-semibold text-[#1c1b1b]">{title || 'Job Title'}</h3>
            <p className="text-[16px] text-[#594047] mt-1 flex items-center gap-2">
              Luxe & Co Salon Group <span className="w-1 h-1 bg-[#8c7077] rounded-full inline-block"></span> {workplaceType === 'remote' ? 'Remote' : 'Beverly Hills, CA'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 bg-[#f1edec] text-[#1c1b1b] px-3 py-1 rounded-full text-[13px] font-medium">
              <Banknote className="w-4 h-4" />
              {minSalary && maxSalary ? `$${minSalary} - $${maxSalary}/${payType === 'Yearly' ? 'yr' : payType === 'Monthly' ? 'mo' : 'hr'}` : '$60,000 - $85,000/yr'}
            </span>
            <span className="inline-flex items-center gap-1 bg-[#f1edec] text-[#1c1b1b] px-3 py-1 rounded-full text-[13px] font-medium capitalize">
              <Store className="w-4 h-4" />
              {jobType.replace('-', ' ')}
            </span>
            <span className="inline-flex items-center gap-1 bg-[#f1edec] text-[#1c1b1b] px-3 py-1 rounded-full text-[13px] font-medium capitalize">
              <MapPin className="w-4 h-4" />
              {workplaceType}
            </span>
          </div>

          <hr className="border-t border-[#e0bec6]" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <h4 className="text-[13px] font-medium text-[#594047]">Experience</h4>
              <p className="text-[16px] text-[#1c1b1b]">{minExp}-{maxExp} Years</p>
            </div>
            <div className="space-y-1">
              <h4 className="text-[13px] font-medium text-[#594047]">Skills</h4>
              <p className="text-[16px] text-[#1c1b1b]">{skills.join(', ') || 'None specified'}</p>
            </div>
            <div className="space-y-1">
              <h4 className="text-[13px] font-medium text-[#594047]">Compensation</h4>
              <p className="text-[16px] text-[#1c1b1b]">
                {payType}
                {incentives && ' + Incentives'}
                {tipsAllowed && ' + Tips'}
              </p>
            </div>
            <div className="space-y-1">
              <h4 className="text-[13px] font-medium text-[#594047]">Schedule</h4>
              <p className="text-[16px] text-[#1c1b1b]">{workingDays}, {workingHours}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );


  const renderStep6 = () => (
    <div className="flex-1 flex flex-col items-center justify-center px-5 pt-12 pb-32 w-full relative z-10 animate-in zoom-in-95 duration-500">
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] bg-gradient-to-b from-[#ffd9e2]/30 to-[#fdf8f8] opacity-50 rounded-full blur-3xl"></div>
      </div>
      
      <div className="w-32 h-32 rounded-full bg-[#f1edec] shadow-sm flex items-center justify-center mb-8 relative animate-in pop-in">
        <div className="absolute inset-0 rounded-full border-4 border-[#e2007c] opacity-20 scale-110"></div>
        <Store className="w-16 h-16 text-[#e2007c]" />
      </div>

      <div className="text-center w-full mb-8 animate-in slide-in-from-bottom-4 duration-500 delay-100 fill-mode-both">
        <h1 className="text-2xl md:text-3xl font-bold text-[#8e004b] mb-2">Job published</h1>
        <p className="text-[16px] text-[#594047]">Your listing is now live and visible to candidates.</p>
      </div>

      <div className="w-full bg-white rounded-xl shadow-sm border border-[#e0bec6]/30 p-4 mb-8 animate-in slide-in-from-bottom-4 duration-500 delay-200 fill-mode-both">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-medium text-[#594047] uppercase tracking-wider">Role</span>
          <div className="flex items-center gap-1.5 bg-[#e8f5e9] text-[#2e7d32] px-3 py-1 rounded-full">
            <div className="w-2 h-2 rounded-full bg-[#4caf50]"></div>
            <span className="text-[13px] font-medium">Published</span>
          </div>
        </div>
        <h2 className="text-[18px] font-semibold text-[#1c1b1b] mb-1">{title || 'Job Title'}</h2>
        <div className="flex items-center text-[#594047] gap-2 mt-2">
          <MapPin className="w-4 h-4" />
          <span className="text-[14px]">{workplaceType === 'remote' ? 'Remote' : 'Downtown Salon'}</span>
        </div>
      </div>

      <div className="w-full flex flex-col gap-4 animate-in slide-in-from-bottom-4 duration-500 delay-300 fill-mode-both">
        <button 
          onClick={handleComplete}
          className="w-full h-12 bg-[#e2007c] text-white rounded-full text-[13px] font-medium shadow-sm hover:bg-[#b50062] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          Manage Applications
        </button>
        <button 
          onClick={handleComplete}
          className="w-full h-12 bg-white text-[#8e004b] border border-[#e0bec6] rounded-full text-[13px] font-medium hover:bg-[#ece7e7] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          View Job
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-[#fdf8f8] overflow-y-auto flex flex-col hide-scrollbar animate-in slide-in-from-bottom-4 duration-300">
      {/* TopAppBar */}
      {step !== 6 && (
        <header className="sticky top-0 w-full bg-[#fdf8f8] shadow-sm z-50">
          <div className="flex justify-between items-center w-full px-5 h-16 max-w-2xl mx-auto">
            <button 
              onClick={step > 1 ? () => setStep(step - 1) : onClose}
              className="p-2 -ml-2 rounded-full hover:bg-[#ece7e7] transition-colors active:scale-95 text-[#594047] flex items-center justify-center cursor-pointer"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl md:text-2xl font-semibold text-[#8e004b] absolute left-1/2 transform -translate-x-1/2">
              Post a Job
            </h1>
            <span className="text-[13px] font-medium text-[#594047]">
              Step {step}/{totalSteps}
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full h-1 bg-[#e6e1e1]">
            <div 
              className="h-full bg-[#e2007c] transition-all duration-500 ease-in-out"
              style={{ width: `${(Math.min(step, totalSteps) / totalSteps) * 100}%` }}
            />
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className={`flex-1 px-5 max-w-2xl mx-auto w-full flex flex-col ${step === 6 ? 'pt-0 pb-0 justify-center' : 'py-6 gap-8'}`}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
        {step === 6 && renderStep6()}

        {/* CTA Area */}
        {step !== 6 && (
          <div className="mt-auto pt-6 pb-6 w-full bg-[#fdf8f8] border-t border-[#e0bec6]/30">
            <button 
              onClick={handleNext}
              className="w-full bg-[#e2007c] text-white text-[18px] font-semibold py-4 rounded-full shadow-sm hover:shadow-md hover:bg-[#b50062] transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            >
              {step < totalSteps ? 'Continue' : 'Publish Job'}
              {step < totalSteps && <ArrowRight className="w-5 h-5" />}
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

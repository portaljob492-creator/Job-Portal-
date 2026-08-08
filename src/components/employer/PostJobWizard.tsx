import React, { useState } from 'react';
import { ArrowLeft, ChevronDown, Store, MapPin, Home, ArrowRight, Search, X, Plus } from 'lucide-react';
import { JobPosting } from '../../types';

interface PostJobWizardProps {
  onClose: () => void;
  onComplete: (job: Partial<JobPosting>) => void;
}

export const PostJobWizard: React.FC<PostJobWizardProps> = ({ onClose, onComplete }) => {
  const [step, setStep] = useState(1);
  const totalSteps = 4;

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

  const suggestedSkills = ['Balayage', 'Keratin', 'Customer Service'];

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      // Complete
      onComplete({
        title,
        category: category === 'hair' ? 'Hair' : category === 'color' ? 'Hair' : 'Nails', // Map properly in real app
        jobType: jobType === 'full-time' ? 'Full-time' : jobType === 'part-time' ? 'Part-time' : 'Commission',
        location: workplaceType === 'remote' ? 'Remote' : 'Beverly Hills, CA',
        salary: '$60,000 - $85,000/yr',
        description: 'Detailed description here...',
        requirements: skills,
        benefits: ['Benefits'],
      });
    }
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

  const renderPlaceholderStep = () => (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-200">
      <h2 className="text-xl font-semibold text-[#1c1b1b] mb-2">Step {step} Details</h2>
      <p className="text-[#594047]">Please proceed to the final step to submit.</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-[#fdf8f8] overflow-y-auto flex flex-col hide-scrollbar animate-in slide-in-from-bottom-4 duration-300">
      {/* TopAppBar */}
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
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-5 py-6 max-w-2xl mx-auto w-full flex flex-col gap-8">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step > 2 && renderPlaceholderStep()}

        {/* CTA Area */}
        <div className="mt-auto pt-6 pb-6 w-full bg-[#fdf8f8] border-t border-[#e0bec6]/30">
          <button 
            onClick={handleNext}
            className="w-full bg-[#e2007c] text-white text-[18px] font-semibold py-4 rounded-full shadow-sm hover:shadow-md hover:bg-[#b50062] transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
          >
            {step < totalSteps ? 'Continue' : 'Publish Job'}
            {step < totalSteps && <ArrowRight className="w-5 h-5" />}
          </button>
        </div>
      </main>
    </div>
  );
};

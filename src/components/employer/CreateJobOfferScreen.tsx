import React, { useState } from 'react';
import { ArrowLeft, CheckCircle, Briefcase, Calendar, ChevronDown, Upload, Send } from 'lucide-react';
import { Applicant } from '../../types';

interface CreateJobOfferScreenProps {
  applicant: Applicant;
  onClose: () => void;
  onSendOffer: (offerDetails: any) => void;
}

export const CreateJobOfferScreen: React.FC<CreateJobOfferScreenProps> = ({ applicant, onClose, onSendOffer }) => {
  const [jobRole, setJobRole] = useState(applicant.appliedJobTitle);
  const [salary, setSalary] = useState('');
  const [employmentType, setEmploymentType] = useState('full-time');
  const [joiningDate, setJoiningDate] = useState('');
  const [offerNotes, setOfferNotes] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleSendOffer = () => {
    setShowConfirmation(true);
  };

  const handleConfirmSend = () => {
    setIsSending(true);
    setTimeout(() => {
      onSendOffer({
        jobRole,
        salary,
        employmentType,
        joiningDate,
        offerNotes
      });
      setIsSending(false);
      setShowConfirmation(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#fdf8f8] overflow-y-auto flex flex-col hide-scrollbar animate-in slide-in-from-bottom-4 duration-300">
      {/* TopAppBar */}
      <header className="sticky top-0 w-full bg-[#fdf8f8] shadow-[0_4px_12px_rgba(90,63,71,0.05)] z-50 border-b border-[#e0bec6]/30">
        <div className="flex items-center justify-between px-5 h-16 w-full max-w-7xl mx-auto">
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#ece7e7] transition-colors active:scale-95 text-[#8e004b]"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl md:text-2xl font-bold text-[#8e004b] flex-1 text-center pr-10">
            Review Posting
          </h1>
          <button className="text-[#8e004b] font-bold text-[13px] hover:opacity-80 transition-opacity whitespace-nowrap hidden md:block">
            Save Draft
          </button>
        </div>
      </header>

      <main className="flex-1 px-5 max-w-3xl mx-auto mt-8 mb-32 md:mt-12 w-full">
        {/* Candidate Header Card */}
        <section className="bg-white rounded-lg border border-[#e0bec6]/30 p-4 mb-8 flex items-center gap-4 shadow-[0_4px_12px_rgba(90,63,71,0.03)]">
          {applicant.avatarUrl ? (
            <img src={applicant.avatarUrl} alt={applicant.name} className="w-16 h-16 rounded-full object-cover border-2 border-[#ece7e7]" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-[#ece7e7] flex items-center justify-center text-[#594047] font-semibold text-xl border-2 border-[#ece7e7]">
              {applicant.name.charAt(0)}
            </div>
          )}
          
          <div>
            <h2 className="text-[18px] font-semibold text-[#1c1b1b]">{applicant.name}</h2>
            <p className="text-[#594047] text-[13px] font-medium">{applicant.appliedJobTitle} Candidate</p>
          </div>
          <div className="ml-auto">
            <CheckCircle className="w-6 h-6 text-[#b90064]" fill="currentColor" color="white" />
          </div>
        </section>

        {/* Input Form */}
        <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
          <div className="space-y-4">
            <h3 className="text-[20px] font-semibold text-[#1c1b1b] border-b border-[#e0bec6]/30 pb-2">Offer Details</h3>
            
            {/* Job Role */}
            <div className="space-y-2 group">
              <label htmlFor="jobRole" className="block text-[13px] font-medium text-[#594047]">Job Role</label>
              <div className="relative bg-[#f1edec] rounded-lg border border-transparent focus-within:border-[#8e004b] focus-within:bg-white transition-colors">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Briefcase className="text-[#594047] opacity-70 w-5 h-5" />
                </span>
                <input 
                  type="text" 
                  id="jobRole" 
                  name="jobRole" 
                  required 
                  value={jobRole}
                  onChange={(e) => setJobRole(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 bg-transparent border-none focus:ring-0 text-[#1c1b1b] text-[16px] rounded-lg outline-none" 
                />
              </div>
            </div>

            {/* Salary */}
            <div className="space-y-2 group">
              <label htmlFor="salary" className="block text-[13px] font-medium text-[#594047]">Annual Salary Offer</label>
              <div className="relative bg-[#f1edec] rounded-lg border border-transparent focus-within:border-[#8e004b] focus-within:bg-white transition-colors">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#1c1b1b] font-medium">
                  ₹
                </span>
                <input 
                  type="number" 
                  id="salary" 
                  name="salary" 
                  placeholder="7,50,000"
                  required 
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  className="block w-full pl-8 pr-12 py-3 bg-transparent border-none focus:ring-0 text-[#1c1b1b] text-[16px] rounded-lg outline-none" 
                />
                <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#594047] text-sm">
                  INR
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Employment Type */}
              <div className="space-y-2 group">
                <label htmlFor="employmentType" className="block text-[13px] font-medium text-[#594047]">Employment Type</label>
                <div className="relative bg-[#f1edec] rounded-lg border border-transparent focus-within:border-[#8e004b] focus-within:bg-white transition-colors">
                  <select 
                    id="employmentType" 
                    name="employmentType"
                    value={employmentType}
                    onChange={(e) => setEmploymentType(e.target.value)}
                    className="block w-full pl-3 pr-10 py-3 bg-transparent border-none focus:ring-0 text-[#1c1b1b] text-[16px] rounded-lg outline-none appearance-none cursor-pointer"
                  >
                    <option value="full-time">Full-time</option>
                    <option value="part-time">Part-time</option>
                    <option value="contract">Contract</option>
                    <option value="freelance">Freelance</option>
                  </select>
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <ChevronDown className="text-[#594047] w-5 h-5" />
                  </span>
                </div>
              </div>

              {/* Joining Date */}
              <div className="space-y-2 group">
                <label htmlFor="joiningDate" className="block text-[13px] font-medium text-[#594047]">Proposed Start Date</label>
                <div className="relative bg-[#f1edec] rounded-lg border border-transparent focus-within:border-[#8e004b] focus-within:bg-white transition-colors">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="text-[#594047] opacity-70 w-5 h-5" />
                  </span>
                  <input 
                    type="date" 
                    id="joiningDate" 
                    name="joiningDate" 
                    required 
                    value={joiningDate}
                    onChange={(e) => setJoiningDate(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 bg-transparent border-none focus:ring-0 text-[#1c1b1b] text-[16px] rounded-lg outline-none cursor-text" 
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-[20px] font-semibold text-[#1c1b1b] border-b border-[#e0bec6]/30 pb-2">Additional Information</h3>
            
            {/* Offer Notes */}
            <div className="space-y-2 group">
              <label htmlFor="offerNotes" className="block text-[13px] font-medium text-[#594047]">Personalized Message (Optional)</label>
              <div className="bg-[#f1edec] rounded-lg border border-transparent focus-within:border-[#8e004b] focus-within:bg-white transition-colors">
                <textarea 
                  id="offerNotes" 
                  name="offerNotes" 
                  placeholder={`Dear ${applicant.name.split(' ')[0]}, we are thrilled to extend this offer...`} 
                  rows={4}
                  value={offerNotes}
                  onChange={(e) => setOfferNotes(e.target.value)}
                  className="block w-full p-3 bg-transparent border-none focus:ring-0 text-[#1c1b1b] text-[16px] rounded-lg outline-none resize-y"
                ></textarea>
              </div>
              <p className="text-xs text-[#594047] opacity-70">This message will be included in the offer notification.</p>
            </div>

            {/* Document Upload */}
            <div className="space-y-2">
              <label className="block text-[13px] font-medium text-[#594047]">Formal Offer Letter (Optional PDF)</label>
              <div 
                className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-[#e0bec6] border-dashed rounded-lg bg-[#fdf8f8] hover:bg-[#f1edec] transition-colors cursor-pointer"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <div className="space-y-1 text-center flex flex-col items-center">
                  <Upload className="w-10 h-10 text-[#594047] opacity-50 mb-2" />
                  <div className="flex text-sm text-[#1c1b1b] justify-center">
                    <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-medium text-[#8e004b] hover:text-[#b90064] focus-within:outline-none">
                      <span>Upload a file</span>
                      <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".pdf" />
                    </label>
                    <p className="pl-1 text-[#594047]">or drag and drop</p>
                  </div>
                  <p className="text-xs text-[#594047]">PDF up to 10MB</p>
                </div>
              </div>
            </div>
          </div>
        </form>
      </main>

      {/* Bottom Action Area */}
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-[#e0bec6]/30 p-4 md:p-6 z-40 pb-safe shadow-[0_-4px_12px_rgba(90,63,71,0.05)]">
        <div className="max-w-3xl mx-auto flex gap-4">
          <button type="button" className="flex-1 bg-white border border-[#e0bec6] text-[#1c1b1b] text-[13px] font-medium rounded-full py-3 px-6 hover:bg-[#ece7e7] transition-colors active:scale-95 hidden md:block">
            Preview Offer
          </button>
          <button 
            type="button" 
            id="sendOfferBtn"
            onClick={handleSendOffer}
            className="flex-1 bg-[#8e004b] text-white text-[13px] font-medium rounded-full py-4 px-6 hover:bg-[#b90064] transition-colors active:scale-95 shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Send Offer</span>
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 z-[110] bg-[#1c1b1b]/40 backdrop-blur-sm flex flex-col items-center justify-center px-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-300">
            <div className="w-12 h-12 rounded-full bg-[#b90064]/20 flex items-center justify-center mb-4 mx-auto">
              <span className="material-symbols-outlined text-[#b90064] text-2xl">mail</span>
            </div>
            <h4 className="text-[24px] font-semibold text-center text-[#1c1b1b] mb-2">Review Offer</h4>
            <p className="text-center text-[16px] text-[#594047] mb-6">
              Are you sure you want to send this offer to {applicant.name}? They will be notified immediately.
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleConfirmSend}
                disabled={isSending}
                className={`w-full bg-[#8e004b] text-white text-[13px] font-medium rounded-full py-3 transition-colors flex items-center justify-center gap-2 cursor-pointer ${isSending ? 'opacity-80' : 'hover:bg-[#b90064]'}`}
              >
                {isSending ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                    Sending...
                  </>
                ) : 'Confirm & Send'}
              </button>
              <button 
                onClick={() => !isSending && setShowConfirmation(false)}
                disabled={isSending}
                className="w-full bg-transparent text-[#1c1b1b] text-[13px] font-medium rounded-full py-3 hover:bg-[#f1edec] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { ArrowLeft, Store, Video, Phone, MapPin, Link as LinkIcon, ChevronDown, Send } from 'lucide-react';

interface RequestInterviewScreenProps {
  applicantName: string;
  applicantJobTitle: string;
  applicantExp?: number;
  applicantAvatar?: string;
  onClose: () => void;
  onConfirm: () => void;
}

export const RequestInterviewScreen: React.FC<RequestInterviewScreenProps> = ({ 
  applicantName,
  applicantJobTitle,
  applicantExp,
  applicantAvatar,
  onClose, 
  onConfirm 
}) => {
  const [interviewType, setInterviewType] = useState<'in-person' | 'video' | 'phone'>('in-person');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('');
  const [location, setLocation] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#fdf8f8] overflow-y-auto flex flex-col hide-scrollbar animate-in slide-in-from-bottom-4 duration-300">
      {/* TopAppBar */}
      <header className="sticky top-0 w-full bg-[#fdf8f8] shadow-sm z-50 border-b border-[#e6e1e1]">
        <div className="flex justify-between items-center w-full px-5 h-16 max-w-2xl mx-auto">
          <button 
            onClick={onClose}
            className="w-10 h-10 -ml-2 rounded-full hover:bg-[#ece7e7] transition-colors active:scale-95 text-[#8e004b] flex items-center justify-center cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl md:text-2xl font-semibold text-[#8e004b] absolute left-1/2 transform -translate-x-1/2 whitespace-nowrap">
            Request Interview
          </h1>
          <div className="w-10 h-10"></div> {/* Spacer */}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-2xl mx-auto mt-4 px-5 space-y-8 pb-24">
        {/* Candidate Summary Card */}
        <section className="bg-white rounded-lg border border-[#e0bec6]/30 p-4 flex items-center gap-4 shadow-[0_2px_8px_rgba(90,63,71,0.03)]">
          <div className="relative w-16 h-16 rounded-full overflow-hidden shrink-0 border-2 border-[#ece7e7]">
            {applicantAvatar ? (
              <img src={applicantAvatar} alt={applicantName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#e6e1e1] flex items-center justify-center text-[#594047] font-semibold text-xl">
                {applicantName.charAt(0)}
              </div>
            )}
          </div>
          <div>
            <h2 className="text-[18px] font-semibold text-[#1c1b1b]">{applicantName}</h2>
            <div className="flex flex-col sm:flex-row sm:items-center text-[#594047] text-[13px] font-medium mt-1 gap-1 sm:gap-3">
              <span className="flex items-center gap-1">
                <Store className="w-4 h-4" />
                {applicantJobTitle}
              </span>
              {applicantExp !== undefined && (
                <>
                  <span className="hidden sm:inline text-[#e0bec6]">•</span>
                  <span className="flex items-center gap-1">
                    <Store className="w-4 h-4" />
                    {applicantExp} Years Exp.
                  </span>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Form Fields */}
        <form id="interview-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Interview Type */}
          <fieldset className="space-y-2">
            <legend className="text-[13px] font-semibold text-[#1c1b1b] mb-2 block">Interview Type</legend>
            <div className="flex p-1 bg-[#f7f2f2] rounded-lg border border-[#e0bec6]/50">
              <label className="flex-1 text-center cursor-pointer relative">
                <input 
                  type="radio" 
                  name="interviewType" 
                  value="in-person"
                  checked={interviewType === 'in-person'}
                  onChange={(e) => setInterviewType(e.target.value as any)}
                  className="peer sr-only"
                />
                <span className={`block py-2 px-3 rounded text-[13px] font-medium transition-all flex items-center justify-center gap-2 ${
                  interviewType === 'in-person' 
                    ? 'bg-[#8e004b] text-white border-transparent' 
                    : 'text-[#594047] hover:bg-[#ece7e7]'
                }`}>
                  <Store className="w-[18px] h-[18px]" />
                  In Person
                </span>
              </label>
              <label className="flex-1 text-center cursor-pointer relative">
                <input 
                  type="radio" 
                  name="interviewType" 
                  value="video"
                  checked={interviewType === 'video'}
                  onChange={(e) => setInterviewType(e.target.value as any)}
                  className="peer sr-only"
                />
                <span className={`block py-2 px-3 rounded text-[13px] font-medium transition-all flex items-center justify-center gap-2 ${
                  interviewType === 'video' 
                    ? 'bg-[#8e004b] text-white border-transparent' 
                    : 'text-[#594047] hover:bg-[#ece7e7]'
                }`}>
                  <Video className="w-[18px] h-[18px]" />
                  Video
                </span>
              </label>
              <label className="flex-1 text-center cursor-pointer relative">
                <input 
                  type="radio" 
                  name="interviewType" 
                  value="phone"
                  checked={interviewType === 'phone'}
                  onChange={(e) => setInterviewType(e.target.value as any)}
                  className="peer sr-only"
                />
                <span className={`block py-2 px-3 rounded text-[13px] font-medium transition-all flex items-center justify-center gap-2 ${
                  interviewType === 'phone' 
                    ? 'bg-[#8e004b] text-white border-transparent' 
                    : 'text-[#594047] hover:bg-[#ece7e7]'
                }`}>
                  <Phone className="w-[18px] h-[18px]" />
                  Phone
                </span>
              </label>
            </div>
          </fieldset>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Date Picker */}
            <div className="space-y-2 flex flex-col">
              <label htmlFor="interviewDate" className="text-[13px] font-semibold text-[#1c1b1b]">Select Date</label>
              <div className="relative flex-1">
                <input 
                  type="date" 
                  id="interviewDate"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required 
                  className="w-full h-12 bg-white border border-[#e0bec6]/60 rounded-lg px-3 py-2 text-[#1c1b1b] focus:ring-2 focus:ring-[#8e004b] focus:border-[#8e004b] transition-colors outline-none cursor-text"
                />
              </div>
            </div>
            
            {/* Time Picker */}
            <div className="space-y-2 flex flex-col">
              <label htmlFor="interviewTime" className="text-[13px] font-semibold text-[#1c1b1b]">Select Time</label>
              <div className="relative flex-1">
                <input 
                  type="time" 
                  id="interviewTime"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required 
                  className="w-full h-12 bg-white border border-[#e0bec6]/60 rounded-lg px-3 py-2 text-[#1c1b1b] focus:ring-2 focus:ring-[#8e004b] focus:border-[#8e004b] transition-colors outline-none cursor-text"
                />
              </div>
            </div>
          </div>

          {/* Duration Dropdown */}
          <div className="space-y-2">
            <label htmlFor="interviewDuration" className="text-[13px] font-semibold text-[#1c1b1b]">Duration</label>
            <div className="relative">
              <select 
                id="interviewDuration" 
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required
                className="w-full h-12 bg-white border border-[#e0bec6]/60 rounded-lg px-3 py-2 text-[#1c1b1b] focus:ring-2 focus:ring-[#8e004b] focus:border-[#8e004b] transition-colors outline-none appearance-none cursor-pointer pr-10"
              >
                <option value="" disabled>Select duration</option>
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">1 hour</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-[#594047]">
                <ChevronDown className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Location / Meeting Link */}
          <div className="space-y-2">
            <label htmlFor="interviewLocation" className="text-[13px] font-semibold text-[#1c1b1b]">Location / Meeting Link</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#594047]">
                {interviewType === 'in-person' ? (
                  <MapPin className="w-5 h-5" />
                ) : interviewType === 'video' ? (
                  <LinkIcon className="w-5 h-5" />
                ) : (
                  <Phone className="w-5 h-5" />
                )}
              </div>
              <input 
                type="text" 
                id="interviewLocation"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={
                  interviewType === 'in-person' ? 'Enter salon address' : 
                  interviewType === 'video' ? 'Enter Zoom/Meet link' : 
                  'Enter phone number (if different)'
                }
                className="w-full h-12 bg-white border border-[#e0bec6]/60 rounded-lg pl-10 pr-3 py-2 text-[#1c1b1b] placeholder:text-[#594047]/50 focus:ring-2 focus:ring-[#8e004b] focus:border-[#8e004b] transition-colors outline-none"
              />
            </div>
          </div>

          {/* Employer Message */}
          <div className="space-y-2">
            <label htmlFor="employerMessage" className="text-[13px] font-semibold text-[#1c1b1b]">Message to Candidate</label>
            <textarea 
              id="employerMessage" 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal note to the candidate..." 
              rows={4}
              className="w-full bg-white border border-[#e0bec6]/60 rounded-lg px-3 py-2 text-[#1c1b1b] placeholder:text-[#594047]/50 focus:ring-2 focus:ring-[#8e004b] focus:border-[#8e004b] transition-colors outline-none resize-none"
            ></textarea>
          </div>
        </form>
      </main>

      {/* Sticky Bottom CTA */}
      <div className="fixed bottom-0 w-full bg-white border-t border-[#e0bec6]/30 p-4 shadow-[0_-4px_12px_rgba(90,63,71,0.05)] z-50">
        <div className="max-w-2xl mx-auto flex">
          <button 
            type="submit"
            form="interview-form"
            className="w-full h-12 bg-[#b50062] text-white rounded-full text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-[#8e004b] transition-colors active:scale-95 shadow-md shadow-[#8e004b]/20 cursor-pointer"
          >
            <Send className="w-5 h-5" />
            Send Interview Request
          </button>
        </div>
      </div>
    </div>
  );
};

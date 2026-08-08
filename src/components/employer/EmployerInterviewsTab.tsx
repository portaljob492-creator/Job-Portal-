import React, { useState } from 'react';
import { Calendar, Video, MapPin, Search, Menu } from 'lucide-react';
import { Applicant } from '../../types';

interface EmployerInterviewsTabProps {
  applicants: Applicant[];
}

export const EmployerInterviewsTab: React.FC<EmployerInterviewsTabProps> = ({ applicants }) => {
  const [activeSubTab, setActiveSubTab] = useState<'Requested' | 'Confirmed' | 'Completed' | 'Cancelled'>('Requested');

  // We will mix in some hardcoded data to match the visual design requested if there are no dynamic ones,
  // but let's try to use dynamic applicants where possible. Since our app state doesn't have "Requested" vs "Confirmed" 
  // as separate fields (just Interview Scheduled), we will mock the split for the UI.
  
  const requestedInterviews = [
    {
      id: 'int-1',
      name: 'Elena Rodriguez',
      role: 'Senior Esthetician',
      status: 'Requested',
      date: 'Oct 24, 10:00 AM',
      type: 'Video Call',
      avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAQ9yGoW71FmxZhbjW-JiwRKtRJjmKp13CAvIcXGlwTRRO9ilOCTnOqHGB9bcu1QhP-1kjhTXp2OGeAtOpyxo3H0-M4fXm7hcyjC0UV2i6zH19ReaNNfo16lgrbq252x-VJ182Tpex2zYmBCbF-hwzK9OPSdczCKoTsLrBJ6l0cAaTi3io_sLcWbmT3eFQgP59UNlvwQ3aCOy2QaYAKyoHl-0PPxG8iAVXQEdM_Q8zGNxxInjr2KxMK'
    },
    {
      id: 'int-2',
      name: 'Marcus Chen',
      role: 'Spa Manager',
      status: 'Requested',
      date: 'Oct 25, 2:30 PM',
      type: 'In-Person',
      avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCJr8vOkm0pLu0Ub0MDrhIcRhQhjIPWjjbupdvByInL3NuogCG5UHFbyTyMnzAL_1d1WeaZWDkMpug_IARca9mTXfJnw_oa9hICpbLQ6sMMhrJZGy0TeH7UXfkvChbV7hLb__P-szXKTW7EzAoEXyoqnCZ6j8uwPFaTCbtA1vBZL8hAyhe-3rvJUf0jbKg1vzPh-aq_jQtLLjKOeT8fGdyZlVyrguTfYVMEboWOHrTyFNJ9gyX8B3K8'
    }
  ];

  return (
    <div className="flex flex-col w-full h-full pb-24 md:pb-0">
      <div className="flex justify-between items-center mb-6 px-5 md:px-0">
        <h2 className="text-2xl md:text-[24px] font-semibold tracking-tight text-[#8e004b]">Interviews</h2>
        <div className="flex items-center gap-2">
          <button className="text-[#8e004b] hover:bg-[#e6e1e1] transition-colors p-2 rounded-full active:scale-95 flex items-center justify-center">
            <Search className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex overflow-x-auto hide-scrollbar border-b border-[#e0bec6] mb-6 mx-5 md:mx-0">
        {['Requested', 'Confirmed', 'Completed', 'Cancelled'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab as any)}
            className={`px-4 py-3 text-[13px] font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
              activeSubTab === tab
                ? 'text-[#8e004b] border-[#8e004b]'
                : 'text-[#594047] border-transparent hover:text-[#8e004b]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Interview Cards List */}
      <div className="flex flex-col gap-4 px-5 md:px-0">
        {activeSubTab === 'Requested' ? (
          requestedInterviews.map((interview) => (
            <article key={interview.id} className="bg-white rounded-lg border border-[#e0bec6] shadow-[0_4px_12px_rgba(90,63,71,0.05)] p-4 flex flex-col gap-2 hover:bg-[#f7f2f2] transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex gap-3 items-center">
                  <img src={interview.avatarUrl} alt={interview.name} className="w-12 h-12 rounded-full object-cover border border-[#e0bec6]" />
                  <div>
                    <h3 className="text-[18px] font-semibold text-[#1c1b1b]">{interview.name}</h3>
                    <p className="text-[13px] font-medium text-[#594047]">{interview.role}</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-[#f2dde9] text-[#241820] rounded-full text-[13px] font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">pending_actions</span> Requested
                </span>
              </div>
              
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 text-[#594047]">
                  <Calendar className="w-[18px] h-[18px]" />
                  <span className="text-[13px] font-medium">{interview.date}</span>
                </div>
                <div className="flex items-center gap-2 text-[#594047]">
                  {interview.type === 'Video Call' ? <Video className="w-[18px] h-[18px]" /> : <MapPin className="w-[18px] h-[18px]" />}
                  <span className="text-[13px] font-medium">{interview.type}</span>
                </div>
              </div>
              
              <div className="flex gap-3 mt-4 pt-4 border-t border-[#e6e1e1]">
                <button className="flex-1 bg-white border border-[#e0bec6] text-[#1c1b1b] text-[13px] font-medium py-2 rounded-full hover:bg-[#ece7e7] transition-colors flex justify-center items-center gap-2 cursor-pointer">
                  View
                </button>
                <button className="flex-1 bg-[#e2007c] text-white text-[13px] font-medium py-2 rounded-full hover:bg-[#b90064] transition-colors flex justify-center items-center gap-2 cursor-pointer">
                  Confirm
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center text-[#594047]">
            <span className="material-symbols-outlined text-4xl mb-4 opacity-50">event_busy</span>
            <p className="text-[16px]">No {activeSubTab.toLowerCase()} interviews at the moment.</p>
          </div>
        )}
      </div>
    </div>
  );
};

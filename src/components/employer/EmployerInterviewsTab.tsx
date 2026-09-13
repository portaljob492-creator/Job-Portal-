import React, { useState } from 'react';
import { Calendar, Video, MapPin, Phone, Search, ChevronDown } from 'lucide-react';
import { Applicant, EmployerInterview } from '../../types';
import { formatInterviewDateTime, interviewTypeLabel } from '../../lib/interviewSchedule';

interface EmployerInterviewsTabProps {
  applicants: Applicant[];
  onRescheduleInterview?: (interviewId: string, newStartIso: string) => Promise<void>;
  onCompleteInterview?: (interviewId: string) => Promise<void>;
}

type SubTab = 'Requested' | 'Confirmed' | 'Completed' | 'Cancelled';

interface InterviewRow {
  interview: EmployerInterview;
  applicant: Applicant;
}

const SUB_TABS: SubTab[] = ['Requested', 'Confirmed', 'Completed', 'Cancelled'];

function statusForTab(status: EmployerInterview['status']): SubTab {
  if (status === 'requested' || status === 'reschedule_requested') return 'Requested';
  if (status === 'confirmed' || status === 'rescheduled') return 'Confirmed';
  if (status === 'completed') return 'Completed';
  return 'Cancelled';
}

function toDateTimeLocalValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const EmployerInterviewsTab: React.FC<EmployerInterviewsTabProps> = ({
  applicants,
  onRescheduleInterview,
  onCompleteInterview,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('Requested');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [newStart, setNewStart] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const rows: InterviewRow[] = applicants.flatMap((applicant) =>
    (applicant.interviews ?? []).map((interview) => ({ interview, applicant })),
  );
  const visible = rows
    .filter((row) => statusForTab(row.interview.status) === activeSubTab)
    .sort((a, b) => new Date(a.interview.scheduledStart).getTime() - new Date(b.interview.scheduledStart).getTime());

  const startReschedule = (row: InterviewRow) => {
    setActionError(null);
    setReschedulingId(row.interview.id);
    setNewStart(toDateTimeLocalValue(row.interview.scheduledStart));
  };

  const submitReschedule = async (row: InterviewRow) => {
    if (!onRescheduleInterview || !newStart) return;
    const start = new Date(newStart);
    if (Number.isNaN(start.getTime()) || start.getTime() <= Date.now() + 15 * 60_000) {
      setActionError('Pick a new time at least 15 minutes in the future.');
      return;
    }
    setPendingId(row.interview.id);
    setActionError(null);
    try {
      await onRescheduleInterview(row.interview.id, start.toISOString());
      setReschedulingId(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to reschedule the interview.');
    } finally {
      setPendingId(null);
    }
  };

  const submitComplete = async (row: InterviewRow) => {
    if (!onCompleteInterview) return;
    setPendingId(row.interview.id);
    setActionError(null);
    try {
      await onCompleteInterview(row.interview.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to complete the interview.');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="flex flex-col w-full h-full pb-24 md:pb-0">
      <div className="flex justify-between items-center mb-6 px-5 md:px-0">
        <h2 className="text-2xl md:text-[24px] font-semibold tracking-tight text-[#4f46e5]">Interviews</h2>
        <div className="flex items-center gap-2">
          <button className="text-[#4f46e5] hover:bg-[#e2e8f0] transition-colors p-2 rounded-full active:scale-95 flex items-center justify-center" aria-label="Search interviews">
            <Search className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex overflow-x-auto hide-scrollbar border-b border-[#cbd5e1] mb-6 mx-5 md:mx-0">
        {SUB_TABS.map((tab) => {
          const count = rows.filter((row) => statusForTab(row.interview.status) === tab).length;
          return (
            <button
              key={tab}
              onClick={() => { setActiveSubTab(tab); setActionError(null); setReschedulingId(null); }}
              className={`px-4 py-3 text-[13px] font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                activeSubTab === tab
                  ? 'text-[#4f46e5] border-[#4f46e5]'
                  : 'text-[#475569] border-transparent hover:text-[#4f46e5]'
              }`}
            >
              {tab} ({count})
            </button>
          );
        })}
      </div>

      {actionError && (
        <p role="alert" className="mx-5 md:mx-0 mb-4 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {actionError}
        </p>
      )}

      {/* Interview Cards List */}
      <div className="flex flex-col gap-4 px-5 md:px-0">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-[#475569]">
            <span className="material-symbols-outlined text-4xl mb-4 opacity-50">event_busy</span>
            <p className="text-[16px]">No {activeSubTab.toLowerCase()} interviews at the moment.</p>
            {activeSubTab === 'Requested' && (
              <p className="text-[13px] mt-1 opacity-70">Schedule one from a candidate&apos;s card to see it here.</p>
            )}
          </div>
        ) : (
          visible.map((row) => {
            const { interview, applicant } = row;
            const expanded = expandedId === interview.id;
            const rescheduling = reschedulingId === interview.id;
            const pending = pendingId === interview.id;
            const TypeIcon = interview.interviewType === 'video' ? Video : interview.interviewType === 'phone' ? Phone : MapPin;
            const canReschedule = onRescheduleInterview && ['requested', 'confirmed', 'reschedule_requested', 'rescheduled'].includes(interview.status);
            const canComplete = onCompleteInterview && interview.status === 'confirmed';
            return (
              <article key={interview.id} className="bg-white rounded-lg border border-[#cbd5e1] shadow-[0_4px_12px_rgba(15,23,42,0.05)] p-4 flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <div className="flex gap-3 items-center">
                    {applicant.avatarUrl ? (
                      <img src={applicant.avatarUrl} alt={applicant.name} className="w-12 h-12 rounded-full object-cover border border-[#cbd5e1]" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[#ede9fe] text-[#4f46e5] font-bold flex items-center justify-center text-lg">
                        {applicant.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h3 className="text-[18px] font-semibold text-[#0f172a]">{applicant.name}</h3>
                      <p className="text-[13px] font-medium text-[#475569]">{applicant.appliedJobTitle}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-[#ede9fe] text-[#1e1b4b] rounded-full text-[13px] font-medium capitalize">
                    {interview.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 text-[#475569]">
                    <Calendar className="w-[18px] h-[18px] shrink-0" />
                    <span className="text-[13px] font-medium">
                      {formatInterviewDateTime(interview.scheduledStart)} · {interview.durationMinutes} min
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[#475569]">
                    <TypeIcon className="w-[18px] h-[18px] shrink-0" />
                    <span className="text-[13px] font-medium truncate">
                      {interviewTypeLabel(interview.interviewType)}
                      {interview.interviewType === 'in_person' && interview.locationText ? ` · ${interview.locationText}` : ''}
                      {interview.interviewType === 'phone' && interview.locationText ? ` · ${interview.locationText}` : ''}
                    </span>
                  </div>
                </div>

                {interview.interviewType === 'video' && interview.meetingUrl && (
                  <a href={interview.meetingUrl} target="_blank" rel="noreferrer" className="text-[13px] font-semibold text-[#6d28d9] hover:underline truncate">
                    Join meeting link
                  </a>
                )}
                {interview.candidateMessage && (
                  <p className="text-[13px] text-[#475569] bg-[#f8fafc] border border-[#cbd5e1]/40 rounded-lg px-3 py-2">
                    <span className="font-semibold text-[#0f172a]">Candidate: </span>{interview.candidateMessage}
                  </p>
                )}

                {expanded && (
                  <div className="text-[13px] text-[#475569] space-y-1 border-t border-[#e2e8f0] pt-3 mt-1">
                    {interview.locationText && <p><span className="font-semibold text-[#0f172a]">Location: </span>{interview.locationText}</p>}
                    {interview.employerMessage && <p><span className="font-semibold text-[#0f172a]">Your note: </span>{interview.employerMessage}</p>}
                    <p><span className="font-semibold text-[#0f172a]">Contact: </span>{applicant.email}{applicant.phone ? ` · ${applicant.phone}` : ''}</p>
                  </div>
                )}

                {rescheduling && (
                  <div className="flex flex-col sm:flex-row gap-2 border-t border-[#e2e8f0] pt-3 mt-1">
                    <input
                      type="datetime-local"
                      value={newStart}
                      onChange={(e) => setNewStart(e.target.value)}
                      className="flex-1 h-10 bg-white border border-[#cbd5e1]/60 rounded-lg px-3 text-[13px] text-[#0f172a] outline-none focus:ring-2 focus:ring-[#4f46e5]"
                      aria-label="New interview date and time"
                    />
                    <button
                      onClick={() => submitReschedule(row)}
                      disabled={pending || !newStart}
                      className="px-4 h-10 bg-[#4f46e5] text-white text-[13px] font-semibold rounded-full hover:bg-[#6d28d9] transition-colors disabled:opacity-60 cursor-pointer"
                    >
                      {pending ? 'Saving…' : 'Save new time'}
                    </button>
                    <button
                      onClick={() => setReschedulingId(null)}
                      className="px-4 h-10 bg-white border border-[#cbd5e1] text-[13px] font-medium rounded-full hover:bg-[#e2e8f0] transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                <div className="flex gap-3 mt-2 pt-3 border-t border-[#e2e8f0]">
                  <button
                    onClick={() => setExpandedId(expanded ? null : interview.id)}
                    className="flex-1 bg-white border border-[#cbd5e1] text-[#0f172a] text-[13px] font-medium py-2 rounded-full hover:bg-[#e2e8f0] transition-colors flex justify-center items-center gap-1 cursor-pointer"
                  >
                    {expanded ? 'Hide' : 'View'} <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  </button>
                  {canReschedule && !rescheduling && (
                    <button
                      onClick={() => startReschedule(row)}
                      className="flex-1 bg-white border border-[#cbd5e1] text-[#0f172a] text-[13px] font-medium py-2 rounded-full hover:bg-[#e2e8f0] transition-colors cursor-pointer"
                    >
                      Reschedule
                    </button>
                  )}
                  {canComplete && (
                    <button
                      onClick={() => submitComplete(row)}
                      disabled={pending}
                      className="flex-1 bg-[#7c3aed] text-white text-[13px] font-medium py-2 rounded-full hover:bg-[#6d28d9] transition-colors disabled:opacity-60 cursor-pointer"
                    >
                      {pending ? 'Saving…' : 'Complete'}
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
};

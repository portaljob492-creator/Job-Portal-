/**
 * Interview scheduling payload: pure builders/validators shared by the
 * employer form and the backend call, so the two can never disagree about
 * what the database accepts. Covered by scripts/test-sprint1.mjs.
 */

export type InterviewFormType = 'in-person' | 'video' | 'phone';
export type InterviewDbType = 'in_person' | 'video' | 'phone';

export const INTERVIEW_TYPE_MAP: Record<InterviewFormType, InterviewDbType> = {
  'in-person': 'in_person',
  video: 'video',
  phone: 'phone',
};

/** The RPC refuses anything sooner than now + 15 minutes. */
export const INTERVIEW_MIN_LEAD_MINUTES = 15;
export const INTERVIEW_MIN_DURATION_MINUTES = 10;
export const INTERVIEW_MAX_DURATION_MINUTES = 480;

export interface InterviewScheduleInput {
  interviewType: InterviewFormType;
  /** `YYYY-MM-DD` from the date picker. */
  date: string;
  /** `HH:MM` from the time picker. */
  time: string;
  /** Minutes, from the duration picker. */
  durationMinutes: number;
  /** Address / phone / meeting link, depending on type. */
  location: string;
  employerMessage: string;
}

export interface InterviewSchedulePayload {
  p_interview_type: InterviewDbType;
  /** ISO timestamp in the employer's local zone, as the picker entered it. */
  p_scheduled_start: string;
  p_duration_minutes: number;
  p_location_text: string | null;
  p_meeting_url: string | null;
  p_employer_message: string | null;
}

export type InterviewScheduleResult =
  | { ok: true; payload: InterviewSchedulePayload }
  | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export function buildInterviewSchedule(input: InterviewScheduleInput): InterviewScheduleResult {
  if (!DATE_RE.test(input.date.trim()) || !TIME_RE.test(input.time.trim())) {
    return { ok: false, error: 'Choose an interview date and time.' };
  }
  const start = new Date(`${input.date.trim()}T${input.time.trim()}:00`);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, error: 'That date or time is not valid.' };
  }
  const leadMs = start.getTime() - Date.now();
  if (leadMs <= INTERVIEW_MIN_LEAD_MINUTES * 60_000) {
    return { ok: false, error: 'Interviews must be scheduled at least 15 minutes in the future.' };
  }
  const duration = Math.floor(Number(input.durationMinutes));
  if (!Number.isFinite(duration) || duration < INTERVIEW_MIN_DURATION_MINUTES || duration > INTERVIEW_MAX_DURATION_MINUTES) {
    return { ok: false, error: `Duration must be between ${INTERVIEW_MIN_DURATION_MINUTES} and ${INTERVIEW_MAX_DURATION_MINUTES} minutes.` };
  }

  const location = input.location.trim();
  const message = input.employerMessage.trim();
  const dbType = INTERVIEW_TYPE_MAP[input.interviewType];

  if (dbType === 'video') {
    // The table check requires video interviews to carry an https meeting URL.
    if (!/^https:\/\//i.test(location)) {
      return { ok: false, error: 'Add an https:// meeting link for a video interview.' };
    }
    return {
      ok: true,
      payload: {
        p_interview_type: dbType,
        p_scheduled_start: start.toISOString(),
        p_duration_minutes: duration,
        p_location_text: null,
        p_meeting_url: location,
        p_employer_message: message || null,
      },
    };
  }

  if (dbType === 'in_person' && !location) {
    return { ok: false, error: 'Add the salon address for an in-person interview.' };
  }

  return {
    ok: true,
    payload: {
      p_interview_type: dbType,
      p_scheduled_start: start.toISOString(),
      p_duration_minutes: duration,
      p_location_text: location || null,
      p_meeting_url: null,
      p_employer_message: message || null,
    },
  };
}

/** Stable, locale-aware rendering for interview timestamps. */
export function formatInterviewDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Date to be confirmed';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function interviewTypeLabel(type: string): string {
  if (type === 'video') return 'Video Call';
  if (type === 'phone') return 'Phone Call';
  return 'In-Person';
}

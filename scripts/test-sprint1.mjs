/**
 * Nexora Sprint 1 contract checks (offline, no credentials).
 *
 * Covers the pure logic behind the six Sprint 1 fixes plus the RPC arg-name
 * contract between `src/services/backend.ts` and `supabase/migrations/` —
 * the exact class of bug that broke interview scheduling before.
 *
 *   npm run test:sprint1
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildInterviewSchedule,
  formatInterviewDateTime,
  interviewTypeLabel,
} from '../src/lib/interviewSchedule.ts';
import {
  avatarStoragePath,
  dataUrlToBlob,
  isDataUrl,
  isRemoteUrl,
  isStoragePath,
  messageAttachmentStoragePath,
  portfolioStoragePath,
  resumeStoragePath,
  sanitizeFileName,
  supportAttachmentStoragePath,
} from '../src/lib/storageMedia.ts';
import { mapBackendError } from '../src/services/backend.ts';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const checks = [];
const check = (name, condition) => {
  if (!condition) throw new Error(`FAILED: ${name}`);
  checks.push(name);
};

/* ------------------------------------------------------------------ */
/* 1. Interview scheduling payload                                     */
/* ------------------------------------------------------------------ */

const tomorrow = new Date(Date.now() + 24 * 3600_000);
const dateStr = tomorrow.toISOString().slice(0, 10);

const inPerson = buildInterviewSchedule({
  interviewType: 'in-person',
  date: dateStr,
  time: '14:30',
  durationMinutes: 45,
  location: 'Luxe Salon, MG Road',
  employerMessage: 'Bring your portfolio.',
});
check('in-person payload accepted', inPerson.ok === true);
if (inPerson.ok) {
  check('in-person maps to in_person', inPerson.payload.p_interview_type === 'in_person');
  check('in-person keeps location text', inPerson.payload.p_location_text === 'Luxe Salon, MG Road');
  check('in-person has no meeting url', inPerson.payload.p_meeting_url === null);
  check('in-person start is ISO', /^\d{4}-\d{2}-\d{2}T/.test(inPerson.payload.p_scheduled_start));
  check('in-person keeps duration', inPerson.payload.p_duration_minutes === 45);
}

const video = buildInterviewSchedule({
  interviewType: 'video',
  date: dateStr,
  time: '10:00',
  durationMinutes: 30,
  location: 'https://meet.example.com/abc',
  employerMessage: '',
});
check('video payload accepted', video.ok === true);
if (video.ok) {
  check('video puts link in meeting url', video.payload.p_meeting_url === 'https://meet.example.com/abc');
  check('video has no location text', video.payload.p_location_text === null);
  check('empty message becomes null', video.payload.p_employer_message === null);
}

const phone = buildInterviewSchedule({
  interviewType: 'phone', date: dateStr, time: '09:00', durationMinutes: 15, location: '', employerMessage: '',
});
check('phone without location accepted', phone.ok === true);

const past = buildInterviewSchedule({
  interviewType: 'phone', date: '2020-01-01', time: '09:00', durationMinutes: 30, location: '', employerMessage: '',
});
check('past date rejected', past.ok === false);

const soon = new Date(Date.now() + 5 * 60_000);
const tooSoon = buildInterviewSchedule({
  interviewType: 'phone',
  date: soon.toISOString().slice(0, 10),
  time: soon.toISOString().slice(11, 16),
  durationMinutes: 30,
  location: '',
  employerMessage: '',
});
check('sub-15-minute lead rejected', tooSoon.ok === false);

const badVideo = buildInterviewSchedule({
  interviewType: 'video', date: dateStr, time: '10:00', durationMinutes: 30, location: 'not a link', employerMessage: '',
});
check('video without https rejected', badVideo.ok === false);

const noAddress = buildInterviewSchedule({
  interviewType: 'in-person', date: dateStr, time: '10:00', durationMinutes: 30, location: '  ', employerMessage: '',
});
check('in-person without address rejected', noAddress.ok === false);

const badDuration = buildInterviewSchedule({
  interviewType: 'phone', date: dateStr, time: '10:00', durationMinutes: 5, location: '', employerMessage: '',
});
check('short duration rejected', badDuration.ok === false);

check('interview type labels', interviewTypeLabel('video') === 'Video Call' && interviewTypeLabel('phone') === 'Phone Call' && interviewTypeLabel('in_person') === 'In-Person');
check('bad date formats honestly', formatInterviewDateTime('not-a-date') === 'Date to be confirmed');

/* ------------------------------------------------------------------ */
/* 2. Storage paths + value guards                                     */
/* ------------------------------------------------------------------ */

const uid = '11111111-2222-3333-4444-555555555555';
check('avatar path is owner-scoped', avatarStoragePath(uid).startsWith(`${uid}/avatar-`));
check('avatar path keeps png ext', avatarStoragePath(uid, 'image/png').endsWith('.png'));
check('portfolio path is owner-scoped', portfolioStoragePath(uid).startsWith(`${uid}/portfolio/`));
const traversalPath = resumeStoragePath(uid, '../../etc/passwd.pdf');
check(
  'resume path strips traversal',
  traversalPath.startsWith(`${uid}/`) && !traversalPath.includes('..') && traversalPath.endsWith('-passwd.pdf'),
);
check('support path is owner-scoped', supportAttachmentStoragePath(uid, 'shot.png').startsWith(`${uid}/`));
check(
  'message path nests conversation',
  messageAttachmentStoragePath(uid, 'conv-1', 'a b.pdf').startsWith(`${uid}/conv-1/`) &&
    messageAttachmentStoragePath(uid, 'conv-1', 'a b.pdf').endsWith('a-b.pdf'),
);
check('sanitize strips separators', sanitizeFileName('a/b\\c.pdf') === 'c.pdf');
check('sanitize falls back', sanitizeFileName('...') === 'file');

check('remote url detection', isRemoteUrl('https://x/y.png') && !isRemoteUrl(`${uid}/avatar-1.jpg`));
check('data url detection', isDataUrl('data:image/png;base64,AA==') && !isDataUrl('https://x/y.png'));
check('storage path detection', isStoragePath(`${uid}/avatar-1.jpg`) && !isStoragePath('data:image/png;base64,AA==') && !isStoragePath('https://x/y.png') && !isStoragePath(''));

const blob = dataUrlToBlob('data:image/png;base64,aGVsbG8=');
check('data url decodes to bytes', blob.size === 5 && blob.type === 'image/png');

/* ------------------------------------------------------------------ */
/* 3. Backend error codes (Sprint 1 additions)                         */
/* ------------------------------------------------------------------ */

check('profile-incomplete maps to the candidate profile gate',
  mapBackendError(new Error('PROFILE_INCOMPLETE')) === 'Please complete your candidate profile before applying.');
check('interview transition maps friendly', mapBackendError(new Error('INVALID_INTERVIEW_TRANSITION')).includes('no longer'));
check('salon-not-found maps friendly', mapBackendError(new Error('SALON_NOT_FOUND')).includes('search results'));
check('raw sql still hidden', mapBackendError(new Error('violates check constraint "x" on relation "y"'), 'Fallback.') === 'Fallback.');

/* ------------------------------------------------------------------ */
/* 4. RPC arg-name contract: backend call sites vs migration signatures */
/* ------------------------------------------------------------------ */

const migrations = fs
  .readdirSync(path.join(repoRoot, 'supabase/migrations'))
  .filter((file) => file.endsWith('.sql'))
  .map((file) => fs.readFileSync(path.join(repoRoot, 'supabase/migrations', file), 'utf8'))
  .join('\n');
const backendSrc = fs.readFileSync(path.join(repoRoot, 'src/services/backend.ts'), 'utf8');

const rpcParams = (name) => {
  const match = migrations.match(new RegExp(`function public\\.${name}\\(([^)]*)\\)`, 's'));
  if (!match) throw new Error(`FAILED: migration for ${name} not found`);
  return match[1]
    .split(',')
    .map((chunk) => chunk.trim().split(/\s+/)[0])
    .filter(Boolean);
};

const callArgs = (needle) => {
  const start = backendSrc.indexOf(needle);
  if (start === -1) throw new Error(`FAILED: backend call ${needle} not found`);
  const open = backendSrc.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < backendSrc.length; i += 1) {
    if (backendSrc[i] === '{') depth += 1;
    if (backendSrc[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        const body = backendSrc.slice(open + 1, i);
        return body
          .split(',')
          .map((chunk) => chunk.trim())
          .filter((chunk) => /^[A-Za-z_][A-Za-z0-9_]*\s*:/.test(chunk) || /^(target_|p_)[A-Za-z0-9_]+$/.test(chunk))
          .map((chunk) => chunk.split(':')[0].trim());
      }
    }
  }
  throw new Error(`FAILED: could not parse ${needle}`);
};

for (const [rpc, needle] of [
  ['create_interview_request', "rpc('create_interview_request'"],
  ['submit_job_application', "rpc('submit_job_application'"],
  ['report_job', "rpc('report_job'"],
  ['report_employer', "rpc('report_employer'"],
  ['create_job_support_ticket', "rpc('create_job_support_ticket'"],
  ['request_job_account_deletion', "rpc('request_job_account_deletion'"],
  ['reschedule_interview', "rpc('reschedule_interview'"],
]) {
  const params = rpcParams(rpc);
  const args = callArgs(needle).filter((arg) => arg !== '...schedule');
  const unknown = args.filter((arg) => !params.includes(arg));
  check(`${rpc} arg names match migration`, unknown.length === 0);
}
// The interview form payload spreads its keys into the RPC call.
const payloadKeys = ['p_interview_type', 'p_scheduled_start', 'p_duration_minutes', 'p_location_text', 'p_meeting_url', 'p_employer_message'];
const interviewParams = rpcParams('create_interview_request');
check(
  'interview payload keys match migration',
  payloadKeys.every((key) => interviewParams.includes(key)),
);

console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));

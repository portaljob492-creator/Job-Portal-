import WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';

globalThis.WebSocket = WebSocket;

const url = process.env.SUPABASE_URL;
const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !publicKey || !serviceKey) {
  throw new Error('Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY.');
}
if (!process.env.ALLOW_JOB_BACKEND_TEST) {
  throw new Error('Set ALLOW_JOB_BACKEND_TEST=1. The test creates and then removes isolated fixtures.');
}

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, clientOptions);
const stamp = Date.now();
const password = `Arena-${stamp}-Secure!`;
const employerEmail = `arena-employer-${stamp}@example.com`;
const seekerEmail = `arena-seeker-${stamp}@example.com`;
let employerId;
let seekerId;
let salonId;
let organizationId;
const checks = [];

function assertCheck(name, condition) {
  if (!condition) throw new Error(`FAILED: ${name}`);
  checks.push(name);
}
function throwOnError(result) {
  if (result.error) throw result.error;
  return result.data;
}

try {
  employerId = throwOnError(await admin.auth.admin.createUser({
    email: employerEmail,
    password,
    email_confirm: true,
    user_metadata: { app_context: 'jobs', job_role: 'employer', role: 'employer', full_name: 'Arena Employer' },
  })).user.id;
  seekerId = throwOnError(await admin.auth.admin.createUser({
    email: seekerEmail,
    password,
    email_confirm: true,
    user_metadata: { app_context: 'jobs', job_role: 'job_seeker', role: 'seeker', full_name: 'Arena Seeker' },
  })).user.id;

  const employer = createClient(url, publicKey, clientOptions);
  const seeker = createClient(url, publicKey, clientOptions);
  throwOnError(await employer.auth.signInWithPassword({ email: employerEmail, password }));
  throwOnError(await seeker.auth.signInWithPassword({ email: seekerEmail, password }));

  const roles = throwOnError(await admin.from('job_user_roles').select('user_id,role').in('user_id', [employerId, seekerId]));
  assertCheck('auth users and role trigger',
    roles.some((row) => row.user_id === employerId && row.role === 'employer') &&
    roles.some((row) => row.user_id === seekerId && row.role === 'job_seeker'));

  salonId = throwOnError(await employer.rpc('complete_job_employer_onboarding', {
    p_business_name: 'Arena Test Salon', p_contact_name: 'Arena Employer',
    p_address: 'Test Road 1', p_city: 'Kota', p_state: 'Rajasthan', p_postal_code: '324001',
    p_business_type: 'salon', p_website_url: null, p_instagram_url: null,
  }));
  organizationId = throwOnError(await admin.from('salons').select('organization_id').eq('id', salonId).single()).organization_id;
  assertCheck('employer onboarding transaction', Boolean(salonId && organizationId));

  const candidateId = throwOnError(await seeker.rpc('complete_job_seeker_onboarding', {
    p_headline: 'Hair Stylist', p_bio: 'Integration test candidate profile.',
    p_city: 'Kota', p_state: 'Rajasthan', p_experience_level: 'mid',
    p_total_experience_months: 24, p_expected_salary_min: 25000,
    p_expected_salary_max: 40000, p_available_from: null,
    p_open_to_relocation: false, p_preferred_roles: ['Hair Stylist'],
    p_employment_types: ['full_time'],
  }));
  assertCheck('candidate onboarding transaction', Boolean(candidateId));

  const locationId = throwOnError(await employer.from('job_salon_locations').select('id')
    .eq('salon_id', salonId).eq('is_primary', true).single()).id;
  const jobId = throwOnError(await employer.rpc('create_job_post', {
    p_salon_id: salonId, p_location_id: locationId,
    p_title: 'Integration Test Hair Stylist', p_category: 'Hair',
    p_description: 'A production integration test listing with complete and valid details.',
    p_employment_type: 'full_time', p_workplace_type: 'on_site',
    p_experience_min_months: 0, p_experience_max_months: 36,
    p_freshers_allowed: true, p_salary_min: 25000, p_salary_max: 40000,
    p_pay_type: 'monthly', p_benefits: 'Training and incentives',
    p_working_days: 'Monday to Saturday', p_working_hours: '10:00-19:00',
    p_openings: 1, p_tags: ['Test'], p_image_path: null,
  }));
  const published = throwOnError(await employer.rpc('publish_job', { target_job_id: jobId }));
  assertCheck('secure job create and publish', published.status === 'published');

  const publicRows = throwOnError(await seeker.from('public_job_listings').select('id').eq('id', jobId));
  assertCheck('published job visibility', publicRows.length === 1);

  const application = throwOnError(await seeker.rpc('submit_job_application', {
    target_job_id: jobId, p_resume_id: null, p_cover_note: 'I am interested in this role.',
    p_expected_salary: 32000, p_available_from: null,
  }));
  const duplicate = await seeker.rpc('submit_job_application', {
    target_job_id: jobId, p_resume_id: null, p_cover_note: 'Duplicate',
    p_expected_salary: 32000, p_available_from: null,
  });
  assertCheck('duplicate application blocked', Boolean(duplicate.error));

  const anonymous = createClient(url, publicKey, clientOptions);
  const anonymousApplications = throwOnError(await anonymous.from('job_applications').select('id').eq('id', application.id));
  assertCheck('anonymous application read denied', anonymousApplications.length === 0);
  const anonymousMutation = await anonymous.rpc('submit_job_application', {
    target_job_id: jobId, p_resume_id: null, p_cover_note: null,
    p_expected_salary: null, p_available_from: null,
  });
  assertCheck('anonymous workflow RPC denied', Boolean(anonymousMutation.error));

  const cards = throwOnError(await employer.rpc('get_job_applicant_cards'));
  assertCheck('authorized candidate projection',
    cards.some((row) => row.application_id === application.id && row.full_name === 'Arena Seeker'));

  throwOnError(await employer.rpc('mark_application_viewed', { target_application_id: application.id }));
  throwOnError(await employer.rpc('shortlist_application', { target_application_id: application.id }));
  const interview = throwOnError(await employer.rpc('create_interview_request', {
    target_application_id: application.id, p_interview_type: 'in_person',
    p_scheduled_start: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    p_duration_minutes: 30, p_location_text: 'Arena Test Salon, Kota',
    p_meeting_url: null, p_employer_message: 'Please attend the interview.',
  }));
  throwOnError(await seeker.rpc('accept_interview', { target_interview_id: interview.id }));
  const completedInterview = throwOnError(await employer.rpc('complete_interview', { target_interview_id: interview.id }));
  assertCheck('interview state machine', completedInterview.status === 'completed');

  const offer = throwOnError(await employer.rpc('send_job_offer', {
    target_application_id: application.id, p_job_role: 'Hair Stylist', p_salary: 35000,
    p_employment_type: 'full_time',
    p_joining_date: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
    p_offer_notes: 'Welcome to the team.', p_offer_document_path: null,
    p_expires_at: new Date(Date.now() + 5 * 86_400_000).toISOString(),
  }));
  throwOnError(await seeker.rpc('accept_job_offer', { target_offer_id: offer.id }));
  const hired = throwOnError(await employer.rpc('mark_candidate_hired', { target_application_id: application.id }));
  assertCheck('offer and hired state machine', hired.status === 'hired');

  const history = throwOnError(await seeker.from('job_application_status_history').select('to_status')
    .eq('application_id', application.id).order('created_at'));
  assertCheck('application status history', history.length >= 8 && history.at(-1).to_status === 'hired');
  const notifications = throwOnError(await seeker.from('job_notifications').select('type').eq('user_id', seekerId));
  assertCheck('workflow notifications', notifications.some((row) => row.type === 'candidate_hired'));

  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
} finally {
  if (salonId) {
    const posts = await admin.from('job_posts').select('id').eq('salon_id', salonId);
    const postIds = (posts.data || []).map((row) => row.id);
    if (postIds.length) {
      await admin.from('job_applications').delete().in('job_id', postIds);
      await admin.from('job_posts').delete().in('id', postIds);
    }
    await admin.from('salons').delete().eq('id', salonId);
  }
  if (organizationId) await admin.from('organizations').delete().eq('id', organizationId);
  if (employerId) await admin.auth.admin.deleteUser(employerId);
  if (seekerId) await admin.auth.admin.deleteUser(seekerId);
}

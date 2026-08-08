-- Nexora Jobs: production core schema
-- Designed to coexist with the existing Nexora marketplace schema.
-- Existing public.profiles, public.organizations, public.organization_members,
-- public.salons, public.notifications and public.push_subscriptions are reused.

begin;

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Role and profile model
-- ---------------------------------------------------------------------------

create table if not exists public.job_user_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null check (role in ('job_seeker', 'employer', 'admin')),
  account_status text not null default 'active'
    check (account_status in ('active', 'suspended', 'deleted')),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_seeker_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  headline text,
  bio text,
  city text,
  state text,
  country text not null default 'India',
  latitude numeric check (latitude is null or latitude between -90 and 90),
  longitude numeric check (longitude is null or longitude between -180 and 180),
  experience_level text check (
    experience_level is null or experience_level in ('fresher', 'junior', 'mid', 'senior', 'lead')
  ),
  total_experience_months integer not null default 0 check (total_experience_months >= 0),
  expected_salary_min numeric check (expected_salary_min is null or expected_salary_min >= 0),
  expected_salary_max numeric check (expected_salary_max is null or expected_salary_max >= 0),
  available_from date,
  open_to_relocation boolean not null default false,
  profile_visibility text not null default 'employers'
    check (profile_visibility in ('private', 'employers')),
  profile_completion integer not null default 0 check (profile_completion between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    expected_salary_min is null or expected_salary_max is null or
    expected_salary_min <= expected_salary_max
  )
);

create table if not exists public.job_skills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  category text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists job_skills_name_unique on public.job_skills (lower(name));
create unique index if not exists job_skills_slug_unique on public.job_skills (lower(slug));

create table if not exists public.job_candidate_skills (
  candidate_id uuid not null references public.job_seeker_profiles(id) on delete cascade,
  skill_id uuid not null references public.job_skills(id) on delete restrict,
  proficiency_level text check (
    proficiency_level is null or proficiency_level in ('beginner', 'intermediate', 'advanced', 'expert')
  ),
  years_experience numeric check (years_experience is null or years_experience >= 0),
  created_at timestamptz not null default now(),
  primary key (candidate_id, skill_id)
);

create table if not exists public.job_candidate_experience (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.job_seeker_profiles(id) on delete cascade,
  salon_name text not null check (char_length(trim(salon_name)) between 1 and 160),
  role_title text not null check (char_length(trim(role_title)) between 1 and 160),
  city text,
  state text,
  start_date date not null,
  end_date date,
  currently_working boolean not null default false,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  check (not currently_working or end_date is null)
);

create table if not exists public.job_candidate_education (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.job_seeker_profiles(id) on delete cascade,
  course_name text not null check (char_length(trim(course_name)) between 1 and 200),
  institution_name text,
  completion_year integer check (completion_year is null or completion_year between 1950 and 2200),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_candidate_certifications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.job_seeker_profiles(id) on delete cascade,
  certificate_name text not null check (char_length(trim(certificate_name)) between 1 and 200),
  institution_name text,
  completion_year integer check (completion_year is null or completion_year between 1950 and 2200),
  certificate_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_candidate_resumes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.job_seeker_profiles(id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null check (
    mime_type in (
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
  ),
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  is_primary boolean not null default true,
  uploaded_at timestamptz not null default now(),
  unique(storage_path)
);
create unique index if not exists job_candidate_one_primary_resume
  on public.job_candidate_resumes(candidate_id) where is_primary;

create table if not exists public.job_candidate_preferences (
  candidate_id uuid primary key references public.job_seeker_profiles(id) on delete cascade,
  preferred_city text,
  preferred_state text,
  radius_km integer check (radius_km is null or radius_km between 1 and 500),
  salary_min numeric check (salary_min is null or salary_min >= 0),
  salary_max numeric check (salary_max is null or salary_max >= 0),
  available_from date,
  open_to_relocation boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (salary_min is null or salary_max is null or salary_min <= salary_max)
);

create table if not exists public.job_candidate_preferred_roles (
  candidate_id uuid not null references public.job_seeker_profiles(id) on delete cascade,
  role_name text not null,
  created_at timestamptz not null default now(),
  primary key (candidate_id, role_name)
);

create table if not exists public.job_candidate_employment_types (
  candidate_id uuid not null references public.job_seeker_profiles(id) on delete cascade,
  employment_type text not null check (
    employment_type in ('full_time', 'part_time', 'internship', 'freelance', 'contract')
  ),
  primary key (candidate_id, employment_type)
);

-- ---------------------------------------------------------------------------
-- Employer, salon and verification model
-- ---------------------------------------------------------------------------

create table if not exists public.job_employer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  display_name text,
  job_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_salon_members (
  salon_id uuid not null references public.salons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null check (member_role in ('owner', 'manager', 'recruiter')),
  status text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (salon_id, user_id)
);

create table if not exists public.job_salon_profiles (
  salon_id uuid primary key references public.salons(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  website_url text,
  instagram_url text,
  business_type text,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified', 'rejected', 'needs_update')),
  jobs_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_salon_locations (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  label text,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null,
  postal_code text,
  country text not null default 'India',
  latitude numeric check (latitude is null or latitude between -90 and 90),
  longitude numeric check (longitude is null or longitude between -180 and 180),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists job_salon_one_primary_location
  on public.job_salon_locations(salon_id) where is_primary;

create table if not exists public.job_employer_verifications (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'rejected', 'needs_update')),
  business_proof_path text,
  identity_proof_path text,
  salon_proof_path text,
  review_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);
create unique index if not exists job_one_open_verification_per_salon
  on public.job_employer_verifications(salon_id)
  where status in ('pending', 'needs_update');

-- ---------------------------------------------------------------------------
-- Jobs and applications
-- ---------------------------------------------------------------------------

create table if not exists public.job_posts (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  location_id uuid references public.job_salon_locations(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 2 and 160),
  category text,
  description text not null check (char_length(trim(description)) between 20 and 12000),
  responsibilities text,
  employment_type text not null check (
    employment_type in ('full_time', 'part_time', 'internship', 'contract', 'freelance')
  ),
  workplace_type text not null default 'on_site'
    check (workplace_type in ('on_site', 'hybrid', 'remote')),
  experience_min_months integer not null default 0 check (experience_min_months >= 0),
  experience_max_months integer check (experience_max_months is null or experience_max_months >= 0),
  freshers_allowed boolean not null default false,
  salary_min numeric check (salary_min is null or salary_min >= 0),
  salary_max numeric check (salary_max is null or salary_max >= 0),
  pay_type text check (pay_type is null or pay_type in ('monthly', 'daily', 'hourly', 'commission')),
  incentives text,
  tips_info text,
  benefits text,
  working_days text,
  working_hours text,
  weekly_off text,
  joining_date date,
  openings integer not null default 1 check (openings > 0 and openings <= 1000),
  image_path text,
  tags text[] not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'published', 'paused', 'closed', 'expired', 'archived')),
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (salary_min is null or salary_max is null or salary_min <= salary_max),
  check (
    experience_max_months is null or experience_min_months <= experience_max_months
  ),
  check (expires_at is null or expires_at > created_at)
);

create table if not exists public.job_post_skills (
  job_id uuid not null references public.job_posts(id) on delete cascade,
  skill_id uuid not null references public.job_skills(id) on delete restrict,
  is_required boolean not null default true,
  primary key (job_id, skill_id)
);

create table if not exists public.job_saved_jobs (
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.job_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_posts(id) on delete restrict,
  candidate_user_id uuid not null references public.profiles(id) on delete restrict,
  candidate_profile_id uuid not null references public.job_seeker_profiles(id) on delete restrict,
  resume_id uuid references public.job_candidate_resumes(id) on delete set null,
  cover_note text check (cover_note is null or char_length(cover_note) <= 5000),
  expected_salary numeric check (expected_salary is null or expected_salary >= 0),
  available_from date,
  status text not null default 'submitted' check (
    status in (
      'submitted', 'viewed', 'shortlisted', 'interview_requested',
      'interview_confirmed', 'interview_completed', 'offer_sent',
      'offer_accepted', 'hired', 'rejected', 'withdrawn', 'position_closed'
    )
  ),
  employer_notes text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, candidate_user_id)
);

create table if not exists public.job_application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.job_applications(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.job_interview_requests (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.job_applications(id) on delete cascade,
  salon_id uuid not null references public.salons(id) on delete restrict,
  candidate_user_id uuid not null references public.profiles(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  interview_type text not null check (interview_type in ('in_person', 'video', 'phone')),
  scheduled_start timestamptz not null,
  duration_minutes integer not null default 30 check (duration_minutes between 10 and 480),
  location_text text,
  meeting_url text,
  employer_message text,
  candidate_message text,
  status text not null default 'requested' check (
    status in (
      'requested', 'confirmed', 'reschedule_requested', 'rescheduled',
      'declined', 'cancelled', 'completed'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_start > created_at - interval '5 minutes'),
  check (
    (interview_type <> 'video') or
    (meeting_url is not null and meeting_url ~* '^https://')
  ),
  check (
    (interview_type <> 'in_person') or
    (location_text is not null and char_length(trim(location_text)) > 0)
  )
);

create table if not exists public.job_interview_schedule_history (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.job_interview_requests(id) on delete cascade,
  previous_start timestamptz,
  new_start timestamptz not null,
  changed_by uuid not null references public.profiles(id) on delete restrict,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.job_offers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.job_applications(id) on delete cascade,
  salon_id uuid not null references public.salons(id) on delete restrict,
  candidate_user_id uuid not null references public.profiles(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  job_role text not null,
  salary numeric check (salary is null or salary >= 0),
  employment_type text,
  joining_date date,
  offer_notes text,
  offer_document_path text,
  status text not null default 'sent'
    check (status in ('sent', 'accepted', 'declined', 'expired', 'withdrawn')),
  sent_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or expires_at > sent_at)
);

-- ---------------------------------------------------------------------------
-- Notifications, saved searches, messaging, portfolio, support and safety
-- ---------------------------------------------------------------------------

create table if not exists public.job_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.job_saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  search_query text,
  category text,
  city text,
  employment_type text,
  salary_min numeric,
  skill_id uuid references public.job_skills(id) on delete set null,
  notify_push boolean not null default true,
  notify_email boolean not null default false,
  notify_in_app boolean not null default true,
  match_frequency text not null default 'instant'
    check (match_frequency in ('instant', 'daily', 'weekly')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_conversations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_posts(id) on delete cascade,
  candidate_user_id uuid not null references public.profiles(id) on delete cascade,
  employer_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'inquiry'
    check (status in ('inquiry', 'interview_requested', 'offer_sent', 'archived')),
  last_message text,
  last_message_at timestamptz not null default now(),
  candidate_unread_count integer not null default 0 check (candidate_unread_count >= 0),
  employer_unread_count integer not null default 0 check (employer_unread_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_id, candidate_user_id, employer_user_id)
);

create table if not exists public.job_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.job_conversations(id) on delete cascade,
  sender_user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  attachment jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  check (char_length(trim(body)) > 0 or attachment is not null)
);

create table if not exists public.job_portfolio_items (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.job_seeker_profiles(id) on delete cascade,
  title text not null,
  category text not null,
  image_path text not null,
  description text,
  technique text,
  item_date date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  issue_type text not null,
  subject text not null,
  description text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.job_support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.job_support_tickets(id) on delete cascade,
  sender_user_id uuid references public.profiles(id) on delete set null,
  message text not null,
  attachment_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.job_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references public.profiles(id) on delete set null,
  target_type text not null check (target_type in ('job', 'employer', 'candidate')),
  target_id uuid not null,
  reason text not null,
  details text,
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.job_blocked_employers (
  candidate_user_id uuid not null references public.profiles(id) on delete cascade,
  salon_id uuid not null references public.salons(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(candidate_user_id, salon_id)
);

create table if not exists public.job_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  salon_id uuid references public.salons(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.job_account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  reason text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'cancelled')),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(user_id, status)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists job_user_roles_role_idx on public.job_user_roles(role, account_status);
create index if not exists job_candidate_city_idx on public.job_seeker_profiles(city, state);
create index if not exists job_candidate_visibility_idx on public.job_seeker_profiles(profile_visibility);
create index if not exists job_candidate_skills_skill_idx on public.job_candidate_skills(skill_id, candidate_id);
create index if not exists job_candidate_experience_idx on public.job_candidate_experience(candidate_id, sort_order);
create index if not exists job_salon_members_user_idx on public.job_salon_members(user_id, status);
create index if not exists job_salon_locations_salon_idx on public.job_salon_locations(salon_id);
create index if not exists job_verifications_salon_idx on public.job_employer_verifications(salon_id, submitted_at desc);
create index if not exists job_posts_status_published_idx on public.job_posts(status, published_at desc);
create index if not exists job_posts_salon_status_idx on public.job_posts(salon_id, status);
create index if not exists job_posts_employment_idx on public.job_posts(employment_type);
create index if not exists job_posts_category_idx on public.job_posts(category);
create index if not exists job_posts_salary_idx on public.job_posts(salary_min, salary_max);
create index if not exists job_posts_search_idx on public.job_posts using gin (
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(category, '') || ' ' || coalesce(description, ''))
);
create index if not exists job_posts_title_trgm_idx on public.job_posts using gin (title gin_trgm_ops);
create index if not exists job_applications_candidate_idx on public.job_applications(candidate_user_id, submitted_at desc);
create index if not exists job_applications_job_status_idx on public.job_applications(job_id, status);
create index if not exists job_applications_status_idx on public.job_applications(status, updated_at desc);
create index if not exists job_application_history_idx on public.job_application_status_history(application_id, created_at);
create index if not exists job_interviews_candidate_idx on public.job_interview_requests(candidate_user_id, scheduled_start);
create index if not exists job_interviews_salon_idx on public.job_interview_requests(salon_id, scheduled_start);
create index if not exists job_offers_candidate_idx on public.job_offers(candidate_user_id, sent_at desc);
create index if not exists job_notifications_user_idx on public.job_notifications(user_id, is_read, created_at desc);
create index if not exists job_conversations_candidate_idx on public.job_conversations(candidate_user_id, last_message_at desc);
create index if not exists job_conversations_employer_idx on public.job_conversations(employer_user_id, last_message_at desc);
create index if not exists job_messages_conversation_idx on public.job_messages(conversation_id, created_at);
create index if not exists job_support_user_idx on public.job_support_tickets(user_id, created_at desc);
create index if not exists job_reports_status_idx on public.job_reports(status, created_at desc);
create index if not exists job_audit_entity_idx on public.job_audit_log(entity_type, entity_id, created_at desc);
create index if not exists job_audit_actor_idx on public.job_audit_log(actor_user_id, created_at desc);

commit;

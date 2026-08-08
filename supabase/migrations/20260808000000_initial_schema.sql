-- Nexora Jobs / Job Portal Supabase backend
-- Apply with `supabase db push`, or paste this migration into the Supabase SQL editor.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'seeker' check (role in ('seeker', 'employer')),
  email text not null,
  full_name text not null default '',
  phone text not null default '',
  avatar_url text,
  location text,
  bio text,
  license_number text,
  specialties text[] not null default '{}',
  experience_years integer not null default 0 check (experience_years >= 0),
  portfolio_url text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_unique on public.profiles (lower(email));

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null,
  contact_person text,
  description text,
  website text,
  logo_url text,
  location text,
  license_number text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  salon_name text not null,
  salon_logo_url text,
  location text not null,
  image_url text,
  rating numeric(2,1) not null default 0 check (rating between 0 and 5),
  reviews_count integer not null default 0 check (reviews_count >= 0),
  salary_display text not null,
  job_type text not null check (job_type in ('Full-time', 'Part-time', 'Commission', 'Chair Rental', 'Contract')),
  category text not null check (category in ('Hair', 'Skincare', 'Nails', 'Lashes & Brows', 'Massage', 'Management')),
  tags text[] not null default '{}',
  description text not null,
  requirements text[] not null default '{}',
  benefits text[] not null default '{}',
  is_featured boolean not null default false,
  active_applicants_count integer not null default 0 check (active_applicants_count >= 0),
  status text not null default 'active' check (status in ('draft', 'active', 'paused', 'closed')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index jobs_status_created_idx on public.jobs (status, created_at desc);
create index jobs_employer_idx on public.jobs (employer_id, created_at desc);
create index jobs_category_idx on public.jobs (category);
create index jobs_location_idx on public.jobs (location);
create index jobs_search_idx on public.jobs using gin (
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(salon_name, '') || ' ' || coalesce(description, ''))
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  seeker_id uuid not null references public.profiles(id) on delete cascade,
  cover_note text,
  expected_salary text,
  availability text,
  resume_url text,
  status text not null default 'submitted' check (
    status in ('submitted', 'new', 'viewed', 'under_review', 'shortlisted', 'interview_scheduled', 'offer_extended', 'hired', 'declined')
  ),
  notes text,
  interview_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_id, seeker_id)
);

create index applications_seeker_idx on public.applications (seeker_id, created_at desc);
create index applications_job_idx on public.applications (job_id, created_at desc);
create index applications_status_idx on public.applications (status);

create table public.bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, job_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  seeker_id uuid not null references public.profiles(id) on delete cascade,
  employer_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'Inquiry' check (status in ('Inquiry', 'Interview Requested', 'Offer Extended', 'Archived')),
  last_message text not null default 'Conversation started',
  last_message_at timestamptz not null default now(),
  unread_count_seeker integer not null default 0 check (unread_count_seeker >= 0),
  unread_count_employer integer not null default 0 check (unread_count_employer >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_id, seeker_id, employer_id)
);

create index conversations_seeker_idx on public.conversations (seeker_id, last_message_at desc);
create index conversations_employer_idx on public.conversations (employer_id, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  attachment jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint message_has_content check (char_length(body) > 0 or attachment is not null)
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  category text not null check (category in ('Hair', 'Skin', 'Makeup', 'Nails', 'Barber', 'Other')),
  image_url text not null,
  description text,
  technique text,
  item_date text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index portfolio_items_user_idx on public.portfolio_items (user_id, created_at desc);

create table public.saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  search_query text,
  category text,
  location text,
  job_type text,
  salary text,
  tag text,
  sort_by text not null default 'relevant' check (sort_by in ('relevant', 'salary_high', 'rating_high', 'newest')),
  notify_push boolean not null default true,
  notify_email boolean not null default false,
  notify_in_app boolean not null default true,
  match_frequency text not null default 'Instant' check (match_frequency in ('Instant', 'Daily', 'Weekly')),
  last_match_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index saved_filters_user_idx on public.saved_filters (user_id, created_at desc);

create table public.job_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  saved_filter_id uuid not null references public.saved_filters(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, saved_filter_id, job_id)
);

create index job_alerts_user_idx on public.job_alerts (user_id, is_read, created_at desc);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  category text not null default 'general',
  message text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_tickets_user_idx on public.support_tickets (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Trigger helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger businesses_set_updated_at before update on public.businesses
for each row execute function public.set_updated_at();
create trigger jobs_set_updated_at before update on public.jobs
for each row execute function public.set_updated_at();
create trigger applications_set_updated_at before update on public.applications
for each row execute function public.set_updated_at();
create trigger conversations_set_updated_at before update on public.conversations
for each row execute function public.set_updated_at();
create trigger portfolio_items_set_updated_at before update on public.portfolio_items
for each row execute function public.set_updated_at();
create trigger saved_filters_set_updated_at before update on public.saved_filters
for each row execute function public.set_updated_at();
create trigger support_tickets_set_updated_at before update on public.support_tickets
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text;
  requested_name text;
  requested_business text;
begin
  requested_role := case
    when new.raw_user_meta_data ->> 'role' = 'employer' then 'employer'
    else 'seeker'
  end;
  requested_name := coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), 'User');
  requested_business := nullif(new.raw_user_meta_data ->> 'business_name', '');

  insert into public.profiles (id, role, email, full_name, phone)
  values (
    new.id,
    requested_role,
    coalesce(new.email, ''),
    requested_name,
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  );

  if requested_role = 'employer' and requested_business is not null then
    insert into public.businesses (owner_id, name, contact_person)
    values (new.id, requested_business, requested_name);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- OAuth providers do not preserve arbitrary signup metadata. This narrowly
-- scoped function lets a brand-new account claim its selected app role once,
-- before it has posted a job or submitted an application.
create or replace function public.claim_oauth_role(requested_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if requested_role not in ('seeker', 'employer') then
    raise exception 'Invalid role';
  end if;
  if exists (select 1 from public.jobs where employer_id = (select auth.uid()))
     or exists (select 1 from public.applications where seeker_id = (select auth.uid())) then
    raise exception 'Role can no longer be changed';
  end if;

  update public.profiles
  set role = requested_role
  where id = (select auth.uid()) and onboarding_completed = false;
end;
$$;

grant execute on function public.claim_oauth_role(text) to authenticated;

create or replace function public.sync_application_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_job uuid;
begin
  affected_job := coalesce(new.job_id, old.job_id);
  update public.jobs
  set active_applicants_count = (
    select count(*)::integer
    from public.applications
    where job_id = affected_job and status <> 'declined'
  )
  where id = affected_job;
  return coalesce(new, old);
end;
$$;

create trigger applications_sync_count
after insert or update of status or delete on public.applications
for each row execute function public.sync_application_count();

create or replace function public.sync_conversation_from_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender_role text;
begin
  select role into sender_role from public.profiles where id = new.sender_id;

  update public.conversations
  set
    last_message = case when char_length(new.body) > 0 then new.body else 'Sent an attachment' end,
    last_message_at = new.created_at,
    unread_count_seeker = unread_count_seeker + case when sender_role = 'employer' then 1 else 0 end,
    unread_count_employer = unread_count_employer + case when sender_role = 'seeker' then 1 else 0 end
  where id = new.conversation_id;

  return new;
end;
$$;

create trigger messages_sync_conversation
after insert on public.messages
for each row execute function public.sync_conversation_from_message();

create or replace function public.create_matching_job_alerts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.job_alerts (user_id, saved_filter_id, job_id)
  select sf.user_id, sf.id, new.id
  from public.saved_filters sf
  where sf.notify_in_app = true
    and (sf.category is null or sf.category in ('', 'All Categories') or sf.category = new.category)
    and (sf.location is null or sf.location in ('', 'All Locations') or new.location ilike '%' || sf.location || '%')
    and (sf.job_type is null or sf.job_type in ('', 'All Types') or sf.job_type = new.job_type)
    and (
      sf.search_query is null or sf.search_query = '' or
      to_tsvector('english', coalesce(new.title, '') || ' ' || coalesce(new.description, ''))
        @@ plainto_tsquery('english', sf.search_query)
    )
  on conflict (user_id, saved_filter_id, job_id) do nothing;

  return new;
end;
$$;

create trigger jobs_create_alerts
after insert on public.jobs
for each row when (new.status = 'active')
execute function public.create_matching_job_alerts();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.bookmarks enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.saved_filters enable row level security;
alter table public.job_alerts enable row level security;
alter table public.support_tickets enable row level security;

create policy "Authenticated users can view profiles"
on public.profiles for select to authenticated
using (true);
create policy "Users can update their own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Keep role/email identity fields immutable through ordinary REST updates.
revoke update on table public.profiles from anon, authenticated;
grant update (
  full_name, phone, avatar_url, location, bio, license_number,
  specialties, experience_years, portfolio_url, onboarding_completed
) on table public.profiles to authenticated;

create policy "Businesses are publicly visible"
on public.businesses for select to anon, authenticated
using (true);
create policy "Owners can insert their business"
on public.businesses for insert to authenticated
with check ((select auth.uid()) = owner_id);
create policy "Owners can update their business"
on public.businesses for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);
create policy "Owners can delete their business"
on public.businesses for delete to authenticated
using ((select auth.uid()) = owner_id);

create policy "Active jobs are publicly visible"
on public.jobs for select to anon, authenticated
using (status = 'active' or (select auth.uid()) = employer_id);
create policy "Employers can post jobs"
on public.jobs for insert to authenticated
with check (
  (select auth.uid()) = employer_id and
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'employer')
);
create policy "Employers can update their jobs"
on public.jobs for update to authenticated
using ((select auth.uid()) = employer_id)
with check ((select auth.uid()) = employer_id);
create policy "Employers can delete their jobs"
on public.jobs for delete to authenticated
using ((select auth.uid()) = employer_id);

create policy "Seekers can view their applications"
on public.applications for select to authenticated
using ((select auth.uid()) = seeker_id);
create policy "Employers can view applications to their jobs"
on public.applications for select to authenticated
using (exists (
  select 1 from public.jobs j
  where j.id = job_id and j.employer_id = (select auth.uid())
));
create policy "Seekers can apply once per job"
on public.applications for insert to authenticated
with check (
  (select auth.uid()) = seeker_id and
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'seeker')
);
create policy "Seekers can update their submitted applications"
on public.applications for update to authenticated
using ((select auth.uid()) = seeker_id and status in ('submitted', 'new'))
with check ((select auth.uid()) = seeker_id);
create policy "Employers can update application status"
on public.applications for update to authenticated
using (exists (
  select 1 from public.jobs j
  where j.id = job_id and j.employer_id = (select auth.uid())
))
with check (exists (
  select 1 from public.jobs j
  where j.id = job_id and j.employer_id = (select auth.uid())
));
create policy "Seekers can withdraw applications"
on public.applications for delete to authenticated
using ((select auth.uid()) = seeker_id and status in ('submitted', 'new'));

create policy "Users manage their own bookmarks"
on public.bookmarks for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Users add their own bookmarks"
on public.bookmarks for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Users remove their own bookmarks"
on public.bookmarks for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "Participants view conversations"
on public.conversations for select to authenticated
using ((select auth.uid()) in (seeker_id, employer_id));
create policy "Participants start valid conversations"
on public.conversations for insert to authenticated
with check (
  employer_id = (select j.employer_id from public.jobs j where j.id = job_id)
  and (
    ((select auth.uid()) = seeker_id)
    or (
      (select auth.uid()) = employer_id
      and exists (
        select 1 from public.applications a
        where a.job_id = job_id and a.seeker_id = seeker_id
      )
    )
  )
);
create policy "Participants update conversations"
on public.conversations for update to authenticated
using ((select auth.uid()) in (seeker_id, employer_id))
with check ((select auth.uid()) in (seeker_id, employer_id));

create policy "Participants view messages"
on public.messages for select to authenticated
using (exists (
  select 1 from public.conversations c
  where c.id = conversation_id and (select auth.uid()) in (c.seeker_id, c.employer_id)
));
create policy "Participants send messages"
on public.messages for insert to authenticated
with check (
  (select auth.uid()) = sender_id and
  exists (
    select 1 from public.conversations c
    where c.id = conversation_id and (select auth.uid()) in (c.seeker_id, c.employer_id)
  )
);
create policy "Recipients mark messages read"
on public.messages for update to authenticated
using (exists (
  select 1 from public.conversations c
  where c.id = conversation_id and (select auth.uid()) in (c.seeker_id, c.employer_id)
));

create policy "Authenticated users view portfolios"
on public.portfolio_items for select to authenticated
using (true);
create policy "Users add portfolio items"
on public.portfolio_items for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Users update portfolio items"
on public.portfolio_items for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "Users delete portfolio items"
on public.portfolio_items for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "Users view their saved filters"
on public.saved_filters for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Users add saved filters"
on public.saved_filters for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Users update saved filters"
on public.saved_filters for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "Users delete saved filters"
on public.saved_filters for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "Users view their job alerts"
on public.job_alerts for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Users update their job alerts"
on public.job_alerts for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "Users delete their job alerts"
on public.job_alerts for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "Users view their support tickets"
on public.support_tickets for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Users create support tickets"
on public.support_tickets for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Users update open support tickets"
on public.support_tickets for update to authenticated
using ((select auth.uid()) = user_id and status = 'open')
with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Storage buckets and policies
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('portfolio', 'portfolio', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('job-assets', 'job-assets', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('resumes', 'resumes', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy "Public images are readable"
on storage.objects for select to anon, authenticated
using (bucket_id in ('avatars', 'portfolio', 'job-assets'));
create policy "Users upload to their own image folder"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('avatars', 'portfolio', 'job-assets') and
  (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "Users update their own images"
on storage.objects for update to authenticated
using ((storage.foldername(name))[1] = (select auth.uid())::text)
with check ((storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete their own images"
on storage.objects for delete to authenticated
using ((storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users upload their own resumes"
on storage.objects for insert to authenticated
with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Resume owners and relevant employers can read resumes"
on storage.objects for select to authenticated
using (
  bucket_id = 'resumes' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1
      from public.applications a
      join public.jobs j on j.id = a.job_id
      where a.resume_url like '%' || name and j.employer_id = (select auth.uid())
    )
  )
);

-- Realtime for messaging and application pipeline updates.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'applications'
  ) then
    alter publication supabase_realtime add table public.applications;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'job_alerts'
  ) then
    alter publication supabase_realtime add table public.job_alerts;
  end if;
end $$;

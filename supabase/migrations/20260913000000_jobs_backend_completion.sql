-- Nexora Jobs: backend completion
--
-- The admin-approval migration (20260808170900) replaced the job status
-- vocabulary: 'published' no longer exists in job_posts_status_check and every
-- live row is 'approved'. Two code paths written against the old vocabulary
-- were never updated, which broke the candidate application flow and the
-- public salon-location read. This migration is the authoritative final state
-- for those objects plus the integrity/index work found by the backend audit.
--
-- Everything here is idempotent and safe to re-run.

begin;

-- ---------------------------------------------------------------------------
-- 1. Apply to a job: 'published' -> 'approved'
--
-- submit_job_application is defined exactly once (20260808170100) and required
-- post.status='published'. After 20260808170900 that value can never exist, so
-- EVERY application attempt failed with JOB_NOT_PUBLISHED. The function now
-- gates on the live 'approved' status and additionally requires the salon to be
-- publicly listable, matching public_job_listings.
-- ---------------------------------------------------------------------------

create or replace function public.submit_job_application(
  target_job_id uuid,
  p_resume_id uuid default null,
  p_cover_note text default null,
  p_expected_salary numeric default null,
  p_available_from date default null
)
returns public.job_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.job_assert_authenticated();
  candidate public.job_seeker_profiles;
  post public.job_posts;
  application public.job_applications;
begin
  if public.job_current_role() <> 'job_seeker' then
    raise exception using errcode='42501', message='ROLE_NOT_ALLOWED';
  end if;
  select * into candidate from public.job_seeker_profiles where user_id=actor;
  if not found or candidate.profile_completion < 50 then
    raise exception using errcode='P0001', message='PROFILE_INCOMPLETE';
  end if;
  select * into post from public.job_posts where id=target_job_id for share;
  if not found then raise exception using errcode='P0002', message='JOB_NOT_FOUND'; end if;

  -- Live status value since the mandatory admin approval model.
  if post.status <> 'approved' then
    raise exception using errcode='P0001', message='JOB_NOT_PUBLISHED';
  end if;
  if post.expires_at is not null and post.expires_at <= now() then
    raise exception using errcode='P0001', message='JOB_EXPIRED';
  end if;
  if not exists (
    select 1 from public.salons s
    join public.job_salon_profiles sp on sp.salon_id = s.id
    where s.id = post.salon_id
      and s.is_active = true and s.deleted_at is null
      and sp.jobs_enabled = true
  ) then
    raise exception using errcode='P0001', message='JOB_NOT_PUBLISHED';
  end if;
  if exists (select 1 from public.job_blocked_employers where candidate_user_id=actor and salon_id=post.salon_id) then
    raise exception using errcode='42501', message='SALON_ACCESS_DENIED';
  end if;
  if p_resume_id is not null and not exists (
    select 1 from public.job_candidate_resumes r
    where r.id=p_resume_id and r.candidate_id=candidate.id
  ) then
    raise exception using errcode='42501', message='FOREIGN_RESUME';
  end if;

  insert into public.job_applications(
    job_id,candidate_user_id,candidate_profile_id,resume_id,cover_note,expected_salary,available_from
  ) values (
    post.id,actor,candidate.id,p_resume_id,nullif(trim(p_cover_note),''),p_expected_salary,p_available_from
  ) returning * into application;

  insert into public.job_notifications(user_id,type,title,body,entity_type,entity_id)
  select distinct m.user_id,'application_submitted','New job application',
         'A candidate applied for '||post.title,'application',application.id
  from public.job_salon_members m
  where m.salon_id=post.salon_id and m.status='active';
  return application;
exception when unique_violation then
  raise exception using errcode='23505', message='APPLICATION_ALREADY_EXISTS';
end;
$$;

revoke execute on function public.submit_job_application(uuid,uuid,text,numeric,date) from public,anon;
grant execute on function public.submit_job_application(uuid,uuid,text,numeric,date) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Public salon location read: 'published' -> 'approved'
--
-- The policy below was created in 20260808170200 and never replaced, so its
-- EXISTS branch could not match any row after the status rename: a signed-in or
-- anonymous visitor reading a public job's location row directly was denied.
-- ---------------------------------------------------------------------------

drop policy if exists job_salon_locations_read on public.job_salon_locations;
create policy job_salon_locations_read
on public.job_salon_locations for select to anon,authenticated
using (
  public.job_is_active_salon_member(salon_id) or public.job_is_admin() or exists(
    select 1 from public.job_posts j
    where j.location_id=job_salon_locations.id and j.status='approved'
      and (j.expires_at is null or j.expires_at>now())
  )
);

-- ---------------------------------------------------------------------------
-- 3. Offers: one ACTIVE offer per application
--
-- job_offers.application_id was UNIQUE, so after an employer withdrew (or the
-- candidate declined) an offer, sending a replacement failed with a raw
-- duplicate-key error. Uniqueness now applies to active offers only, and the
-- RPC reports a predictable error code instead of leaking the constraint name.
-- ---------------------------------------------------------------------------

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'job_offers'
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) like '%(application_id)%'
  loop
    execute format('alter table public.job_offers drop constraint %I', constraint_name);
  end loop;
end $$;

create unique index if not exists job_one_active_offer_per_application
  on public.job_offers(application_id)
  where status in ('sent', 'accepted');

create or replace function public.send_job_offer(
  target_application_id uuid,
  p_job_role text,
  p_salary numeric,
  p_employment_type text,
  p_joining_date date,
  p_offer_notes text default null,
  p_offer_document_path text default null,
  p_expires_at timestamptz default null
)
returns public.job_offers language plpgsql security definer set search_path = '' as $$
declare actor uuid:=public.job_assert_authenticated(); app public.job_applications; post public.job_posts; offer public.job_offers;
begin
  if not public.job_can_manage_application(target_application_id) then raise exception using errcode='42501',message='SALON_ACCESS_DENIED'; end if;
  select * into app from public.job_applications where id=target_application_id for update;
  select * into post from public.job_posts where id=app.job_id;
  if app.status<>'interview_completed' then raise exception using errcode='P0001',message='INVALID_APPLICATION_TRANSITION'; end if;
  if p_joining_date<current_date or (p_expires_at is not null and p_expires_at<=now()) then raise exception using errcode='22023',message='VALIDATION_ERROR'; end if;
  insert into public.job_offers(application_id,salon_id,candidate_user_id,created_by,job_role,salary,employment_type,joining_date,offer_notes,offer_document_path,expires_at)
  values(app.id,post.salon_id,app.candidate_user_id,actor,trim(p_job_role),p_salary,p_employment_type,p_joining_date,p_offer_notes,p_offer_document_path,p_expires_at)
  returning * into offer;
  perform set_config('app.job_transition_reason','Job offer sent',true);
  update public.job_applications set status='offer_sent' where id=app.id;
  insert into public.job_notifications(user_id,type,title,body,entity_type,entity_id)
  values(app.candidate_user_id,'offer_received','Job offer received','You received a job offer.','offer',offer.id);
  insert into public.job_audit_log(actor_user_id,action,entity_type,entity_id,salon_id)
  values(actor,'offer_sent','offer',offer.id,post.salon_id);
  return offer;
exception when unique_violation then
  raise exception using errcode='23505', message='OFFER_ALREADY_ACTIVE';
end $$;

revoke execute on function public.send_job_offer(uuid,text,numeric,text,date,text,text,timestamptz) from public,anon;
grant execute on function public.send_job_offer(uuid,text,numeric,text,date,text,text,timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Withdrawal: a live offer must be declined, not withdrawn
--
-- Withdrawing an application that has a pending offer hit the application
-- transition guard and surfaced INVALID_APPLICATION_TRANSITION. Candidates now
-- get a predictable error that points at the offer instead.
-- ---------------------------------------------------------------------------

create or replace function public.withdraw_application(target_application_id uuid, p_reason text default null)
returns public.job_applications language plpgsql security definer set search_path = '' as $$
declare actor uuid:=public.job_assert_authenticated(); app public.job_applications;
begin
  if exists (
    select 1 from public.job_applications a
    where a.id=target_application_id and a.candidate_user_id=actor and a.status='offer_sent'
  ) then
    raise exception using errcode='P0001', message='OFFER_PENDING';
  end if;
  perform set_config('app.job_transition_reason',coalesce(nullif(trim(p_reason),''),'Withdrawn by candidate'),true);
  update public.job_applications set status='withdrawn'
  where id=target_application_id and candidate_user_id=actor
    and status not in ('hired','rejected','withdrawn','position_closed','offer_accepted','offer_sent')
  returning * into app;
  if not found then raise exception using errcode='42501', message='INVALID_APPLICATION_TRANSITION'; end if;
  insert into public.job_notifications(user_id,type,title,body,entity_type,entity_id)
  select distinct m.user_id,'application_withdrawn','Application withdrawn',
         'A candidate withdrew an application.','application',app.id
  from public.job_posts j join public.job_salon_members m on m.salon_id=j.salon_id
  where j.id=app.job_id and m.status='active';
  return app;
end $$;

revoke execute on function public.withdraw_application(uuid,text) from public,anon;
grant execute on function public.withdraw_application(uuid,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Authoritative role assignment
--
-- job_register_role was defined twice with different semantics: the first
-- version (20260808170100) could switch the role of an inactive account, the
-- later one (20260808170800) never changes a role. Re-assert the strict version
-- here so the deployed state is identical no matter how the earlier files are
-- replayed, and so a role can never be escalated through the API.
-- ---------------------------------------------------------------------------

create or replace function public.job_register_role(requested_role text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.job_assert_authenticated();
  existing_role text;
begin
  if requested_role not in ('job_seeker', 'employer') then
    raise exception using errcode='22023',message='ROLE_NOT_ALLOWED';
  end if;

  select role into existing_role
  from public.job_user_roles
  where user_id=actor
  for update;

  if existing_role is not null then
    if existing_role <> requested_role then
      raise exception using
        errcode='42501',
        message='PORTAL_ROLE_MISMATCH:' || existing_role;
    end if;
    return existing_role;
  end if;

  insert into public.job_user_roles(user_id,role)
  values(actor,requested_role)
  on conflict(user_id) do nothing;

  select role into existing_role
  from public.job_user_roles
  where user_id=actor;

  if existing_role is distinct from requested_role then
    raise exception using
      errcode='42501',
      message='PORTAL_ROLE_MISMATCH:' || coalesce(existing_role,'unassigned');
  end if;

  return existing_role;
end;
$$;

revoke execute on function public.job_register_role(text) from public,anon;
grant execute on function public.job_register_role(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Helper execute rights
--
-- PostgreSQL grants EXECUTE on new functions to PUBLIC, so these two helpers
-- stayed callable by the anonymous role even though no anonymous policy uses
-- them. job_is_admin and job_is_active_salon_member intentionally stay callable
-- by anon because public read policies evaluate them.
-- ---------------------------------------------------------------------------

revoke execute on function public.job_current_role() from public, anon;
revoke execute on function public.job_can_manage_application(uuid) from public, anon;
grant execute on function public.job_current_role() to authenticated;
grant execute on function public.job_can_manage_application(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Signup trigger must not depend on trigger ordering
--
-- job_create_role_after_signup writes to job_user_roles, which references
-- public.profiles. When the shared Nexora profile trigger has not created the
-- profile row yet, the insert raised a foreign key violation and the whole
-- auth.users insert (the signup) failed. The role is still guaranteed: the app
-- calls job_register_role during signup/onboarding, and this trigger keeps
-- working whenever the profile already exists.
-- ---------------------------------------------------------------------------

create or replace function public.job_create_role_after_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text;
begin
  if coalesce(new.raw_user_meta_data ->> 'app_context', '') <> 'jobs' then
    return new;
  end if;

  requested_role := coalesce(new.raw_user_meta_data ->> 'job_role', new.raw_user_meta_data ->> 'role');
  if requested_role = 'seeker' then requested_role := 'job_seeker'; end if;
  if requested_role not in ('job_seeker', 'employer') then requested_role := 'job_seeker'; end if;

  begin
    insert into public.job_user_roles(user_id, role)
    values (new.id, requested_role)
    on conflict (user_id) do nothing;
  exception when foreign_key_violation then
    -- The shared profile row does not exist yet; job_register_role assigns the
    -- portal role as soon as the account is usable.
    null;
  end;

  return new;
end;
$$;

revoke execute on function public.job_create_role_after_signup() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Foreign-key indexes used by RLS policies and workspace queries
--
-- None of these columns had a supporting index. The first four are evaluated
-- inside row level security policies on every candidate/application read, so
-- they are the ones that actually matter for latency.
-- ---------------------------------------------------------------------------

create index if not exists job_applications_candidate_profile_idx
  on public.job_applications(candidate_profile_id);
create index if not exists job_interview_requests_application_idx
  on public.job_interview_requests(application_id);
create index if not exists job_saved_searches_user_idx
  on public.job_saved_searches(user_id, created_at desc);
create index if not exists job_support_messages_ticket_idx
  on public.job_support_messages(ticket_id, created_at);
create index if not exists job_portfolio_candidate_idx
  on public.job_portfolio_items(candidate_id, sort_order);
create index if not exists job_candidate_certifications_candidate_idx
  on public.job_candidate_certifications(candidate_id);
create index if not exists job_candidate_education_candidate_idx
  on public.job_candidate_education(candidate_id);
create index if not exists job_post_skills_skill_idx
  on public.job_post_skills(skill_id, job_id);
create index if not exists job_posts_location_idx
  on public.job_posts(location_id);
create index if not exists job_blocked_employers_salon_idx
  on public.job_blocked_employers(salon_id);
create index if not exists job_offers_salon_idx
  on public.job_offers(salon_id, status);
create index if not exists job_applications_resume_idx
  on public.job_applications(resume_id);
create index if not exists job_interview_history_interview_idx
  on public.job_interview_schedule_history(interview_id);
create index if not exists job_application_history_actor_idx
  on public.job_application_status_history(changed_by);

-- ---------------------------------------------------------------------------
-- 9. Messaging/read-path tuning
--
-- The workspace loads every visible conversation summary and notification; the
-- unread badge is the only filtered read, so index it directly.
-- ---------------------------------------------------------------------------

create index if not exists job_notifications_unread_idx
  on public.job_notifications(user_id, created_at desc) where is_read = false;
create index if not exists job_messages_sender_idx
  on public.job_messages(sender_user_id);

commit;

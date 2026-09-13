-- ===========================================================================
-- Nexora Jobs: schema & relational integrity hardening
--
-- Round 2 of the backend hardening audit: foreign keys / cascade behaviour and
-- strict vocabularies for status-like columns.
--
-- Findings this file acts on (the rest of the audit was already clean and is
-- asserted by `npm run test:db`):
--   1. `job_offers.employment_type` and `job_saved_searches.employment_type`
--      were the only employment-type columns without a constraint, so the UI
--      spelling 'full-time' was stored verbatim next to the canonical
--      'full_time' used everywhere else.
--   2. `job_application_status_history.from_status/to_status` accepted any
--      text, so the audit trail could contradict the state machine.
--   3. Event columns (`job_notifications.type/entity_type`,
--      `job_audit_log.action/entity_type`, `job_support_tickets.issue_type`,
--      `job_salon_profiles.business_type`) accepted empty/garbage values.
--   4. `job_posts` can only be hard-deleted by the service role, and doing so
--      surfaced a raw constraint name (`job_applications_job_id_fkey`) while
--      leaving notifications pointing at the removed job.
--
-- Idempotent: safe to re-run. Apply after the other jobs migrations.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Employment types: one vocabulary for posts, offers and saved searches
-- ---------------------------------------------------------------------------

create or replace function public.job_normalize_employment_type(p_value text)
returns text language sql immutable set search_path = '' as $$
  select case lower(btrim(coalesce(p_value, '')))
    when '' then null
    when 'full_time' then 'full_time'
    when 'full-time' then 'full_time'
    when 'full time' then 'full_time'
    when 'part_time' then 'part_time'
    when 'part-time' then 'part_time'
    when 'part time' then 'part_time'
    when 'internship' then 'internship'
    when 'intern' then 'internship'
    when 'freelance' then 'freelance'
    when 'commission' then 'freelance'
    when 'chair rental' then 'freelance'
    when 'contract' then 'contract'
    when 'contractual' then 'contract'
    else null
  end;
$$;

revoke execute on function public.job_normalize_employment_type(text) from public, anon, authenticated;

-- Normalize what existing rows can be normalized; anything unrecognisable is
-- cleared rather than guessed (both columns are optional metadata).
update public.job_offers
   set employment_type = public.job_normalize_employment_type(employment_type)
 where employment_type is not null
   and employment_type is distinct from public.job_normalize_employment_type(employment_type);

update public.job_saved_searches
   set employment_type = public.job_normalize_employment_type(employment_type)
 where employment_type is not null
   and employment_type is distinct from public.job_normalize_employment_type(employment_type);

alter table public.job_offers drop constraint if exists job_offers_employment_type_check;
alter table public.job_offers add constraint job_offers_employment_type_check
  check (employment_type is null or employment_type in ('full_time', 'part_time', 'internship', 'freelance', 'contract'));

alter table public.job_saved_searches drop constraint if exists job_saved_searches_employment_type_check;
alter table public.job_saved_searches add constraint job_saved_searches_employment_type_check
  check (employment_type is null or employment_type in ('full_time', 'part_time', 'internship', 'freelance', 'contract'));

-- `send_job_offer` now normalizes at the database boundary, so a caller cannot
-- store a second spelling, and an unusable value is refused with a stable code.
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
declare actor uuid:=public.job_assert_authenticated(); app public.job_applications; post public.job_posts; offer public.job_offers; v_type text;
begin
  if not public.job_can_manage_application(target_application_id) then raise exception using errcode='42501',message='SALON_ACCESS_DENIED'; end if;
  v_type := public.job_normalize_employment_type(p_employment_type);
  if nullif(btrim(coalesce(p_employment_type, '')), '') is not null and v_type is null then
    raise exception using errcode='22023', message='INVALID_EMPLOYMENT_TYPE';
  end if;
  select * into app from public.job_applications where id=target_application_id for update;
  select * into post from public.job_posts where id=app.job_id;
  if app.status<>'interview_completed' then raise exception using errcode='P0001',message='INVALID_APPLICATION_TRANSITION'; end if;
  if p_joining_date<current_date or (p_expires_at is not null and p_expires_at<=now()) then raise exception using errcode='22023',message='VALIDATION_ERROR'; end if;
  insert into public.job_offers(application_id,salon_id,candidate_user_id,created_by,job_role,salary,employment_type,joining_date,offer_notes,offer_document_path,expires_at)
  values(app.id,post.salon_id,app.candidate_user_id,actor,trim(p_job_role),p_salary,v_type,p_joining_date,p_offer_notes,p_offer_document_path,p_expires_at)
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
-- 2. The application history table must speak the same vocabulary as the
--    state machine it records
-- ---------------------------------------------------------------------------

alter table public.job_application_status_history
  drop constraint if exists job_application_status_history_statuses_check;
alter table public.job_application_status_history
  add constraint job_application_status_history_statuses_check
  check (
    (from_status is null or from_status in (
      'submitted','viewed','shortlisted','interview_requested','interview_confirmed',
      'interview_completed','offer_sent','offer_accepted','hired','rejected','withdrawn','position_closed'))
    and to_status in (
      'submitted','viewed','shortlisted','interview_requested','interview_confirmed',
      'interview_completed','offer_sent','offer_accepted','hired','rejected','withdrawn','position_closed')
  );

alter table public.job_application_status_history
  drop constraint if exists job_application_status_history_changed_check;
alter table public.job_application_status_history
  add constraint job_application_status_history_changed_check
  check (from_status is distinct from to_status);

-- ---------------------------------------------------------------------------
-- 3. Event columns: no blank values, machine-readable names, pair integrity
-- ---------------------------------------------------------------------------

alter table public.job_notifications drop constraint if exists job_notifications_type_check;
alter table public.job_notifications add constraint job_notifications_type_check
  check (type ~ '^[a-z][a-z0-9_]{2,63}$');

alter table public.job_notifications drop constraint if exists job_notifications_entity_check;
alter table public.job_notifications add constraint job_notifications_entity_check
  check (
    (entity_type is null or entity_type ~ '^[a-z][a-z0-9_]{2,31}$')
    and (entity_id is null or entity_type is not null)
  );

alter table public.job_audit_log drop constraint if exists job_audit_log_action_check;
alter table public.job_audit_log add constraint job_audit_log_action_check
  check (action ~ '^[a-z][a-z0-9_]{2,63}$');

alter table public.job_audit_log drop constraint if exists job_audit_log_entity_check;
alter table public.job_audit_log add constraint job_audit_log_entity_check
  check (entity_type ~ '^[a-z][a-z0-9_]{2,31}$' and entity_id is not null);

alter table public.job_support_tickets drop constraint if exists job_support_tickets_issue_type_check;
alter table public.job_support_tickets add constraint job_support_tickets_issue_type_check
  check (char_length(btrim(issue_type)) between 2 and 64);

alter table public.job_salon_profiles drop constraint if exists job_salon_profiles_business_type_check;
alter table public.job_salon_profiles add constraint job_salon_profiles_business_type_check
  check (business_type is null or char_length(btrim(business_type)) between 2 and 80);

-- ---------------------------------------------------------------------------
-- 4. Deleting a job posting
--
--    Bookmarks, post skills and conversations already cascade. Applications
--    must not: they are the candidate's history and the employer's hiring
--    record. The foreign key therefore stays RESTRICT, and a guard trigger
--    turns what used to be a raw `job_applications_job_id_fkey` error into the
--    stable code JOB_HAS_APPLICATIONS. Closing the role (close_job) is the
--    intended way to retire a posting that has applicants.
-- ---------------------------------------------------------------------------

create or replace function public.job_guard_post_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.job_applications where job_id = old.id) then
    raise exception using errcode='P0001', message='JOB_HAS_APPLICATIONS',
      hint = 'Close the posting with close_job() instead of deleting it.';
  end if;
  return old;
end $$;

create or replace function public.job_cleanup_post_relations()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Notifications point at a job that no longer exists; the audit log is
  -- append-only by design and keeps its historical reference on purpose.
  delete from public.job_notifications where entity_type = 'job' and entity_id = old.id;
  return old;
end $$;

revoke execute on function public.job_guard_post_delete() from public, anon, authenticated;
revoke execute on function public.job_cleanup_post_relations() from public, anon, authenticated;

drop trigger if exists job_posts_guard_delete on public.job_posts;
create trigger job_posts_guard_delete
before delete on public.job_posts
for each row execute function public.job_guard_post_delete();

drop trigger if exists job_posts_cleanup_relations on public.job_posts;
create trigger job_posts_cleanup_relations
after delete on public.job_posts
for each row execute function public.job_cleanup_post_relations();

-- ---------------------------------------------------------------------------
-- 5. Indexed cascades: PostgreSQL never indexes a foreign key for you, so every
--    parent delete (and every SET NULL) scans these columns. The audit found
--    fifteen that had no leading index.
-- ---------------------------------------------------------------------------

create index if not exists job_saved_jobs_job_idx                     on public.job_saved_jobs(job_id);
create index if not exists job_saved_searches_skill_idx               on public.job_saved_searches(skill_id);
create index if not exists job_posts_created_by_idx                   on public.job_posts(created_by);
create index if not exists job_posts_reviewed_by_idx                  on public.job_posts(reviewed_by);
create index if not exists job_audit_log_salon_created_idx            on public.job_audit_log(salon_id, created_at desc);
create index if not exists job_employer_verifications_submitted_idx   on public.job_employer_verifications(submitted_by);
create index if not exists job_employer_verifications_reviewed_idx    on public.job_employer_verifications(reviewed_by);
create index if not exists job_interview_requests_created_by_idx      on public.job_interview_requests(created_by);
create index if not exists job_interview_history_changed_by_idx       on public.job_interview_schedule_history(changed_by);
create index if not exists job_offers_created_by_idx                  on public.job_offers(created_by);
create index if not exists job_salon_profiles_owner_idx               on public.job_salon_profiles(owner_user_id);
create index if not exists job_reports_reporter_idx                   on public.job_reports(reporter_user_id);
create index if not exists job_reports_resolved_idx                   on public.job_reports(resolved_by);
create index if not exists job_support_tickets_assigned_idx           on public.job_support_tickets(assigned_to);
create index if not exists job_support_messages_sender_idx            on public.job_support_messages(sender_user_id);

-- ---------------------------------------------------------------------------
-- 6. Documented state machine and cascade policy
-- ---------------------------------------------------------------------------

comment on function public.job_validate_application_transition() is
  'Application state machine. submitted -> viewed -> shortlisted -> interview_requested '
  '<-> interview_confirmed -> interview_completed -> offer_sent -> offer_accepted -> hired. '
  'rejected/withdrawn/position_closed are reachable from every open state; hired, rejected, '
  'withdrawn and position_closed are terminal. interview_confirmed may fall back to shortlisted, '
  'and offer_sent may fall back to interview_completed when an offer is withdrawn.';

comment on column public.job_applications.status is
  'Lifecycle state, enforced by job_validate_application_transition() plus a CHECK constraint.';

comment on column public.job_posts.status is
  'draft -> pending_approval -> approved -> paused/closed/expired/archived. There is no '
  '''published'' state: approval replaced it, and only approved jobs are publicly listable.';

commit;

-- Nexora Jobs: Row Level Security, safe views, grants, Storage and Realtime

begin;

-- ---------------------------------------------------------------------------
-- Enable RLS on every Jobs table
-- ---------------------------------------------------------------------------

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'job_user_roles','job_seeker_profiles','job_skills','job_candidate_skills',
    'job_candidate_experience','job_candidate_education','job_candidate_certifications',
    'job_candidate_resumes','job_candidate_preferences','job_candidate_preferred_roles',
    'job_candidate_employment_types','job_employer_profiles','job_salon_members',
    'job_salon_profiles','job_salon_locations','job_employer_verifications',
    'job_posts','job_post_skills','job_saved_jobs','job_applications',
    'job_application_status_history','job_interview_requests',
    'job_interview_schedule_history','job_offers','job_notifications',
    'job_saved_searches','job_conversations','job_messages','job_portfolio_items',
    'job_support_tickets','job_support_messages','job_reports',
    'job_blocked_employers','job_audit_log','job_account_deletion_requests'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

-- Remove policies from a previous idempotent application of this migration.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname='public' and tablename like 'job\_%' escape '\'
  loop
    execute format('drop policy if exists %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Roles and candidate data
-- ---------------------------------------------------------------------------

create policy job_roles_select_own
on public.job_user_roles for select to authenticated
using (user_id=(select auth.uid()) or public.job_is_admin());

create policy job_candidate_profile_select_own_or_related
on public.job_seeker_profiles for select to authenticated
using (
  user_id=(select auth.uid()) or public.job_is_admin() or exists (
    select 1 from public.job_applications a
    join public.job_posts j on j.id=a.job_id
    where a.candidate_profile_id=job_seeker_profiles.id
      and public.job_is_active_salon_member(j.salon_id)
  )
);
create policy job_candidate_profile_insert_own
on public.job_seeker_profiles for insert to authenticated
with check (user_id=(select auth.uid()) and public.job_current_role()='job_seeker');
create policy job_candidate_profile_update_own
on public.job_seeker_profiles for update to authenticated
using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create policy job_skills_read
on public.job_skills for select to anon,authenticated using (is_active or public.job_is_admin());

create policy job_candidate_skills_read
on public.job_candidate_skills for select to authenticated
using (exists (
  select 1 from public.job_seeker_profiles c
  where c.id=candidate_id and (
    c.user_id=(select auth.uid()) or public.job_is_admin() or exists (
      select 1 from public.job_applications a join public.job_posts j on j.id=a.job_id
      where a.candidate_profile_id=c.id and public.job_is_active_salon_member(j.salon_id)
    )
  )
));
create policy job_candidate_skills_write
on public.job_candidate_skills for all to authenticated
using (exists(select 1 from public.job_seeker_profiles c where c.id=candidate_id and c.user_id=(select auth.uid())))
with check (exists(select 1 from public.job_seeker_profiles c where c.id=candidate_id and c.user_id=(select auth.uid())));

create policy job_candidate_experience_read
on public.job_candidate_experience for select to authenticated
using (exists (
  select 1 from public.job_seeker_profiles c where c.id=candidate_id and (
    c.user_id=(select auth.uid()) or public.job_is_admin() or exists(
      select 1 from public.job_applications a join public.job_posts j on j.id=a.job_id
      where a.candidate_profile_id=c.id and public.job_is_active_salon_member(j.salon_id)
    )
  )
));
create policy job_candidate_experience_write
on public.job_candidate_experience for all to authenticated
using (exists(select 1 from public.job_seeker_profiles c where c.id=candidate_id and c.user_id=(select auth.uid())))
with check (exists(select 1 from public.job_seeker_profiles c where c.id=candidate_id and c.user_id=(select auth.uid())));

create policy job_candidate_education_read
on public.job_candidate_education for select to authenticated
using (exists (
  select 1 from public.job_seeker_profiles c where c.id=candidate_id and (
    c.user_id=(select auth.uid()) or public.job_is_admin() or exists(
      select 1 from public.job_applications a join public.job_posts j on j.id=a.job_id
      where a.candidate_profile_id=c.id and public.job_is_active_salon_member(j.salon_id)
    )
  )
));
create policy job_candidate_education_write
on public.job_candidate_education for all to authenticated
using (exists(select 1 from public.job_seeker_profiles c where c.id=candidate_id and c.user_id=(select auth.uid())))
with check (exists(select 1 from public.job_seeker_profiles c where c.id=candidate_id and c.user_id=(select auth.uid())));

create policy job_candidate_certifications_read
on public.job_candidate_certifications for select to authenticated
using (exists (
  select 1 from public.job_seeker_profiles c where c.id=candidate_id and (
    c.user_id=(select auth.uid()) or public.job_is_admin() or exists(
      select 1 from public.job_applications a join public.job_posts j on j.id=a.job_id
      where a.candidate_profile_id=c.id and public.job_is_active_salon_member(j.salon_id)
    )
  )
));
create policy job_candidate_certifications_write
on public.job_candidate_certifications for all to authenticated
using (exists(select 1 from public.job_seeker_profiles c where c.id=candidate_id and c.user_id=(select auth.uid())))
with check (exists(select 1 from public.job_seeker_profiles c where c.id=candidate_id and c.user_id=(select auth.uid())));

create policy job_candidate_resumes_read
on public.job_candidate_resumes for select to authenticated
using (exists (
  select 1 from public.job_seeker_profiles c where c.id=candidate_id and (
    c.user_id=(select auth.uid()) or public.job_is_admin() or exists(
      select 1 from public.job_applications a join public.job_posts j on j.id=a.job_id
      where a.resume_id=job_candidate_resumes.id and public.job_is_active_salon_member(j.salon_id)
    )
  )
));
create policy job_candidate_resumes_write
on public.job_candidate_resumes for all to authenticated
using (exists(select 1 from public.job_seeker_profiles c where c.id=candidate_id and c.user_id=(select auth.uid())))
with check (exists(select 1 from public.job_seeker_profiles c where c.id=candidate_id and c.user_id=(select auth.uid())));

create policy job_candidate_preferences_own
on public.job_candidate_preferences for all to authenticated
using (exists(select 1 from public.job_seeker_profiles c where c.id=candidate_id and c.user_id=(select auth.uid())))
with check (exists(select 1 from public.job_seeker_profiles c where c.id=candidate_id and c.user_id=(select auth.uid())));
create policy job_candidate_roles_own
on public.job_candidate_preferred_roles for all to authenticated
using (exists(select 1 from public.job_seeker_profiles c where c.id=candidate_id and c.user_id=(select auth.uid())))
with check (exists(select 1 from public.job_seeker_profiles c where c.id=candidate_id and c.user_id=(select auth.uid())));
create policy job_candidate_employment_own
on public.job_candidate_employment_types for all to authenticated
using (exists(select 1 from public.job_seeker_profiles c where c.id=candidate_id and c.user_id=(select auth.uid())))
with check (exists(select 1 from public.job_seeker_profiles c where c.id=candidate_id and c.user_id=(select auth.uid())));

-- ---------------------------------------------------------------------------
-- Employer, salon and job data
-- ---------------------------------------------------------------------------

create policy job_employer_profiles_read
on public.job_employer_profiles for select to authenticated
using (user_id=(select auth.uid()) or public.job_is_admin() or public.job_current_role()='job_seeker');
create policy job_employer_profiles_update_own
on public.job_employer_profiles for update to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create policy job_salon_members_read
on public.job_salon_members for select to authenticated
using (
  user_id=(select auth.uid()) or public.job_is_admin()
  or public.job_is_active_salon_member(salon_id)
);

create policy job_salon_profiles_public_read
on public.job_salon_profiles for select to anon,authenticated
using (jobs_enabled or public.job_is_active_salon_member(salon_id) or public.job_is_admin());
create policy job_salon_profiles_member_update
on public.job_salon_profiles for update to authenticated
using(public.job_is_active_salon_member(salon_id))
with check(public.job_is_active_salon_member(salon_id));

create policy job_salon_locations_read
on public.job_salon_locations for select to anon,authenticated
using (
  public.job_is_active_salon_member(salon_id) or public.job_is_admin() or exists(
    select 1 from public.job_posts j
    where j.location_id=job_salon_locations.id and j.status='published'
      and (j.expires_at is null or j.expires_at>now())
  )
);
create policy job_salon_locations_member_write
on public.job_salon_locations for all to authenticated
using(public.job_is_active_salon_member(salon_id))
with check(public.job_is_active_salon_member(salon_id));

create policy job_verifications_read
on public.job_employer_verifications for select to authenticated
using(submitted_by=(select auth.uid()) or public.job_is_active_salon_member(salon_id) or public.job_is_admin());

create policy job_posts_read
on public.job_posts for select to anon,authenticated
using (
  public.job_is_admin() or public.job_is_active_salon_member(salon_id) or (
    status='published' and (expires_at is null or expires_at>now()) and exists(
      select 1 from public.salons s join public.job_salon_profiles sp on sp.salon_id=s.id
      where s.id=job_posts.salon_id and s.is_active=true and s.deleted_at is null and sp.jobs_enabled=true
    )
  )
);
create policy job_posts_member_update
on public.job_posts for update to authenticated
using(public.job_is_active_salon_member(salon_id))
with check(public.job_is_active_salon_member(salon_id) and created_by is not null);
create policy job_posts_member_delete_draft
on public.job_posts for delete to authenticated
using(public.job_is_active_salon_member(salon_id) and status in ('draft','archived'));

create policy job_post_skills_read
on public.job_post_skills for select to anon,authenticated
using(exists(select 1 from public.job_posts j where j.id=job_id));
create policy job_post_skills_member_write
on public.job_post_skills for all to authenticated
using(exists(select 1 from public.job_posts j where j.id=job_id and public.job_is_active_salon_member(j.salon_id)))
with check(exists(select 1 from public.job_posts j where j.id=job_id and public.job_is_active_salon_member(j.salon_id)));

create policy job_saved_jobs_own
on public.job_saved_jobs for all to authenticated
using(user_id=(select auth.uid()))
with check(user_id=(select auth.uid()) and public.job_current_role()='job_seeker');

-- ---------------------------------------------------------------------------
-- Applications, interviews, offers and notifications
-- ---------------------------------------------------------------------------

create policy job_applications_read_related
on public.job_applications for select to authenticated
using(candidate_user_id=(select auth.uid()) or public.job_can_manage_application(id) or public.job_is_admin());

create policy job_application_history_read_related
on public.job_application_status_history for select to authenticated
using(exists(
  select 1 from public.job_applications a
  where a.id=application_id and (
    a.candidate_user_id=(select auth.uid()) or public.job_can_manage_application(a.id) or public.job_is_admin()
  )
));

create policy job_interviews_read_related
on public.job_interview_requests for select to authenticated
using(candidate_user_id=(select auth.uid()) or public.job_is_active_salon_member(salon_id) or public.job_is_admin());

create policy job_interview_history_read_related
on public.job_interview_schedule_history for select to authenticated
using(exists(
  select 1 from public.job_interview_requests i
  where i.id=interview_id and (
    i.candidate_user_id=(select auth.uid()) or public.job_is_active_salon_member(i.salon_id) or public.job_is_admin()
  )
));

create policy job_offers_read_related
on public.job_offers for select to authenticated
using(candidate_user_id=(select auth.uid()) or public.job_is_active_salon_member(salon_id) or public.job_is_admin());

create policy job_notifications_read_own
on public.job_notifications for select to authenticated
using(user_id=(select auth.uid()) or public.job_is_admin());
create policy job_notifications_update_own
on public.job_notifications for update to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy job_notifications_delete_own
on public.job_notifications for delete to authenticated
using(user_id=(select auth.uid()));

create policy job_saved_searches_own
on public.job_saved_searches for all to authenticated
using(user_id=(select auth.uid()))
with check(user_id=(select auth.uid()) and public.job_current_role()='job_seeker');

-- ---------------------------------------------------------------------------
-- Messaging and portfolio
-- ---------------------------------------------------------------------------

create policy job_conversations_read_participant
on public.job_conversations for select to authenticated
using((select auth.uid()) in (candidate_user_id,employer_user_id) or public.job_is_admin());
create policy job_conversations_insert_participant
on public.job_conversations for insert to authenticated
with check (
  (candidate_user_id=(select auth.uid()) and exists(
    select 1 from public.job_posts j
    where j.id=job_id and exists(
      select 1 from public.job_salon_members m
      where m.salon_id=j.salon_id and m.user_id=employer_user_id and m.status='active'
    )
  )) or
  (employer_user_id=(select auth.uid()) and exists(
    select 1 from public.job_applications a join public.job_posts j on j.id=a.job_id
    where a.job_id=job_id and a.candidate_user_id=candidate_user_id
      and public.job_is_active_salon_member(j.salon_id)
  ))
);
create policy job_conversations_update_participant
on public.job_conversations for update to authenticated
using((select auth.uid()) in (candidate_user_id,employer_user_id))
with check((select auth.uid()) in (candidate_user_id,employer_user_id));

create policy job_messages_read_participant
on public.job_messages for select to authenticated
using(exists(
  select 1 from public.job_conversations c
  where c.id=conversation_id and (select auth.uid()) in (c.candidate_user_id,c.employer_user_id)
));
create policy job_messages_insert_participant
on public.job_messages for insert to authenticated
with check(sender_user_id=(select auth.uid()) and exists(
  select 1 from public.job_conversations c
  where c.id=conversation_id and (select auth.uid()) in (c.candidate_user_id,c.employer_user_id)
));
create policy job_messages_mark_read
on public.job_messages for update to authenticated
using(exists(
  select 1 from public.job_conversations c
  where c.id=conversation_id and (select auth.uid()) in (c.candidate_user_id,c.employer_user_id)
));

create policy job_portfolio_read_related
on public.job_portfolio_items for select to authenticated
using(exists(
  select 1 from public.job_seeker_profiles c
  where c.id=candidate_id and (
    c.user_id=(select auth.uid()) or public.job_is_admin() or exists(
      select 1 from public.job_applications a join public.job_posts j on j.id=a.job_id
      where a.candidate_profile_id=c.id and public.job_is_active_salon_member(j.salon_id)
    )
  )
));
create policy job_portfolio_write_own
on public.job_portfolio_items for all to authenticated
using(exists(select 1 from public.job_seeker_profiles c where c.id=candidate_id and c.user_id=(select auth.uid())))
with check(exists(select 1 from public.job_seeker_profiles c where c.id=candidate_id and c.user_id=(select auth.uid())));

-- ---------------------------------------------------------------------------
-- Support, safety and audit
-- ---------------------------------------------------------------------------

create policy job_support_tickets_read
on public.job_support_tickets for select to authenticated
using(user_id=(select auth.uid()) or public.job_is_admin());
create policy job_support_messages_read
on public.job_support_messages for select to authenticated
using(public.job_is_admin() or exists(
  select 1 from public.job_support_tickets t where t.id=ticket_id and t.user_id=(select auth.uid())
));
create policy job_support_messages_insert
on public.job_support_messages for insert to authenticated
with check(sender_user_id=(select auth.uid()) and exists(
  select 1 from public.job_support_tickets t where t.id=ticket_id and t.user_id=(select auth.uid())
));

create policy job_reports_read_own_or_admin
on public.job_reports for select to authenticated
using(reporter_user_id=(select auth.uid()) or public.job_is_admin());
create policy job_reports_insert_own
on public.job_reports for insert to authenticated
with check(reporter_user_id=(select auth.uid()));

create policy job_blocks_own
on public.job_blocked_employers for all to authenticated
using(candidate_user_id=(select auth.uid())) with check(candidate_user_id=(select auth.uid()));

create policy job_audit_admin_read
on public.job_audit_log for select to authenticated using(public.job_is_admin());

create policy job_deletion_requests_read_own
on public.job_account_deletion_requests for select to authenticated
using(user_id=(select auth.uid()) or public.job_is_admin());

-- ---------------------------------------------------------------------------
-- Safe projections
-- ---------------------------------------------------------------------------

create or replace view public.public_job_listings
with (security_barrier=true, security_invoker=false)
as
select
  j.id,j.title,j.category,j.description,j.responsibilities,j.employment_type,
  j.workplace_type,j.experience_min_months,j.experience_max_months,
  j.freshers_allowed,j.salary_min,j.salary_max,j.pay_type,j.incentives,
  j.tips_info,j.benefits,j.working_days,j.working_hours,j.weekly_off,
  j.joining_date,j.openings,j.image_path,j.tags,j.published_at,j.expires_at,
  s.id as salon_id,s.name as salon_name,s.slug as salon_slug,s.logo_path,
  s.verified as salon_verified,s.rating_average,s.review_count,
  coalesce(l.city,s.city) as city,coalesce(l.state,s.state) as state,
  l.id as location_id,l.label as location_label
from public.job_posts j
join public.salons s on s.id=j.salon_id
join public.job_salon_profiles sp on sp.salon_id=s.id
left join public.job_salon_locations l on l.id=j.location_id
where j.status='published'
  and (j.expires_at is null or j.expires_at>now())
  and s.is_active=true and s.deleted_at is null and sp.jobs_enabled=true;

create or replace view public.public_job_salon_profiles
with (security_barrier=true, security_invoker=false)
as
select
  s.id,s.name,s.slug,s.description,s.business_category,s.city,s.state,
  s.logo_path,s.cover_image_path,s.verified,s.rating_average,s.review_count,
  sp.website_url,sp.instagram_url,sp.business_type,sp.verification_status
from public.salons s
join public.job_salon_profiles sp on sp.salon_id=s.id
where s.is_active=true and s.deleted_at is null and sp.jobs_enabled=true;

create or replace view public.job_employer_candidate_cards
with (security_barrier=true, security_invoker=false)
as
select
  c.id as candidate_id,c.user_id,p.full_name,p.avatar_path,c.headline,c.bio,
  c.city,c.state,c.experience_level,c.total_experience_months,
  c.expected_salary_min,c.expected_salary_max,c.available_from,c.open_to_relocation,
  coalesce(array_agg(distinct sk.name) filter (where sk.id is not null),'{}') as skills
from public.job_seeker_profiles c
join public.profiles p on p.id=c.user_id
left join public.job_candidate_skills cs on cs.candidate_id=c.id
left join public.job_skills sk on sk.id=cs.skill_id
where c.profile_visibility='employers'
  and p.is_active=true
  and (
    public.job_is_admin() or exists(
      select 1 from public.job_salon_members m
      where m.user_id=(select auth.uid()) and m.status='active'
    )
  )
group by c.id,p.id,p.full_name,p.avatar_path;

revoke all on public.public_job_listings from public;
revoke all on public.public_job_salon_profiles from public;
revoke all on public.job_employer_candidate_cards from public;
grant select on public.public_job_listings to anon,authenticated;
grant select on public.public_job_salon_profiles to anon,authenticated;
grant select on public.job_employer_candidate_cards to authenticated;

-- ---------------------------------------------------------------------------
-- Table grants: sensitive workflow writes are RPC-only
-- ---------------------------------------------------------------------------

grant select on
  public.job_user_roles,public.job_seeker_profiles,public.job_skills,
  public.job_candidate_skills,public.job_candidate_experience,
  public.job_candidate_education,public.job_candidate_certifications,
  public.job_candidate_resumes,public.job_candidate_preferences,
  public.job_candidate_preferred_roles,public.job_candidate_employment_types,
  public.job_employer_profiles,public.job_salon_members,public.job_salon_profiles,
  public.job_salon_locations,public.job_employer_verifications,public.job_posts,
  public.job_post_skills,public.job_saved_jobs,public.job_applications,
  public.job_application_status_history,public.job_interview_requests,
  public.job_interview_schedule_history,public.job_offers,public.job_notifications,
  public.job_saved_searches,public.job_conversations,public.job_messages,
  public.job_portfolio_items,public.job_support_tickets,public.job_support_messages,
  public.job_reports,public.job_blocked_employers,public.job_audit_log,
  public.job_account_deletion_requests
  to authenticated;
grant select on public.job_skills,public.job_salon_profiles,
  public.job_salon_locations,public.job_posts,public.job_post_skills to anon;

revoke insert,update,delete on public.job_user_roles from anon,authenticated;
revoke insert,update,delete on public.job_employer_verifications from anon,authenticated;
revoke insert,update,delete on public.job_applications from anon,authenticated;
revoke insert,update,delete on public.job_application_status_history from anon,authenticated;
revoke insert,update,delete on public.job_interview_requests from anon,authenticated;
revoke insert,update,delete on public.job_interview_schedule_history from anon,authenticated;
revoke insert,update,delete on public.job_offers from anon,authenticated;
revoke insert on public.job_notifications from anon,authenticated;
revoke insert,update,delete on public.job_audit_log from anon,authenticated;
revoke update,delete on public.job_reports from anon,authenticated;
revoke insert,update,delete on public.job_account_deletion_requests from anon,authenticated;
revoke insert,update,delete on public.job_support_tickets from anon,authenticated;

grant insert,update,delete on public.job_seeker_profiles,public.job_candidate_skills,
  public.job_candidate_experience,public.job_candidate_education,
  public.job_candidate_certifications,public.job_candidate_resumes,
  public.job_candidate_preferences,public.job_candidate_preferred_roles,
  public.job_candidate_employment_types,public.job_employer_profiles,
  public.job_salon_profiles,public.job_salon_locations,public.job_posts,
  public.job_post_skills,public.job_saved_jobs,public.job_saved_searches,
  public.job_conversations,public.job_messages,public.job_portfolio_items,
  public.job_support_messages,public.job_reports,public.job_blocked_employers
  to authenticated;

grant update(is_read,read_at) on public.job_notifications to authenticated;
grant delete on public.job_notifications to authenticated;

-- ---------------------------------------------------------------------------
-- Function grants
-- ---------------------------------------------------------------------------

revoke execute on function public.job_assert_authenticated() from public,anon,authenticated;
revoke execute on function public.job_create_role_after_signup() from public,anon,authenticated;
revoke execute on function public.job_set_updated_at() from public,anon,authenticated;
revoke execute on function public.job_guard_role_fields() from public,anon,authenticated;
revoke execute on function public.job_guard_post_status() from public,anon,authenticated;
revoke execute on function public.job_validate_application_transition() from public,anon,authenticated;
revoke execute on function public.job_record_application_history() from public,anon,authenticated;
revoke execute on function public.job_sync_message_conversation() from public,anon,authenticated;
revoke execute on function public.job_create_match_notifications(uuid) from public,anon,authenticated;

grant execute on function public.job_current_role() to authenticated;
grant execute on function public.job_is_admin() to anon,authenticated;
grant execute on function public.job_is_active_salon_member(uuid) to anon,authenticated;
grant execute on function public.job_can_manage_application(uuid) to authenticated;

grant execute on function public.job_register_role(text) to authenticated;
grant execute on function public.complete_job_seeker_onboarding(text,text,text,text,text,integer,numeric,numeric,date,boolean,text[],text[]) to authenticated;
grant execute on function public.complete_job_employer_onboarding(text,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.create_job_post(uuid,uuid,text,text,text,text,text,integer,integer,boolean,numeric,numeric,text,text,text,text,integer,text[],text) to authenticated;
grant execute on function public.publish_job(uuid) to authenticated;
grant execute on function public.pause_job(uuid) to authenticated;
grant execute on function public.resume_job(uuid) to authenticated;
grant execute on function public.close_job(uuid) to authenticated;
grant execute on function public.submit_job_application(uuid,uuid,text,numeric,date) to authenticated;
grant execute on function public.mark_application_viewed(uuid) to authenticated;
grant execute on function public.shortlist_application(uuid) to authenticated;
grant execute on function public.reject_application(uuid,text) to authenticated;
grant execute on function public.withdraw_application(uuid,text) to authenticated;
grant execute on function public.create_interview_request(uuid,text,timestamptz,integer,text,text,text) to authenticated;
grant execute on function public.accept_interview(uuid) to authenticated;
grant execute on function public.request_interview_reschedule(uuid,text) to authenticated;
grant execute on function public.reschedule_interview(uuid,timestamptz,text) to authenticated;
grant execute on function public.decline_interview(uuid,text) to authenticated;
grant execute on function public.complete_interview(uuid) to authenticated;
grant execute on function public.send_job_offer(uuid,text,numeric,text,date,text,text,timestamptz) to authenticated;
grant execute on function public.accept_job_offer(uuid) to authenticated;
grant execute on function public.decline_job_offer(uuid) to authenticated;
grant execute on function public.withdraw_job_offer(uuid,text) to authenticated;
grant execute on function public.mark_candidate_hired(uuid) to authenticated;
grant execute on function public.submit_employer_verification(uuid,text,text,text) to authenticated;
grant execute on function public.review_employer_verification(uuid,text,text) to authenticated;
grant execute on function public.create_job_support_ticket(text,text,text,text) to authenticated;
grant execute on function public.report_job(uuid,text,text) to authenticated;
grant execute on function public.report_employer(uuid,text,text) to authenticated;
grant execute on function public.request_job_account_deletion(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage buckets and access policies
-- ---------------------------------------------------------------------------

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
 ('job-resumes','job-resumes',false,10485760,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
 ('job-certificates','job-certificates',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp']),
 ('employer-verification','employer-verification',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp']),
 ('job-offers','job-offers',false,10485760,array['application/pdf']),
 ('job-support-attachments','job-support-attachments',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp']),
 ('job-profile-media','job-profile-media',false,10485760,array['image/jpeg','image/png','image/webp']),
 ('salon-public-media','salon-public-media',true,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set
  public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

do $$
declare policy_name text;
begin
  foreach policy_name in array array[
    'job_public_media_read','job_owner_private_upload','job_owner_private_read',
    'job_owner_private_update','job_owner_private_delete','job_resume_employer_read',
    'job_verification_member_access','job_offer_related_access','job_public_media_member_write'
  ] loop
    execute format('drop policy if exists %I on storage.objects',policy_name);
  end loop;
end $$;

create policy job_public_media_read
on storage.objects for select to anon,authenticated
using(bucket_id='salon-public-media');

create policy job_owner_private_upload
on storage.objects for insert to authenticated
with check(
  bucket_id in ('job-resumes','job-certificates','job-support-attachments','job-profile-media')
  and (storage.foldername(name))[1]=(select auth.uid())::text
);
create policy job_owner_private_read
on storage.objects for select to authenticated
using(
  bucket_id in ('job-resumes','job-certificates','job-support-attachments','job-profile-media')
  and (storage.foldername(name))[1]=(select auth.uid())::text
);
create policy job_owner_private_update
on storage.objects for update to authenticated
using(
  bucket_id in ('job-resumes','job-certificates','job-support-attachments','job-profile-media')
  and (storage.foldername(name))[1]=(select auth.uid())::text
)
with check((storage.foldername(name))[1]=(select auth.uid())::text);
create policy job_owner_private_delete
on storage.objects for delete to authenticated
using(
  bucket_id in ('job-resumes','job-certificates','job-support-attachments','job-profile-media')
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

create policy job_resume_employer_read
on storage.objects for select to authenticated
using(
  bucket_id in ('job-resumes','job-certificates') and exists(
    select 1
    from public.job_candidate_resumes r
    join public.job_applications a on a.resume_id=r.id
    join public.job_posts j on j.id=a.job_id
    where r.storage_path=name and public.job_is_active_salon_member(j.salon_id)
  )
);

create policy job_verification_member_access
on storage.objects for all to authenticated
using(
  bucket_id='employer-verification'
  and public.job_is_active_salon_member(
    case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then ((storage.foldername(name))[1])::uuid end
  )
)
with check(
  bucket_id='employer-verification'
  and public.job_is_active_salon_member(
    case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then ((storage.foldername(name))[1])::uuid end
  )
);

create policy job_offer_related_access
on storage.objects for all to authenticated
using(
  bucket_id='job-offers' and exists(
    select 1 from public.job_applications a
    join public.job_posts j on j.id=a.job_id
    where a.id=case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then ((storage.foldername(name))[1])::uuid end
      and (a.candidate_user_id=(select auth.uid()) or public.job_is_active_salon_member(j.salon_id))
  )
)
with check(
  bucket_id='job-offers' and exists(
    select 1 from public.job_applications a
    join public.job_posts j on j.id=a.job_id
    where a.id=case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then ((storage.foldername(name))[1])::uuid end
      and public.job_is_active_salon_member(j.salon_id)
  )
);

create policy job_public_media_member_write
on storage.objects for all to authenticated
using(
  bucket_id='salon-public-media'
  and public.job_is_active_salon_member(
    case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then ((storage.foldername(name))[1])::uuid end
  )
)
with check(
  bucket_id='salon-public-media'
  and public.job_is_active_salon_member(
    case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then ((storage.foldername(name))[1])::uuid end
  )
);

-- ---------------------------------------------------------------------------
-- Realtime only for records protected by RLS
-- ---------------------------------------------------------------------------

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'job_notifications','job_applications','job_interview_requests','job_offers',
    'job_conversations','job_messages'
  ] loop
    if not exists(
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I',table_name);
    end if;
  end loop;
end $$;

commit;

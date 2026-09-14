-- Nexora Jobs: workspace RPC reconciliation (the applicantCards 404).
--
-- The deployed employer workspace calls
--   POST /rest/v1/rpc/get_employer_job_applications  -> browser logs a 404 whose
--                                                       resource name contains "job_applications"
--   [loadWorkspace] non-critical applicantCards failed, using empty fallback
-- and the seeker workspace calls get_my_job_application_listings(). A PostgREST
-- 404 (PGRST202) means the FUNCTION is absent from the live schema cache —
-- projects that never applied 20260913001100 / 20260913001400 are exactly in
-- that state. This file re-declares both functions verbatim (create or replace,
-- same name/args/returns) so a single `supabase db push` converges regardless
-- of how far behind the project drifted; on an already-current project the
-- statements are no-ops.
--
-- Sources of truth (kept byte-identical):
--   get_employer_job_applications -> 20260913001400_jobs_employer_applications.sql
--   get_my_job_application_listings -> 20260913001100_jobs_my_applications.sql

begin;

create or replace function public.get_employer_job_applications(target_job_id uuid default null)
returns table(
  application_id uuid,
  job_id uuid,
  job_title text,
  candidate_profile_id uuid,
  candidate_name text,
  email text,
  phone text,
  avatar_path text,
  total_experience_months integer,
  skills text[],
  preferred_city text,
  preferred_state text,
  resume_storage_path text,
  resume_filename text,
  status text,
  submitted_at timestamptz,
  cover_note text,
  expected_salary numeric,
  available_from date,
  interviews jsonb
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare actor uuid:=public.job_assert_authenticated();
begin
  if public.job_current_role()<>'employer' then
    raise exception using errcode='42501',message='ROLE_NOT_ALLOWED';
  end if;
  if target_job_id is not null and not exists(
    select 1 from public.job_posts j where j.id=target_job_id and j.created_by=actor
  ) then
    raise exception using errcode='P0002',message='JOB_NOT_FOUND';
  end if;

  return query
  select
    a.id,a.job_id,j.title,a.candidate_profile_id,
    coalesce(p.full_name,'Applicant'),coalesce(u.email,'')::text,coalesce(p.phone,''),p.avatar_path,
    coalesce(c.total_experience_months,0),coalesce(skill_list.skills,'{}'::text[]),
    coalesce(pref.preferred_city,c.city),coalesce(pref.preferred_state,c.state),
    r.storage_path,r.original_filename,a.status,a.submitted_at,a.cover_note,a.expected_salary,a.available_from,
    coalesce(interview_list.items,'[]'::jsonb)
  from public.job_applications a
  join public.job_posts j on j.id=a.job_id
  join public.job_seeker_profiles c on c.id=a.candidate_profile_id
  join public.profiles p on p.id=a.candidate_user_id
  join auth.users u on u.id=a.candidate_user_id
  left join public.job_candidate_preferences pref on pref.candidate_id=c.id
  left join public.job_candidate_resumes r on r.id=a.resume_id
  left join lateral(
    select array_agg(distinct s.name order by s.name) as skills
    from public.job_candidate_skills cs
    join public.job_skills s on s.id=cs.skill_id
    where cs.candidate_id=c.id
  ) skill_list on true
  left join lateral(
    select jsonb_agg(to_jsonb(i) order by i.scheduled_start desc) as items
    from public.job_interview_requests i where i.application_id=a.id
  ) interview_list on true
  where j.created_by=actor and (target_job_id is null or j.id=target_job_id)
  order by a.submitted_at desc;
end $$;

revoke execute on function public.get_employer_job_applications(uuid) from public,anon;
grant execute on function public.get_employer_job_applications(uuid) to authenticated;

create or replace function public.get_my_job_application_listings()
returns table(
  application_id uuid,
  listing jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  actor uuid := public.job_assert_authenticated();
begin
  if public.job_current_role() <> 'job_seeker' then
    raise exception using errcode = '42501', message = 'ROLE_NOT_ALLOWED';
  end if;

  return query
  select
    a.id,
    jsonb_build_object(
      'id', j.id,
      'title', j.title,
      'category', j.category,
      'description', j.description,
      'responsibilities', j.responsibilities,
      'employment_type', j.employment_type,
      'workplace_type', j.workplace_type,
      'experience_min_months', j.experience_min_months,
      'experience_max_months', j.experience_max_months,
      'freshers_allowed', j.freshers_allowed,
      'salary_min', j.salary_min,
      'salary_max', j.salary_max,
      'pay_type', j.pay_type,
      'incentives', j.incentives,
      'tips_info', j.tips_info,
      'benefits', j.benefits,
      'working_days', j.working_days,
      'working_hours', j.working_hours,
      'weekly_off', j.weekly_off,
      'joining_date', j.joining_date,
      'openings', j.openings,
      'image_path', j.image_path,
      'tags', j.tags,
      'published_at', j.published_at,
      'expires_at', j.expires_at,
      'created_at', j.created_at,
      'status', j.status,
      'salon_id', s.id,
      'salon_name', s.name,
      'logo_path', s.logo_path,
      'salon_verified', s.verified,
      'rating_average', s.rating_average,
      'review_count', s.review_count,
      'city', coalesce(l.city, s.city),
      'state', coalesce(l.state, s.state),
      'location_id', l.id,
      'location_label', l.label
    )
  from public.job_applications a
  join public.job_posts j on j.id = a.job_id
  join public.salons s on s.id = j.salon_id
  left join public.job_salon_locations l on l.id = j.location_id
  where a.candidate_user_id = actor
  order by a.submitted_at desc;
end
$fn$;

revoke execute on function public.get_my_job_application_listings() from public, anon;
grant execute on function public.get_my_job_application_listings() to authenticated;

comment on function public.get_employer_job_applications(uuid) is
  'Reconciled by 20260914120001: employer-owned applicant cards for the workspace; identical signature to 20260913001400.';
comment on function public.get_my_job_application_listings() is
  'Returns safe job-listing fields for every application owned by the signed-in job seeker, including jobs no longer visible in public search.';

commit;

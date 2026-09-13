-- Nexora Jobs: safe candidate-owned listing snapshots for My Applications.
--
-- A job can leave the public search feed after a candidate applies (paused,
-- closed or expired). The normal job_posts RLS correctly hides those rows from
-- public search, but My Applications still needs the non-sensitive listing
-- fields. This role-checked function returns only jobs linked to auth.uid() and
-- deliberately omits creator ids, admin review notes and other internal data.

begin;

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

comment on function public.get_my_job_application_listings() is
  'Returns safe job-listing fields for every application owned by the signed-in job seeker, including jobs no longer visible in public search.';

commit;

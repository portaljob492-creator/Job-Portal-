-- Nexora Jobs: narrow employer-owned application cards for /jobs/applications/:jobId.
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

commit;

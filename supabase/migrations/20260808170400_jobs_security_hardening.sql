-- Nexora Jobs: security-advisor hardening

begin;

-- PostgreSQL grants EXECUTE to PUBLIC on new functions by default. Remove that
-- implicit grant from every externally exposed Jobs workflow before granting
-- only the authenticated role.
do $$
declare
  proc regprocedure;
begin
  for proc in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname = any(array[
      'job_register_role','complete_job_seeker_onboarding',
      'complete_job_employer_onboarding','create_job_post','publish_job',
      'pause_job','resume_job','close_job','submit_job_application',
      'mark_application_viewed','shortlist_application','reject_application',
      'withdraw_application','create_interview_request','accept_interview',
      'request_interview_reschedule','reschedule_interview','decline_interview',
      'complete_interview','send_job_offer','accept_job_offer',
      'decline_job_offer','withdraw_job_offer','mark_candidate_hired',
      'submit_employer_verification','review_employer_verification',
      'create_job_support_ticket','report_job','report_employer',
      'request_job_account_deletion'
    ])
  loop
    execute format('revoke execute on function %s from public, anon',proc);
  end loop;
end $$;

-- Safe views run with the caller's permissions and RLS. Candidate discovery
-- beyond an existing application is provided by the explicit checked RPC below.
alter view public.public_job_listings set (security_invoker=true);
alter view public.public_job_salon_profiles set (security_invoker=true);
alter view public.job_employer_candidate_cards set (security_invoker=true);

create or replace function public.search_job_candidates(
  p_city text default null,
  p_skill_id uuid default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table(
  candidate_id uuid,
  user_id uuid,
  full_name text,
  avatar_path text,
  headline text,
  bio text,
  city text,
  state text,
  experience_level text,
  total_experience_months integer,
  expected_salary_min numeric,
  expected_salary_max numeric,
  available_from date,
  open_to_relocation boolean,
  skills text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.job_assert_authenticated();
  if public.job_current_role() <> 'employer'
     or not exists(
       select 1 from public.job_salon_members m
       where m.user_id=(select auth.uid()) and m.status='active'
     ) then
    raise exception using errcode='42501',message='ROLE_NOT_ALLOWED';
  end if;

  return query
  select
    c.id,c.user_id,p.full_name,p.avatar_path,c.headline,c.bio,c.city,c.state,
    c.experience_level,c.total_experience_months,c.expected_salary_min,
    c.expected_salary_max,c.available_from,c.open_to_relocation,
    coalesce(array_agg(distinct sk.name) filter(where sk.id is not null),'{}'::text[])
  from public.job_seeker_profiles c
  join public.profiles p on p.id=c.user_id
  left join public.job_candidate_skills cs on cs.candidate_id=c.id
  left join public.job_skills sk on sk.id=cs.skill_id
  where c.profile_visibility='employers'
    and p.is_active=true
    and (p_city is null or lower(c.city)=lower(p_city))
    and (p_skill_id is null or exists(
      select 1 from public.job_candidate_skills match_skill
      where match_skill.candidate_id=c.id and match_skill.skill_id=p_skill_id
    ))
    and not exists(
      select 1 from public.job_blocked_employers b
      join public.job_salon_members mine on mine.salon_id=b.salon_id
      where b.candidate_user_id=c.user_id
        and mine.user_id=(select auth.uid()) and mine.status='active'
    )
  group by c.id,p.id,p.full_name,p.avatar_path
  order by c.profile_completion desc,c.updated_at desc
  limit least(greatest(p_limit,1),100)
  offset greatest(p_offset,0);
end;
$$;

revoke execute on function public.search_job_candidates(text,uuid,integer,integer) from public,anon;
grant execute on function public.search_job_candidates(text,uuid,integer,integer) to authenticated;

commit;

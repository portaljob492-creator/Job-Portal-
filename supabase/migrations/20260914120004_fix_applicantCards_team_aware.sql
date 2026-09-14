-- Phase 5 — fix applicantCards (employer workspace) team-aware & admin-aware.
--
-- loadWorkspace() → applicantCards → POST /rest/v1/rpc/get_employer_job_applications
-- previously 404'd (PGRST202) when the live project was behind 20260913001400,
-- and even after the Phase-4 reconciliation it remained owner-only
-- (j.created_by = actor) and employer-only, so:
--   * a manager/recruiter in the same salon saw empty applicantCards (not an
--     error, but wrong — the warning was the visible symptom when the function
--     was still missing)
--   * an admin saw ROLE_NOT_ALLOWED
-- Both are now correct: the membership test is the same set-based helper the
-- hot-path policies and get_job_applicant_cards() already use
-- (job_my_active_salon_ids()), evaluated once per query, and admins bypass it.
--
-- Dependencies verified:
--   job_applications (table + RLS + FKs from 20260914120003), job_posts,
--   profiles + auth.users, job_seeker_profiles, job_candidate_preferences,
--   job_candidate_resumes, job_candidate_skills → job_skills,
--   job_interview_requests — all inner/left joins as in the original function.
--   Not dependent on user_location (separate Phase) or any view; the function
--   is SECURITY DEFINER so it bypasses RLS and enforces its own actor check.
--   The call in src/services/backend.ts is already correct
--   (client.rpc('get_employer_job_applications', {target_job_id: null})) —
--   no frontend endpoint change required.

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
set search_path = ''
as $$
declare actor uuid := public.job_assert_authenticated();
  is_admin boolean := public.job_is_admin();
  is_employer boolean := public.job_current_role() = 'employer';
begin
  if not is_employer and not is_admin then
    raise exception using errcode = '42501', message = 'ROLE_NOT_ALLOWED';
  end if;

  if target_job_id is not null and not exists (
    select 1 from public.job_posts j
    where j.id = target_job_id
      and (j.salon_id in (select public.job_my_active_salon_ids()) or is_admin)
  ) then
    raise exception using errcode = 'P0002', message = 'JOB_NOT_FOUND';
  end if;

  return query
  select
    a.id, a.job_id, j.title, a.candidate_profile_id,
    coalesce(p.full_name, 'Applicant'), coalesce(u.email, '')::text, coalesce(p.phone, ''), p.avatar_path,
    coalesce(c.total_experience_months, 0), coalesce(skill_list.skills, '{}'::text[]),
    coalesce(pref.preferred_city, c.city), coalesce(pref.preferred_state, c.state),
    r.storage_path, r.original_filename, a.status, a.submitted_at, a.cover_note, a.expected_salary, a.available_from,
    coalesce(interview_list.items, '[]'::jsonb)
  from public.job_applications a
  join public.job_posts j on j.id = a.job_id
  join public.job_seeker_profiles c on c.id = a.candidate_profile_id
  join public.profiles p on p.id = a.candidate_user_id
  join auth.users u on u.id = a.candidate_user_id
  left join public.job_candidate_preferences pref on pref.candidate_id = c.id
  left join public.job_candidate_resumes r on r.id = a.resume_id
  left join lateral (
    select array_agg(distinct s.name order by s.name) as skills
    from public.job_candidate_skills cs
    join public.job_skills s on s.id = cs.skill_id
    where cs.candidate_id = c.id
  ) skill_list on true
  left join lateral (
    select jsonb_agg(to_jsonb(i) order by i.scheduled_start desc) as items
    from public.job_interview_requests i where i.application_id = a.id
  ) interview_list on true
  where (j.salon_id in (select public.job_my_active_salon_ids()) or is_admin)
    and (target_job_id is null or j.id = target_job_id)
  order by a.submitted_at desc;
end;
$$;

revoke execute on function public.get_employer_job_applications(uuid) from public, anon;
grant execute on function public.get_employer_job_applications(uuid) to authenticated;

-- Ensure the older card function stays team-aware as well (re-assert after
-- any manual DB edits; no-op on a current project).
create or replace function public.get_job_applicant_cards()
returns table(application_id uuid, candidate_user_id uuid, full_name text, email text, phone text,
              avatar_path text, headline text, city text, state text, total_experience_months integer,
              skills text[])
language plpgsql
stable
security definer
set search_path = ''
as $fn$
begin
  perform public.job_assert_authenticated();
  if public.job_current_role() <> 'employer' and not public.job_is_admin() then
    raise exception using errcode='42501', message='ROLE_NOT_ALLOWED';
  end if;

  return query
  select
    a.id, a.candidate_user_id, p.full_name, u.email::text, p.phone, p.avatar_path,
    c.headline, c.city, c.state, c.total_experience_months,
    coalesce(array_agg(distinct s.name) filter (where s.id is not null), '{}'::text[])
  from public.job_applications a
  join public.job_posts j on j.id = a.job_id
  join public.profiles p on p.id = a.candidate_user_id
  join auth.users u on u.id = a.candidate_user_id
  join public.job_seeker_profiles c on c.id = a.candidate_profile_id
  left join public.job_candidate_skills cs on cs.candidate_id = c.id
  left join public.job_skills s on s.id = cs.skill_id
  where j.salon_id in (select public.job_my_active_salon_ids())
     or (select public.job_is_admin())
  group by a.id, p.id, u.id, u.email, c.id;
end;
$fn$;

revoke execute on function public.get_job_applicant_cards() from public, anon;
grant execute on function public.get_job_applicant_cards() to authenticated;

comment on function public.get_employer_job_applications(uuid) is
  'Phase 5: team-aware (job_my_active_salon_ids) + admin-aware; fixes applicantCards for managers/recruiters and admins, same columns as before.';

commit;

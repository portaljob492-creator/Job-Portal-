-- Nexora Jobs: authorized projections that include protected identity fields

begin;

create or replace function public.get_job_applicant_cards()
returns table(
  application_id uuid,
  candidate_user_id uuid,
  full_name text,
  email text,
  phone text,
  avatar_path text,
  headline text,
  city text,
  state text,
  total_experience_months integer,
  skills text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.job_assert_authenticated();
  if public.job_current_role() <> 'employer' and not public.job_is_admin() then
    raise exception using errcode='42501',message='ROLE_NOT_ALLOWED';
  end if;

  return query
  select
    a.id,a.candidate_user_id,p.full_name,u.email::text,p.phone,p.avatar_path,
    c.headline,c.city,c.state,c.total_experience_months,
    coalesce(array_agg(distinct s.name) filter(where s.id is not null),'{}'::text[])
  from public.job_applications a
  join public.job_posts j on j.id=a.job_id
  join public.profiles p on p.id=a.candidate_user_id
  join auth.users u on u.id=a.candidate_user_id
  join public.job_seeker_profiles c on c.id=a.candidate_profile_id
  left join public.job_candidate_skills cs on cs.candidate_id=c.id
  left join public.job_skills s on s.id=cs.skill_id
  where public.job_is_admin() or public.job_is_active_salon_member(j.salon_id)
  group by a.id,p.id,u.id,u.email,c.id;
end;
$$;

create or replace function public.get_job_conversation_summaries()
returns table(
  conversation_id uuid,
  job_id uuid,
  job_title text,
  salon_name text,
  salon_logo_path text,
  candidate_user_id uuid,
  candidate_name text,
  candidate_email text,
  candidate_avatar_path text,
  employer_user_id uuid,
  employer_name text,
  employer_avatar_path text,
  status text,
  last_message text,
  last_message_at timestamptz,
  candidate_unread_count integer,
  employer_unread_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare actor uuid:=public.job_assert_authenticated();
begin
  return query
  select
    c.id,c.job_id,j.title,s.name,s.logo_path,c.candidate_user_id,
    cp.full_name,cu.email::text,cp.avatar_path,c.employer_user_id,
    ep.full_name,ep.avatar_path,c.status,c.last_message,c.last_message_at,
    c.candidate_unread_count,c.employer_unread_count
  from public.job_conversations c
  join public.job_posts j on j.id=c.job_id
  join public.salons s on s.id=j.salon_id
  join public.profiles cp on cp.id=c.candidate_user_id
  join auth.users cu on cu.id=c.candidate_user_id
  join public.profiles ep on ep.id=c.employer_user_id
  where actor in (c.candidate_user_id,c.employer_user_id) or public.job_is_admin()
  order by c.last_message_at desc;
end;
$$;

revoke execute on function public.get_job_applicant_cards() from public,anon;
revoke execute on function public.get_job_conversation_summaries() from public,anon;
grant execute on function public.get_job_applicant_cards() to authenticated;
grant execute on function public.get_job_conversation_summaries() to authenticated;

commit;

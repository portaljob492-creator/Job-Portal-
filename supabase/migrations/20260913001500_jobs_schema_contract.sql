-- Nexora Jobs: schema contract compatibility without duplicating existing data.
-- `job_seeker_profiles` is the authoritative candidate profile table. A secure
-- `candidate_profiles` projection provides the requested flat shape while the
-- normalized education, skills, preferences and resume tables remain canonical.
begin;

-- ---------------------------------------------------------------------------
-- Candidate profile compatibility view (no duplicate candidate table).
-- ---------------------------------------------------------------------------
create or replace view public.candidate_profiles
with (security_barrier=true,security_invoker=false)
as
select
  c.id,
  c.user_id,
  p.full_name,
  u.email::text as email,
  p.phone as mobile,
  p.avatar_path as profile_image_url,
  c.city,
  p.preferred_area as area,
  education.summary as education,
  round(c.total_experience_months::numeric/12,2) as experience_years,
  coalesce(candidate_skills.items,'{}'::text[]) as skills,
  preferred_role.role_name as preferred_job_role,
  coalesce(c.expected_salary_min,pref.salary_min) as preferred_salary_min,
  coalesce(c.expected_salary_max,pref.salary_max) as preferred_salary_max,
  candidate_resume.storage_path as resume_url,
  case when c.submitted_at is null then 'draft' else 'submitted' end::text as profile_status,
  (c.profile_completion>=50) as is_complete,
  c.created_at,
  c.updated_at
from public.job_seeker_profiles c
join public.profiles p on p.id=c.user_id
join auth.users u on u.id=c.user_id
left join public.job_candidate_preferences pref on pref.candidate_id=c.id
left join lateral(
  select string_agg(
    concat_ws(', ',e.course_name,e.institution_name,
      case when e.completion_year is null then null else e.completion_year::text end),
    '; ' order by e.completion_year desc nulls last,e.created_at
  ) as summary
  from public.job_candidate_education e where e.candidate_id=c.id
) education on true
left join lateral(
  select array_agg(distinct s.name order by s.name) as items
  from public.job_candidate_skills cs
  join public.job_skills s on s.id=cs.skill_id
  where cs.candidate_id=c.id
) candidate_skills on true
left join lateral(
  select r.role_name
  from public.job_candidate_preferred_roles r
  where r.candidate_id=c.id
  order by r.created_at,r.role_name
  limit 1
) preferred_role on true
left join lateral(
  select r.storage_path
  from public.job_candidate_resumes r
  where r.candidate_id=c.id and (
    c.user_id=(select auth.uid())
    or public.job_is_admin()
    or exists(
      select 1 from public.job_applications a
      join public.job_posts j on j.id=a.job_id
      where a.resume_id=r.id and (
        j.created_by=(select auth.uid())
        or public.job_is_active_salon_member(j.salon_id)
      )
    )
  )
  order by r.is_primary desc,r.uploaded_at desc
  limit 1
) candidate_resume on true
where c.user_id=(select auth.uid())
  or public.job_is_admin()
  or exists(
    select 1 from public.job_applications a
    join public.job_posts j on j.id=a.job_id
    where a.candidate_profile_id=c.id and (
      j.created_by=(select auth.uid())
      or public.job_is_active_salon_member(j.salon_id)
    )
  );

revoke all on public.candidate_profiles from public,anon;
grant select on public.candidate_profiles to authenticated;
comment on view public.candidate_profiles is
  'Secure flat compatibility projection over normalized job_seeker_profiles data; not a duplicate storage table.';

-- ---------------------------------------------------------------------------
-- Add requested names to the existing job_posts table and keep them synced
-- with the richer canonical columns already used by the Jobs module.
-- ---------------------------------------------------------------------------
alter table public.job_posts add column if not exists owner_id uuid;
alter table public.job_posts add column if not exists job_title text;
alter table public.job_posts add column if not exists skills_required text[];
alter table public.job_posts add column if not exists experience_required text;
alter table public.job_posts add column if not exists job_type text;
alter table public.job_posts add column if not exists address text;

update public.job_posts set
  owner_id=created_by,
  job_title=title,
  skills_required=coalesce(string_to_array(responsibilities,E'\n'),'{}'::text[]),
  experience_required=case
    when freshers_allowed and experience_min_months=0 then 'Freshers can apply'
    when experience_max_months is null then trim(to_char(experience_min_months::numeric/12,'FM999990.##'))||'+ years'
    else trim(to_char(experience_min_months::numeric/12,'FM999990.##'))||' - '
      ||trim(to_char(experience_max_months::numeric/12,'FM999990.##'))||' years'
  end,
  job_type=employment_type,
  address=work_location;

create or replace function public.job_sync_post_contract_columns()
returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then
    new.created_by=coalesce(new.created_by,new.owner_id);
    new.title=coalesce(new.title,new.job_title);
    new.employment_type=coalesce(new.employment_type,new.job_type);
    new.work_location=coalesce(new.work_location,new.address);
    if new.responsibilities is null and new.skills_required is not null then
      new.responsibilities=array_to_string(new.skills_required,E'\n');
    end if;
  end if;
  new.owner_id=new.created_by;
  new.job_title=new.title;
  new.skills_required=coalesce(string_to_array(new.responsibilities,E'\n'),'{}'::text[]);
  new.experience_required=case
    when new.freshers_allowed and new.experience_min_months=0 then 'Freshers can apply'
    when new.experience_max_months is null then trim(to_char(new.experience_min_months::numeric/12,'FM999990.##'))||'+ years'
    else trim(to_char(new.experience_min_months::numeric/12,'FM999990.##'))||' - '
      ||trim(to_char(new.experience_max_months::numeric/12,'FM999990.##'))||' years'
  end;
  new.job_type=new.employment_type;
  new.address=new.work_location;
  return new;
end $$;

drop trigger if exists job_posts_sync_contract_columns on public.job_posts;
create trigger job_posts_sync_contract_columns
before insert or update on public.job_posts
for each row execute function public.job_sync_post_contract_columns();
revoke execute on function public.job_sync_post_contract_columns() from public,anon,authenticated;

alter table public.job_posts alter column owner_id set not null;
alter table public.job_posts alter column job_title set not null;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='job_posts_owner_id_auth_fkey') then
    alter table public.job_posts add constraint job_posts_owner_id_auth_fkey
      foreign key(owner_id) references auth.users(id) on delete restrict;
  end if;
end $$;

create index if not exists job_posts_owner_id_idx on public.job_posts(owner_id);

comment on column public.job_posts.owner_id is 'Compatibility owner field, synchronized from created_by (auth.uid() in write RPCs).';
comment on column public.job_posts.job_title is 'Compatibility alias synchronized from title.';
comment on column public.job_posts.status is 'Internal published value is approved; draft and closed retain their literal values.';

-- ---------------------------------------------------------------------------
-- Add requested names to the existing job_applications table. The existing
-- unique(job_id,candidate_user_id) remains the authoritative duplicate guard.
-- ---------------------------------------------------------------------------
alter table public.job_applications add column if not exists candidate_id uuid;
alter table public.job_applications add column if not exists owner_id uuid;
alter table public.job_applications add column if not exists applied_at timestamptz default now();

update public.job_applications a set
  candidate_id=a.candidate_profile_id,
  owner_id=j.created_by,
  applied_at=a.submitted_at
from public.job_posts j where j.id=a.job_id;

create or replace function public.job_sync_application_contract_columns()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    new.candidate_profile_id=coalesce(new.candidate_profile_id,new.candidate_id);
    new.submitted_at=coalesce(new.submitted_at,new.applied_at,now());
  end if;
  new.candidate_id=new.candidate_profile_id;
  new.applied_at=new.submitted_at;
  select j.created_by into new.owner_id from public.job_posts j where j.id=new.job_id;
  if new.owner_id is null then raise exception using errcode='P0002',message='JOB_NOT_FOUND'; end if;
  return new;
end $$;

drop trigger if exists job_applications_sync_contract_columns on public.job_applications;
create trigger job_applications_sync_contract_columns
before insert or update on public.job_applications
for each row execute function public.job_sync_application_contract_columns();
revoke execute on function public.job_sync_application_contract_columns() from public,anon,authenticated;

alter table public.job_applications alter column candidate_id set not null;
alter table public.job_applications alter column owner_id set not null;
alter table public.job_applications alter column applied_at set not null;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='job_applications_candidate_id_fkey') then
    alter table public.job_applications add constraint job_applications_candidate_id_fkey
      foreign key(candidate_id) references public.job_seeker_profiles(id) on delete restrict;
  end if;
  if not exists(select 1 from pg_constraint where conname='job_applications_candidate_user_auth_fkey') then
    alter table public.job_applications add constraint job_applications_candidate_user_auth_fkey
      foreign key(candidate_user_id) references auth.users(id) on delete restrict;
  end if;
  if not exists(select 1 from pg_constraint where conname='job_applications_owner_id_auth_fkey') then
    alter table public.job_applications add constraint job_applications_owner_id_auth_fkey
      foreign key(owner_id) references auth.users(id) on delete restrict;
  end if;
  if not exists(
    select 1 from pg_constraint
    where conrelid='public.job_applications'::regclass and contype='u'
      and pg_get_constraintdef(oid)='UNIQUE (job_id, candidate_user_id)'
  ) then
    alter table public.job_applications add constraint job_applications_one_candidate_per_job
      unique(job_id,candidate_user_id);
  end if;
end $$;

comment on column public.job_applications.candidate_id is 'Compatibility alias synchronized from candidate_profile_id.';
comment on column public.job_applications.owner_id is 'Job owner copied from job_posts.created_by by a trusted trigger.';
comment on column public.job_applications.applied_at is 'Compatibility alias synchronized from submitted_at.';
comment on column public.job_applications.status is 'Internal applied value is submitted; later values preserve the full hiring workflow.';

create index if not exists job_applications_candidate_id_idx
  on public.job_applications(candidate_id);
create index if not exists job_applications_owner_applied_idx
  on public.job_applications(owner_id,applied_at desc);

commit;

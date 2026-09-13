-- Nexora Jobs: complete candidate-profile submission and confirmation metadata.
--
-- The browser previously saved only the shared name/phone plus headline/bio and
-- showed a success toast before any database response.  This RPC is the single
-- transaction behind the eight-step candidate form: the shared profile,
-- candidate row, skills, experience, education, certifications and preferences
-- either all land together or none of them do.  The caller is always derived
-- from auth.uid(); no user/candidate id is accepted from the client.

begin;

alter table public.job_seeker_profiles
  add column if not exists submitted_at timestamptz;

comment on column public.job_seeker_profiles.submitted_at is
  'Last time the candidate explicitly completed Review & Submit. Null means the profile has only been saved/onboarded, not submitted through the full form.';

create or replace function public.job_submit_candidate_profile(
  p_full_name text,
  p_phone text,
  p_avatar_path text default null,
  p_headline text default null,
  p_bio text default null,
  p_city text default null,
  p_state text default null,
  p_experience_level text default 'fresher',
  p_total_experience_months integer default 0,
  p_expected_salary_min numeric default null,
  p_expected_salary_max numeric default null,
  p_available_from date default null,
  p_open_to_relocation boolean default false,
  p_skills text[] default '{}',
  p_preferred_roles text[] default '{}',
  p_employment_types text[] default '{}',
  p_experience jsonb default '[]'::jsonb,
  p_education jsonb default '[]'::jsonb,
  p_certifications jsonb default '[]'::jsonb
)
returns table(
  candidate_id uuid,
  profile_completion integer,
  application_ready boolean,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  actor uuid := public.job_assert_authenticated();
  candidate_uuid uuid;
  completion integer := 0;
  submitted_time timestamptz := now();
  item text;
  skill_uuid uuid;
  record_json jsonb;
  role_title text;
  salon_name text;
  city_name text;
  state_name text;
  start_on date;
  end_on date;
  is_current boolean;
  course_name text;
  institution_name text;
  completion_year integer;
  certificate_name text;
  certificate_path text;
begin
  if public.job_current_role() <> 'job_seeker' then
    raise exception using errcode='42501', message='ROLE_NOT_ALLOWED';
  end if;
  if p_full_name is null or char_length(trim(p_full_name)) < 2
     or p_phone is null or char_length(trim(p_phone)) < 5
     or p_headline is null or char_length(trim(p_headline)) < 2
     or p_city is null or char_length(trim(p_city)) < 2
     or p_state is null or char_length(trim(p_state)) < 2 then
    raise exception using errcode='22023', message='VALIDATION_ERROR';
  end if;
  if p_experience_level not in ('fresher', 'junior', 'mid', 'senior', 'lead')
     or coalesce(p_total_experience_months, -1) < 0 then
    raise exception using errcode='22023', message='VALIDATION_ERROR';
  end if;
  if p_expected_salary_min is not null and p_expected_salary_min < 0
     or p_expected_salary_max is not null and p_expected_salary_max < 0
     or p_expected_salary_min is not null and p_expected_salary_max is not null
        and p_expected_salary_min > p_expected_salary_max then
    raise exception using errcode='22023', message='VALIDATION_ERROR';
  end if;
  if coalesce(array_length(p_skills, 1), 0) = 0
     or coalesce(array_length(p_preferred_roles, 1), 0) = 0
     or coalesce(array_length(p_employment_types, 1), 0) = 0 then
    raise exception using errcode='22023', message='VALIDATION_ERROR';
  end if;

  update public.profiles
     set full_name = trim(p_full_name),
         phone = nullif(trim(coalesce(p_phone, '')), ''),
         avatar_path = nullif(trim(coalesce(p_avatar_path, '')), '')
   where id = actor;
  if not found then
    raise exception using errcode='P0002', message='PROFILE_NOT_FOUND';
  end if;

  -- Completion is calculated by the server from persisted sections.  It is not
  -- accepted from the browser, so application readiness cannot be forged.
  completion := completion + 10; -- valid identity
  completion := completion + 10; -- valid contact
  if nullif(trim(coalesce(p_headline, '')), '') is not null
     and nullif(trim(coalesce(p_bio, '')), '') is not null then completion := completion + 10; end if;
  completion := completion + 10; -- city + state validated above
  completion := completion + 10; -- skills validated above
  if jsonb_array_length(coalesce(p_education, '[]'::jsonb)) > 0
     or jsonb_array_length(coalesce(p_certifications, '[]'::jsonb)) > 0 then completion := completion + 10; end if;
  if p_experience_level = 'fresher'
     or p_total_experience_months > 0
     or jsonb_array_length(coalesce(p_experience, '[]'::jsonb)) > 0 then completion := completion + 10; end if;
  completion := completion + 10; -- preferred roles validated above
  completion := completion + 10; -- employment types validated above
  if nullif(trim(coalesce(p_avatar_path, '')), '') is not null
     or exists (
       select 1 from public.job_candidate_resumes r
       join public.job_seeker_profiles c on c.id = r.candidate_id
       where c.user_id = actor
     ) then completion := completion + 10; end if;

  insert into public.job_seeker_profiles(
    user_id, headline, bio, city, state, experience_level,
    total_experience_months, expected_salary_min, expected_salary_max,
    available_from, open_to_relocation, profile_completion,
    profile_visibility, submitted_at
  ) values (
    actor, trim(p_headline), nullif(trim(coalesce(p_bio, '')), ''),
    trim(p_city), trim(p_state), p_experience_level,
    p_total_experience_months, p_expected_salary_min, p_expected_salary_max,
    p_available_from, p_open_to_relocation, completion, 'employers', submitted_time
  )
  on conflict (user_id) do update set
    headline = excluded.headline,
    bio = excluded.bio,
    city = excluded.city,
    state = excluded.state,
    experience_level = excluded.experience_level,
    total_experience_months = excluded.total_experience_months,
    expected_salary_min = excluded.expected_salary_min,
    expected_salary_max = excluded.expected_salary_max,
    available_from = excluded.available_from,
    open_to_relocation = excluded.open_to_relocation,
    profile_completion = excluded.profile_completion,
    profile_visibility = 'employers',
    submitted_at = excluded.submitted_at,
    updated_at = now()
  returning id into candidate_uuid;

  delete from public.job_candidate_skills where job_candidate_skills.candidate_id = candidate_uuid;
  foreach item in array coalesce(p_skills, '{}') loop
    item := nullif(trim(item), '');
    if item is not null then
      insert into public.job_skills(name, slug, category)
      values (
        item,
        trim(both '-' from regexp_replace(lower(item), '[^a-z0-9]+', '-', 'g')) || '-' || substr(md5(lower(item)), 1, 8),
        'candidate'
      ) on conflict do nothing;
      select s.id into skill_uuid from public.job_skills s where lower(s.name) = lower(item) limit 1;
      if skill_uuid is not null then
        insert into public.job_candidate_skills(candidate_id, skill_id)
        values (candidate_uuid, skill_uuid) on conflict do nothing;
      end if;
    end if;
  end loop;

  delete from public.job_candidate_experience where job_candidate_experience.candidate_id = candidate_uuid;
  for record_json in select value from jsonb_array_elements(coalesce(p_experience, '[]'::jsonb)) loop
    role_title := nullif(trim(coalesce(record_json ->> 'role_title', '')), '');
    salon_name := nullif(trim(coalesce(record_json ->> 'salon_name', '')), '');
    if role_title is null or salon_name is null then
      raise exception using errcode='22023', message='VALIDATION_ERROR';
    end if;
    begin
      start_on := (record_json ->> 'start_date')::date;
      end_on := nullif(record_json ->> 'end_date', '')::date;
    exception when others then
      raise exception using errcode='22023', message='VALIDATION_ERROR';
    end;
    is_current := coalesce((record_json ->> 'currently_working')::boolean, false);
    if start_on is null or (not is_current and end_on is not null and end_on < start_on) then
      raise exception using errcode='22023', message='VALIDATION_ERROR';
    end if;
    insert into public.job_candidate_experience(
      candidate_id, salon_name, role_title, city, state, start_date,
      end_date, currently_working, description, sort_order
    ) values (
      candidate_uuid, salon_name, role_title,
      nullif(trim(coalesce(record_json ->> 'city', '')), ''),
      nullif(trim(coalesce(record_json ->> 'state', '')), ''), start_on,
      case when is_current then null else end_on end, is_current,
      nullif(trim(coalesce(record_json ->> 'description', '')), ''),
      coalesce((record_json ->> 'sort_order')::integer, 0)
    );
  end loop;

  delete from public.job_candidate_education where job_candidate_education.candidate_id = candidate_uuid;
  for record_json in select value from jsonb_array_elements(coalesce(p_education, '[]'::jsonb)) loop
    course_name := nullif(trim(coalesce(record_json ->> 'course_name', '')), '');
    institution_name := nullif(trim(coalesce(record_json ->> 'institution_name', '')), '');
    begin
      completion_year := nullif(record_json ->> 'completion_year', '')::integer;
    exception when others then
      raise exception using errcode='22023', message='VALIDATION_ERROR';
    end;
    if course_name is null then raise exception using errcode='22023', message='VALIDATION_ERROR'; end if;
    insert into public.job_candidate_education(
      candidate_id, course_name, institution_name, completion_year, description
    ) values (
      candidate_uuid, course_name, institution_name, completion_year,
      nullif(trim(coalesce(record_json ->> 'description', '')), '')
    );
  end loop;

  delete from public.job_candidate_certifications where job_candidate_certifications.candidate_id = candidate_uuid;
  for record_json in select value from jsonb_array_elements(coalesce(p_certifications, '[]'::jsonb)) loop
    certificate_name := nullif(trim(coalesce(record_json ->> 'certificate_name', '')), '');
    institution_name := nullif(trim(coalesce(record_json ->> 'institution_name', '')), '');
    certificate_path := nullif(trim(coalesce(record_json ->> 'certificate_path', '')), '');
    begin
      completion_year := nullif(record_json ->> 'completion_year', '')::integer;
    exception when others then
      raise exception using errcode='22023', message='VALIDATION_ERROR';
    end;
    if certificate_name is null then raise exception using errcode='22023', message='VALIDATION_ERROR'; end if;
    insert into public.job_candidate_certifications(
      candidate_id, certificate_name, institution_name, completion_year, certificate_path
    ) values (candidate_uuid, certificate_name, institution_name, completion_year, certificate_path);
  end loop;

  insert into public.job_candidate_preferences(
    candidate_id, preferred_city, preferred_state, salary_min, salary_max,
    available_from, open_to_relocation
  ) values (
    candidate_uuid, trim(p_city), trim(p_state), p_expected_salary_min,
    p_expected_salary_max, p_available_from, p_open_to_relocation
  ) on conflict on constraint job_candidate_preferences_pkey do update set
    preferred_city = excluded.preferred_city,
    preferred_state = excluded.preferred_state,
    salary_min = excluded.salary_min,
    salary_max = excluded.salary_max,
    available_from = excluded.available_from,
    open_to_relocation = excluded.open_to_relocation,
    updated_at = now();

  delete from public.job_candidate_preferred_roles where job_candidate_preferred_roles.candidate_id = candidate_uuid;
  foreach item in array coalesce(p_preferred_roles, '{}') loop
    if nullif(trim(item), '') is not null then
      insert into public.job_candidate_preferred_roles(candidate_id, role_name)
      values (candidate_uuid, trim(item)) on conflict do nothing;
    end if;
  end loop;

  delete from public.job_candidate_employment_types where job_candidate_employment_types.candidate_id = candidate_uuid;
  foreach item in array coalesce(p_employment_types, '{}') loop
    if item not in ('full_time', 'part_time', 'internship', 'freelance', 'contract') then
      raise exception using errcode='22023', message='INVALID_EMPLOYMENT_TYPE';
    end if;
    insert into public.job_candidate_employment_types(candidate_id, employment_type)
    values (candidate_uuid, item) on conflict do nothing;
  end loop;

  update public.job_user_roles
     set onboarding_completed = true, updated_at = now()
   where user_id = actor;

  candidate_id := candidate_uuid;
  profile_completion := completion;
  application_ready := completion >= 50;
  submitted_at := submitted_time;
  return next;
end
$fn$;

revoke execute on function public.job_submit_candidate_profile(
  text,text,text,text,text,text,text,text,integer,numeric,numeric,date,boolean,
  text[],text[],text[],jsonb,jsonb,jsonb
) from public, anon;
grant execute on function public.job_submit_candidate_profile(
  text,text,text,text,text,text,text,text,integer,numeric,numeric,date,boolean,
  text[],text[],text[],jsonb,jsonb,jsonb
) to authenticated;

comment on function public.job_submit_candidate_profile(
  text,text,text,text,text,text,text,text,integer,numeric,numeric,date,boolean,
  text[],text[],text[],jsonb,jsonb,jsonb
) is
  'Atomically submits the signed-in job seeker full profile and returns server-calculated completion/readiness confirmation.';

commit;

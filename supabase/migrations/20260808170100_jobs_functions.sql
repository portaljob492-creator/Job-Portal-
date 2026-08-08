-- Nexora Jobs: trusted helpers, triggers and workflow RPCs

begin;

-- ---------------------------------------------------------------------------
-- Authorization helpers
-- ---------------------------------------------------------------------------

create or replace function public.job_current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select r.role
  from public.job_user_roles r
  where r.user_id = (select auth.uid())
    and r.account_status = 'active'
$$;

create or replace function public.job_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    exists (
      select 1 from public.job_user_roles r
      where r.user_id = (select auth.uid())
        and r.role = 'admin'
        and r.account_status = 'active'
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.platform_role = 'admin'
        and p.is_active = true
    ), false
  )
$$;

create or replace function public.job_is_active_salon_member(target_salon_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(exists (
    select 1
    from public.job_salon_members m
    join public.job_user_roles r on r.user_id = m.user_id
    join public.salons s on s.id = m.salon_id
    where m.salon_id = target_salon_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.member_role in ('owner', 'manager', 'recruiter')
      and r.role in ('employer', 'admin')
      and r.account_status = 'active'
      and s.is_active = true
      and s.deleted_at is null
  ), false)
$$;

create or replace function public.job_can_manage_application(target_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.job_is_admin() or coalesce(exists (
    select 1
    from public.job_applications a
    join public.job_posts j on j.id = a.job_id
    join public.job_salon_members m on m.salon_id = j.salon_id
    where a.id = target_application_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.member_role in ('owner', 'manager', 'recruiter')
  ), false)
$$;

create or replace function public.job_assert_authenticated()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then raise exception using errcode = '28000', message = 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.profiles p where p.id = actor and p.is_active = true
  ) then
    raise exception using errcode = '42501', message = 'ACCOUNT_INACTIVE';
  end if;
  return actor;
end;
$$;

-- ---------------------------------------------------------------------------
-- Role registration and onboarding
-- ---------------------------------------------------------------------------

create or replace function public.job_register_role(requested_role text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.job_assert_authenticated();
  existing_role text;
begin
  if requested_role not in ('job_seeker', 'employer') then
    raise exception using errcode = '22023', message = 'ROLE_NOT_ALLOWED';
  end if;

  select role into existing_role from public.job_user_roles where user_id = actor;
  if existing_role is not null and existing_role <> requested_role and (
    exists (select 1 from public.job_applications where candidate_user_id = actor)
    or exists (select 1 from public.job_posts where created_by = actor)
    or exists (select 1 from public.job_salon_members where user_id = actor and status = 'active')
  ) then
    raise exception using errcode = '42501', message = 'ROLE_LOCKED';
  end if;

  perform set_config('app.job_trusted_role_change', 'yes', true);
  insert into public.job_user_roles(user_id, role)
  values (actor, requested_role)
  on conflict (user_id) do update
    set role = excluded.role, updated_at = now()
    where public.job_user_roles.onboarding_completed = false;

  select role into existing_role from public.job_user_roles where user_id = actor;
  return existing_role;
end;
$$;

create or replace function public.job_create_role_after_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text;
begin
  if coalesce(new.raw_user_meta_data ->> 'app_context', '') <> 'jobs' then
    return new;
  end if;

  requested_role := coalesce(new.raw_user_meta_data ->> 'job_role', new.raw_user_meta_data ->> 'role');
  if requested_role = 'seeker' then requested_role := 'job_seeker'; end if;
  if requested_role not in ('job_seeker', 'employer') then requested_role := 'job_seeker'; end if;

  insert into public.job_user_roles(user_id, role)
  values (new.id, requested_role)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_jobs on auth.users;
create trigger on_auth_user_created_jobs
after insert on auth.users
for each row execute function public.job_create_role_after_signup();

create or replace function public.complete_job_seeker_onboarding(
  p_headline text,
  p_bio text,
  p_city text,
  p_state text,
  p_experience_level text,
  p_total_experience_months integer,
  p_expected_salary_min numeric default null,
  p_expected_salary_max numeric default null,
  p_available_from date default null,
  p_open_to_relocation boolean default false,
  p_preferred_roles text[] default '{}',
  p_employment_types text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.job_assert_authenticated();
  candidate_uuid uuid;
  item text;
begin
  perform public.job_register_role('job_seeker');
  if p_total_experience_months < 0 then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;
  if p_expected_salary_min is not null and p_expected_salary_max is not null
     and p_expected_salary_min > p_expected_salary_max then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  insert into public.job_seeker_profiles(
    user_id, headline, bio, city, state, experience_level,
    total_experience_months, expected_salary_min, expected_salary_max,
    available_from, open_to_relocation, profile_completion
  ) values (
    actor, nullif(trim(p_headline), ''), nullif(trim(p_bio), ''),
    nullif(trim(p_city), ''), nullif(trim(p_state), ''), p_experience_level,
    p_total_experience_months, p_expected_salary_min, p_expected_salary_max,
    p_available_from, p_open_to_relocation, 70
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
    profile_completion = greatest(public.job_seeker_profiles.profile_completion, 70),
    updated_at = now()
  returning id into candidate_uuid;

  delete from public.job_candidate_preferred_roles where candidate_id = candidate_uuid;
  foreach item in array coalesce(p_preferred_roles, '{}') loop
    if nullif(trim(item), '') is not null then
      insert into public.job_candidate_preferred_roles(candidate_id, role_name)
      values (candidate_uuid, trim(item)) on conflict do nothing;
    end if;
  end loop;

  delete from public.job_candidate_employment_types where candidate_id = candidate_uuid;
  foreach item in array coalesce(p_employment_types, '{}') loop
    if item in ('full_time', 'part_time', 'internship', 'freelance', 'contract') then
      insert into public.job_candidate_employment_types(candidate_id, employment_type)
      values (candidate_uuid, item) on conflict do nothing;
    end if;
  end loop;

  insert into public.job_candidate_preferences(
    candidate_id, preferred_city, preferred_state, salary_min,
    salary_max, available_from, open_to_relocation
  ) values (
    candidate_uuid, p_city, p_state, p_expected_salary_min,
    p_expected_salary_max, p_available_from, p_open_to_relocation
  ) on conflict (candidate_id) do update set
    preferred_city = excluded.preferred_city,
    preferred_state = excluded.preferred_state,
    salary_min = excluded.salary_min,
    salary_max = excluded.salary_max,
    available_from = excluded.available_from,
    open_to_relocation = excluded.open_to_relocation,
    updated_at = now();

  update public.job_user_roles
  set onboarding_completed = true, updated_at = now()
  where user_id = actor;

  return candidate_uuid;
end;
$$;

create or replace function public.complete_job_employer_onboarding(
  p_business_name text,
  p_contact_name text,
  p_address text,
  p_city text,
  p_state text,
  p_postal_code text default null,
  p_business_type text default 'salon',
  p_website_url text default null,
  p_instagram_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.job_assert_authenticated();
  organization_uuid uuid;
  salon_uuid uuid;
  salon_slug text;
begin
  perform public.job_register_role('employer');
  if nullif(trim(p_business_name), '') is null or nullif(trim(p_address), '') is null
     or nullif(trim(p_city), '') is null or nullif(trim(p_state), '') is null then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select m.salon_id into salon_uuid
  from public.job_salon_members m
  where m.user_id = actor and m.member_role = 'owner' and m.status = 'active'
  order by m.created_at limit 1;

  if salon_uuid is null then
    insert into public.organizations(display_name, legal_name, business_category, status, created_by)
    values (trim(p_business_name), trim(p_business_name), p_business_type, 'active', actor)
    returning id into organization_uuid;

    insert into public.organization_members(organization_id, user_id, role, status, joined_at)
    values (organization_uuid, actor, 'owner', 'active', now())
    on conflict (organization_id, user_id) do update
      set role = 'owner', status = 'active', joined_at = coalesce(public.organization_members.joined_at, now());

    salon_slug := trim(both '-' from regexp_replace(lower(trim(p_business_name)), '[^a-z0-9]+', '-', 'g'))
      || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

    insert into public.salons(
      organization_id, slug, name, description, business_category,
      address, city, state, pincode, logo_path, verified, is_active
    ) values (
      organization_uuid, salon_slug, trim(p_business_name), null,
      p_business_type, trim(p_address), trim(p_city), trim(p_state),
      nullif(trim(p_postal_code), ''), null, false, true
    ) returning id into salon_uuid;

    insert into public.job_salon_members(salon_id, user_id, member_role, status)
    values (salon_uuid, actor, 'owner', 'active');
  end if;

  insert into public.job_employer_profiles(user_id, display_name, job_title)
  values (actor, coalesce(nullif(trim(p_contact_name), ''), trim(p_business_name)), 'Owner')
  on conflict (user_id) do update set
    display_name = excluded.display_name, updated_at = now();

  insert into public.job_salon_profiles(
    salon_id, owner_user_id, website_url, instagram_url, business_type
  ) values (
    salon_uuid, actor, nullif(trim(p_website_url), ''),
    nullif(trim(p_instagram_url), ''), p_business_type
  ) on conflict (salon_id) do update set
    website_url = excluded.website_url,
    instagram_url = excluded.instagram_url,
    business_type = excluded.business_type,
    updated_at = now();

  insert into public.job_salon_locations(
    salon_id, label, address_line1, city, state, postal_code, is_primary
  ) values (
    salon_uuid, 'Primary', trim(p_address), trim(p_city), trim(p_state),
    nullif(trim(p_postal_code), ''), true
  ) on conflict do nothing;

  update public.job_user_roles
  set onboarding_completed = true, updated_at = now()
  where user_id = actor;

  return salon_uuid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Common triggers and guards
-- ---------------------------------------------------------------------------

create or replace function public.job_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'job_user_roles', 'job_seeker_profiles', 'job_candidate_experience',
    'job_candidate_education', 'job_candidate_certifications',
    'job_candidate_preferences', 'job_employer_profiles', 'job_salon_members',
    'job_salon_profiles', 'job_salon_locations', 'job_employer_verifications',
    'job_posts', 'job_applications', 'job_interview_requests', 'job_offers',
    'job_saved_searches', 'job_conversations', 'job_portfolio_items',
    'job_support_tickets'
  ] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function public.job_set_updated_at()',
      table_name, table_name
    );
  end loop;
end $$;

create or replace function public.job_guard_role_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role is distinct from new.role
     or old.account_status is distinct from new.account_status then
    if coalesce(current_setting('app.job_trusted_role_change', true), '') <> 'yes'
       and not public.job_is_admin() then
      raise exception using errcode = '42501', message = 'ROLE_NOT_ALLOWED';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists job_user_roles_guard on public.job_user_roles;
create trigger job_user_roles_guard
before update on public.job_user_roles
for each row execute function public.job_guard_role_fields();

create or replace function public.job_guard_post_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status
     and coalesce(current_setting('app.job_trusted_status_change', true), '') <> 'yes'
     and not public.job_is_admin() then
    raise exception using errcode = '42501', message = 'USE_JOB_STATUS_ACTION';
  end if;
  return new;
end;
$$;
drop trigger if exists job_posts_guard_status on public.job_posts;
create trigger job_posts_guard_status
before update of status on public.job_posts
for each row execute function public.job_guard_post_status();

create or replace function public.job_validate_application_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = new.status then return new; end if;
  if not (
    (old.status = 'submitted' and new.status in ('viewed', 'rejected', 'withdrawn', 'position_closed')) or
    (old.status = 'viewed' and new.status in ('shortlisted', 'rejected', 'withdrawn', 'position_closed')) or
    (old.status = 'shortlisted' and new.status in ('interview_requested', 'rejected', 'withdrawn', 'position_closed')) or
    (old.status = 'interview_requested' and new.status in ('interview_confirmed', 'shortlisted', 'rejected', 'withdrawn', 'position_closed')) or
    (old.status = 'interview_confirmed' and new.status in ('interview_completed', 'shortlisted', 'rejected', 'position_closed')) or
    (old.status = 'interview_completed' and new.status in ('offer_sent', 'rejected', 'position_closed')) or
    (old.status = 'offer_sent' and new.status in ('offer_accepted', 'interview_completed', 'rejected', 'position_closed')) or
    (old.status = 'offer_accepted' and new.status in ('hired', 'position_closed'))
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_APPLICATION_TRANSITION';
  end if;
  return new;
end;
$$;
drop trigger if exists job_applications_validate_transition on public.job_applications;
create trigger job_applications_validate_transition
before update of status on public.job_applications
for each row execute function public.job_validate_application_transition();

create or replace function public.job_record_application_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.job_application_status_history(application_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, (select auth.uid()));
  elsif old.status is distinct from new.status then
    insert into public.job_application_status_history(
      application_id, from_status, to_status, changed_by, reason
    ) values (
      new.id, old.status, new.status, (select auth.uid()),
      nullif(current_setting('app.job_transition_reason', true), '')
    );
  end if;
  return new;
end;
$$;
drop trigger if exists job_applications_record_history on public.job_applications;
create trigger job_applications_record_history
after insert or update of status on public.job_applications
for each row execute function public.job_record_application_history();

create or replace function public.job_sync_message_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.job_conversations c
  set last_message = case when char_length(trim(new.body)) > 0 then left(new.body, 500) else 'Sent an attachment' end,
      last_message_at = new.created_at,
      candidate_unread_count = c.candidate_unread_count + case when new.sender_user_id = c.employer_user_id then 1 else 0 end,
      employer_unread_count = c.employer_unread_count + case when new.sender_user_id = c.candidate_user_id then 1 else 0 end,
      updated_at = now()
  where c.id = new.conversation_id;
  return new;
end;
$$;
drop trigger if exists job_messages_sync_conversation on public.job_messages;
create trigger job_messages_sync_conversation
after insert on public.job_messages
for each row execute function public.job_sync_message_conversation();

-- ---------------------------------------------------------------------------
-- Job lifecycle
-- ---------------------------------------------------------------------------

create or replace function public.create_job_post(
  p_salon_id uuid,
  p_location_id uuid,
  p_title text,
  p_category text,
  p_description text,
  p_employment_type text,
  p_workplace_type text default 'on_site',
  p_experience_min_months integer default 0,
  p_experience_max_months integer default null,
  p_freshers_allowed boolean default false,
  p_salary_min numeric default null,
  p_salary_max numeric default null,
  p_pay_type text default 'monthly',
  p_benefits text default null,
  p_working_days text default null,
  p_working_hours text default null,
  p_openings integer default 1,
  p_tags text[] default '{}',
  p_image_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.job_assert_authenticated();
  post_uuid uuid;
begin
  if public.job_current_role() <> 'employer' or not public.job_is_active_salon_member(p_salon_id) then
    raise exception using errcode = '42501', message = 'SALON_ACCESS_DENIED';
  end if;
  if p_location_id is not null and not exists (
    select 1 from public.job_salon_locations where id = p_location_id and salon_id = p_salon_id
  ) then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  insert into public.job_posts(
    salon_id, location_id, created_by, title, category, description,
    employment_type, workplace_type, experience_min_months,
    experience_max_months, freshers_allowed, salary_min, salary_max,
    pay_type, benefits, working_days, working_hours, openings, tags, image_path
  ) values (
    p_salon_id, p_location_id, actor, trim(p_title), nullif(trim(p_category), ''),
    trim(p_description), p_employment_type, p_workplace_type,
    p_experience_min_months, p_experience_max_months, p_freshers_allowed,
    p_salary_min, p_salary_max, p_pay_type, p_benefits, p_working_days,
    p_working_hours, p_openings, coalesce(p_tags, '{}'), p_image_path
  ) returning id into post_uuid;

  insert into public.job_audit_log(actor_user_id, action, entity_type, entity_id, salon_id)
  values (actor, 'job_created', 'job', post_uuid, p_salon_id);
  return post_uuid;
end;
$$;

create or replace function public.job_create_match_notifications(target_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.job_notifications(user_id, type, title, body, entity_type, entity_id, metadata)
  select s.user_id, 'job_match', 'New job matching ' || s.name,
         j.title || ' at ' || salon.name, 'job', j.id,
         jsonb_build_object('saved_search_id', s.id, 'salon_id', j.salon_id)
  from public.job_saved_searches s
  join public.job_user_roles r on r.user_id = s.user_id
  join public.job_posts j on j.id = target_job_id
  join public.salons salon on salon.id = j.salon_id
  left join public.job_salon_locations loc on loc.id = j.location_id
  where s.notify_in_app = true
    and r.role = 'job_seeker' and r.account_status = 'active'
    and (s.category is null or s.category = j.category)
    and (s.employment_type is null or s.employment_type = j.employment_type)
    and (s.salary_min is null or coalesce(j.salary_max, j.salary_min, 0) >= s.salary_min)
    and (s.city is null or lower(s.city) = lower(coalesce(loc.city, salon.city)))
    and (
      s.search_query is null or trim(s.search_query) = '' or
      to_tsvector('english', coalesce(j.title, '') || ' ' || coalesce(j.description, ''))
      @@ plainto_tsquery('english', s.search_query)
    )
    and (
      s.skill_id is null or exists (
        select 1 from public.job_post_skills js
        where js.job_id = j.id and js.skill_id = s.skill_id
      )
    )
    and not exists (
      select 1 from public.job_notifications n
      where n.user_id = s.user_id and n.type = 'job_match'
        and n.entity_type = 'job' and n.entity_id = j.id
        and n.metadata ->> 'saved_search_id' = s.id::text
    );
end;
$$;

create or replace function public.publish_job(target_job_id uuid)
returns public.job_posts
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.job_assert_authenticated();
  post public.job_posts;
begin
  select * into post from public.job_posts where id = target_job_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'JOB_NOT_FOUND'; end if;
  if not public.job_is_active_salon_member(post.salon_id) then
    raise exception using errcode = '42501', message = 'SALON_ACCESS_DENIED';
  end if;
  if post.status not in ('draft', 'paused') then
    raise exception using errcode = 'P0001', message = 'INVALID_JOB_TRANSITION';
  end if;
  if char_length(trim(post.description)) < 20 or post.openings <= 0
     or (post.workplace_type <> 'remote' and post.location_id is null) then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;
  if not exists (
    select 1 from public.salons s
    join public.job_salon_profiles sp on sp.salon_id = s.id
    where s.id = post.salon_id and s.is_active = true
      and s.deleted_at is null and sp.jobs_enabled = true
  ) then
    raise exception using errcode = '42501', message = 'SALON_ACCESS_DENIED';
  end if;

  perform set_config('app.job_trusted_status_change', 'yes', true);
  update public.job_posts set status = 'published', published_at = coalesce(published_at, now())
  where id = target_job_id returning * into post;

  perform public.job_create_match_notifications(target_job_id);
  insert into public.job_audit_log(actor_user_id, action, entity_type, entity_id, salon_id)
  values (actor, 'job_published', 'job', post.id, post.salon_id);
  return post;
end;
$$;

create or replace function public.pause_job(target_job_id uuid)
returns public.job_posts language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.job_assert_authenticated(); post public.job_posts;
begin
  select * into post from public.job_posts where id = target_job_id for update;
  if not found then raise exception using errcode='P0002', message='JOB_NOT_FOUND'; end if;
  if not public.job_is_active_salon_member(post.salon_id) or post.status <> 'published' then
    raise exception using errcode='42501', message='SALON_ACCESS_DENIED';
  end if;
  perform set_config('app.job_trusted_status_change','yes',true);
  update public.job_posts set status='paused' where id=target_job_id returning * into post;
  insert into public.job_audit_log(actor_user_id,action,entity_type,entity_id,salon_id)
  values(actor,'job_paused','job',post.id,post.salon_id);
  return post;
end $$;

create or replace function public.resume_job(target_job_id uuid)
returns public.job_posts language plpgsql security definer set search_path = '' as $$
begin
  return public.publish_job(target_job_id);
end $$;

create or replace function public.close_job(target_job_id uuid)
returns public.job_posts language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.job_assert_authenticated(); post public.job_posts;
begin
  select * into post from public.job_posts where id=target_job_id for update;
  if not found then raise exception using errcode='P0002', message='JOB_NOT_FOUND'; end if;
  if not public.job_is_active_salon_member(post.salon_id) then
    raise exception using errcode='42501', message='SALON_ACCESS_DENIED';
  end if;
  perform set_config('app.job_trusted_status_change','yes',true);
  update public.job_posts set status='closed' where id=target_job_id returning * into post;
  perform set_config('app.job_transition_reason','Position closed',true);
  update public.job_applications set status='position_closed'
  where job_id=target_job_id and status not in ('hired','rejected','withdrawn','position_closed');
  insert into public.job_audit_log(actor_user_id,action,entity_type,entity_id,salon_id)
  values(actor,'job_closed','job',post.id,post.salon_id);
  return post;
end $$;

-- ---------------------------------------------------------------------------
-- Application lifecycle
-- ---------------------------------------------------------------------------

create or replace function public.submit_job_application(
  target_job_id uuid,
  p_resume_id uuid default null,
  p_cover_note text default null,
  p_expected_salary numeric default null,
  p_available_from date default null
)
returns public.job_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.job_assert_authenticated();
  candidate public.job_seeker_profiles;
  post public.job_posts;
  application public.job_applications;
begin
  if public.job_current_role() <> 'job_seeker' then
    raise exception using errcode='42501', message='ROLE_NOT_ALLOWED';
  end if;
  select * into candidate from public.job_seeker_profiles where user_id=actor;
  if not found or candidate.profile_completion < 50 then
    raise exception using errcode='P0001', message='PROFILE_INCOMPLETE';
  end if;
  select * into post from public.job_posts where id=target_job_id for share;
  if not found then raise exception using errcode='P0002', message='JOB_NOT_FOUND'; end if;
  if post.status <> 'published' then raise exception using errcode='P0001', message='JOB_NOT_PUBLISHED'; end if;
  if post.expires_at is not null and post.expires_at <= now() then
    raise exception using errcode='P0001', message='JOB_EXPIRED';
  end if;
  if exists (select 1 from public.job_blocked_employers where candidate_user_id=actor and salon_id=post.salon_id) then
    raise exception using errcode='42501', message='SALON_ACCESS_DENIED';
  end if;
  if p_resume_id is not null and not exists (
    select 1 from public.job_candidate_resumes r
    where r.id=p_resume_id and r.candidate_id=candidate.id
  ) then
    raise exception using errcode='42501', message='FOREIGN_RESUME';
  end if;

  insert into public.job_applications(
    job_id,candidate_user_id,candidate_profile_id,resume_id,cover_note,expected_salary,available_from
  ) values (
    post.id,actor,candidate.id,p_resume_id,nullif(trim(p_cover_note),''),p_expected_salary,p_available_from
  ) returning * into application;

  insert into public.job_notifications(user_id,type,title,body,entity_type,entity_id)
  select distinct m.user_id,'application_submitted','New job application',
         'A candidate applied for '||post.title,'application',application.id
  from public.job_salon_members m
  where m.salon_id=post.salon_id and m.status='active';
  return application;
exception when unique_violation then
  raise exception using errcode='23505', message='APPLICATION_ALREADY_EXISTS';
end;
$$;

create or replace function public.mark_application_viewed(target_application_id uuid)
returns public.job_applications language plpgsql security definer set search_path = '' as $$
declare actor uuid:=public.job_assert_authenticated(); app public.job_applications;
begin
  if not public.job_can_manage_application(target_application_id) then
    raise exception using errcode='42501', message='SALON_ACCESS_DENIED'; end if;
  perform set_config('app.job_transition_reason','Employer viewed application',true);
  update public.job_applications set status='viewed' where id=target_application_id and status='submitted' returning * into app;
  if not found then select * into app from public.job_applications where id=target_application_id; end if;
  insert into public.job_notifications(user_id,type,title,body,entity_type,entity_id)
  values(app.candidate_user_id,'application_viewed','Application viewed','An employer viewed your application.','application',app.id);
  return app;
end $$;

create or replace function public.shortlist_application(target_application_id uuid)
returns public.job_applications language plpgsql security definer set search_path = '' as $$
declare actor uuid:=public.job_assert_authenticated(); app public.job_applications; salon_uuid uuid;
begin
  if not public.job_can_manage_application(target_application_id) then
    raise exception using errcode='42501', message='SALON_ACCESS_DENIED'; end if;
  select a.* into app from public.job_applications a where a.id=target_application_id for update;
  select j.salon_id into salon_uuid from public.job_posts j where j.id=app.job_id;
  if app.status='submitted' then
    perform set_config('app.job_transition_reason','Employer reviewed application',true);
    update public.job_applications set status='viewed' where id=app.id;
  end if;
  perform set_config('app.job_transition_reason','Candidate shortlisted',true);
  update public.job_applications set status='shortlisted' where id=app.id returning * into app;
  insert into public.job_notifications(user_id,type,title,body,entity_type,entity_id)
  values(app.candidate_user_id,'application_shortlisted','You were shortlisted','Your application has been shortlisted.','application',app.id);
  insert into public.job_audit_log(actor_user_id,action,entity_type,entity_id,salon_id)
  values(actor,'candidate_shortlisted','application',app.id,salon_uuid);
  return app;
end $$;

create or replace function public.reject_application(target_application_id uuid, p_reason text default null)
returns public.job_applications language plpgsql security definer set search_path = '' as $$
declare actor uuid:=public.job_assert_authenticated(); app public.job_applications; salon_uuid uuid;
begin
  if not public.job_can_manage_application(target_application_id) then
    raise exception using errcode='42501', message='SALON_ACCESS_DENIED'; end if;
  perform set_config('app.job_transition_reason',coalesce(nullif(trim(p_reason),''),'Rejected by employer'),true);
  update public.job_applications a set status='rejected'
  where a.id=target_application_id
    and a.status not in ('rejected','withdrawn','hired','position_closed')
  returning a.* into app;
  if not found then raise exception using errcode='P0001', message='INVALID_APPLICATION_TRANSITION'; end if;
  select j.salon_id into salon_uuid from public.job_posts j where j.id=app.job_id;
  insert into public.job_notifications(user_id,type,title,body,entity_type,entity_id)
  values(app.candidate_user_id,'application_rejected','Application update','Your application was not selected.','application',app.id);
  insert into public.job_audit_log(actor_user_id,action,entity_type,entity_id,salon_id,metadata)
  values(actor,'candidate_rejected','application',app.id,salon_uuid,jsonb_build_object('reason',p_reason));
  return app;
end $$;

create or replace function public.withdraw_application(target_application_id uuid, p_reason text default null)
returns public.job_applications language plpgsql security definer set search_path = '' as $$
declare actor uuid:=public.job_assert_authenticated(); app public.job_applications;
begin
  perform set_config('app.job_transition_reason',coalesce(nullif(trim(p_reason),''),'Withdrawn by candidate'),true);
  update public.job_applications set status='withdrawn'
  where id=target_application_id and candidate_user_id=actor
    and status not in ('hired','rejected','withdrawn','position_closed','offer_accepted')
  returning * into app;
  if not found then raise exception using errcode='42501', message='INVALID_APPLICATION_TRANSITION'; end if;
  insert into public.job_notifications(user_id,type,title,body,entity_type,entity_id)
  select distinct m.user_id,'application_withdrawn','Application withdrawn',
         'A candidate withdrew an application.','application',app.id
  from public.job_posts j join public.job_salon_members m on m.salon_id=j.salon_id
  where j.id=app.job_id and m.status='active';
  return app;
end $$;

-- ---------------------------------------------------------------------------
-- Interview lifecycle
-- ---------------------------------------------------------------------------

create or replace function public.create_interview_request(
  target_application_id uuid,
  p_interview_type text,
  p_scheduled_start timestamptz,
  p_duration_minutes integer default 30,
  p_location_text text default null,
  p_meeting_url text default null,
  p_employer_message text default null
)
returns public.job_interview_requests
language plpgsql security definer set search_path = '' as $$
declare actor uuid:=public.job_assert_authenticated(); app public.job_applications; post public.job_posts; interview public.job_interview_requests;
begin
  if not public.job_can_manage_application(target_application_id) then
    raise exception using errcode='42501', message='SALON_ACCESS_DENIED'; end if;
  if p_scheduled_start <= now()+interval '15 minutes' then
    raise exception using errcode='22023', message='VALIDATION_ERROR'; end if;
  select * into app from public.job_applications where id=target_application_id for update;
  select * into post from public.job_posts where id=app.job_id;
  if app.status <> 'shortlisted' then raise exception using errcode='P0001', message='INVALID_APPLICATION_TRANSITION'; end if;
  insert into public.job_interview_requests(
    application_id,salon_id,candidate_user_id,created_by,interview_type,scheduled_start,
    duration_minutes,location_text,meeting_url,employer_message
  ) values (
    app.id,post.salon_id,app.candidate_user_id,actor,p_interview_type,p_scheduled_start,
    p_duration_minutes,p_location_text,p_meeting_url,p_employer_message
  ) returning * into interview;
  perform set_config('app.job_transition_reason','Interview requested',true);
  update public.job_applications set status='interview_requested' where id=app.id;
  insert into public.job_notifications(user_id,type,title,body,entity_type,entity_id)
  values(app.candidate_user_id,'interview_requested','Interview request','An employer invited you to an interview.','interview',interview.id);
  insert into public.job_audit_log(actor_user_id,action,entity_type,entity_id,salon_id)
  values(actor,'interview_requested','interview',interview.id,post.salon_id);
  return interview;
end $$;

create or replace function public.accept_interview(target_interview_id uuid)
returns public.job_interview_requests language plpgsql security definer set search_path = '' as $$
declare actor uuid:=public.job_assert_authenticated(); interview public.job_interview_requests; app public.job_applications;
begin
  update public.job_interview_requests set status='confirmed'
  where id=target_interview_id and candidate_user_id=actor and status in ('requested','rescheduled')
  returning * into interview;
  if not found then raise exception using errcode='42501', message='INVALID_INTERVIEW_TRANSITION'; end if;
  perform set_config('app.job_transition_reason','Candidate confirmed interview',true);
  update public.job_applications set status='interview_confirmed' where id=interview.application_id returning * into app;
  insert into public.job_notifications(user_id,type,title,body,entity_type,entity_id)
  select distinct m.user_id,'interview_confirmed','Interview confirmed','The candidate confirmed the interview.','interview',interview.id
  from public.job_salon_members m where m.salon_id=interview.salon_id and m.status='active';
  return interview;
end $$;

create or replace function public.request_interview_reschedule(target_interview_id uuid, p_reason text)
returns public.job_interview_requests language plpgsql security definer set search_path = '' as $$
declare actor uuid:=public.job_assert_authenticated(); interview public.job_interview_requests;
begin
  update public.job_interview_requests set status='reschedule_requested',candidate_message=nullif(trim(p_reason),'')
  where id=target_interview_id and candidate_user_id=actor and status in ('requested','confirmed','rescheduled')
  returning * into interview;
  if not found then raise exception using errcode='42501', message='INVALID_INTERVIEW_TRANSITION'; end if;
  insert into public.job_notifications(user_id,type,title,body,entity_type,entity_id)
  select distinct m.user_id,'interview_reschedule_requested','Reschedule requested','The candidate requested a new interview time.','interview',interview.id
  from public.job_salon_members m where m.salon_id=interview.salon_id and m.status='active';
  return interview;
end $$;

create or replace function public.reschedule_interview(target_interview_id uuid, p_new_start timestamptz, p_reason text default null)
returns public.job_interview_requests language plpgsql security definer set search_path = '' as $$
declare actor uuid:=public.job_assert_authenticated(); interview public.job_interview_requests; previous timestamptz;
begin
  select * into interview from public.job_interview_requests where id=target_interview_id for update;
  if not found or not public.job_is_active_salon_member(interview.salon_id) or interview.status not in ('requested','confirmed','reschedule_requested') then
    raise exception using errcode='42501', message='INVALID_INTERVIEW_TRANSITION'; end if;
  if p_new_start<=now()+interval '15 minutes' then raise exception using errcode='22023',message='VALIDATION_ERROR'; end if;
  previous:=interview.scheduled_start;
  update public.job_interview_requests set scheduled_start=p_new_start,status='rescheduled' where id=interview.id returning * into interview;
  insert into public.job_interview_schedule_history(interview_id,previous_start,new_start,changed_by,reason)
  values(interview.id,previous,p_new_start,actor,p_reason);
  insert into public.job_notifications(user_id,type,title,body,entity_type,entity_id)
  values(interview.candidate_user_id,'interview_rescheduled','Interview rescheduled','Your interview time was updated.','interview',interview.id);
  return interview;
end $$;

create or replace function public.decline_interview(target_interview_id uuid, p_reason text default null)
returns public.job_interview_requests language plpgsql security definer set search_path = '' as $$
declare actor uuid:=public.job_assert_authenticated(); interview public.job_interview_requests;
begin
  update public.job_interview_requests set status='declined',candidate_message=nullif(trim(p_reason),'')
  where id=target_interview_id and candidate_user_id=actor and status in ('requested','confirmed','rescheduled') returning * into interview;
  if not found then raise exception using errcode='42501',message='INVALID_INTERVIEW_TRANSITION'; end if;
  perform set_config('app.job_transition_reason','Interview declined; returned to shortlist',true);
  update public.job_applications set status='shortlisted' where id=interview.application_id;
  insert into public.job_notifications(user_id,type,title,body,entity_type,entity_id)
  select distinct m.user_id,'interview_cancelled','Interview declined','The candidate declined the interview.','interview',interview.id
  from public.job_salon_members m where m.salon_id=interview.salon_id and m.status='active';
  return interview;
end $$;

create or replace function public.complete_interview(target_interview_id uuid)
returns public.job_interview_requests language plpgsql security definer set search_path = '' as $$
declare actor uuid:=public.job_assert_authenticated(); interview public.job_interview_requests;
begin
  select * into interview from public.job_interview_requests where id=target_interview_id for update;
  if not found or not public.job_is_active_salon_member(interview.salon_id) or interview.status<>'confirmed' then
    raise exception using errcode='42501',message='INVALID_INTERVIEW_TRANSITION'; end if;
  update public.job_interview_requests set status='completed' where id=interview.id returning * into interview;
  perform set_config('app.job_transition_reason','Interview completed',true);
  update public.job_applications set status='interview_completed' where id=interview.application_id;
  return interview;
end $$;

-- ---------------------------------------------------------------------------
-- Offer and hire lifecycle
-- ---------------------------------------------------------------------------

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
declare actor uuid:=public.job_assert_authenticated(); app public.job_applications; post public.job_posts; offer public.job_offers;
begin
  if not public.job_can_manage_application(target_application_id) then raise exception using errcode='42501',message='SALON_ACCESS_DENIED'; end if;
  select * into app from public.job_applications where id=target_application_id for update;
  select * into post from public.job_posts where id=app.job_id;
  if app.status<>'interview_completed' then raise exception using errcode='P0001',message='INVALID_APPLICATION_TRANSITION'; end if;
  if p_joining_date<current_date or (p_expires_at is not null and p_expires_at<=now()) then raise exception using errcode='22023',message='VALIDATION_ERROR'; end if;
  insert into public.job_offers(application_id,salon_id,candidate_user_id,created_by,job_role,salary,employment_type,joining_date,offer_notes,offer_document_path,expires_at)
  values(app.id,post.salon_id,app.candidate_user_id,actor,trim(p_job_role),p_salary,p_employment_type,p_joining_date,p_offer_notes,p_offer_document_path,p_expires_at)
  returning * into offer;
  perform set_config('app.job_transition_reason','Job offer sent',true);
  update public.job_applications set status='offer_sent' where id=app.id;
  insert into public.job_notifications(user_id,type,title,body,entity_type,entity_id)
  values(app.candidate_user_id,'offer_received','Job offer received','You received a job offer.','offer',offer.id);
  insert into public.job_audit_log(actor_user_id,action,entity_type,entity_id,salon_id)
  values(actor,'offer_sent','offer',offer.id,post.salon_id);
  return offer;
end $$;

create or replace function public.accept_job_offer(target_offer_id uuid)
returns public.job_offers language plpgsql security definer set search_path = '' as $$
declare actor uuid:=public.job_assert_authenticated(); offer public.job_offers;
begin
  update public.job_offers set status='accepted',responded_at=now()
  where id=target_offer_id and candidate_user_id=actor and status='sent' and (expires_at is null or expires_at>now()) returning * into offer;
  if not found then raise exception using errcode='42501',message='OFFER_EXPIRED'; end if;
  perform set_config('app.job_transition_reason','Candidate accepted offer',true);
  update public.job_applications set status='offer_accepted' where id=offer.application_id;
  insert into public.job_notifications(user_id,type,title,body,entity_type,entity_id)
  select distinct m.user_id,'offer_accepted','Offer accepted','The candidate accepted the job offer.','offer',offer.id
  from public.job_salon_members m where m.salon_id=offer.salon_id and m.status='active';
  return offer;
end $$;

create or replace function public.decline_job_offer(target_offer_id uuid)
returns public.job_offers language plpgsql security definer set search_path = '' as $$
declare actor uuid:=public.job_assert_authenticated(); offer public.job_offers;
begin
  update public.job_offers set status='declined',responded_at=now()
  where id=target_offer_id and candidate_user_id=actor and status='sent' returning * into offer;
  if not found then raise exception using errcode='42501',message='INVALID_OFFER_TRANSITION'; end if;
  insert into public.job_notifications(user_id,type,title,body,entity_type,entity_id)
  select distinct m.user_id,'offer_declined','Offer declined','The candidate declined the job offer.','offer',offer.id
  from public.job_salon_members m where m.salon_id=offer.salon_id and m.status='active';
  return offer;
end $$;

create or replace function public.withdraw_job_offer(target_offer_id uuid, p_reason text default null)
returns public.job_offers language plpgsql security definer set search_path = '' as $$
declare actor uuid:=public.job_assert_authenticated(); offer public.job_offers;
begin
  select * into offer from public.job_offers where id=target_offer_id for update;
  if not found or not public.job_is_active_salon_member(offer.salon_id) or offer.status<>'sent' then raise exception using errcode='42501',message='INVALID_OFFER_TRANSITION'; end if;
  update public.job_offers set status='withdrawn',responded_at=now() where id=offer.id returning * into offer;
  perform set_config('app.job_transition_reason','Offer withdrawn by employer',true);
  update public.job_applications set status='interview_completed' where id=offer.application_id;
  insert into public.job_notifications(user_id,type,title,body,entity_type,entity_id,metadata)
  values(offer.candidate_user_id,'system','Offer withdrawn','The employer withdrew the job offer.','offer',offer.id,jsonb_build_object('reason',p_reason));
  return offer;
end $$;

create or replace function public.mark_candidate_hired(target_application_id uuid)
returns public.job_applications language plpgsql security definer set search_path = '' as $$
declare actor uuid:=public.job_assert_authenticated(); app public.job_applications; salon_uuid uuid;
begin
  if not public.job_can_manage_application(target_application_id) then raise exception using errcode='42501',message='SALON_ACCESS_DENIED'; end if;
  select a.* into app from public.job_applications a where a.id=target_application_id for update;
  select j.salon_id into salon_uuid from public.job_posts j where j.id=app.job_id;
  if app.status<>'offer_accepted' then raise exception using errcode='P0001',message='INVALID_APPLICATION_TRANSITION'; end if;
  perform set_config('app.job_transition_reason','Candidate marked hired',true);
  update public.job_applications set status='hired' where id=app.id returning * into app;
  insert into public.job_notifications(user_id,type,title,body,entity_type,entity_id)
  values(app.candidate_user_id,'candidate_hired','You are hired','The employer marked your application as hired.','application',app.id);
  insert into public.job_audit_log(actor_user_id,action,entity_type,entity_id,salon_id)
  values(actor,'candidate_hired','application',app.id,salon_uuid);
  return app;
end $$;

-- ---------------------------------------------------------------------------
-- Verification, support, reporting and account safety
-- ---------------------------------------------------------------------------

create or replace function public.submit_employer_verification(
  target_salon_id uuid,
  p_business_proof_path text,
  p_identity_proof_path text,
  p_salon_proof_path text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid:=public.job_assert_authenticated(); verification_uuid uuid;
begin
  if not public.job_is_active_salon_member(target_salon_id) then raise exception using errcode='42501',message='SALON_ACCESS_DENIED'; end if;
  if p_business_proof_path is null or p_identity_proof_path is null then raise exception using errcode='22023',message='VALIDATION_ERROR'; end if;
  insert into public.job_employer_verifications(salon_id,submitted_by,business_proof_path,identity_proof_path,salon_proof_path)
  values(target_salon_id,actor,p_business_proof_path,p_identity_proof_path,p_salon_proof_path)
  returning id into verification_uuid;
  update public.job_salon_profiles set verification_status='pending' where salon_id=target_salon_id;
  return verification_uuid;
end $$;

create or replace function public.review_employer_verification(target_verification_id uuid, p_status text, p_notes text default null)
returns public.job_employer_verifications language plpgsql security definer set search_path = '' as $$
declare actor uuid:=public.job_assert_authenticated(); verification public.job_employer_verifications;
begin
  if not public.job_is_admin() or p_status not in ('verified','rejected','needs_update') then raise exception using errcode='42501',message='ROLE_NOT_ALLOWED'; end if;
  update public.job_employer_verifications set status=p_status,review_notes=p_notes,reviewed_by=actor,reviewed_at=now()
  where id=target_verification_id and status in ('pending','needs_update') returning * into verification;
  if not found then raise exception using errcode='P0001',message='INVALID_VERIFICATION_TRANSITION'; end if;
  update public.job_salon_profiles set verification_status=p_status where salon_id=verification.salon_id;
  if p_status='verified' then update public.salons set verified=true where id=verification.salon_id; end if;
  insert into public.job_notifications(user_id,type,title,body,entity_type,entity_id)
  values(verification.submitted_by,'employer_verification_update','Verification update','Your employer verification is now '||p_status||'.','verification',verification.id);
  insert into public.job_audit_log(actor_user_id,action,entity_type,entity_id,salon_id,metadata)
  values(actor,'employer_verification_'||p_status,'verification',verification.id,verification.salon_id,jsonb_build_object('notes',p_notes));
  return verification;
end $$;

create or replace function public.create_job_support_ticket(p_issue_type text,p_subject text,p_description text,p_priority text default 'normal')
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid:=public.job_assert_authenticated(); ticket_uuid uuid;
begin
  if char_length(trim(p_subject))<3 or char_length(trim(p_description))<10 then raise exception using errcode='22023',message='VALIDATION_ERROR'; end if;
  insert into public.job_support_tickets(user_id,issue_type,subject,description,priority)
  values(actor,p_issue_type,trim(p_subject),trim(p_description),p_priority) returning id into ticket_uuid;
  return ticket_uuid;
end $$;

create or replace function public.report_job(target_job_id uuid,p_reason text,p_details text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid:=public.job_assert_authenticated(); report_uuid uuid;
begin
  if not exists(select 1 from public.job_posts where id=target_job_id) then raise exception using errcode='P0002',message='JOB_NOT_FOUND'; end if;
  insert into public.job_reports(reporter_user_id,target_type,target_id,reason,details)
  values(actor,'job',target_job_id,trim(p_reason),p_details) returning id into report_uuid;
  return report_uuid;
end $$;

create or replace function public.report_employer(target_salon_id uuid,p_reason text,p_details text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid:=public.job_assert_authenticated(); report_uuid uuid;
begin
  if not exists(select 1 from public.salons where id=target_salon_id) then raise exception using errcode='P0002',message='SALON_NOT_FOUND'; end if;
  insert into public.job_reports(reporter_user_id,target_type,target_id,reason,details)
  values(actor,'employer',target_salon_id,trim(p_reason),p_details) returning id into report_uuid;
  return report_uuid;
end $$;

create or replace function public.request_job_account_deletion(p_reason text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid:=public.job_assert_authenticated(); request_uuid uuid;
begin
  insert into public.job_account_deletion_requests(user_id,reason)
  values(actor,p_reason) on conflict(user_id,status) do update set reason=excluded.reason,requested_at=now()
  returning id into request_uuid;
  perform set_config('app.job_trusted_role_change','yes',true);
  update public.job_user_roles set account_status='deleted' where user_id=actor;
  update public.job_seeker_profiles set profile_visibility='private' where user_id=actor;
  return request_uuid;
end $$;

-- Function execute permissions are explicitly limited in the RLS migration.

commit;

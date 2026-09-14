-- Fix for "Unable to save profile. Please retry." – make profile saves resilient
-- Root causes:
-- 1. job_save_profile did UPDATE only and threw PROFILE_NOT_FOUND if profiles row missing
-- 2. job_seeker_profiles / job_employer_profiles rows might not exist for new accounts
-- 3. job_update_employer_profile threw SALON_ACCESS_DENIED when salon membership missing
-- This migration makes all three RPCs self-healing: they ensure the rows exist.

begin;

-- ---------------------------------------------------------------------------
-- 1. Resilient job_save_profile: ensure profiles row, upsert role rows
-- ---------------------------------------------------------------------------
create or replace function public.job_save_profile(
  p_full_name text,
  p_phone text default null,
  p_avatar_path text default null,
  p_headline text default null,
  p_bio text default null,
  p_display_name text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  actor uuid := public.job_assert_authenticated();
  role text := public.job_current_role();
  ensured_full_name text := trim(coalesce(p_full_name, ''));
begin
  if char_length(ensured_full_name) < 2 then
    raise exception using errcode='P0001', message='VALIDATION_ERROR: Full name must be at least 2 characters';
  end if;

  -- Ensure shared profiles row exists (best-effort, never fails entry)
  perform public.job_ensure_profile_row(actor);

  -- Upsert profiles: if row still missing after ensure, insert it
  insert into public.profiles(id, full_name, phone, avatar_path, is_active)
  values (
    actor,
    ensured_full_name,
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_avatar_path, '')), ''),
    true
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    avatar_path = excluded.avatar_path,
    is_active = true,
    updated_at = now();

  if role = 'job_seeker' then
    -- Upsert seeker profile row if missing (new account that never completed onboarding)
    insert into public.job_seeker_profiles(user_id, headline, bio, profile_completion)
    values (actor, nullif(trim(coalesce(p_headline, '')), ''), nullif(trim(coalesce(p_bio, '')), ''), 0)
    on conflict (user_id) do update set
      headline = coalesce(nullif(trim(coalesce(p_headline, '')), ''), public.job_seeker_profiles.headline),
      bio = coalesce(nullif(trim(coalesce(p_bio, '')), ''), public.job_seeker_profiles.bio),
      updated_at = now();
  elsif role in ('employer', 'admin') then
    insert into public.job_employer_profiles(user_id, display_name)
    values (actor, nullif(trim(coalesce(p_display_name, '')), ''))
    on conflict (user_id) do update set
      display_name = coalesce(nullif(trim(coalesce(p_display_name, '')), ''), public.job_employer_profiles.display_name),
      updated_at = now();
  end if;
end
$fn$;

revoke execute on function public.job_save_profile(text, text, text, text, text, text) from public, anon;
grant execute on function public.job_save_profile(text, text, text, text, text, text) to authenticated;

comment on function public.job_save_profile(text, text, text, text, text, text) is
  'Resilient save: ensures profiles row exists, upserts seeker/employer rows, never throws PROFILE_NOT_FOUND for new accounts';

-- ---------------------------------------------------------------------------
-- 2. Resilient job_update_employer_profile: upsert employer profile, auto-create salon if missing
-- ---------------------------------------------------------------------------
create or replace function public.job_update_employer_profile(
  p_business_name text,
  p_contact_name text,
  p_phone text default null,
  p_avatar_path text default null,
  p_description text default null,
  p_website_url text default null,
  p_instagram_url text default null,
  p_city text default null,
  p_state text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  actor uuid := public.job_assert_authenticated();
  salon_uuid uuid;
  org_uuid uuid;
  ensured_business text := trim(coalesce(p_business_name, ''));
  ensured_contact text := trim(coalesce(p_contact_name, ''));
begin
  if char_length(ensured_business) < 2 then
    raise exception using errcode='P0001', message='VALIDATION_ERROR: Business name must be at least 2 characters';
  end if;
  if char_length(ensured_contact) < 2 then
    raise exception using errcode='P0001', message='VALIDATION_ERROR: Contact name must be at least 2 characters';
  end if;

  -- Ensure shared profiles row
  perform public.job_ensure_profile_row(actor);

  -- Upsert profiles
  insert into public.profiles(id, full_name, phone, avatar_path, is_active)
  values (actor, ensured_contact, nullif(trim(coalesce(p_phone, '')), ''), nullif(trim(coalesce(p_avatar_path, '')), ''), true)
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    avatar_path = excluded.avatar_path,
    is_active = true,
    updated_at = now();

  -- Upsert employer profile
  insert into public.job_employer_profiles(user_id, display_name)
  values (actor, ensured_contact)
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    updated_at = now();

  -- Find existing salon membership
  select m.salon_id into salon_uuid
  from public.job_salon_members m
  where m.user_id = actor and m.status = 'active'
  order by case m.member_role when 'owner' then 0 when 'manager' then 1 else 2 end, m.created_at
  limit 1;

  -- If no salon, create minimal org + salon (self-heal for accounts where onboarding failed)
  if salon_uuid is null then
    insert into public.organizations(display_name, legal_name, business_category, status, created_by)
    values (ensured_business, ensured_business, 'salon', 'active', actor)
    returning id into org_uuid;

    insert into public.organization_members(organization_id, user_id, role, status, joined_at)
    values (org_uuid, actor, 'owner', 'active', now())
    on conflict (organization_id, user_id) do update set role='owner', status='active';

    insert into public.salons(organization_id, slug, name, description, business_category, city, state, is_active)
    values (
      org_uuid,
      trim(both '-' from regexp_replace(lower(ensured_business), '[^a-z0-9]+', '-', 'g')) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
      ensured_business,
      nullif(trim(coalesce(p_description, '')), ''),
      'salon',
      nullif(trim(coalesce(p_city, '')), ''),
      nullif(trim(coalesce(p_state, '')), ''),
      true
    )
    returning id into salon_uuid;

    insert into public.job_salon_members(salon_id, user_id, member_role, status)
    values (salon_uuid, actor, 'owner', 'active');

    insert into public.job_salon_profiles(salon_id, owner_user_id, website_url, instagram_url, business_type)
    values (salon_uuid, actor, nullif(trim(coalesce(p_website_url, '')), ''), nullif(trim(coalesce(p_instagram_url, '')), ''), 'salon')
    on conflict (salon_id) do update set
      website_url = excluded.website_url,
      instagram_url = excluded.instagram_url,
      updated_at = now();

    insert into public.job_salon_locations(salon_id, label, address_line1, city, state, is_primary)
    values (salon_uuid, 'Primary', ensured_business, nullif(trim(coalesce(p_city, '')), ''), nullif(trim(coalesce(p_state, '')), ''), true)
    on conflict do nothing;
  else
    -- Update existing salon if caller is owner/manager
    if exists(select 1 from public.job_salon_members m where m.salon_id=salon_uuid and m.user_id=actor and m.status='active' and m.member_role in ('owner','manager')) or public.job_is_admin() then
      update public.salons set
        name = ensured_business,
        description = coalesce(nullif(trim(coalesce(p_description, '')), ''), description),
        city = coalesce(nullif(trim(coalesce(p_city, '')), ''), city),
        state = coalesce(nullif(trim(coalesce(p_state, '')), ''), state)
      where id = salon_uuid;

      update public.job_salon_profiles set
        website_url = nullif(trim(coalesce(p_website_url, '')), ''),
        instagram_url = nullif(trim(coalesce(p_instagram_url, '')), ''),
        updated_at = now()
      where salon_id = salon_uuid;

      update public.job_salon_locations set
        city = coalesce(nullif(trim(coalesce(p_city, '')), ''), city),
        state = coalesce(nullif(trim(coalesce(p_state, '')), ''), state),
        updated_at = now()
      where salon_id = salon_uuid and is_primary = true;
    end if;
  end if;
end
$fn$;

revoke execute on function public.job_update_employer_profile(text,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.job_update_employer_profile(text,text,text,text,text,text,text,text,text) to authenticated;

comment on function public.job_update_employer_profile(text,text,text,text,text,text,text,text,text) is
  'Resilient employer profile save: ensures profiles row, upserts employer profile, auto-creates salon if missing';

-- ---------------------------------------------------------------------------
-- 3. Also make complete_job_employer_onboarding idempotent for p_business_type
--    (accept our 12 new services, not just old enum)
-- ---------------------------------------------------------------------------
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
as $fn$
declare
  actor uuid := public.job_assert_authenticated();
  organization_uuid uuid;
  salon_uuid uuid;
  salon_slug text;
  safe_business_type text := lower(trim(coalesce(p_business_type, 'salon')));
begin
  perform public.job_register_role('employer');
  if nullif(trim(p_business_name), '') is null or nullif(trim(p_address), '') is null
     or nullif(trim(p_city), '') is null or nullif(trim(p_state), '') is null then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR: Business name, address, city and state are required';
  end if;

  -- Normalize business_type to allowed set, but accept any of our 12 new services
  if safe_business_type not in ('salon','spa','barbershop','nail_studio','aesthetic','hair_cut','barber','unisex','beauty','hair_spa','facial','makeup','massage','hair_coloring','bridal_makeup') then
    safe_business_type := 'salon';
  end if;

  select m.salon_id into salon_uuid
  from public.job_salon_members m
  where m.user_id = actor and m.member_role = 'owner' and m.status = 'active'
  order by m.created_at limit 1;

  if salon_uuid is null then
    insert into public.organizations(display_name, legal_name, business_category, status, created_by)
    values (trim(p_business_name), trim(p_business_name), safe_business_type, 'active', actor)
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
      safe_business_type, trim(p_address), trim(p_city), trim(p_state),
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
    nullif(trim(p_instagram_url), ''), safe_business_type
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
$fn$;

commit;

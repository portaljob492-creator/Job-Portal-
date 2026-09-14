-- Fix for "Unable to save profile. Please retry." — the actual runtime failure.
--
-- 20260914000001 tried to make the profile RPCs resilient but introduced three
-- runtime faults that make the very same save fail again:
--
-- 1. `insert into public.profiles(...) on conflict (id) do update set ...
--     updated_at = now()` — public.profiles is the *marketplace-owned* shared
--    table (see 20260913000600 / 20260913000900: "profiles is marketplace-owned").
--    It has no `updated_at` column, so every call of job_save_profile() and
--    job_update_employer_profile() aborted with
--      ERROR 42703: column "updated_at" of relation "profiles" does not exist
--    That raw SQL text is exactly what `mapBackendError()` collapses into the
--    generic browser alert "Unable to save profile. Please retry." (see
--    `looksLikeRawSql` in src/services/backend.ts). No migration before
--    20260914000001 ever referenced profiles.updated_at — every one writes only
--    (full_name, phone, avatar_path, is_active).
--
-- 2. Both RPCs called public.job_assert_authenticated() *before*
--    public.job_ensure_profile_row(). The guard requires an active profiles row
--    and raises ACCOUNT_INACTIVE otherwise, so the ensure was dead code for
--    exactly the accounts that need it (OAuth signups / accounts created by
--    another Nexora app). 20260913000900 documents this trap explicitly:
--    "the ensure runs BEFORE job_assert_authenticated".
--
-- 3. The employer self-heal path inserted a primary job_salon_locations row with
--    `nullif(trim(p_city),'')` / `nullif(trim(p_state),'')`, but that table
--    declares city and state NOT NULL, so an employer who had not filled in a
--    location got
--      ERROR 23502: null value in column "city" ... violates not-null constraint
--    — another failure that degrades into the same generic alert.
--
-- This migration re-declares both RPCs correctly: they heal a missing profiles
-- row before the guard, never touch marketplace-only columns, and only write
-- location rows the shared schema can actually accept.

begin;

-- ---------------------------------------------------------------------------
-- 1. job_save_profile: heal the shared profiles row first, then save.
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
  actor uuid := (select auth.uid());
  role text;
  ensured_full_name text := trim(coalesce(p_full_name, ''));
begin
  if actor is null then
    raise exception using errcode='28000', message='AUTH_REQUIRED';
  end if;
  if char_length(ensured_full_name) < 2 then
    raise exception using errcode='P0001', message='VALIDATION_ERROR: Full name must be at least 2 characters';
  end if;

  -- The guard below requires an active profiles row, so a missing row must be
  -- healed BEFORE it (20260913000900 documents the same ordering). The ensure
  -- never raises and never reactivates a row, so suspended/deleted accounts are
  -- still rejected by the guard with ACCOUNT_INACTIVE.
  perform public.job_ensure_profile_row(actor);
  actor := public.job_assert_authenticated();
  role := public.job_current_role();

  if role is null then
    perform public.job_register_role(case when p_display_name is not null and p_headline is null then 'employer' else 'job_seeker' end);
    role := public.job_current_role();
  end if;

  -- Shared profiles upsert. Only the marketplace columns every earlier
  -- migration already writes are touched — no updated_at, no platform_role.
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
    is_active = true;

  if role = 'job_seeker' then
    -- Seeker row upsert for accounts that never finished onboarding.
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
  'Atomic profile save: heals a missing shared profiles row, upserts the caller role row, and never writes marketplace-only columns (no profiles.updated_at).';

-- ---------------------------------------------------------------------------
-- 2. job_update_employer_profile: same corrections, plus a NOT NULL-safe
--    salon / brand / location self-heal.
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
  actor uuid := (select auth.uid());
  salon_uuid uuid;
  org_uuid uuid;
  existing_owner uuid;
  ensured_role text;
  ensured_business text := trim(coalesce(p_business_name, ''));
  ensured_contact text := trim(coalesce(p_contact_name, ''));
  ensured_city text := nullif(trim(coalesce(p_city, '')), '');
  ensured_state text := nullif(trim(coalesce(p_state, '')), '');
  ensured_website text := nullif(trim(coalesce(p_website_url, '')), '');
  ensured_instagram text := nullif(trim(coalesce(p_instagram_url, '')), '');
  salon_slug text;
begin
  if actor is null then
    raise exception using errcode='28000', message='AUTH_REQUIRED';
  end if;
  if char_length(ensured_business) < 2 then
    raise exception using errcode='P0001', message='VALIDATION_ERROR: Business name must be at least 2 characters';
  end if;
  if char_length(ensured_contact) < 2 then
    raise exception using errcode='P0001', message='VALIDATION_ERROR: Contact name must be at least 2 characters';
  end if;

  -- Ensure before the guard: the guard rejects a missing profiles row with
  -- ACCOUNT_INACTIVE, which would make this ensure unreachable and would leave
  -- cross-app accounts unable to save at all.
  perform public.job_ensure_profile_row(actor);
  actor := public.job_assert_authenticated();

  -- Only the employer portal owns a business profile. A candidate account is
  -- refused here (a SECURITY DEFINER function cannot rely on RLS for this).
  ensured_role := public.job_current_role();
  if ensured_role is null then
    -- Unassigned portal account: assign the employer portal exactly the way
    -- portal entry does, then re-read the role.
    perform public.job_register_role('employer');
    ensured_role := public.job_current_role();
  end if;
  if ensured_role not in ('employer', 'admin') then
    raise exception using errcode='42501', message='ROLE_NOT_ALLOWED';
  end if;

  -- Shared profiles row (marketplace columns only — no updated_at).
  insert into public.profiles(id, full_name, phone, avatar_path, is_active)
  values (
    actor,
    ensured_contact,
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_avatar_path, '')), ''),
    true
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    avatar_path = excluded.avatar_path,
    is_active = true;

  insert into public.job_employer_profiles(user_id, display_name)
  values (actor, ensured_contact)
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    updated_at = now();

  -- Resolve the caller's own salon (owner first, then manager, then team).
  select m.salon_id into salon_uuid
  from public.job_salon_members m
  where m.user_id = actor and m.status = 'active'
  order by case m.member_role when 'owner' then 0 when 'manager' then 1 else 2 end, m.created_at
  limit 1;

  if salon_uuid is null then
    -- Self-heal: this account never got a salon (onboarding skipped, legacy or
    -- cross-app signup). Create the minimum rows the portal needs.
    insert into public.organizations(display_name, legal_name, business_category, status, created_by)
    values (ensured_business, ensured_business, 'salon', 'active', actor)
    returning id into org_uuid;

    insert into public.organization_members(organization_id, user_id, role, status, joined_at)
    values (org_uuid, actor, 'owner', 'active', now())
    on conflict (organization_id, user_id) do update set role = 'owner', status = 'active';

    salon_slug := trim(both '-' from regexp_replace(lower(ensured_business), '[^a-z0-9]+', '-', 'g'))
      || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

    insert into public.salons(
      organization_id, slug, name, description, business_category, city, state, is_active
    ) values (
      org_uuid, salon_slug, ensured_business,
      nullif(trim(coalesce(p_description, '')), ''), 'salon',
      ensured_city, ensured_state, true
    ) returning id into salon_uuid;

    insert into public.job_salon_members(salon_id, user_id, member_role, status)
    values (salon_uuid, actor, 'owner', 'active')
    on conflict (salon_id, user_id) do nothing;

    insert into public.job_salon_profiles(salon_id, owner_user_id, website_url, instagram_url, business_type)
    values (salon_uuid, actor, ensured_website, ensured_instagram, 'salon')
    on conflict (salon_id) do update set
      website_url = excluded.website_url,
      instagram_url = excluded.instagram_url,
      updated_at = now();

    -- job_salon_locations.city and .state are NOT NULL in the shared schema, so
    -- the primary row is only created once there is a real place to record.
    -- Saving a profile must never fail just because the location is blank.
    if ensured_city is not null or ensured_state is not null then
      insert into public.job_salon_locations(salon_id, label, address_line1, city, state, is_primary)
      values (
        salon_uuid, 'Primary', ensured_business,
        coalesce(ensured_city, ''), coalesce(ensured_state, ''), true
      )
      on conflict do nothing;
    end if;
  else
    -- Existing salon: owner/manager (or admin) may edit the business identity.
    if public.job_is_admin() or exists (
      select 1 from public.job_salon_members m
      where m.salon_id = salon_uuid and m.user_id = actor and m.status = 'active'
        and m.member_role in ('owner', 'manager')
    ) then
      update public.salons set
        name = ensured_business,
        description = nullif(trim(coalesce(p_description, '')), ''),
        city = coalesce(ensured_city, city),
        state = coalesce(ensured_state, state)
      where id = salon_uuid;

      -- Upsert, not update: a salon created before job_salon_profiles/brand
      -- links existed would otherwise silently drop the website and Instagram.
      select sp.owner_user_id into existing_owner
      from public.job_salon_profiles sp where sp.salon_id = salon_uuid;

      insert into public.job_salon_profiles(salon_id, owner_user_id, website_url, instagram_url, business_type)
      values (salon_uuid, coalesce(existing_owner, actor), ensured_website, ensured_instagram, 'salon')
      on conflict (salon_id) do update set
        website_url = excluded.website_url,
        instagram_url = excluded.instagram_url,
        updated_at = now();

      update public.job_salon_locations set
        city = coalesce(ensured_city, city),
        state = coalesce(ensured_state, state),
        updated_at = now()
      where salon_id = salon_uuid and is_primary = true;

      -- Same NOT NULL-safe rule as the insert path when the primary row is
      -- missing on an existing salon.
      if not found and (ensured_city is not null or ensured_state is not null) then
        insert into public.job_salon_locations(salon_id, label, address_line1, city, state, is_primary)
        values (
          salon_uuid, 'Primary', ensured_business,
          coalesce(ensured_city, ''), coalesce(ensured_state, ''), true
        )
        on conflict do nothing;
      end if;
    end if;
  end if;
end
$fn$;

revoke execute on function public.job_update_employer_profile(text,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.job_update_employer_profile(text,text,text,text,text,text,text,text,text) to authenticated;

comment on function public.job_update_employer_profile(text,text,text,text,text,text,text,text,text) is
  'Atomic employer profile save: heals a missing shared profiles row, upserts employer/salon/brand rows, and never writes marketplace-only columns (no profiles.updated_at).';

commit;

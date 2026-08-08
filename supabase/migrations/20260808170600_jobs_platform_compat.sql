-- Nexora Jobs: coexist with the existing organization membership guard.
-- Jobs authorization uses job_salon_members; the existing marketplace
-- organization_members table remains managed only by its trusted server flow.

begin;

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

  if not exists(
    select 1 from public.job_salon_locations
    where salon_id=salon_uuid and is_primary=true
  ) then
    insert into public.job_salon_locations(
      salon_id, label, address_line1, city, state, postal_code, is_primary
    ) values (
      salon_uuid, 'Primary', trim(p_address), trim(p_city), trim(p_state),
      nullif(trim(p_postal_code), ''), true
    );
  end if;

  update public.job_user_roles
  set onboarding_completed = true, updated_at = now()
  where user_id = actor;

  return salon_uuid;
end;
$$;

revoke execute on function public.complete_job_employer_onboarding(text,text,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.complete_job_employer_onboarding(text,text,text,text,text,text,text,text,text) to authenticated;

commit;

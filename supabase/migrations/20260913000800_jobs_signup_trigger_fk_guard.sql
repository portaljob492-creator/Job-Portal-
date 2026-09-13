-- Nexora Jobs: the signup trigger must not depend on trigger ordering.
--
-- job_create_role_after_signup writes to job_user_roles, which references
-- public.profiles. The 20260913000000 migration wrapped that insert in an
-- exception handler so a signup never fails when the shared profile row does
-- not exist yet — but 20260913000600 replaced the function and dropped the
-- guard, so every Jobs signup (auth.users row first, profile row later) fails
-- with a foreign key violation again.
--
-- This migration restores the guard while keeping the profiles self-ensure:
-- the trigger ensures the profiles row FIRST (best-effort, warnings only) so
-- the common path succeeds immediately, and the roles insert still swallows
-- foreign_key_violation as a last resort. The role remains guaranteed by
-- job_register_role during signup/onboarding either way.

begin;

create or replace function public.job_create_role_after_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text;
  display_name text;
begin
  if coalesce(new.raw_user_meta_data ->> 'app_context', '') <> 'jobs' then
    return new;
  end if;

  requested_role := coalesce(new.raw_user_meta_data ->> 'job_role', new.raw_user_meta_data ->> 'role');
  if requested_role = 'seeker' then requested_role := 'job_seeker'; end if;
  if requested_role not in ('job_seeker', 'employer') then requested_role := 'job_seeker'; end if;

  -- Profiles first: the roles insert below FK-references this row, so
  -- ensuring it here makes the common path succeed without depending on the
  -- marketplace app's own auth trigger having run first.
  display_name := coalesce(
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    split_part(coalesce(new.email, 'user'), '@', 1)
  );
  begin
    insert into public.profiles(id, full_name)
    values (new.id, display_name)
    on conflict (id) do nothing;
  exception when others then
    raise warning 'job_create_role_after_signup: profiles ensure failed for %: %', new.id, sqlerrm;
  end;

  begin
    insert into public.job_user_roles(user_id, role)
    values (new.id, requested_role)
    on conflict (user_id) do nothing;
  exception when foreign_key_violation then
    -- The shared profile row does not exist yet (and the ensure above was
    -- skipped or failed); job_register_role assigns the portal role as soon
    -- as the account is usable. The signup itself must never fail.
    null;
  end;

  return new;
end;
$$;

revoke execute on function public.job_create_role_after_signup() from public, anon, authenticated;

comment on function public.job_create_role_after_signup() is
  'Auth signup hook (app_context=jobs): assigns the permanent portal role and best-effort ensures a public.profiles row. Never fails the signup on trigger ordering.';

commit;

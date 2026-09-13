-- Nexora Jobs: portal entry self-heals a missing shared profile row.
--
-- The signup trigger (20260913000600) only fires for Jobs-native signups: it
-- returns early without app_context='jobs' metadata, which OAuth signups and
-- accounts created by other Nexora apps never carry. Those users reach the
-- portal with a role row but no public.profiles row, so reads degrade to
-- defaults and job_save_profile fails with PROFILE_NOT_FOUND.
--
-- job_register_role runs on every portal entry that assigns or validates a
-- role (password sign-in, OAuth return), so it is the choke point:
-- best-effort ensure the profiles row here and every portal user converges to
-- a complete account. The ensure runs BEFORE job_assert_authenticated because
-- that guard requires an active profiles row — ensuring after it would be dead
-- code for exactly the users who need it. Stragglers on old stored sessions
-- heal on their next sign-in, which the PROFILE_NOT_FOUND guidance already
-- advises ("Please sign in again").
--
-- profiles is marketplace-owned: the ensure swallows per-row failures and only
-- emits a warning, so a profiles problem can never fail portal entry. Role
-- semantics below are unchanged from 20260913000000.

begin;

create or replace function public.job_register_role(requested_role text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  existing_role text;
begin
  actor := (select auth.uid());
  if actor is null then
    raise exception using errcode='28000', message='AUTH_REQUIRED';
  end if;

  -- First portal entry activates the account: without this, OAuth signups and
  -- accounts from other Nexora apps (no profiles row, so the guard below would
  -- reject them) can never enter the portal at all.
  perform public.job_ensure_profile_row(actor);

  -- Re-check through the standard guard so deactivated accounts (row exists
  -- with is_active=false, which the ensure deliberately leaves alone) stay
  -- blocked with ACCOUNT_INACTIVE.
  actor := public.job_assert_authenticated();

  if requested_role not in ('job_seeker', 'employer') then
    raise exception using errcode='22023',message='ROLE_NOT_ALLOWED';
  end if;

  select role into existing_role
  from public.job_user_roles
  where user_id=actor
  for update;

  if existing_role is not null then
    if existing_role <> requested_role then
      raise exception using
        errcode='42501',
        message='PORTAL_ROLE_MISMATCH:' || existing_role;
    end if;
    return existing_role;
  end if;

  insert into public.job_user_roles(user_id,role)
  values(actor,requested_role)
  on conflict(user_id) do nothing;

  select role into existing_role
  from public.job_user_roles
  where user_id=actor;

  if existing_role is distinct from requested_role then
    raise exception using
      errcode='42501',
      message='PORTAL_ROLE_MISMATCH:' || coalesce(existing_role,'unassigned');
  end if;

  return existing_role;
end;
$$;

-- Shared profiles ensure, split out so the signup trigger and role
-- registration cannot drift apart again (see 20260913000800, where a
-- function replace silently dropped a guard).
create or replace function public.job_ensure_profile_row(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    -- is_active is set explicitly (not left to the column default) because
    -- the auth guard requires an active row. on conflict do nothing: an
    -- existing row — including a deactivated one — is never touched here.
    insert into public.profiles(id, full_name, is_active)
    select p_user_id, coalesce(
      nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), ''),
      split_part(coalesce(u.email, 'user'), '@', 1)
    ), true
    from auth.users u
    where u.id = p_user_id
    on conflict (id) do nothing;
  exception when others then
    raise warning 'job_ensure_profile_row: profiles ensure failed for %: %', p_user_id, sqlerrm;
  end;
end;
$$;

revoke execute on function public.job_register_role(text) from public, anon;
grant execute on function public.job_register_role(text) to authenticated;
revoke execute on function public.job_ensure_profile_row(uuid) from public, anon, authenticated;

comment on function public.job_ensure_profile_row(uuid) is
  'Best-effort ensure of the marketplace-owned public.profiles row. Never raises: failures emit a warning only. Not directly callable by clients.';

commit;

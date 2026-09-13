-- Nexora Jobs: guarantee a public.profiles row for every Jobs signup.
--
-- loadWorkspace reads profiles for the display name/avatar, and job_save_profile
-- raises PROFILE_NOT_FOUND without one — but the row was historically created
-- only by the marketplace app's own auth trigger. A Jobs signup must never
-- depend on another app's trigger to hydrate, so the Jobs trigger now
-- best-effort ensures the row itself, and this migration backfills stragglers.
--
-- profiles is marketplace-owned: both the trigger path and the backfill swallow
-- per-row failures (unknown NOT NULL columns, future schema drift) and only
-- emit warnings, so a profiles problem can never fail a signup or this migration.

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

  insert into public.job_user_roles(user_id, role)
  values (new.id, requested_role)
  on conflict (user_id) do nothing;

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

  return new;
end;
$$;

comment on function public.job_create_role_after_signup() is
  'Auth signup hook (app_context=jobs): assigns the permanent portal role and best-effort ensures a public.profiles row.';

-- Backfill: ensure rows for Jobs users created before this trigger change.
do $$
declare
  u record;
  ensured integer := 0;
begin
  for u in
    select au.id as id, au.email as email, au.raw_user_meta_data as raw_user_meta_data
    from auth.users au
    join public.job_user_roles r on r.user_id = au.id
    where not exists (select 1 from public.profiles p where p.id = au.id)
  loop
    begin
      insert into public.profiles(id, full_name)
      values (
        u.id,
        coalesce(
          nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), ''),
          split_part(coalesce(u.email, 'user'), '@', 1)
        )
      )
      on conflict (id) do nothing;
      ensured := ensured + 1;
    exception when others then
      raise warning 'jobs profile backfill skipped %: %', u.id, sqlerrm;
    end;
  end loop;
  raise notice 'jobs profile backfill ensured % row(s)', ensured;
end $$;

commit;

-- Nexora Jobs: authenticated location synchronization
--
-- Stores the last known device position of a signed-in portal user so that
-- nearby-job ranking can be computed server side. Writes are only possible
-- through the checked RPC below; the table itself is RLS-locked to its owner.
-- No service_role key and no client-side table write is required or permitted.

begin;

create table if not exists public.job_user_locations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  latitude numeric not null check (latitude between -90 and 90),
  longitude numeric not null check (longitude between -180 and 180),
  accuracy_m numeric check (accuracy_m is null or (accuracy_m >= 0 and accuracy_m <= 20000)),
  source text not null default 'device' check (source in ('device','manual')),
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_user_locations_synced_at_idx on public.job_user_locations(synced_at);

-- RLS is enabled (not forced) exactly like every other Jobs table: authenticated
-- callers are limited to the owner-only SELECT policy below, while the checked
-- security definer RPC keeps its write path.
alter table public.job_user_locations enable row level security;

do $$
declare policy_row record;
begin
  for policy_row in
    select policyname from pg_policies
    where schemaname='public' and tablename='job_user_locations'
  loop
    execute format('drop policy if exists %I on public.job_user_locations', policy_row.policyname);
  end loop;
end $$;

-- Owners read their own location; admins keep platform oversight. There is
-- deliberately no insert/update/delete policy: all writes go through the RPC.
create policy job_user_locations_select_own
on public.job_user_locations for select to authenticated
using (user_id=(select auth.uid()) or public.job_is_admin());

drop trigger if exists job_user_locations_set_updated_at on public.job_user_locations;
create trigger job_user_locations_set_updated_at
before update on public.job_user_locations
for each row execute function public.job_set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers and RPCs
-- ---------------------------------------------------------------------------

create or replace function public.job_location_distance_m(
  lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select (
    2 * 6371000 * asin(least(1, sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)
    )))
  )::numeric;
$$;

create or replace function public.sync_user_location(
  p_latitude numeric,
  p_longitude numeric,
  p_accuracy_m numeric default null,
  p_source text default 'device'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.job_assert_authenticated();
  existing public.job_user_locations;
begin
  if p_latitude is null or p_longitude is null then
    raise exception using errcode = '22023', message = 'COORDINATES_REQUIRED';
  end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception using errcode = '22023', message = 'COORDINATES_OUT_OF_RANGE';
  end if;
  if p_accuracy_m is not null and (p_accuracy_m < 0 or p_accuracy_m > 20000) then
    raise exception using errcode = '22023', message = 'ACCURACY_OUT_OF_RANGE';
  end if;
  if coalesce(p_source, 'device') not in ('device', 'manual') then
    raise exception using errcode = '22023', message = 'SOURCE_NOT_ALLOWED';
  end if;

  select * into existing from public.job_user_locations where user_id = actor for update;

  -- Server-side throttle: ignore repeat reports that are seconds apart and have
  -- not moved, so a chatty client cannot flood the table.
  if found
     and existing.synced_at > now() - interval '20 seconds'
     and public.job_location_distance_m(
           existing.latitude, existing.longitude, p_latitude, p_longitude
         ) < 25
  then
    return false;
  end if;

  insert into public.job_user_locations(user_id, latitude, longitude, accuracy_m, source, synced_at)
  values (actor, p_latitude, p_longitude, p_accuracy_m, coalesce(p_source, 'device'), now())
  on conflict (user_id) do update
    set latitude = excluded.latitude,
        longitude = excluded.longitude,
        accuracy_m = excluded.accuracy_m,
        source = excluded.source,
        synced_at = excluded.synced_at,
        updated_at = now();

  return true;
end;
$$;

create or replace function public.clear_user_location()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.job_assert_authenticated();
begin
  delete from public.job_user_locations where user_id = actor;
  return true;
end;
$$;

create or replace function public.job_current_user_location()
returns table(latitude numeric, longitude numeric, accuracy_m numeric, synced_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select l.latitude, l.longitude, l.accuracy_m, l.synced_at
  from public.job_user_locations l
  where l.user_id = (select auth.uid());
$$;

revoke execute on function public.job_location_distance_m(numeric,numeric,numeric,numeric) from public,anon;
revoke execute on function public.sync_user_location(numeric,numeric,numeric,text) from public,anon;
revoke execute on function public.clear_user_location() from public,anon;
revoke execute on function public.job_current_user_location() from public,anon;

grant execute on function public.job_location_distance_m(numeric,numeric,numeric,numeric) to authenticated;
grant execute on function public.sync_user_location(numeric,numeric,numeric,text) to authenticated;
grant execute on function public.clear_user_location() to authenticated;
grant execute on function public.job_current_user_location() to authenticated;

commit;

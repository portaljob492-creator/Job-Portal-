-- Phase 6 — user_location 404 reconciliation (complete)
--
-- Trace (exact request):
--   Browser:   src/services/locationSync.ts → createLocationSyncEngine() →
--              navigator.geolocation.watchPosition() → handlePosition() →
--              client.rpc('sync_user_location', { p_latitude, p_longitude, p_accuracy_m, p_source })
--              client.rpc('clear_user_location', {}) on disable/logout
--   Transport: POST https://qwaehqsmodekbgvnaavz.supabase.co/rest/v1/rpc/sync_user_location
--              POST /rest/v1/rpc/clear_user_location
--              (PostgREST RPC, not a Vercel /api route, not a direct table query)
--   Database:  public.job_user_locations (Supabase table) +
--              public.sync_user_location(numeric,numeric,numeric,text) → boolean
--              public.clear_user_location() → boolean
--              public.job_current_user_location() → table
--              public.job_location_distance_m(numeric,numeric,numeric,numeric) → numeric
--
-- Also verified NOT to be:
--   - database view                    → no pg_class relkind='v' named user_location
--   - Vercel API route                 → no api/ folder, vercel.json only SPA rewrite to /index.html
--   - bare browser geolocation leak    → geolocation is wrapped, never stored raw; writes only via RPC
--   - profile location (job_seeker_profiles.city/state) → separate, text fields, not numeric
--   - profile media/saved location     → separate tables
--   Live 404 observed: PGRST202 "Could not find the function public.sync_user_location … in the schema cache"
--   and PGRST205 "Could not find the table 'public.job_user_locations' in the schema cache"
--   when supabase/migrations/20260810090000_jobs_location_sync.sql had not been applied
--   on the live project qwaehqsmodekbgvnaavz.
--
-- What this migration guarantees (idempotent, safe to rerun):
--   - Supabase table public.job_user_locations exists with exact schema, checks, index, RLS, trigger
--   - RLS enabled (NOT forced) + owner-only SELECT policy (no insert/update/delete policies)
--   - FK public.job_user_locations.user_id → public.profiles(id) ON DELETE CASCADE (named, validated)
--   - All 4 RPCs re-declared security definer, search_path='', auth guard, validates ranges, rate-limits
--   - Grants: REVOKE from public,anon ; GRANT EXECUTE to authenticated (exactly)
--   - Grants: REVOKE all on table from public,anon ; GRANT SELECT on table to authenticated (RLS authoritative)
--   - Frontend already fails gracefully (locationSync.ts classifyRpcError → 'unsupported', clearWatch()),
--     so workspace (loadWorkspace) never breaks; this migration simply removes the 404 at the source.
--   - Works whether 20260810090000 was applied, skipped, or half-rolled-back.
--
-- Frontend contract:
--   src/services/locationSync.ts  rpc('sync_user_location', { p_latitude, p_longitude, p_accuracy_m, p_source })
--   src/hooks/useLocationSync.ts  rpc('clear_user_location', {})
--   Both use the authenticated Supabase client singleton; no service_role key; no direct table writes.

begin;

-- ---------------------------------------------------------------------------
-- Table: saved device location (optional feature, owned rows only)
-- ---------------------------------------------------------------------------

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

-- Ensure FK exists with canonical name even if table pre-existed without it or with generated name.
do $$
begin
  -- If the constraint already exists with the right definition, do nothing.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.job_user_locations'::regclass
      and conname = 'job_user_locations_user_id_fkey'
  ) then
    -- Drop any legacy/generated FK on user_id before recreating canonically.
    -- This handles projects where the FK was created with an auto-generated name.
    declare
      r record;
    begin
      for r in
        select conname from pg_constraint
        where conrelid = 'public.job_user_locations'::regclass
          and contype = 'f'
          and conkey = array[(select attnum from pg_attribute where attrelid='public.job_user_locations'::regclass and attname='user_id')]
      loop
        execute format('alter table public.job_user_locations drop constraint %I', r.conname);
      end loop;
    end;
    -- Recreate with canonical name; ON DELETE CASCADE is the contract (profile delete cleans location).
    begin
      alter table public.job_user_locations
        add constraint job_user_locations_user_id_fkey
        foreign key (user_id) references public.profiles(id) on delete cascade;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

create index if not exists job_user_locations_synced_at_idx on public.job_user_locations(synced_at);

-- RLS is enabled (not forced) exactly like every other Jobs table: authenticated
-- callers are limited to the owner-only SELECT policy below, while the
-- SECURITY DEFINER RPC keeps its write path. Forcing RLS would break the
-- definer path; we explicitly ensure it is NOT forced.
alter table public.job_user_locations enable row level security;
-- Ensure not forced (definer RPC must still write).
do $$
begin
  -- pg_class.relforcerowsecurity is true when RLS is forced.
  if exists (select 1 from pg_class where oid='public.job_user_locations'::regclass and relforcerowsecurity) then
    execute 'alter table public.job_user_locations no force row level security';
  end if;
end $$;

-- Reset policies to exactly one owner-only SELECT (no insert/update/delete for authenticated).
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

create policy job_user_locations_select_own
on public.job_user_locations for select to authenticated
using (user_id=(select auth.uid()) or public.job_is_admin());

-- updated_at maintenance (uses existing public.job_set_updated_at() from security hardening).
drop trigger if exists job_user_locations_set_updated_at on public.job_user_locations;
create trigger job_user_locations_set_updated_at
before update on public.job_user_locations
for each row execute function public.job_set_updated_at();

-- Table grants: RLS + policy is authoritative, but grants must allow authenticated SELECT
-- and deny anon/public any table access (writes only via RPC).
revoke all on table public.job_user_locations from public, anon;
grant select on table public.job_user_locations to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers and RPCs (exact originals, idempotent)
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

-- RPC grants: authenticated only (PostgREST 404 if missing; 401/42501 handled by RPC).
revoke execute on function public.job_location_distance_m(numeric,numeric,numeric,numeric) from public,anon;
revoke execute on function public.sync_user_location(numeric,numeric,numeric,text) from public,anon;
revoke execute on function public.clear_user_location() from public,anon;
revoke execute on function public.job_current_user_location() from public,anon;

grant execute on function public.job_location_distance_m(numeric,numeric,numeric,numeric) to authenticated;
grant execute on function public.sync_user_location(numeric,numeric,numeric,text) to authenticated;
grant execute on function public.clear_user_location() to authenticated;
grant execute on function public.job_current_user_location() to authenticated;

-- PostgREST picks up new objects automatically; explicit reload is harmless on idempotent rerun.
-- notify pgrst, 'reload schema';

commit;

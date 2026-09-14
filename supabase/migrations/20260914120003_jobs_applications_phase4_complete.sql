-- Nexora Jobs: Phase 4 — complete `job_applications` 404 reconciliation.
--
-- Production triage showed the deployed frontend 404ing on:
--   GET /rest/v1/job_applications?select=*,job:job_posts!job_applications_job_id_fkey(*,…),interviews:…  (PGRST200/201/205)
--   POST /rest/v1/rpc/get_employer_job_applications                (PGRST202)
--   POST /rest/v1/rpc/get_my_job_application_listings               (PGRST202)
--   [loadWorkspace] non-critical applicantCards / applications fallback
--
-- Root cause is the same class: the live project's schema cache is behind this
-- repo's migrations. PostgREST answers 404 (not 401/403) when the relation,
-- FK-traversal, or RPC is absent from the exposed schema. This migration is
-- the single, idempotent repair for that class — it never creates a duplicate
-- table when one already exists, but it does guarantee every object the client
-- actually queries:
--
--   * Table public.job_applications exists with the exact columns the app
--     reads/writes (core + contract compatibility fields), correct FKs,
--     indexes, RLS, policies, grants, and realtime publication.
--   * All FK constraint NAMES the client embeds by name are repaired (rename
--     if drifted, recreate if missing) — including the nested job_salon_locations
--     traversal and the two reverse FKs (interviews/offers) that the same
--     applicationSelect embed relies on.
--   * The three RPCs the workspace and lifecycle flows depend on are
--     re-declared (create or replace) with the canonical signatures and grants.
--
-- It is safe to re-run on an already-current project (all statements are
-- IF NOT EXISTS / OR REPLACE / idempotent guards).

begin;

-- ---------------------------------------------------------------------------
-- 1. Table + columns — create only if absent, add only missing columns.
--    Never shrinks the table and never replaces an existing FK.
-- ---------------------------------------------------------------------------

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_posts(id) on delete restrict,
  candidate_user_id uuid not null references public.profiles(id) on delete restrict,
  candidate_profile_id uuid not null references public.job_seeker_profiles(id) on delete restrict,
  resume_id uuid references public.job_candidate_resumes(id) on delete set null,
  cover_note text check (cover_note is null or char_length(cover_note) <= 5000),
  expected_salary numeric check (expected_salary is null or expected_salary >= 0),
  available_from date,
  status text not null default 'submitted' check (
    status in (
      'submitted', 'viewed', 'shortlisted', 'interview_requested',
      'interview_confirmed', 'interview_completed', 'offer_sent',
      'offer_accepted', 'hired', 'rejected', 'withdrawn', 'position_closed'
    )
  ),
  employer_notes text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, candidate_user_id)
);

-- Contract compatibility fields (added by 20260913001500 on live projects that
-- have them, no-oped otherwise). Kept here for Phase 4 completeness.
alter table public.job_applications add column if not exists candidate_id uuid;
alter table public.job_applications add column if not exists owner_id uuid;
alter table public.job_applications add column if not exists applied_at timestamptz;

-- Backfill compatibility fields only where they are still null.
do $$
declare candidate_kind "char"; post_has_owner boolean;
begin
  if not exists (select 1 from public.job_applications where candidate_id is null or owner_id is null or applied_at is null) then
    return;
  end if;
  select c.relkind into candidate_kind
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'candidate_profiles';
  select exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='job_posts' and column_name='owner_id') into post_has_owner;

  if candidate_kind in ('r','p') then
    execute $sql$
      update public.job_applications a set candidate_id = cp.id
      from public.candidate_profiles cp
      where a.candidate_id is null and cp.user_id = a.candidate_user_id
    $sql$;
  else
    update public.job_applications set candidate_id = candidate_profile_id where candidate_id is null;
  end if;

  if post_has_owner then
    execute $sql$
      update public.job_applications a set owner_id = coalesce(j.owner_id, j.created_by)
      from public.job_posts j where a.owner_id is null and j.id = a.job_id
    $sql$;
  else
    update public.job_applications a set owner_id = j.created_by
    from public.job_posts j where a.owner_id is null and j.id = a.job_id;
  end if;

  update public.job_applications set applied_at = submitted_at where applied_at is null and submitted_at is not null;
end $$;

-- Indexes the workspace and lifecycle hot paths rely on.
create index if not exists job_applications_candidate_idx on public.job_applications(candidate_user_id, submitted_at desc);
create index if not exists job_applications_job_status_idx on public.job_applications(job_id, status);
create index if not exists job_applications_status_idx on public.job_applications(status, updated_at desc);
create index if not exists job_applications_candidate_profile_idx on public.job_applications(candidate_profile_id);
create index if not exists job_applications_candidate_id_idx on public.job_applications(candidate_id);
create index if not exists job_applications_owner_id_idx on public.job_applications(owner_id);

-- ---------------------------------------------------------------------------
-- 2. FK constraint NAMES — every embed the client uses resolves by name.
--    PostgREST answers 400/404 "Could not find relationship" when the name
--    drifted. Repair: create if missing (core semantics), rename if drifted.
-- ---------------------------------------------------------------------------
do $$
declare
  repair record;
  found_name text;
  found_oid oid;
begin
  for repair in
    select * from (values
      -- Forward embed used by seeker My Applications:
      --   job:job_posts!job_applications_job_id_fkey(*, location:job_salon_locations!job_posts_location_id_fkey(*))
      ('job_applications', 'job_id', 'job_posts', 'id', 'job_applications_job_id_fkey', 'r'),
      ('job_posts', 'location_id', 'job_salon_locations', 'id', 'job_posts_location_id_fkey', 'n'),
      -- Reverse embeds in the same select:
      --   interviews:job_interview_requests(*), offers:job_offers(*)
      --   (PostgREST resolves these via the FKs on the child tables)
      ('job_interview_requests', 'application_id', 'job_applications', 'id', 'job_interview_requests_application_id_fkey', 'c'),
      ('job_offers', 'application_id', 'job_applications', 'id', 'job_offers_application_id_fkey', 'c')
    ) as t(child, col, parent, parent_col, wanted, deltype)
  loop
    select con.oid, con.conname into found_oid, found_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join unnest(con.conkey) as ck(attnum) on true
    join pg_attribute at on at.attrelid = con.conrelid and at.attnum = ck.attnum
    where nsp.nspname = 'public' and rel.relname = repair.child and con.contype = 'f' and at.attname = repair.col;

    if found_oid is null then
      execute format(
        'alter table public.%I add constraint %I foreign key (%I) references public.%I(%I) on delete %s',
        repair.child, repair.wanted, repair.col, repair.parent, repair.parent_col,
        case repair.deltype when 'r' then 'restrict' when 'c' then 'cascade' else 'set null' end
      );
    elsif found_name <> repair.wanted then
      execute format('alter table public.%I rename constraint %I to %I', repair.child, found_name, repair.wanted);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. RLS + policies + grants — authoritative posture from
--    20260913001500 / 20260914120000. Never widens anon, never drops an
--    existing non-broad policy; only removes a confirmed USING(true) hazard
--    and adds missing least-privilege paths.
-- ---------------------------------------------------------------------------
alter table public.job_applications enable row level security;

-- Remove any confirmed broad USING(true)/WITH CHECK(true) authenticated policy
-- that would let an anon-level row leak (historical hazard, not current).
do $$
declare p record;
begin
  for p in select policyname from pg_policies
    where schemaname='public' and tablename='job_applications'
      and 'authenticated' = any(roles)
      and (coalesce(qual,'') ~* '^\s*\(?\s*true\s*\)?\s*$' or coalesce(with_check,'') ~* '^\s*\(?\s*true\s*\)?\s*$')
  loop
    execute format('drop policy %I on public.job_applications', p.policyname);
    raise notice 'Phase4: removed broad policy %', p.policyname;
  end loop;
end $$;

-- Reconcile the four least-privilege policies (own-insert, admin-insert,
-- manager-status update, admin update/delete) if they are still missing.
do $$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='job_applications'
    and cmd in ('INSERT','ALL') and coalesce(with_check,'') ilike '%candidate_user_id%auth.uid%') then
    create policy job_applications_reconcile_candidate_insert
      on public.job_applications for insert to authenticated
      with check (candidate_user_id = (select auth.uid()) and status = 'submitted');
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='job_applications'
    and cmd in ('INSERT','ALL') and coalesce(with_check,'') ilike '%job_is_admin%') then
    create policy job_applications_reconcile_admin_insert
      on public.job_applications for insert to authenticated with check (public.job_is_admin());
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='job_applications'
    and cmd in ('UPDATE','ALL') and (coalesce(qual,'') ilike '%job_my_active_salon_ids%' or coalesce(with_check,'') ilike '%job_my_active_salon_ids%')) then
    create policy job_applications_reconcile_manager_status
      on public.job_applications for update to authenticated
      using (job_id in (select j.id from public.job_posts j where j.salon_id in (select public.job_my_active_salon_ids())))
      with check (job_id in (select j.id from public.job_posts j where j.salon_id in (select public.job_my_active_salon_ids())));
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='job_applications'
    and cmd in ('UPDATE','ALL') and coalesce(qual,'') ilike '%job_is_admin%' and coalesce(with_check,'') ilike '%job_is_admin%') then
    create policy job_applications_reconcile_admin_update
      on public.job_applications for update to authenticated using (public.job_is_admin()) with check (public.job_is_admin());
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='job_applications'
    and cmd in ('DELETE','ALL') and coalesce(qual,'') ilike '%job_is_admin%') then
    create policy job_applications_reconcile_admin_delete
      on public.job_applications for delete to authenticated using (public.job_is_admin());
  end if;
  -- Read policy: must be the set-based version from 20260913000300 (evaluated
  -- once per query). If a live project still carries the old per-row
  -- job_can_manage_application() version from 20260808170200, replace it;
  -- otherwise add it only if missing. Never leaves the per-row helper in place.
  do $policy$
  declare pol_qual text;
  begin
    select qual into pol_qual from pg_policies
      where schemaname='public' and tablename='job_applications' and policyname='job_applications_read_related';
    if pol_qual is not null and pol_qual ilike '%job_can_manage_application%' then
      execute 'drop policy job_applications_read_related on public.job_applications';
      pol_qual := null;
    end if;
    if pol_qual is null then
      create policy job_applications_read_related
        on public.job_applications for select to authenticated
        using (
          candidate_user_id = (select auth.uid())
          or (select public.job_is_admin())
          or job_id in (
            select p.id from public.job_posts p where p.salon_id in (select public.job_my_active_salon_ids())
          )
        );
    end if;
  end $policy$;
end $$;

-- Grants: authenticated gets SELECT/INSERT/DELETE + column-scoped UPDATE(status,employer_notes);
-- anon gets no writes. Public reads flow through public_job_listings views.
grant usage on schema public to anon, authenticated;
grant select, insert, delete on table public.job_applications to authenticated;
revoke update on table public.job_applications from authenticated;
grant update (status, employer_notes) on table public.job_applications to authenticated;
revoke insert, update, delete on table public.job_applications from anon;
grant select on table public.job_posts, public.job_salon_locations, public.job_interview_requests, public.job_offers to authenticated;

-- Realtime: the workspace subscribes to job_applications postgres_changes.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='job_applications') then
    execute 'alter publication supabase_realtime add table public.job_applications';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. RPCs — every procedure the app calls for the five flows:
--    apply, view my, employer view, status, details, update, admin.
--    Re-declared create-or-replace so a behind project converges in one push.
-- ---------------------------------------------------------------------------

-- submit_job_application is security-definer and is the ONLY write path for
-- `apply to job` (direct INSERTs are intentionally narrow and trigger-guarded).
create or replace function public.submit_job_application(
  target_job_id uuid,
  p_resume_id uuid default null,
  p_cover_note text default null,
  p_expected_salary numeric default null,
  p_available_from date default null
) returns public.job_applications language plpgsql security definer set search_path='' as $$
declare
  actor uuid := public.job_assert_authenticated();
  candidate public.job_seeker_profiles;
  post public.job_posts;
  application public.job_applications;
begin
  if public.job_current_role() <> 'job_seeker' then raise exception using errcode='42501', message='ROLE_NOT_ALLOWED'; end if;
  select * into candidate from public.job_seeker_profiles where user_id = actor;
  if not found or candidate.profile_completion < 50 then raise exception using errcode='P0001', message='PROFILE_INCOMPLETE'; end if;
  select * into post from public.job_posts where id = target_job_id for share;
  if not found then raise exception using errcode='P0002', message='JOB_NOT_FOUND'; end if;
  if post.status <> 'approved' then raise exception using errcode='P0001', message='JOB_NOT_PUBLISHED'; end if;
  if post.expires_at is not null and post.expires_at <= now() then raise exception using errcode='P0001', message='JOB_EXPIRED'; end if;
  if exists (select 1 from public.job_blocked_employers where candidate_user_id = actor and salon_id = post.salon_id) then
    raise exception using errcode='42501', message='SALON_ACCESS_DENIED';
  end if;
  if p_resume_id is not null and not exists (select 1 from public.job_candidate_resumes r where r.id = p_resume_id and r.candidate_id = candidate.id) then
    raise exception using errcode='42501', message='FOREIGN_RESUME';
  end if;
  insert into public.job_applications(job_id, candidate_user_id, candidate_profile_id, resume_id, cover_note, expected_salary, available_from)
  values (post.id, actor, candidate.id, p_resume_id, nullif(trim(p_cover_note),''), p_expected_salary, p_available_from)
  returning * into application;
  insert into public.job_notifications(user_id, type, title, body, entity_type, entity_id)
  select distinct m.user_id, 'application_submitted', 'New job application', 'A candidate applied for ' || post.title, 'application', application.id
  from public.job_salon_members m where m.salon_id = post.salon_id and m.status = 'active';
  return application;
exception when unique_violation then raise exception using errcode='23505', message='APPLICATION_ALREADY_EXISTS';
end $$;
revoke execute on function public.submit_job_application(uuid, uuid, text, numeric, date) from public, anon;
grant execute on function public.submit_job_application(uuid, uuid, text, numeric, date) to authenticated;

-- Employer views received applications (workspace applicantCards)
create or replace function public.get_employer_job_applications(target_job_id uuid default null)
returns table(
  application_id uuid, job_id uuid, job_title text, candidate_profile_id uuid, candidate_name text,
  email text, phone text, avatar_path text, total_experience_months integer, skills text[],
  preferred_city text, preferred_state text, resume_storage_path text, resume_filename text,
  status text, submitted_at timestamptz, cover_note text, expected_salary numeric, available_from date, interviews jsonb
) language plpgsql stable security definer set search_path='' as $$
declare actor uuid := public.job_assert_authenticated();
begin
  if public.job_current_role() <> 'employer' then raise exception using errcode='42501', message='ROLE_NOT_ALLOWED'; end if;
  if target_job_id is not null and not exists (select 1 from public.job_posts j where j.id=target_job_id and j.created_by=actor) then
    raise exception using errcode='P0002', message='JOB_NOT_FOUND';
  end if;
  return query
  select a.id, a.job_id, j.title, a.candidate_profile_id, coalesce(p.full_name,'Applicant'), coalesce(u.email,'')::text, coalesce(p.phone,''), p.avatar_path,
         coalesce(c.total_experience_months,0), coalesce(skill_list.skills,'{}'::text[]),
         coalesce(pref.preferred_city, c.city), coalesce(pref.preferred_state, c.state),
         r.storage_path, r.original_filename, a.status, a.submitted_at, a.cover_note, a.expected_salary, a.available_from,
         coalesce(interview_list.items,'[]'::jsonb)
  from public.job_applications a
  join public.job_posts j on j.id = a.job_id
  join public.job_seeker_profiles c on c.id = a.candidate_profile_id
  join public.profiles p on p.id = a.candidate_user_id
  join auth.users u on u.id = a.candidate_user_id
  left join public.job_candidate_preferences pref on pref.candidate_id = c.id
  left join public.job_candidate_resumes r on r.id = a.resume_id
  left join lateral (select array_agg(distinct s.name order by s.name) as skills from public.job_candidate_skills cs join public.job_skills s on s.id = cs.skill_id where cs.candidate_id = c.id) skill_list on true
  left join lateral (select jsonb_agg(to_jsonb(i) order by i.scheduled_start desc) as items from public.job_interview_requests i where i.application_id = a.id) interview_list on true
  where j.created_by=actor and (target_job_id is null or j.id=target_job_id)
  order by a.submitted_at desc;
end $$;
revoke execute on function public.get_employer_job_applications(uuid) from public, anon;
grant execute on function public.get_employer_job_applications(uuid) to authenticated;

-- Seeker views own applications (workspace listing snapshots, including closed jobs)
create or replace function public.get_my_job_application_listings()
returns table(application_id uuid, listing jsonb) language plpgsql stable security definer set search_path='' as $fn$
declare actor uuid := public.job_assert_authenticated();
begin
  if public.job_current_role() <> 'job_seeker' then raise exception using errcode='42501', message='ROLE_NOT_ALLOWED'; end if;
  return query
  select a.id, jsonb_build_object(
      'id', j.id, 'title', j.title, 'category', j.category, 'description', j.description,
      'responsibilities', j.responsibilities, 'employment_type', j.employment_type, 'workplace_type', j.workplace_type,
      'experience_min_months', j.experience_min_months, 'experience_max_months', j.experience_max_months,
      'freshers_allowed', j.freshers_allowed, 'salary_min', j.salary_min, 'salary_max', j.salary_max,
      'pay_type', j.pay_type, 'incentives', j.incentives, 'tips_info', j.tips_info, 'benefits', j.benefits,
      'working_days', j.working_days, 'working_hours', j.working_hours, 'weekly_off', j.weekly_off,
      'joining_date', j.joining_date, 'openings', j.openings, 'image_path', j.image_path, 'tags', j.tags,
      'published_at', j.published_at, 'expires_at', j.expires_at, 'created_at', j.created_at, 'status', j.status,
      'salon_id', s.id, 'salon_name', s.name, 'logo_path', s.logo_path, 'salon_verified', s.verified,
      'rating_average', s.rating_average, 'review_count', s.review_count,
      'city', coalesce(l.city, s.city), 'state', coalesce(l.state, s.state),
      'location_id', l.id, 'location_label', l.label
    )
  from public.job_applications a
  join public.job_posts j on j.id = a.job_id
  join public.salons s on s.id = j.salon_id
  left join public.job_salon_locations l on l.id = j.location_id
  where a.candidate_user_id = actor
  order by a.submitted_at desc;
end $fn$;
revoke execute on function public.get_my_job_application_listings() from public, anon;
grant execute on function public.get_my_job_application_listings() to authenticated;

comment on table public.job_applications is
  'Phase 4 verified: candidate applications — table, FK names, indexes, RLS, grants, realtime, and workspace RPCs reconciled so /rest/v1/job_applications and both listing RPCs never 404 a deployed frontend.';

commit;

-- ===========================================================================
-- Nexora Jobs: FINAL production reconciliation (one-pass, idempotent).
--
-- RUN THIS ONCE in the Supabase SQL Editor (or via `supabase db push`).
-- Safe to re-run any number of times.
--
-- WHAT THIS DOES
--   Reconciles the CURRENT production catalog to the secure end state without
--   rebuilding anything:
--     * RLS stays enabled on candidate_profiles / job_seeker_profiles /
--       job_posts / job_applications (never disabled).
--     * All existing production columns, foreign keys (with their exact ON
--       DELETE actions), indexes, helper functions, triggers, views and data
--       are PRESERVED. Nothing business-critical is dropped or rewritten.
--     * Only confirmed redundancies are removed, each only after its
--       replacement is verified present:
--         - a duplicate equivalent UNIQUE guard on
--           job_applications(job_id, candidate_user_id);
--         - a duplicate equivalent updated_at trigger on job_applications;
--         - byte-identical duplicate RLS policies (one copy is kept);
--         - broad USING (true) / WITH CHECK (true) policies on the four
--           reconciled tables (unsafe: replaced by the preserved scoped rules);
--         - an unrestricted candidate UPDATE policy on job_applications
--           (candidates withdraw via DELETE-free status RPC, never free UPDATE).
--     * Only genuinely missing security rules are ADDED (never duplicated):
--       own-user CRUD + admin read on physical candidate profile tables,
--       admin CRUD on job_posts, candidate/employer/admin paths on
--       job_applications, immutable ownership guards, insert identity
--       derivation (only when no equivalent validation trigger exists),
--       private Storage buckets/policies.
--   Salon/Employer/Recruiter authorization (job_is_active_salon_member,
--   job_can_manage_application, job_my_active_salon_ids) and admin
--   authorization (job_is_admin) are the SOLE mechanisms used. No second role
--   system is created.
--
-- WHAT THIS NEVER DOES
--   DROP TABLE, TRUNCATE, DROP SCHEMA, deleting users/profiles/jobs/
--   applications, resetting the database, replacing FK ON DELETE actions,
--   replacing the status-transition state machine, the history trigger, the
--   salon/member functions, or the admin function.
--
-- LAYOUTS SUPPORTED (catalog-driven, nothing is assumed)
--   1. Physical public.candidate_profiles table + job_seeker_profiles; or
--   2. job_seeker_profiles canonical, candidate_profiles absent -> a read-only
--      compatibility VIEW is created (never a second writable table).
--   job_seeker_profiles is authoritative for the Jobs application workflow
--   (submit_job_application, profile_completion gate, resume ownership);
--   candidate_profiles is the legacy/marketplace profile record linked via
--   job_applications.candidate_id. Both are preserved; neither is merged.
--
-- Sections: 0 guards + helpers, 1 RLS+layout, 2 profile policies,
--   3 application columns/FKs, 4 uniqueness, 5 triggers, 6 job/application
--   policies, 7 helper RPC convergence, 8 storage, 9 grants, 10 verification.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. Required objects. Fail fast with an explicit list instead of half-applying.
-- ---------------------------------------------------------------------------
do $$
declare missing text[] := '{}';
begin
  if to_regclass('public.job_posts') is null then missing := array_append(missing, 'public.job_posts'); end if;
  if to_regclass('public.job_applications') is null then missing := array_append(missing, 'public.job_applications'); end if;
  if to_regclass('public.profiles') is null then missing := array_append(missing, 'public.profiles'); end if;
  if to_regclass('public.job_seeker_profiles') is null then missing := array_append(missing, 'public.job_seeker_profiles'); end if;
  if to_regclass('public.job_candidate_resumes') is null then missing := array_append(missing, 'public.job_candidate_resumes'); end if;
  if to_regclass('public.salons') is null then missing := array_append(missing, 'public.salons'); end if;
  if to_regclass('public.job_salon_members') is null then missing := array_append(missing, 'public.job_salon_members'); end if;
  if to_regclass('public.job_salon_profiles') is null then missing := array_append(missing, 'public.job_salon_profiles'); end if;
  if to_regclass('public.job_user_roles') is null then missing := array_append(missing, 'public.job_user_roles'); end if;
  if to_regprocedure('public.job_is_admin()') is null then missing := array_append(missing, 'public.job_is_admin()'); end if;
  if to_regprocedure('public.job_is_active_salon_member(uuid)') is null then missing := array_append(missing, 'public.job_is_active_salon_member(uuid)'); end if;
  if to_regprocedure('public.job_can_manage_application(uuid)') is null then missing := array_append(missing, 'public.job_can_manage_application(uuid)'); end if;
  if to_regprocedure('public.job_current_role()') is null then missing := array_append(missing, 'public.job_current_role()'); end if;
  if to_regprocedure('public.job_assert_authenticated()') is null then missing := array_append(missing, 'public.job_assert_authenticated()'); end if;
  if cardinality(missing) > 0 then
    raise exception 'JOBS_SCHEMA_MISSING_REQUIRED_OBJECTS: %', array_to_string(missing, ', ');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 0b. Create-if-missing small helpers this reconciliation relies on.
-- Existing definitions are NEVER replaced here.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.job_set_updated_at()') is null then
    create function public.job_set_updated_at()
    returns trigger language plpgsql set search_path = '' as $fn$
    begin
      new.updated_at = now();
      return new;
    end $fn$;
    revoke execute on function public.job_set_updated_at() from public, anon, authenticated;
    raise notice 'Created missing trigger helper public.job_set_updated_at()';
  end if;

  if to_regprocedure('public.job_my_active_salon_ids()') is null then
    create function public.job_my_active_salon_ids()
    returns setof uuid language sql stable security definer set search_path = '' as $fn$
      select m.salon_id
      from public.job_salon_members m
      join public.job_user_roles r on r.user_id = m.user_id
      join public.salons s on s.id = m.salon_id
      where m.user_id = (select auth.uid())
        and m.status = 'active'
        and m.member_role in ('owner', 'manager', 'recruiter')
        and r.role in ('employer', 'admin')
        and r.account_status = 'active'
        and s.is_active = true
        and s.deleted_at is null
    $fn$;
    revoke execute on function public.job_my_active_salon_ids() from public;
    grant execute on function public.job_my_active_salon_ids() to anon, authenticated;
    comment on function public.job_my_active_salon_ids() is
      'Salons the current user may act for. Set-returning twin of job_is_active_salon_member(), used by RLS policies so the membership test is evaluated once per query instead of once per row.';
    raise notice 'Created missing helper public.job_my_active_salon_ids()';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. RLS state + candidate_profiles layout (physical table preserved; view
--    created only when the relation is absent entirely).
-- ---------------------------------------------------------------------------
alter table public.job_posts enable row level security;
alter table public.job_applications enable row level security;
alter table public.job_seeker_profiles enable row level security;

do $$
declare candidate_kind "char";
begin
  select c.relkind into candidate_kind
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'candidate_profiles';

  if candidate_kind is null then
    execute $view$
      create view public.candidate_profiles
      with (security_barrier = true, security_invoker = false)
      as
      select
        c.id, c.user_id, p.full_name, u.email::text as email, p.phone as mobile,
        p.avatar_path as profile_image_url, c.city, p.preferred_area as area,
        education.summary as education,
        round(c.total_experience_months::numeric / 12, 2) as experience_years,
        coalesce(candidate_skills.items, '{}'::text[]) as skills,
        preferred_role.role_name as preferred_job_role,
        coalesce(c.expected_salary_min, pref.salary_min) as preferred_salary_min,
        coalesce(c.expected_salary_max, pref.salary_max) as preferred_salary_max,
        resume.storage_path as resume_url,
        case when c.submitted_at is null then 'draft' else 'submitted' end::text as profile_status,
        (c.profile_completion >= 50) as is_complete, c.created_at, c.updated_at
      from public.job_seeker_profiles c
      join public.profiles p on p.id = c.user_id
      join auth.users u on u.id = c.user_id
      left join public.job_candidate_preferences pref on pref.candidate_id = c.id
      left join lateral (
        select string_agg(concat_ws(', ', e.course_name, e.institution_name,
          case when e.completion_year is null then null else e.completion_year::text end),
          '; ' order by e.completion_year desc nulls last, e.created_at) as summary
        from public.job_candidate_education e where e.candidate_id = c.id
      ) education on true
      left join lateral (
        select array_agg(distinct s.name order by s.name) as items
        from public.job_candidate_skills cs join public.job_skills s on s.id = cs.skill_id
        where cs.candidate_id = c.id
      ) candidate_skills on true
      left join lateral (
        select r.role_name from public.job_candidate_preferred_roles r
        where r.candidate_id = c.id order by r.created_at, r.role_name limit 1
      ) preferred_role on true
      left join lateral (
        select r.storage_path from public.job_candidate_resumes r
        where r.candidate_id = c.id
        order by r.is_primary desc, r.uploaded_at desc limit 1
      ) resume on true
      where c.user_id = (select auth.uid()) or public.job_is_admin()
    $view$;
    comment on view public.candidate_profiles is
      'Read-only compatibility projection over job_seeker_profiles; not a duplicate candidate table.';
    raise notice 'Created read-only compatibility view public.candidate_profiles';
  elsif candidate_kind in ('r', 'p') then
    execute 'alter table public.candidate_profiles enable row level security';
  elsif candidate_kind <> 'v' then
    raise exception 'INCOMPATIBLE_SCHEMA_OBJECT: public.candidate_profiles has relkind %', candidate_kind;
  end if;
end $$;

revoke all on public.candidate_profiles from public, anon;
grant select on public.candidate_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Candidate profile tables: own-user CRUD + active-admin read.
--    Employer access stays application-scoped through the dedicated RPCs
--    (get_job_applicant_cards, get_employer_job_applications,
--    search_job_candidates, job_get_applicant_portfolio), never through broad
--    or recursive table policies. Existing valid policies are preserved; only
--    byte-identical duplicates, USING(true) policies, and recursive
--    application-join policies on these two tables are removed.
-- ---------------------------------------------------------------------------
do $$
declare
  profile_table text;
  dupe record;
  drop_name text;
  canonical_name text;
begin
  foreach profile_table in array array['job_seeker_profiles', 'candidate_profiles'] loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = profile_table and c.relkind in ('r', 'p')
    ) then continue; end if;

    -- 2a. Byte-identical duplicates: keep the alphabetically first, drop rest.
    for dupe in
      select cmd, roles::text as roles_text, coalesce(qual, '') as qual_text,
             coalesce(with_check, '') as check_text, count(*) as n
      from pg_policies
      where schemaname = 'public' and tablename = profile_table
      group by cmd, roles::text, coalesce(qual, ''), coalesce(with_check, '')
      having count(*) > 1
    loop
      for drop_name in
        select policyname from pg_policies
        where schemaname = 'public' and tablename = profile_table
          and cmd = dupe.cmd and roles::text = dupe.roles_text
          and coalesce(qual, '') = dupe.qual_text
          and coalesce(with_check, '') = dupe.check_text
        order by policyname offset 1
      loop
        execute format('drop policy %I on public.%I', drop_name, profile_table);
        raise notice 'Removed byte-identical duplicate policy %.%', profile_table, drop_name;
      end loop;
    end loop;

    -- 2b. Unsafe broad policies (USING/WITH CHECK true) on profile tables.
    for drop_name in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = profile_table
        and (coalesce(qual, '') ~* '^\s*\(?\s*true\s*\)?\s*$'
          or coalesce(with_check, '') ~* '^\s*\(?\s*true\s*\)?\s*$')
    loop
      execute format('drop policy %I on public.%I', drop_name, profile_table);
      raise notice 'Removed broad USING(true) policy %.%', profile_table, drop_name;
    end loop;

    -- 2c. Ensure own-user CRUD + admin read BEFORE removing recursive policies,
    -- so the table is never left without its required access paths.
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = profile_table
      and cmd in ('SELECT', 'ALL') and coalesce(qual, '') ilike '%user_id%auth.uid%') then
      canonical_name := profile_table || '_own_select';
      if exists (select 1 from pg_policies where schemaname = 'public' and tablename = profile_table and policyname = canonical_name) then
        canonical_name := canonical_name || '_final';
      end if;
      execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))',
        canonical_name, profile_table);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = profile_table
      and cmd in ('INSERT', 'ALL') and coalesce(with_check, '') ilike '%user_id%auth.uid%') then
      canonical_name := profile_table || '_own_insert';
      if exists (select 1 from pg_policies where schemaname = 'public' and tablename = profile_table and policyname = canonical_name) then
        canonical_name := canonical_name || '_final';
      end if;
      execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))',
        canonical_name, profile_table);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = profile_table
      and cmd in ('UPDATE', 'ALL') and coalesce(qual, '') ilike '%user_id%auth.uid%'
      and coalesce(with_check, '') ilike '%user_id%auth.uid%') then
      canonical_name := profile_table || '_own_update';
      if exists (select 1 from pg_policies where schemaname = 'public' and tablename = profile_table and policyname = canonical_name) then
        canonical_name := canonical_name || '_final';
      end if;
      execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
        canonical_name, profile_table);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = profile_table
      and cmd in ('DELETE', 'ALL') and coalesce(qual, '') ilike '%user_id%auth.uid%') then
      canonical_name := profile_table || '_own_delete';
      if exists (select 1 from pg_policies where schemaname = 'public' and tablename = profile_table and policyname = canonical_name) then
        canonical_name := canonical_name || '_final';
      end if;
      execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))',
        canonical_name, profile_table);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = profile_table
      and cmd in ('SELECT', 'ALL') and coalesce(qual, '') ilike '%job_is_admin%') then
      canonical_name := profile_table || '_admin_select';
      if exists (select 1 from pg_policies where schemaname = 'public' and tablename = profile_table and policyname = canonical_name) then
        canonical_name := canonical_name || '_final';
      end if;
      execute format('create policy %I on public.%I for select to authenticated using (public.job_is_admin())',
        canonical_name, profile_table);
    end if;

    -- 2d. Recursive employer-branch policies on profile tables: these join
    -- job_applications/job_posts whose own policies recurse, and they allow
    -- broad profile browsing outside any application. The RPC layer
    -- (SECURITY DEFINER, application-scoped) preserves the salon workflow.
    for drop_name in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = profile_table
        and 'authenticated' = any (roles)
        and cmd in ('SELECT', 'ALL')
        and (coalesce(qual, '') ilike '%job_applications%'
          or coalesce(qual, '') ilike '%job_is_active_salon_member%')
    loop
      execute format('drop policy %I on public.%I', drop_name, profile_table);
      raise notice 'Removed recursive/broad candidate profile policy %.% (employer access remains via application-scoped RPCs)',
        profile_table, drop_name;
    end loop;

    execute format('grant select, insert, update, delete on public.%I to authenticated', profile_table);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. job_applications: preserve every production column; reconcile only the
--    compatibility fields (additive, backfilled, never shrunk).
-- ---------------------------------------------------------------------------
alter table public.job_applications add column if not exists candidate_id uuid;
alter table public.job_applications add column if not exists owner_id uuid;
alter table public.job_applications add column if not exists applied_at timestamptz;

do $$
declare candidate_kind "char"; post_has_owner boolean;
begin
  select c.relkind into candidate_kind
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'candidate_profiles';
  select exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'job_posts' and column_name = 'owner_id') into post_has_owner;

  if candidate_kind in ('r', 'p') then
    execute $sql$
      update public.job_applications a set candidate_id = cp.id
      from public.candidate_profiles cp
      where a.candidate_id is null and cp.user_id = a.candidate_user_id
    $sql$;
  else
    update public.job_applications
      set candidate_id = candidate_profile_id
      where candidate_id is null;
  end if;

  if post_has_owner then
    execute $sql$
      update public.job_applications a
      set owner_id = coalesce(j.owner_id, j.created_by)
      from public.job_posts j
      where a.owner_id is null and j.id = a.job_id
    $sql$;
  else
    update public.job_applications a
      set owner_id = j.created_by
      from public.job_posts j
      where a.owner_id is null and j.id = a.job_id;
  end if;

  update public.job_applications
    set applied_at = submitted_at
    where applied_at is null and submitted_at is not null;
end $$;

-- Add only MISSING single-column foreign keys. Any existing FK on the column
-- (whatever its name, target or ON DELETE action) is preserved exactly.
do $$
declare candidate_kind "char"; candidate_target regclass;
begin
  select c.relkind into candidate_kind
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'candidate_profiles';
  candidate_target := case when candidate_kind in ('r', 'p') then 'public.candidate_profiles'::regclass
                           else 'public.job_seeker_profiles'::regclass end;

  if not exists (select 1 from pg_constraint c where c.conrelid = 'public.job_applications'::regclass
    and c.contype = 'f'
    and c.conkey = array[(select attnum from pg_attribute where attrelid = 'public.job_applications'::regclass and attname = 'candidate_id')]::smallint[]) then
    if exists (select 1 from pg_constraint where conrelid = 'public.job_applications'::regclass and conname = 'job_applications_candidate_id_fkey') then
      raise exception 'INCOMPATIBLE_SCHEMA_OBJECT: job_applications_candidate_id_fkey';
    end if;
    execute format('alter table public.job_applications add constraint job_applications_candidate_id_fkey foreign key (candidate_id) references %s (id) on delete cascade not valid', candidate_target);
    if not exists (select 1 from public.job_applications where candidate_id is not null)
      or not exists (select 1 from public.job_applications a
        where a.candidate_id is not null
          and not exists (select 1 from public.candidate_profiles c where c.id = a.candidate_id)) then
      alter table public.job_applications validate constraint job_applications_candidate_id_fkey;
    else
      raise warning 'UNVALIDATED_APPLICATION_CANDIDATE_FK: legacy orphan rows were preserved';
    end if;
  end if;

  if not exists (select 1 from pg_constraint c where c.conrelid = 'public.job_applications'::regclass
    and c.contype = 'f'
    and c.conkey = array[(select attnum from pg_attribute where attrelid = 'public.job_applications'::regclass and attname = 'owner_id')]::smallint[]) then
    if exists (select 1 from pg_constraint where conrelid = 'public.job_applications'::regclass and conname = 'job_applications_owner_id_auth_fkey') then
      raise exception 'INCOMPATIBLE_SCHEMA_OBJECT: job_applications_owner_id_auth_fkey';
    end if;
    alter table public.job_applications add constraint job_applications_owner_id_auth_fkey
      foreign key (owner_id) references auth.users (id) on delete cascade not valid;
    if not exists (select 1 from public.job_applications a where a.owner_id is not null
      and not exists (select 1 from auth.users u where u.id = a.owner_id)) then
      alter table public.job_applications validate constraint job_applications_owner_id_auth_fkey;
    else
      raise warning 'UNVALIDATED_APPLICATION_OWNER_FK: legacy orphan rows were preserved';
    end if;
  end if;
end $$;

do $$
begin
  if exists (select 1 from public.job_applications where candidate_id is null or owner_id is null or applied_at is null) then
    raise warning 'UNRECONCILED_APPLICATION_RELATIONSHIPS: nullable compatibility fields retained; inspect final verification output';
  else
    alter table public.job_applications alter column candidate_id set not null;
    alter table public.job_applications alter column owner_id set not null;
    alter table public.job_applications alter column applied_at set not null;
  end if;
end $$;

create index if not exists job_applications_candidate_id_idx on public.job_applications (candidate_id);
create index if not exists job_applications_owner_id_idx on public.job_applications (owner_id);

-- ---------------------------------------------------------------------------
-- 4. Exactly one (job_id, candidate_user_id) uniqueness guard. Duplicates are
--    reported, never deleted.
-- ---------------------------------------------------------------------------
do $$
declare report_kind "char";
begin
  select c.relkind into report_kind from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'job_application_duplicate_report';
  if report_kind is null then
    execute $view$
      create view public.job_application_duplicate_report
      with (security_barrier = true, security_invoker = false) as
      select a.job_id, a.candidate_user_id, count(*)::bigint as duplicate_count,
        array_agg(a.id order by a.submitted_at, a.id) as application_ids,
        min(a.submitted_at) as first_submitted_at, max(a.submitted_at) as last_submitted_at
      from public.job_applications a
      where public.job_is_admin()
      group by a.job_id, a.candidate_user_id having count(*) > 1
    $view$;
  elsif report_kind = 'v' then
    execute $view$
      create or replace view public.job_application_duplicate_report
      with (security_barrier = true, security_invoker = false) as
      select a.job_id, a.candidate_user_id, count(*)::bigint as duplicate_count,
        array_agg(a.id order by a.submitted_at, a.id) as application_ids,
        min(a.submitted_at) as first_submitted_at, max(a.submitted_at) as last_submitted_at
      from public.job_applications a
      where public.job_is_admin()
      group by a.job_id, a.candidate_user_id having count(*) > 1
    $view$;
  else
    raise warning 'INCOMPATIBLE_SCHEMA_OBJECT: public.job_application_duplicate_report is not a view; preserved unchanged';
  end if;
end $$;

revoke all on public.job_application_duplicate_report from public, anon, authenticated;
grant select on public.job_application_duplicate_report to authenticated;

do $$
declare
  job_att smallint;
  user_att smallint;
  keep_name text;
  duplicate_name text;
  keep_index oid;
  duplicate_index record;
  protection_exists boolean;
begin
  select attnum into job_att from pg_attribute
    where attrelid = 'public.job_applications'::regclass and attname = 'job_id' and not attisdropped;
  select attnum into user_att from pg_attribute
    where attrelid = 'public.job_applications'::regclass and attname = 'candidate_user_id' and not attisdropped;

  -- Keep the original core constraint name when present; otherwise keep any
  -- one equivalent guard. Duplicates are dropped only while the kept guard
  -- still exists (same transaction, verified below).
  select c.conname into keep_name
  from pg_constraint c
  where c.conrelid = 'public.job_applications'::regclass and c.contype = 'u'
    and array(select unnest(c.conkey) order by 1) = array(select unnest(array[job_att, user_att]::smallint[]) order by 1)
  order by case c.conname
    when 'job_applications_job_id_candidate_user_id_key' then 0
    when 'job_applications_job_user_unique' then 1
    else 2 end, c.conname
  limit 1;

  if keep_name is not null then
    for duplicate_name in
      select c.conname from pg_constraint c
      where c.conrelid = 'public.job_applications'::regclass and c.contype = 'u'
        and c.conname <> keep_name
        and array(select unnest(c.conkey) order by 1) = array(select unnest(array[job_att, user_att]::smallint[]) order by 1)
      order by c.conname
    loop
      begin
        execute format('alter table public.job_applications drop constraint %I', duplicate_name);
        raise notice 'Removed redundant equivalent unique constraint %, retained %', duplicate_name, keep_name;
      exception when dependent_objects_still_exist then
        raise warning 'Retained redundant constraint % because another object depends on it', duplicate_name;
      end;
    end loop;
  end if;

  if keep_name is not null then
    select c.conindid into keep_index from pg_constraint c
    where c.conrelid = 'public.job_applications'::regclass and c.conname = keep_name;
  else
    select i.indexrelid into keep_index from pg_index i join pg_class x on x.oid = i.indexrelid
    where i.indrelid = 'public.job_applications'::regclass and i.indisunique and i.indisvalid
      and i.indpred is null and i.indexprs is null
      and array(select unnest(i.indkey::smallint[]) order by 1) = array(select unnest(array[job_att, user_att]::smallint[]) order by 1)
    order by x.relname limit 1;
  end if;

  if keep_index is not null then
    for duplicate_index in
      select i.indexrelid, x.relname
      from pg_index i join pg_class x on x.oid = i.indexrelid
      where i.indrelid = 'public.job_applications'::regclass and i.indisunique and i.indisvalid
        and i.indpred is null and i.indexprs is null and i.indexrelid <> keep_index
        and array(select unnest(i.indkey::smallint[]) order by 1) = array(select unnest(array[job_att, user_att]::smallint[]) order by 1)
        and not exists (select 1 from pg_constraint c where c.conindid = i.indexrelid)
      order by x.relname
    loop
      begin
        execute format('drop index public.%I', duplicate_index.relname);
        raise notice 'Removed redundant equivalent standalone unique index %, retained guard %',
          duplicate_index.relname, keep_index::regclass;
      exception when dependent_objects_still_exist then
        raise warning 'Retained redundant unique index % because another object depends on it', duplicate_index.relname;
      end;
    end loop;
  end if;

  select exists (
    select 1 from pg_index i
    where i.indrelid = 'public.job_applications'::regclass and i.indisunique and i.indisvalid
      and i.indpred is null and i.indexprs is null
      and array(select unnest(i.indkey::smallint[]) order by 1) = array(select unnest(array[job_att, user_att]::smallint[]) order by 1)
  ) into protection_exists;

  if not protection_exists then
    if exists (select 1 from public.job_applications group by job_id, candidate_user_id having count(*) > 1) then
      raise warning 'DUPLICATE_APPLICATIONS_REPORTED: no rows deleted; reconcile public.job_application_duplicate_report before adding uniqueness';
    elsif exists (select 1 from pg_constraint where conrelid = 'public.job_applications'::regclass and conname = 'job_applications_job_user_unique') then
      raise exception 'INCOMPATIBLE_SCHEMA_OBJECT: job_applications_job_user_unique';
    else
      alter table public.job_applications add constraint job_applications_job_user_unique
        unique (job_id, candidate_user_id);
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Triggers. Existing validation/history/transition/updated_at triggers are
--    preserved; only a confirmed redundant updated_at duplicate is removed,
--    and missing guards are added only when no equivalent exists.
-- ---------------------------------------------------------------------------

-- 5a. Exactly one updated_at trigger on job_applications.
do $$
declare
  upd_trigger record;
  keep_name text := null;
  trigger_def text;
begin
  -- Preferred keeper: the canonical name, else the legacy name, else any
  -- narrow updated_at trigger (alphabetically first for determinism).
  select t.tgname into keep_name
  from pg_trigger t
  where t.tgrelid = 'public.job_applications'::regclass and not t.tgisinternal
    and t.tgname in ('job_applications_set_updated_at', 'job_applications_updated_at')
    and lower(pg_get_functiondef(t.tgfoid)) like '%new.updated_at%now()%'
  order by case t.tgname when 'job_applications_set_updated_at' then 0 else 1 end
  limit 1;

  if keep_name is null then
    select t.tgname into keep_name
    from pg_trigger t
    where t.tgrelid = 'public.job_applications'::regclass and not t.tgisinternal
      and lower(pg_get_functiondef(t.tgfoid)) like '%new.updated_at%now()%'
    order by t.tgname
    limit 1;
  end if;

  if keep_name is null then
    -- No updated_at behavior at all: add the canonical one (name guaranteed
    -- free here, otherwise keep_name would have been found above).
    if not exists (select 1 from pg_trigger t
        where t.tgrelid = 'public.job_applications'::regclass and t.tgname = 'job_applications_set_updated_at') then
      create trigger job_applications_set_updated_at
        before update on public.job_applications for each row
        execute function public.job_set_updated_at();
      raise notice 'Added missing updated_at trigger job_applications_set_updated_at';
    else
      raise warning 'TRIGGER_NAME_TAKEN: job_applications_set_updated_at exists with non-updated_at behavior; left untouched for manual review';
    end if;
  else
    -- Drop only narrow updated_at duplicates. A trigger whose function does
    -- more (history/status/writes) is kept with a warning for manual review.
    for upd_trigger in
      select t.tgname, lower(pg_get_functiondef(t.tgfoid)) as definition
      from pg_trigger t
      where t.tgrelid = 'public.job_applications'::regclass and not t.tgisinternal
        and t.tgname <> keep_name
        and lower(pg_get_functiondef(t.tgfoid)) like '%new.updated_at%now()%'
      order by t.tgname
    loop
      if upd_trigger.definition like '%insert into%'
        or upd_trigger.definition like '%history%'
        or (upd_trigger.definition like '%new.status%' and upd_trigger.definition like '%old.status%') then
        raise warning 'Retained trigger %: it sets updated_at but also does more; manual review required', upd_trigger.tgname;
      else
        execute format('drop trigger %I on public.job_applications', upd_trigger.tgname);
        raise notice 'Removed redundant updated_at trigger %, retained %', upd_trigger.tgname, keep_name;
      end if;
    end loop;

    -- The retained trigger must actually fire.
    select t.tgenabled into trigger_def from pg_trigger t
    where t.tgrelid = 'public.job_applications'::regclass and t.tgname = keep_name;
    if trigger_def = 'D' then
      execute format('alter table public.job_applications enable trigger %I', keep_name);
      raise notice 'Re-enabled retained updated_at trigger %', keep_name;
    end if;
  end if;
end $$;

-- 5b. Insert identity validation: preserve production's
-- validate_job_application_trigger (or any equivalent) when present; add the
-- narrow derivation trigger only when nothing equivalent exists.
do $$
declare has_insert_validation boolean;
begin
  select exists (
    select 1 from pg_trigger t
    where t.tgrelid = 'public.job_applications'::regclass and not t.tgisinternal
      and (t.tgname = 'validate_job_application_trigger'
        or (lower(pg_get_functiondef(t.tgfoid)) like '%candidate_user_id%'
          and lower(pg_get_functiondef(t.tgfoid)) like '%auth.uid%'
          and lower(pg_get_functiondef(t.tgfoid)) like '%owner_id%'))
  ) into has_insert_validation;

  if not has_insert_validation then
    execute $ddl$
      create function public.job_reconcile_application_insert()
      returns trigger language plpgsql security definer set search_path = '' as $fn$
      declare
        actor uuid := auth.uid();
        seeker_id uuid;
        candidate_record_id uuid;
        post_row public.job_posts;
        post_owner uuid;
        post_status text;
        post_expires timestamptz;
      begin
        if actor is null then raise exception using errcode = '28000', message = 'AUTH_REQUIRED'; end if;
        if not public.job_is_admin() and public.job_current_role() <> 'job_seeker' then
          raise exception using errcode = '42501', message = 'ROLE_NOT_ALLOWED';
        end if;
        if not public.job_is_admin() then new.candidate_user_id := actor; end if;
        if new.candidate_user_id is null then raise exception using errcode = '22023', message = 'VALIDATION_ERROR'; end if;

        select c.id into seeker_id from public.job_seeker_profiles c
        where c.user_id = new.candidate_user_id
          and coalesce((to_jsonb(c) ->> 'profile_completion')::integer, 100) >= 50;
        select c.id into candidate_record_id from public.candidate_profiles c
        where c.user_id = new.candidate_user_id;
        if seeker_id is null or candidate_record_id is null then
          raise exception using errcode = 'P0001', message = 'PROFILE_INCOMPLETE';
        end if;

        select j.* into post_row from public.job_posts j where j.id = new.job_id;
        if not found then raise exception using errcode = 'P0002', message = 'JOB_NOT_FOUND'; end if;
        post_owner := coalesce((to_jsonb(post_row) ->> 'owner_id')::uuid, (to_jsonb(post_row) ->> 'created_by')::uuid);
        post_status := to_jsonb(post_row) ->> 'status';
        post_expires := (to_jsonb(post_row) ->> 'expires_at')::timestamptz;
        if post_status not in ('approved', 'published') then
          raise exception using errcode = 'P0001', message = 'JOB_NOT_PUBLISHED';
        end if;
        if post_expires is not null and post_expires <= now() then
          raise exception using errcode = 'P0001', message = 'JOB_EXPIRED';
        end if;
        if new.resume_id is not null and not exists (
          select 1 from public.job_candidate_resumes r
          where r.id = new.resume_id and r.candidate_id = seeker_id
        ) then raise exception using errcode = '42501', message = 'FOREIGN_RESUME'; end if;

        new.candidate_profile_id := seeker_id;
        new.candidate_id := candidate_record_id;
        new.owner_id := post_owner;
        new.status := 'submitted';
        new.submitted_at := now();
        new.applied_at := new.submitted_at;
        return new;
      end $fn$
    $ddl$;
    revoke execute on function public.job_reconcile_application_insert() from public, anon, authenticated;
    if not exists (select 1 from pg_trigger t
        where t.tgrelid = 'public.job_applications'::regclass and t.tgname = 'job_applications_reconcile_insert') then
      create trigger job_applications_reconcile_insert
        before insert on public.job_applications for each row
        execute function public.job_reconcile_application_insert();
    end if;
    raise notice 'Added narrow insert identity trigger job_applications_reconcile_insert (no equivalent validation existed)';
  else
    raise notice 'Preserved existing application insert validation trigger';
  end if;
end $$;

-- 5c. Immutable application ownership guard (separate from status logic).
do $$
begin
  if not exists (
    select 1 from pg_trigger t
    where t.tgrelid = 'public.job_applications'::regclass and not t.tgisinternal
      and (lower(pg_get_functiondef(t.tgfoid)) like '%immutable_application_ownership%'
        or (lower(pg_get_functiondef(t.tgfoid)) like '%old.job_id%'
          and lower(pg_get_functiondef(t.tgfoid)) like '%new.job_id%'
          and lower(pg_get_functiondef(t.tgfoid)) like '%old.candidate_user_id%'
          and lower(pg_get_functiondef(t.tgfoid)) like '%new.candidate_user_id%'))
  ) then
    execute $ddl$
      create function public.job_guard_immutable_application_fields()
      returns trigger language plpgsql set search_path = '' as $fn$
      begin
        if old.job_id is distinct from new.job_id
          or old.candidate_user_id is distinct from new.candidate_user_id
          or old.candidate_profile_id is distinct from new.candidate_profile_id
          or old.candidate_id is distinct from new.candidate_id
          or old.owner_id is distinct from new.owner_id
          or old.submitted_at is distinct from new.submitted_at
          or old.applied_at is distinct from new.applied_at then
          raise exception using errcode = '42501', message = 'IMMUTABLE_APPLICATION_OWNERSHIP';
        end if;
        return new;
      end $fn$
    $ddl$;
    revoke execute on function public.job_guard_immutable_application_fields() from public, anon, authenticated;
    if not exists (select 1 from pg_trigger t
        where t.tgrelid = 'public.job_applications'::regclass and t.tgname = 'job_applications_immutable_authority') then
      create trigger job_applications_immutable_authority
        before update on public.job_applications for each row
        execute function public.job_guard_immutable_application_fields();
    end if;
    raise notice 'Added immutable application ownership guard';
  end if;
end $$;

-- 5d. Immutable job ownership/salon guard (content stays editable by members).
do $$
begin
  if not exists (
    select 1 from pg_trigger t
    where t.tgrelid = 'public.job_posts'::regclass and not t.tgisinternal
      and (lower(pg_get_functiondef(t.tgfoid)) like '%immutable_job_ownership%'
        or (lower(pg_get_functiondef(t.tgfoid)) like '%old.created_by%'
          and lower(pg_get_functiondef(t.tgfoid)) like '%new.created_by%'
          and lower(pg_get_functiondef(t.tgfoid)) like '%old.salon_id%'
          and lower(pg_get_functiondef(t.tgfoid)) like '%new.salon_id%'))
  ) then
    execute $ddl$
      create function public.job_guard_immutable_post_authority()
      returns trigger language plpgsql set search_path = '' as $fn$
      begin
        if (to_jsonb(old) -> 'created_by') is distinct from (to_jsonb(new) -> 'created_by')
          or (to_jsonb(old) -> 'owner_id') is distinct from (to_jsonb(new) -> 'owner_id')
          or (to_jsonb(old) -> 'salon_id') is distinct from (to_jsonb(new) -> 'salon_id') then
          raise exception using errcode = '42501', message = 'IMMUTABLE_JOB_OWNERSHIP';
        end if;
        return new;
      end $fn$
    $ddl$;
    revoke execute on function public.job_guard_immutable_post_authority() from public, anon, authenticated;
    if not exists (select 1 from pg_trigger t
        where t.tgrelid = 'public.job_posts'::regclass and t.tgname = 'job_posts_immutable_authority') then
      create trigger job_posts_immutable_authority
        before update on public.job_posts for each row
        execute function public.job_guard_immutable_post_authority();
    end if;
    raise notice 'Added immutable job ownership guard';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. job_posts + job_applications RLS.
-- Order: ENSURE every required path first, then remove only confirmed
-- redundant/unsafe policies. Application writes stay RPC-first; direct table
-- policies are the narrow scoped set below.
-- ---------------------------------------------------------------------------

-- 6a. job_posts: preserve read/member policies; ensure admin CRUD.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_posts'
    and cmd in ('SELECT', 'ALL') and coalesce(qual, '') ilike '%job_is_admin%') then
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_posts'
      and policyname = 'job_posts_reconcile_admin_select') then
      create policy job_posts_reconcile_admin_select on public.job_posts for select to authenticated using (public.job_is_admin());
    else
      create policy job_posts_final_admin_select on public.job_posts for select to authenticated using (public.job_is_admin());
    end if;
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_posts'
    and cmd in ('INSERT', 'ALL') and coalesce(with_check, '') ilike '%job_is_admin%') then
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_posts'
      and policyname = 'job_posts_reconcile_admin_insert') then
      create policy job_posts_reconcile_admin_insert on public.job_posts for insert to authenticated with check (public.job_is_admin());
    else
      create policy job_posts_final_admin_insert on public.job_posts for insert to authenticated with check (public.job_is_admin());
    end if;
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_posts'
    and cmd in ('UPDATE', 'ALL') and (coalesce(qual, '') ilike '%job_is_admin%' or coalesce(with_check, '') ilike '%job_is_admin%')) then
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_posts'
      and policyname = 'job_posts_reconcile_admin_update') then
      create policy job_posts_reconcile_admin_update on public.job_posts for update to authenticated
        using (public.job_is_admin()) with check (public.job_is_admin());
    else
      create policy job_posts_final_admin_update on public.job_posts for update to authenticated
        using (public.job_is_admin()) with check (public.job_is_admin());
    end if;
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_posts'
    and cmd in ('DELETE', 'ALL') and coalesce(qual, '') ilike '%job_is_admin%') then
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_posts'
      and policyname = 'job_posts_reconcile_admin_delete') then
      create policy job_posts_reconcile_admin_delete on public.job_posts for delete to authenticated using (public.job_is_admin());
    else
      create policy job_posts_final_admin_delete on public.job_posts for delete to authenticated using (public.job_is_admin());
    end if;
  end if;
end $$;

-- 6b. job_applications: ensure candidate/employer/admin paths.
do $$
begin
  -- Candidate inserts for self only; the validation trigger replaces every
  -- browser-supplied identity, so the policy checks the settled row.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_applications'
    and cmd in ('INSERT', 'ALL') and coalesce(with_check, '') ilike '%candidate_user_id%auth.uid%') then
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_applications'
      and policyname = 'job_applications_reconcile_candidate_insert') then
      create policy job_applications_reconcile_candidate_insert
        on public.job_applications for insert to authenticated
        with check (candidate_user_id = (select auth.uid()) and status = 'submitted');
    else
      create policy job_applications_final_candidate_insert
        on public.job_applications for insert to authenticated
        with check (candidate_user_id = (select auth.uid()) and status = 'submitted');
    end if;
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_applications'
    and cmd in ('INSERT', 'ALL') and coalesce(with_check, '') ilike '%job_is_admin%') then
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_applications'
      and policyname = 'job_applications_reconcile_admin_insert') then
      create policy job_applications_reconcile_admin_insert
        on public.job_applications for insert to authenticated with check (public.job_is_admin());
    else
      create policy job_applications_final_admin_insert
        on public.job_applications for insert to authenticated with check (public.job_is_admin());
    end if;
  end if;

  -- Salon-team status management (owner/manager/recruiter of the job's salon).
  -- Column grants (§9) restrict direct UPDATE to status + employer_notes.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_applications'
    and cmd in ('UPDATE', 'ALL')
    and (coalesce(qual, '') ilike '%job_my_active_salon_ids%'
      or coalesce(with_check, '') ilike '%job_my_active_salon_ids%'
      or coalesce(qual, '') ilike '%job_can_manage_application%'
      or coalesce(with_check, '') ilike '%job_can_manage_application%')) then
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_applications'
      and policyname = 'job_applications_reconcile_manager_status') then
      create policy job_applications_reconcile_manager_status
        on public.job_applications for update to authenticated
        using (job_id in (
          select j.id from public.job_posts j
          where j.salon_id in (select public.job_my_active_salon_ids())
        ))
        with check (job_id in (
          select j.id from public.job_posts j
          where j.salon_id in (select public.job_my_active_salon_ids())
        ));
    else
      create policy job_applications_final_manager_status
        on public.job_applications for update to authenticated
        using (job_id in (
          select j.id from public.job_posts j
          where j.salon_id in (select public.job_my_active_salon_ids())
        ))
        with check (job_id in (
          select j.id from public.job_posts j
          where j.salon_id in (select public.job_my_active_salon_ids())
        ));
    end if;
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_applications'
    and cmd in ('UPDATE', 'ALL')
    and coalesce(qual, '') ilike '%job_is_admin%'
    and coalesce(with_check, '') ilike '%job_is_admin%') then
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_applications'
      and policyname = 'job_applications_reconcile_admin_update') then
      create policy job_applications_reconcile_admin_update
        on public.job_applications for update to authenticated
        using (public.job_is_admin()) with check (public.job_is_admin());
    else
      create policy job_applications_final_admin_update
        on public.job_applications for update to authenticated
        using (public.job_is_admin()) with check (public.job_is_admin());
    end if;
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_applications'
    and cmd in ('DELETE', 'ALL') and coalesce(qual, '') ilike '%job_is_admin%') then
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_applications'
      and policyname = 'job_applications_reconcile_admin_delete') then
      create policy job_applications_reconcile_admin_delete
        on public.job_applications for delete to authenticated using (public.job_is_admin());
    else
      create policy job_applications_final_admin_delete
        on public.job_applications for delete to authenticated using (public.job_is_admin());
    end if;
  end if;

  -- Safety-net SELECT paths (normally already covered by the preserved
  -- job_applications_read_related policy; created only when genuinely absent).
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_applications'
    and cmd in ('SELECT', 'ALL') and coalesce(qual, '') ilike '%candidate_user_id%auth.uid%') then
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_applications'
      and policyname = 'job_applications_final_candidate_select') then
      create policy job_applications_final_candidate_select
        on public.job_applications for select to authenticated
        using (candidate_user_id = (select auth.uid()));
    end if;
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_applications'
    and cmd in ('SELECT', 'ALL')
    and (coalesce(qual, '') ilike '%job_can_manage_application%'
      or coalesce(qual, '') ilike '%job_my_active_salon_ids%'
      or coalesce(qual, '') ilike '%job_is_admin%')) then
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_applications'
      and policyname = 'job_applications_final_team_select') then
      create policy job_applications_final_team_select
        on public.job_applications for select to authenticated
        using (
          (select public.job_is_admin())
          or job_id in (
            select p.id from public.job_posts p
            where p.salon_id in (select public.job_my_active_salon_ids())
          )
        );
    end if;
  end if;
end $$;

-- 6c. Removals on job_posts / job_applications. Each removal is narrow:
-- byte-identical duplicates (keep first), broad USING(true) policies, and
-- unrestricted candidate UPDATE policies. Named salon/member/read policies
-- are explicitly never dropped.
do $$
declare
  target_table text;
  dupe record;
  drop_name text;
begin
  foreach target_table in array array['job_posts', 'job_applications'] loop
    -- Byte-identical duplicates: keep the alphabetically first, drop rest.
    for dupe in
      select cmd, roles::text as roles_text, coalesce(qual, '') as qual_text,
             coalesce(with_check, '') as check_text, count(*) as n
      from pg_policies
      where schemaname = 'public' and tablename = target_table
      group by cmd, roles::text, coalesce(qual, ''), coalesce(with_check, '')
      having count(*) > 1
    loop
      for drop_name in
        select policyname from pg_policies
        where schemaname = 'public' and tablename = target_table
          and cmd = dupe.cmd and roles::text = dupe.roles_text
          and coalesce(qual, '') = dupe.qual_text
          and coalesce(with_check, '') = dupe.check_text
          and policyname not in (
            'job_posts_read', 'job_posts_member_update', 'job_posts_member_delete_draft',
            'job_applications_read_related')
        order by policyname offset 1
      loop
        execute format('drop policy %I on public.%I', drop_name, target_table);
        raise notice 'Removed byte-identical duplicate policy %.%', target_table, drop_name;
      end loop;
    end loop;

    -- Broad USING(true) / WITH CHECK(true): unauthorized access by definition.
    -- Preserved scoped policies + RPCs keep all legitimate flows working.
    for drop_name in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = target_table
        and (coalesce(qual, '') ~* '^\s*\(?\s*true\s*\)?\s*$'
          or coalesce(with_check, '') ~* '^\s*\(?\s*true\s*\)?\s*$')
        and policyname not in (
          'job_posts_read', 'job_posts_member_update', 'job_posts_member_delete_draft',
          'job_applications_read_related')
    loop
      execute format('drop policy %I on public.%I', drop_name, target_table);
      raise notice 'Removed unsafe broad policy %.%', target_table, drop_name;
    end loop;
  end loop;

  -- Unrestricted candidate UPDATE on job_applications: a candidate must never
  -- freely UPDATE the row (status/ownership changes are RPC + team/admin only).
  -- Withdrawal uses the withdraw_application RPC (status-based), not UPDATE.
  for drop_name in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'job_applications'
      and cmd in ('UPDATE', 'ALL')
      and (coalesce(qual, '') ilike '%candidate_user_id%auth.uid%'
        or coalesce(with_check, '') ilike '%candidate_user_id%auth.uid%')
      and coalesce(qual, '') not ilike '%job_is_admin%'
      and coalesce(with_check, '') not ilike '%job_is_admin%'
      and coalesce(qual, '') not ilike '%job_can_manage_application%'
      and coalesce(with_check, '') not ilike '%job_can_manage_application%'
      and coalesce(qual, '') not ilike '%job_my_active_salon_ids%'
      and coalesce(with_check, '') not ilike '%job_my_active_salon_ids%'
  loop
    execute format('drop policy %I on public.job_applications', drop_name);
    raise notice 'Removed unrestricted candidate UPDATE policy job_applications.% (withdrawal stays available via withdraw_application RPC)', drop_name;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Helper RPC convergence. Valid implementations are preserved; a function
--    is (re)created only when absent or when its catalog definition
--    demonstrably lacks the required team-aware guard.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.delete_employer_job(uuid)') is null
    or lower(pg_get_functiondef(to_regprocedure('public.delete_employer_job(uuid)')::oid))
      not like '%job_is_active_salon_member%' then
    execute $ddl$
      create or replace function public.delete_employer_job(target_job_id uuid)
      returns void language plpgsql security definer set search_path = '' as $fn$
      declare actor uuid := public.job_assert_authenticated(); post public.job_posts;
      begin
        select * into post from public.job_posts where id = target_job_id for update;
        if not found then raise exception using errcode = 'P0002', message = 'JOB_NOT_FOUND'; end if;
        if not public.job_is_admin() and not public.job_is_active_salon_member(post.salon_id) then
          raise exception using errcode = '42501', message = 'SALON_ACCESS_DENIED';
        end if;
        if (to_jsonb(post) ->> 'status') not in ('draft', 'rejected', 'archived') then
          raise exception using errcode = 'P0001', message = 'INVALID_JOB_TRANSITION';
        end if;
        if exists (select 1 from public.job_applications a where a.job_id = post.id) then
          raise exception using errcode = 'P0001', message = 'JOB_HAS_APPLICATIONS';
        end if;
        delete from public.job_posts where id = post.id;
      end $fn$
    $ddl$;
  end if;

  if (to_regprocedure('public.job_get_applicant_portfolio(uuid)') is null
      or lower(pg_get_functiondef(to_regprocedure('public.job_get_applicant_portfolio(uuid)')::oid))
        not like '%job_can_manage_application%')
    and to_regclass('public.job_portfolio_items') is not null then
    execute $ddl$
      create or replace function public.job_get_applicant_portfolio(target_application_id uuid)
      returns setof public.job_portfolio_items
      language plpgsql stable security definer set search_path = '' as $fn$
      declare candidate_profile uuid;
      begin
        perform public.job_assert_authenticated();
        if not public.job_can_manage_application(target_application_id) then
          raise exception using errcode = '42501', message = 'SALON_ACCESS_DENIED';
        end if;
        select a.candidate_profile_id into candidate_profile
          from public.job_applications a where a.id = target_application_id;
        if candidate_profile is null then raise exception using errcode = 'P0002', message = 'APPLICATION_NOT_FOUND'; end if;
        return query select p.* from public.job_portfolio_items p
          where p.candidate_id = candidate_profile order by p.sort_order, p.created_at;
      end $fn$
    $ddl$;
  end if;
end $$;

revoke execute on function public.delete_employer_job(uuid) from public, anon;
grant execute on function public.delete_employer_job(uuid) to authenticated;
do $$ begin
  if to_regprocedure('public.job_get_applicant_portfolio(uuid)') is not null then
    revoke execute on function public.job_get_applicant_portfolio(uuid) from public, anon;
    grant execute on function public.job_get_applicant_portfolio(uuid) to authenticated;
  end if;
end $$;

do $$
begin
  if to_regprocedure('public.job_update_employer_profile(text,text,text,text,text,text,text,text,text)') is null then
    execute $ddl$
      create function public.job_update_employer_profile(
        p_business_name text, p_contact_name text, p_phone text default null,
        p_avatar_path text default null, p_description text default null,
        p_website_url text default null, p_instagram_url text default null,
        p_city text default null, p_state text default null)
      returns void language plpgsql security definer set search_path = '' as $fn$
      declare actor uuid := public.job_assert_authenticated(); salon_uuid uuid;
      begin
        if public.job_current_role() <> 'employer'
          or char_length(trim(coalesce(p_business_name, ''))) < 2
          or char_length(trim(coalesce(p_contact_name, ''))) < 2 then
          raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
        end if;
        select m.salon_id into salon_uuid from public.job_salon_members m
        where m.user_id = actor and m.status = 'active'
        order by case m.member_role when 'owner' then 0 when 'manager' then 1 else 2 end, m.created_at limit 1;
        if salon_uuid is null then raise exception using errcode = '42501', message = 'SALON_ACCESS_DENIED'; end if;
        update public.profiles set full_name = trim(p_contact_name), phone = nullif(trim(coalesce(p_phone, '')), ''),
          avatar_path = nullif(trim(coalesce(p_avatar_path, '')), '') where id = actor;
        update public.job_employer_profiles set display_name = trim(p_contact_name), updated_at = now() where user_id = actor;
        if public.job_is_admin() or exists (select 1 from public.job_salon_members m where m.salon_id = salon_uuid
          and m.user_id = actor and m.status = 'active' and m.member_role in ('owner', 'manager')) then
          update public.salons set name = trim(p_business_name), description = nullif(trim(coalesce(p_description, '')), ''),
            city = coalesce(nullif(trim(coalesce(p_city, '')), ''), city),
            state = coalesce(nullif(trim(coalesce(p_state, '')), ''), state) where id = salon_uuid;
          update public.job_salon_profiles set website_url = nullif(trim(coalesce(p_website_url, '')), ''),
            instagram_url = nullif(trim(coalesce(p_instagram_url, '')), ''), updated_at = now() where salon_id = salon_uuid;
          update public.job_salon_locations set city = coalesce(nullif(trim(coalesce(p_city, '')), ''), city),
            state = coalesce(nullif(trim(coalesce(p_state, '')), ''), state), updated_at = now()
            where salon_id = salon_uuid and is_primary = true;
        end if;
      end $fn$
    $ddl$;
  end if;

  if to_regprocedure('public.job_create_candidate_resume(text,text,text,bigint,boolean)') is null then
    execute $ddl$
      create function public.job_create_candidate_resume(
        p_storage_path text, p_original_filename text, p_mime_type text, p_file_size bigint, p_is_primary boolean default true)
      returns public.job_candidate_resumes language plpgsql security definer set search_path = '' as $fn$
      declare actor uuid := public.job_assert_authenticated(); profile_id uuid; saved public.job_candidate_resumes;
      begin
        if public.job_current_role() <> 'job_seeker' then raise exception using errcode = '42501', message = 'ROLE_NOT_ALLOWED'; end if;
        select c.id into profile_id from public.job_seeker_profiles c where c.user_id = actor for update;
        if profile_id is null then raise exception using errcode = 'P0002', message = 'PROFILE_NOT_FOUND'; end if;
        if p_storage_path is null or p_storage_path not like actor::text || '/%'
          or not exists (select 1 from storage.objects o where o.bucket_id = 'job-resumes' and o.name = p_storage_path)
          or char_length(trim(coalesce(p_original_filename, ''))) < 1 then
          raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
        end if;
        if coalesce(p_is_primary, true) then
          update public.job_candidate_resumes set is_primary = false where candidate_id = profile_id and is_primary = true;
        end if;
        insert into public.job_candidate_resumes(candidate_id, storage_path, original_filename, mime_type, file_size, is_primary)
          values (profile_id, p_storage_path, trim(p_original_filename), p_mime_type, p_file_size, coalesce(p_is_primary, true))
          returning * into saved;
        return saved;
      end $fn$
    $ddl$;
  end if;

  if to_regprocedure('public.job_set_primary_resume(uuid)') is null then
    execute $ddl$
      create function public.job_set_primary_resume(target_resume_id uuid)
      returns void language plpgsql security definer set search_path = '' as $fn$
      declare actor uuid := public.job_assert_authenticated(); profile_id uuid;
      begin
        select c.id into profile_id from public.job_seeker_profiles c where c.user_id = actor for update;
        if profile_id is null then raise exception using errcode = 'P0002', message = 'PROFILE_NOT_FOUND'; end if;
        if not exists (select 1 from public.job_candidate_resumes r where r.id = target_resume_id and r.candidate_id = profile_id) then
          raise exception using errcode = 'P0002', message = 'RESUME_NOT_FOUND';
        end if;
        update public.job_candidate_resumes set is_primary = false
          where candidate_id = profile_id and is_primary = true and id <> target_resume_id;
        update public.job_candidate_resumes set is_primary = true
          where candidate_id = profile_id and id = target_resume_id;
      end $fn$
    $ddl$;
  end if;
end $$;

revoke execute on function public.job_update_employer_profile(text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.job_update_employer_profile(text, text, text, text, text, text, text, text, text) to authenticated;
revoke execute on function public.job_create_candidate_resume(text, text, text, bigint, boolean) from public, anon;
grant execute on function public.job_create_candidate_resume(text, text, text, bigint, boolean) to authenticated;
revoke execute on function public.job_set_primary_resume(uuid) from public, anon;
grant execute on function public.job_set_primary_resume(uuid) to authenticated;

-- Storage media helpers: (re)created only when absent or demonstrably lacking
-- the required team-aware guard.
do $$
begin
  if to_regprocedure('public.job_can_read_attached_resume(text)') is null
    or lower(pg_get_functiondef(to_regprocedure('public.job_can_read_attached_resume(text)')::oid))
      not like '%job_can_manage_application%'
    or lower(pg_get_functiondef(to_regprocedure('public.job_can_read_attached_resume(text)')::oid))
      not like '%c.user_id%auth.uid%' then
    execute $ddl$
      create or replace function public.job_can_read_attached_resume(target_storage_path text)
      returns boolean language sql stable security definer set search_path = '' as $fn$
        select public.job_is_admin() or coalesce(exists (
          select 1 from public.job_candidate_resumes r
          join public.job_seeker_profiles c on c.id = r.candidate_id
          where r.storage_path = target_storage_path and c.user_id = (select auth.uid())
        ), false) or coalesce(exists (
          select 1 from public.job_candidate_resumes r
          join public.job_applications a on a.resume_id = r.id
          where r.storage_path = target_storage_path and public.job_can_manage_application(a.id)
        ), false)
      $fn$
    $ddl$;
  end if;
  if to_regprocedure('public.job_can_read_applicant_media(uuid)') is null
    or lower(pg_get_functiondef(to_regprocedure('public.job_can_read_applicant_media(uuid)')::oid))
      not like '%job_can_manage_application%'
    or lower(pg_get_functiondef(to_regprocedure('public.job_can_read_applicant_media(uuid)')::oid))
      not like '%target_candidate_user_id%auth.uid%' then
    execute $ddl$
      create or replace function public.job_can_read_applicant_media(target_candidate_user_id uuid)
      returns boolean language sql stable security definer set search_path = '' as $fn$
        select public.job_is_admin() or target_candidate_user_id = (select auth.uid()) or coalesce(exists (
          select 1 from public.job_applications a where a.candidate_user_id = target_candidate_user_id
            and public.job_can_manage_application(a.id)
        ), false)
      $fn$
    $ddl$;
  end if;
  if to_regprocedure('public.job_can_read_offer_media(uuid)') is null
    or lower(pg_get_functiondef(to_regprocedure('public.job_can_read_offer_media(uuid)')::oid))
      not like '%job_can_manage_application%'
    or lower(pg_get_functiondef(to_regprocedure('public.job_can_read_offer_media(uuid)')::oid))
      not like '%candidate_user_id%auth.uid%' then
    execute $ddl$
      create or replace function public.job_can_read_offer_media(target_application_id uuid)
      returns boolean language sql stable security definer set search_path = '' as $fn$
        select public.job_is_admin() or coalesce(exists (
          select 1 from public.job_applications a where a.id = target_application_id
            and (a.candidate_user_id = (select auth.uid()) or public.job_can_manage_application(a.id))
        ), false)
      $fn$
    $ddl$;
  end if;
  if to_regprocedure('public.job_can_manage_offer_media(uuid)') is null
    or lower(pg_get_functiondef(to_regprocedure('public.job_can_manage_offer_media(uuid)')::oid))
      not like '%job_can_manage_application%' then
    execute $ddl$
      create or replace function public.job_can_manage_offer_media(target_application_id uuid)
      returns boolean language sql stable security definer set search_path = '' as $fn$
        select public.job_is_admin() or public.job_can_manage_application(target_application_id)
      $fn$
    $ddl$;
  end if;
end $$;

revoke execute on function public.job_can_read_attached_resume(text) from public, anon;
grant execute on function public.job_can_read_attached_resume(text) to authenticated;
revoke execute on function public.job_can_read_applicant_media(uuid) from public, anon;
grant execute on function public.job_can_read_applicant_media(uuid) to authenticated;
revoke execute on function public.job_can_read_offer_media(uuid) from public, anon;
grant execute on function public.job_can_read_offer_media(uuid) to authenticated;
revoke execute on function public.job_can_manage_offer_media(uuid) from public, anon;
grant execute on function public.job_can_manage_offer_media(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Storage: reuse existing buckets (create only when missing), keep private
--    media private, converge the team-aware media policies. No duplicate
--    buckets, no public resumes.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('job-resumes', 'job-resumes', false, 10485760, array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('job-certificates', 'job-certificates', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('job-offers', 'job-offers', false, 10485760, array['application/pdf']),
  ('job-profile-media', 'job-profile-media', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('job-message-attachments', 'job-message-attachments', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('job-support-attachments', 'job-support-attachments', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('employer-verification', 'employer-verification', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false
where storage.buckets.public is distinct from false;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('salon-public-media', 'salon-public-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Converge the reconciled media policies (drop + create = idempotent, never
-- duplicated). All other storage policies are preserved untouched.
drop policy if exists job_resume_employer_read on storage.objects;
create policy job_resume_employer_read on storage.objects for select to authenticated
using (bucket_id = 'job-resumes' and public.job_can_read_attached_resume(name));

drop policy if exists job_profile_media_applicant_read on storage.objects;
create policy job_profile_media_applicant_read on storage.objects for select to authenticated
using (
  bucket_id = 'job-profile-media'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.job_can_read_applicant_media(((storage.foldername(name))[1])::uuid)
);

drop policy if exists job_offer_related_access on storage.objects;
drop policy if exists job_offer_related_read on storage.objects;
create policy job_offer_related_read on storage.objects for select to authenticated
using (
  bucket_id = 'job-offers'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.job_can_read_offer_media(((storage.foldername(name))[1])::uuid)
);
drop policy if exists job_offer_authorized_insert on storage.objects;
create policy job_offer_authorized_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'job-offers'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.job_can_manage_offer_media(((storage.foldername(name))[1])::uuid)
);
drop policy if exists job_offer_authorized_update on storage.objects;
create policy job_offer_authorized_update on storage.objects for update to authenticated
using (
  bucket_id = 'job-offers'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.job_can_manage_offer_media(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'job-offers'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.job_can_manage_offer_media(((storage.foldername(name))[1])::uuid)
);
drop policy if exists job_offer_authorized_delete on storage.objects;
create policy job_offer_authorized_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'job-offers'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.job_can_manage_offer_media(((storage.foldername(name))[1])::uuid)
);

-- Byte-identical duplicate storage policies (any bucket): keep first, drop
-- rest. Semantics-preserving by construction; nothing else is touched.
do $$
declare
  dupe record;
  drop_name text;
begin
  for dupe in
    select cmd, roles::text as roles_text, coalesce(qual, '') as qual_text,
           coalesce(with_check, '') as check_text, count(*) as n
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
    group by cmd, roles::text, coalesce(qual, ''), coalesce(with_check, '')
    having count(*) > 1
  loop
    for drop_name in
      select policyname from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and cmd = dupe.cmd and roles::text = dupe.roles_text
        and coalesce(qual, '') = dupe.qual_text
        and coalesce(with_check, '') = dupe.check_text
      order by policyname offset 1
    loop
      execute format('drop policy %I on storage.objects', drop_name);
      raise notice 'Removed byte-identical duplicate storage policy %', drop_name;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Table / column grants.
-- Direct application UPDATE is restricted to status + employer_notes at the
-- GRANT level, so even a future policy mistake cannot expose ownership/status
-- columns to free client writes. RPCs (SECURITY DEFINER) are unaffected.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.job_posts to authenticated;
grant select, insert, delete on public.job_applications to authenticated;
revoke update on public.job_applications from authenticated;
grant update (status, employer_notes) on public.job_applications to authenticated;

commit;

-- ===========================================================================
-- 10. SAFE FINAL VERIFICATION (read-only; valid in the Supabase SQL Editor).
-- ===========================================================================

-- 10a. RLS state (relforcerowsecurity comes from pg_class, not pg_tables).
select n.nspname as schema_name, c.relname as relation_name, c.relkind,
  c.relrowsecurity as rls_enabled, c.relforcerowsecurity as force_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('candidate_profiles', 'job_seeker_profiles', 'job_posts', 'job_applications')
order by c.relname;

-- 10b. Columns of the reconciled relations.
select table_schema, table_name, column_name, ordinal_position, data_type, udt_name,
  is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('candidate_profiles', 'job_seeker_profiles', 'job_posts', 'job_applications')
order by table_name, ordinal_position;

-- 10c. Policies on the reconciled relations + jobs storage policies.
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename in ('candidate_profiles', 'job_seeker_profiles', 'job_posts', 'job_applications'))
   or (schemaname = 'storage' and tablename = 'objects' and policyname like 'job\_%' escape '\')
order by schemaname, tablename, policyname;

-- 10d. Triggers on the reconciled relations.
select n.nspname as schema_name, c.relname as table_name, t.tgname as trigger_name,
  p.proname as function_name, t.tgenabled
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal and n.nspname = 'public'
  and c.relname in ('candidate_profiles', 'job_seeker_profiles', 'job_posts', 'job_applications', 'job_application_status_history')
order by c.relname, t.tgname;

-- 10e. Constraints on job_applications (PK/UNIQUE/FK/CHECK with definitions).
select c.conname, c.contype, pg_get_constraintdef(c.oid) as definition
from pg_constraint c
where c.conrelid = 'public.job_applications'::regclass and c.contype in ('p', 'u', 'f', 'c')
order by c.contype, c.conname;

-- 10f. Foreign keys on job_applications with ON DELETE actions (must be unchanged).
select c.conname as fk_name,
  (select attname from pg_attribute where attrelid = c.conrelid and attnum = c.conkey[1]) as column_name,
  c.confrelid::regclass::text as references_table,
  case c.confdeltype when 'c' then 'CASCADE' when 'r' then 'RESTRICT' when 'n' then 'SET NULL' when 'd' then 'SET DEFAULT' when 'a' then 'NO ACTION' end as on_delete,
  c.convalidated as validated
from pg_constraint c
where c.conrelid = 'public.job_applications'::regclass and c.contype = 'f'
order by c.conname;

-- 10g. Indexes on the reconciled relations.
select tablename, indexname, indexdef from pg_indexes
where schemaname = 'public'
  and tablename in ('candidate_profiles', 'job_seeker_profiles', 'job_posts', 'job_applications')
order by tablename, indexname;

-- 10h. Security functions (present = row; absent = no row, never an error).
select p.oid::regprocedure::text as function_signature, p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in (
  'job_can_manage_application', 'job_is_active_salon_member', 'job_is_admin',
  'job_my_active_salon_ids', 'job_validate_application_transition',
  'job_record_application_history', 'job_set_updated_at', 'handle_updated_at',
  'validate_job_application', 'job_reconcile_application_insert',
  'job_guard_immutable_application_fields', 'job_guard_immutable_post_authority',
  'delete_employer_job', 'job_get_applicant_portfolio',
  'job_update_employer_profile', 'job_create_candidate_resume',
  'job_set_primary_resume', 'submit_job_application', 'withdraw_application'
)
order by p.proname, p.oid::regprocedure::text;

-- 10i. Guard counts: exactly 1 unique guard, exactly 1 updated_at trigger,
-- zero candidate-UPDATE policies, zero broad USING(true) policies.
select
  (select count(*) from pg_index i
    where i.indrelid = 'public.job_applications'::regclass and i.indisunique and i.indisvalid
      and i.indpred is null and i.indexprs is null
      and array(select unnest(i.indkey::smallint[]) order by 1) = array(
        select attnum from pg_attribute
        where attrelid = 'public.job_applications'::regclass and attname in ('job_id', 'candidate_user_id') order by 1)) as unique_job_candidate_guards,
  (select count(*) from pg_trigger t
    where t.tgrelid = 'public.job_applications'::regclass and not t.tgisinternal
      and lower(pg_get_functiondef(t.tgfoid)) like '%new.updated_at%now()%') as application_updated_at_triggers,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'job_applications' and cmd in ('UPDATE', 'ALL')
      and (coalesce(qual, '') ilike '%candidate_user_id%auth.uid%' or coalesce(with_check, '') ilike '%candidate_user_id%auth.uid%')
      and coalesce(qual, '') not ilike '%job_is_admin%' and coalesce(with_check, '') not ilike '%job_is_admin%'
      and coalesce(qual, '') not ilike '%job_can_manage_application%' and coalesce(with_check, '') not ilike '%job_can_manage_application%'
      and coalesce(qual, '') not ilike '%job_my_active_salon_ids%' and coalesce(with_check, '') not ilike '%job_my_active_salon_ids%') as candidate_update_policies,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename in ('candidate_profiles', 'job_seeker_profiles', 'job_posts', 'job_applications')
      and (coalesce(qual, '') ~* '^\s*\(?\s*true\s*\)?\s*$' or coalesce(with_check, '') ~* '^\s*\(?\s*true\s*\)?\s*$')) as broad_true_policies;

-- 10j. Non-destructive duplicate evidence (any row needs manual reconciliation).
select job_id, candidate_user_id, count(*)::bigint as duplicate_count,
  array_agg(id order by submitted_at, id) as application_ids
from public.job_applications
group by job_id, candidate_user_id
having count(*) > 1
order by duplicate_count desc, job_id, candidate_user_id;

-- 10k. Buckets (private media must all show public = false).
select id as bucket_id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('job-profile-media', 'job-resumes', 'job-certificates', 'job-offers',
  'job-message-attachments', 'job-support-attachments', 'employer-verification', 'salon-public-media')
order by id;

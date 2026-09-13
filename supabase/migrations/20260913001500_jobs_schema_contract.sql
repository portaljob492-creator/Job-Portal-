-- Nexora Jobs: one-pass, data-preserving production reconciliation.
--
-- This migration is intentionally catalog-driven. It supports both known Jobs
-- profile layouts:
--   1. a physical public.candidate_profiles table plus job_seeker_profiles; or
--   2. job_seeker_profiles as the canonical table, with candidate_profiles
--      absent (a read-only compatibility view is then created).
--
-- It never deletes business rows and never replaces existing salon/member,
-- application-history, status-transition, updated_at, admin, or role functions.
begin;

-- ---------------------------------------------------------------------------
-- 1. Required objects and RLS state.
-- ---------------------------------------------------------------------------
do $$
declare missing text[] := '{}';
begin
  if to_regclass('public.job_posts') is null then missing:=array_append(missing,'public.job_posts'); end if;
  if to_regclass('public.job_applications') is null then missing:=array_append(missing,'public.job_applications'); end if;
  if to_regclass('public.profiles') is null then missing:=array_append(missing,'public.profiles'); end if;
  if to_regclass('public.job_seeker_profiles') is null then missing:=array_append(missing,'public.job_seeker_profiles'); end if;
  if to_regclass('public.job_candidate_resumes') is null then missing:=array_append(missing,'public.job_candidate_resumes'); end if;
  if to_regclass('public.salons') is null then missing:=array_append(missing,'public.salons'); end if;
  if to_regclass('public.job_salon_members') is null then missing:=array_append(missing,'public.job_salon_members'); end if;
  if to_regclass('public.job_salon_profiles') is null then missing:=array_append(missing,'public.job_salon_profiles'); end if;
  if to_regclass('public.job_user_roles') is null then missing:=array_append(missing,'public.job_user_roles'); end if;
  if to_regclass('public.job_portfolio_items') is null then missing:=array_append(missing,'public.job_portfolio_items'); end if;
  if to_regprocedure('public.job_is_admin()') is null then missing:=array_append(missing,'public.job_is_admin()'); end if;
  if to_regprocedure('public.job_is_active_salon_member(uuid)') is null then missing:=array_append(missing,'public.job_is_active_salon_member(uuid)'); end if;
  if to_regprocedure('public.job_can_manage_application(uuid)') is null then missing:=array_append(missing,'public.job_can_manage_application(uuid)'); end if;
  if to_regprocedure('public.job_my_active_salon_ids()') is null then missing:=array_append(missing,'public.job_my_active_salon_ids()'); end if;
  if to_regprocedure('public.job_current_role()') is null then missing:=array_append(missing,'public.job_current_role()'); end if;
  if to_regprocedure('public.job_assert_authenticated()') is null then missing:=array_append(missing,'public.job_assert_authenticated()'); end if;
  if cardinality(missing)>0 then
    raise exception 'JOBS_SCHEMA_MISSING_REQUIRED_OBJECTS: %',array_to_string(missing,', ');
  end if;
end $$;

alter table public.job_posts enable row level security;
alter table public.job_applications enable row level security;
alter table public.job_seeker_profiles enable row level security;

-- Preserve a physical candidate_profiles table when production has one. Only
-- installations without it receive a read-only compatibility view.
do $$
declare candidate_kind "char";
begin
  select c.relkind into candidate_kind
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='candidate_profiles';

  if candidate_kind is null then
    execute $view$
      create view public.candidate_profiles
      with (security_barrier=true,security_invoker=false)
      as
      select
        c.id,c.user_id,p.full_name,u.email::text as email,p.phone as mobile,
        p.avatar_path as profile_image_url,c.city,p.preferred_area as area,
        education.summary as education,
        round(c.total_experience_months::numeric/12,2) as experience_years,
        coalesce(candidate_skills.items,'{}'::text[]) as skills,
        preferred_role.role_name as preferred_job_role,
        coalesce(c.expected_salary_min,pref.salary_min) as preferred_salary_min,
        coalesce(c.expected_salary_max,pref.salary_max) as preferred_salary_max,
        resume.storage_path as resume_url,
        case when c.submitted_at is null then 'draft' else 'submitted' end::text as profile_status,
        (c.profile_completion>=50) as is_complete,c.created_at,c.updated_at
      from public.job_seeker_profiles c
      join public.profiles p on p.id=c.user_id
      join auth.users u on u.id=c.user_id
      left join public.job_candidate_preferences pref on pref.candidate_id=c.id
      left join lateral(
        select string_agg(concat_ws(', ',e.course_name,e.institution_name,
          case when e.completion_year is null then null else e.completion_year::text end),
          '; ' order by e.completion_year desc nulls last,e.created_at) as summary
        from public.job_candidate_education e where e.candidate_id=c.id
      ) education on true
      left join lateral(
        select array_agg(distinct s.name order by s.name) as items
        from public.job_candidate_skills cs join public.job_skills s on s.id=cs.skill_id
        where cs.candidate_id=c.id
      ) candidate_skills on true
      left join lateral(
        select r.role_name from public.job_candidate_preferred_roles r
        where r.candidate_id=c.id order by r.created_at,r.role_name limit 1
      ) preferred_role on true
      left join lateral(
        select r.storage_path from public.job_candidate_resumes r
        where r.candidate_id=c.id
        order by r.is_primary desc,r.uploaded_at desc limit 1
      ) resume on true
      where c.user_id=(select auth.uid()) or public.job_is_admin()
    $view$;
    comment on view public.candidate_profiles is
      'Read-only compatibility projection over job_seeker_profiles; not a duplicate candidate table.';
  elsif candidate_kind in ('r','p') then
    execute 'alter table public.candidate_profiles enable row level security';
  elsif candidate_kind<>'v' then
    raise exception 'INCOMPATIBLE_SCHEMA_OBJECT: public.candidate_profiles has relkind %',candidate_kind;
  end if;
end $$;

revoke all on public.candidate_profiles from public,anon;
grant select on public.candidate_profiles to authenticated;

-- Physical candidate_profiles tables keep their existing policies. Add only a
-- missing own-user CRUD path and missing active-admin read path.
do $$
declare candidate_kind "char";
begin
  select c.relkind into candidate_kind
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='candidate_profiles';
  if candidate_kind not in ('r','p') then return; end if;

  if not exists(select 1 from pg_policies where schemaname='public' and tablename='candidate_profiles'
    and cmd in ('SELECT','ALL') and coalesce(qual,'') ilike '%user_id%auth.uid%') then
    execute 'create policy candidate_profiles_own_select on public.candidate_profiles for select to authenticated using(user_id=(select auth.uid()))';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='candidate_profiles'
    and cmd in ('INSERT','ALL') and coalesce(with_check,'') ilike '%user_id%auth.uid%') then
    execute 'create policy candidate_profiles_own_insert on public.candidate_profiles for insert to authenticated with check(user_id=(select auth.uid()))';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='candidate_profiles'
    and cmd in ('UPDATE','ALL') and coalesce(qual,'') ilike '%user_id%auth.uid%'
    and coalesce(with_check,'') ilike '%user_id%auth.uid%') then
    execute 'create policy candidate_profiles_own_update on public.candidate_profiles for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()))';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='candidate_profiles'
    and cmd in ('DELETE','ALL') and coalesce(qual,'') ilike '%user_id%auth.uid%') then
    execute 'create policy candidate_profiles_own_delete on public.candidate_profiles for delete to authenticated using(user_id=(select auth.uid()))';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='candidate_profiles'
    and cmd in ('SELECT','ALL') and coalesce(qual,'') ilike '%job_is_admin%') then
    execute 'create policy candidate_profiles_admin_select on public.candidate_profiles for select to authenticated using(public.job_is_admin())';
  end if;
  execute 'grant select,insert,update,delete on public.candidate_profiles to authenticated';
end $$;

-- Candidate profile rows are directly visible only to their user and active
-- admins. Employer access remains application-scoped through the dedicated
-- portfolio/resume functions, avoiding both broad browsing and recursive RLS.
do $$
declare
  profile_table text;
  p record;
begin
  foreach profile_table in array array['job_seeker_profiles','candidate_profiles'] loop
    if not exists(
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=profile_table and c.relkind in ('r','p')
    ) then continue; end if;

    for p in select policyname from pg_policies
      where schemaname='public' and tablename=profile_table
        and 'authenticated'=any(roles)
        and ((cmd in ('SELECT','ALL') and (
            coalesce(qual,'') ilike '%job_applications%'
            or coalesce(qual,'') ilike '%job_is_active_salon_member%'))
          or coalesce(qual,'')~* '^\s*\(?\s*true\s*\)?\s*$'
          or coalesce(with_check,'')~* '^\s*\(?\s*true\s*\)?\s*$')
    loop
      execute format('drop policy %I on public.%I',p.policyname,profile_table);
      raise notice 'Removed broad/recursive candidate profile policy %.%',profile_table,p.policyname;
    end loop;

    if not exists(select 1 from pg_policies where schemaname='public' and tablename=profile_table
      and cmd in ('SELECT','ALL') and coalesce(qual,'') ilike '%user_id%auth.uid%') then
      execute format('create policy %I on public.%I for select to authenticated using(user_id=(select auth.uid()))',
        profile_table||'_reconcile_own_select',profile_table);
    end if;
    if not exists(select 1 from pg_policies where schemaname='public' and tablename=profile_table
      and cmd in ('SELECT','ALL') and coalesce(qual,'') ilike '%job_is_admin%') then
      execute format('create policy %I on public.%I for select to authenticated using(public.job_is_admin())',
        profile_table||'_reconcile_admin_select',profile_table);
    end if;
    if not exists(select 1 from pg_policies where schemaname='public' and tablename=profile_table
      and cmd in ('INSERT','ALL') and coalesce(with_check,'') ilike '%user_id%auth.uid%') then
      execute format('create policy %I on public.%I for insert to authenticated with check(user_id=(select auth.uid()))',
        profile_table||'_reconcile_own_insert',profile_table);
    end if;
    if not exists(select 1 from pg_policies where schemaname='public' and tablename=profile_table
      and cmd in ('UPDATE','ALL') and coalesce(qual,'') ilike '%user_id%auth.uid%'
      and coalesce(with_check,'') ilike '%user_id%auth.uid%') then
      execute format('create policy %I on public.%I for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()))',
        profile_table||'_reconcile_own_update',profile_table);
    end if;
    if not exists(select 1 from pg_policies where schemaname='public' and tablename=profile_table
      and cmd in ('DELETE','ALL') and coalesce(qual,'') ilike '%user_id%auth.uid%') then
      execute format('create policy %I on public.%I for delete to authenticated using(user_id=(select auth.uid()))',
        profile_table||'_reconcile_own_delete',profile_table);
    end if;
    execute format('grant select,insert,update,delete on public.%I to authenticated',profile_table);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Reconcile application compatibility fields without shrinking the table.
-- ---------------------------------------------------------------------------
alter table public.job_applications add column if not exists candidate_id uuid;
alter table public.job_applications add column if not exists owner_id uuid;
alter table public.job_applications add column if not exists applied_at timestamptz;

-- Backfill only missing values. Existing production relationships win.
do $$
declare candidate_kind "char"; post_has_owner boolean;
begin
  select c.relkind into candidate_kind
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='candidate_profiles';
  select exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='job_posts' and column_name='owner_id') into post_has_owner;

  if candidate_kind in ('r','p') then
    execute $sql$
      update public.job_applications a set candidate_id=cp.id
      from public.candidate_profiles cp
      where a.candidate_id is null and cp.user_id=a.candidate_user_id
    $sql$;
  else
    update public.job_applications
      set candidate_id=candidate_profile_id
      where candidate_id is null;
  end if;

  if post_has_owner then
    execute $sql$
      update public.job_applications a
      set owner_id=coalesce(j.owner_id,j.created_by)
      from public.job_posts j
      where a.owner_id is null and j.id=a.job_id
    $sql$;
  else
    update public.job_applications a
      set owner_id=j.created_by
      from public.job_posts j
      where a.owner_id is null and j.id=a.job_id;
  end if;

  update public.job_applications
    set applied_at=submitted_at
    where applied_at is null and submitted_at is not null;
end $$;

-- Add only missing single-column foreign keys. Existing FK names and ON DELETE
-- actions are preserved exactly; this section never replaces a working FK.
do $$
declare candidate_kind "char"; candidate_target regclass;
begin
  select c.relkind into candidate_kind
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='candidate_profiles';
  candidate_target:=case when candidate_kind in ('r','p') then 'public.candidate_profiles'::regclass
                         else 'public.job_seeker_profiles'::regclass end;

  if not exists(select 1 from pg_constraint c where c.conrelid='public.job_applications'::regclass
    and c.contype='f'
    and c.conkey=array[(select attnum from pg_attribute where attrelid='public.job_applications'::regclass and attname='candidate_id')]::smallint[]) then
    if exists(select 1 from pg_constraint where conrelid='public.job_applications'::regclass and conname='job_applications_candidate_id_fkey') then
      raise exception 'INCOMPATIBLE_SCHEMA_OBJECT: job_applications_candidate_id_fkey';
    end if;
    execute format('alter table public.job_applications add constraint job_applications_candidate_id_fkey foreign key(candidate_id) references %s(id) on delete cascade not valid',candidate_target);
    if not exists(select 1 from public.job_applications where candidate_id is not null)
      or not exists(select 1 from public.job_applications a
        where a.candidate_id is not null
          and not exists(select 1 from public.candidate_profiles c where c.id=a.candidate_id)) then
      alter table public.job_applications validate constraint job_applications_candidate_id_fkey;
    else
      raise warning 'UNVALIDATED_APPLICATION_CANDIDATE_FK: legacy orphan rows were preserved';
    end if;
  end if;

  if not exists(select 1 from pg_constraint c where c.conrelid='public.job_applications'::regclass
    and c.contype='f'
    and c.conkey=array[(select attnum from pg_attribute where attrelid='public.job_applications'::regclass and attname='owner_id')]::smallint[]) then
    if exists(select 1 from pg_constraint where conrelid='public.job_applications'::regclass and conname='job_applications_owner_id_auth_fkey') then
      raise exception 'INCOMPATIBLE_SCHEMA_OBJECT: job_applications_owner_id_auth_fkey';
    end if;
    alter table public.job_applications add constraint job_applications_owner_id_auth_fkey
      foreign key(owner_id) references auth.users(id) on delete cascade not valid;
    if not exists(select 1 from public.job_applications a where a.owner_id is not null
      and not exists(select 1 from auth.users u where u.id=a.owner_id)) then
      alter table public.job_applications validate constraint job_applications_owner_id_auth_fkey;
    else
      raise warning 'UNVALIDATED_APPLICATION_OWNER_FK: legacy orphan rows were preserved';
    end if;
  end if;
end $$;

-- Tighten new fields only when every legacy row was safely reconciled.
do $$
begin
  if exists(select 1 from public.job_applications where candidate_id is null or owner_id is null or applied_at is null) then
    raise warning 'UNRECONCILED_APPLICATION_RELATIONSHIPS: nullable compatibility fields retained; inspect final verification output';
  else
    alter table public.job_applications alter column candidate_id set not null;
    alter table public.job_applications alter column owner_id set not null;
    alter table public.job_applications alter column applied_at set not null;
  end if;
end $$;

create index if not exists job_applications_candidate_id_idx on public.job_applications(candidate_id);
create index if not exists job_applications_owner_id_idx on public.job_applications(owner_id);

-- ---------------------------------------------------------------------------
-- 3. Exactly one candidate/job uniqueness guard; never delete duplicates.
-- ---------------------------------------------------------------------------
do $$
declare report_kind "char";
begin
  select c.relkind into report_kind from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='job_application_duplicate_report';
  if report_kind is null then
    execute $view$
      create view public.job_application_duplicate_report
      with (security_barrier=true,security_invoker=false) as
      select a.job_id,a.candidate_user_id,count(*)::bigint as duplicate_count,
        array_agg(a.id order by a.submitted_at,a.id) as application_ids,
        min(a.submitted_at) as first_submitted_at,max(a.submitted_at) as last_submitted_at
      from public.job_applications a
      where public.job_is_admin()
      group by a.job_id,a.candidate_user_id having count(*)>1
    $view$;
  elsif report_kind='v' then
    execute $view$
      create or replace view public.job_application_duplicate_report
      with (security_barrier=true,security_invoker=false) as
      select a.job_id,a.candidate_user_id,count(*)::bigint as duplicate_count,
        array_agg(a.id order by a.submitted_at,a.id) as application_ids,
        min(a.submitted_at) as first_submitted_at,max(a.submitted_at) as last_submitted_at
      from public.job_applications a
      where public.job_is_admin()
      group by a.job_id,a.candidate_user_id having count(*)>1
    $view$;
  else
    raise warning 'INCOMPATIBLE_SCHEMA_OBJECT: public.job_application_duplicate_report is not a view; preserved unchanged';
  end if;
end $$;

revoke all on public.job_application_duplicate_report from public,anon,authenticated;
grant select on public.job_application_duplicate_report to authenticated;

-- Safely consolidate duplicate equivalent UNIQUE constraints. Constraint-backed
-- protection is preferred; a valid equivalent standalone unique index also
-- counts as protection and prevents another constraint from being created.
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
    where attrelid='public.job_applications'::regclass and attname='job_id' and not attisdropped;
  select attnum into user_att from pg_attribute
    where attrelid='public.job_applications'::regclass and attname='candidate_user_id' and not attisdropped;

  select c.conname into keep_name
  from pg_constraint c
  where c.conrelid='public.job_applications'::regclass and c.contype='u'
    and array(select unnest(c.conkey) order by 1)=array(select unnest(array[job_att,user_att]::smallint[]) order by 1)
  order by case c.conname
    when 'job_applications_job_id_candidate_user_id_key' then 0
    when 'job_applications_job_user_unique' then 1
    else 2 end,c.conname
  limit 1;

  if keep_name is not null then
    for duplicate_name in
      select c.conname from pg_constraint c
      where c.conrelid='public.job_applications'::regclass and c.contype='u'
        and c.conname<>keep_name
        and array(select unnest(c.conkey) order by 1)=array(select unnest(array[job_att,user_att]::smallint[]) order by 1)
      order by c.conname
    loop
      begin
        execute format('alter table public.job_applications drop constraint %I',duplicate_name);
        raise notice 'Removed redundant equivalent unique constraint %, retained %',duplicate_name,keep_name;
      exception when dependent_objects_still_exist then
        raise warning 'Retained redundant constraint % because another object depends on it',duplicate_name;
      end;
    end loop;
  end if;

  -- Constraint-backed indexes and standalone unique indexes are equivalent
  -- guards for this purpose. Keep one, then remove only confirmed redundant
  -- standalone equivalents (never an index still owned by a constraint).
  if keep_name is not null then
    select c.conindid into keep_index from pg_constraint c
    where c.conrelid='public.job_applications'::regclass and c.conname=keep_name;
  else
    select i.indexrelid into keep_index from pg_index i join pg_class x on x.oid=i.indexrelid
    where i.indrelid='public.job_applications'::regclass and i.indisunique and i.indisvalid
      and i.indpred is null and i.indexprs is null
      and array(select unnest(i.indkey::smallint[]) order by 1)=array(select unnest(array[job_att,user_att]::smallint[]) order by 1)
    order by x.relname limit 1;
  end if;

  if keep_index is not null then
    for duplicate_index in
      select i.indexrelid,x.relname
      from pg_index i join pg_class x on x.oid=i.indexrelid
      where i.indrelid='public.job_applications'::regclass and i.indisunique and i.indisvalid
        and i.indpred is null and i.indexprs is null and i.indexrelid<>keep_index
        and array(select unnest(i.indkey::smallint[]) order by 1)=array(select unnest(array[job_att,user_att]::smallint[]) order by 1)
        and not exists(select 1 from pg_constraint c where c.conindid=i.indexrelid)
      order by x.relname
    loop
      begin
        execute format('drop index public.%I',duplicate_index.relname);
        raise notice 'Removed redundant equivalent standalone unique index %, retained guard %',
          duplicate_index.relname,keep_index::regclass;
      exception when dependent_objects_still_exist then
        raise warning 'Retained redundant unique index % because another object depends on it',duplicate_index.relname;
      end;
    end loop;
  end if;

  select exists(
    select 1 from pg_index i
    where i.indrelid='public.job_applications'::regclass and i.indisunique and i.indisvalid
      and i.indpred is null and i.indexprs is null
      and array(select unnest(i.indkey::smallint[]) order by 1)=array(select unnest(array[job_att,user_att]::smallint[]) order by 1)
  ) into protection_exists;

  if not protection_exists then
    if exists(select 1 from public.job_applications group by job_id,candidate_user_id having count(*)>1) then
      raise warning 'DUPLICATE_APPLICATIONS_REPORTED: no rows deleted; reconcile public.job_application_duplicate_report before adding uniqueness';
    elsif exists(select 1 from pg_constraint where conrelid='public.job_applications'::regclass and conname='job_applications_job_user_unique') then
      raise exception 'INCOMPATIBLE_SCHEMA_OBJECT: job_applications_job_user_unique';
    else
      alter table public.job_applications add constraint job_applications_job_user_unique
        unique(job_id,candidate_user_id);
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Preserve existing validation/history/transition/updated_at triggers.
--    Add only missing identity derivation and a separate immutable-field guard.
-- ---------------------------------------------------------------------------
do $$
declare has_insert_validation boolean;
begin
  select exists(
    select 1 from pg_trigger t
    where t.tgrelid='public.job_applications'::regclass and not t.tgisinternal
      and (t.tgname='validate_job_application_trigger'
        or (lower(pg_get_functiondef(t.tgfoid)) like '%candidate_user_id%'
          and lower(pg_get_functiondef(t.tgfoid)) like '%auth.uid%'
          and lower(pg_get_functiondef(t.tgfoid)) like '%owner_id%'))
  ) into has_insert_validation;

  if not has_insert_validation then
    execute $ddl$
      create function public.job_reconcile_application_insert()
      returns trigger language plpgsql security definer set search_path='' as $fn$
      declare
        actor uuid:=auth.uid();
        seeker_id uuid;
        candidate_record_id uuid;
        post_row public.job_posts;
        post_owner uuid;
        post_status text;
        post_expires timestamptz;
      begin
        if actor is null then raise exception using errcode='28000',message='AUTH_REQUIRED'; end if;
        if not public.job_is_admin() and public.job_current_role()<>'job_seeker' then
          raise exception using errcode='42501',message='ROLE_NOT_ALLOWED';
        end if;
        if not public.job_is_admin() then new.candidate_user_id:=actor; end if;
        if new.candidate_user_id is null then raise exception using errcode='22023',message='VALIDATION_ERROR'; end if;

        select c.id into seeker_id from public.job_seeker_profiles c
        where c.user_id=new.candidate_user_id
          and coalesce((to_jsonb(c)->>'profile_completion')::integer,100)>=50;
        select c.id into candidate_record_id from public.candidate_profiles c
        where c.user_id=new.candidate_user_id;
        if seeker_id is null or candidate_record_id is null then
          raise exception using errcode='P0001',message='PROFILE_INCOMPLETE';
        end if;

        select j.* into post_row from public.job_posts j where j.id=new.job_id;
        if not found then raise exception using errcode='P0002',message='JOB_NOT_FOUND'; end if;
        post_owner:=coalesce((to_jsonb(post_row)->>'owner_id')::uuid,(to_jsonb(post_row)->>'created_by')::uuid);
        post_status:=to_jsonb(post_row)->>'status';
        post_expires:=(to_jsonb(post_row)->>'expires_at')::timestamptz;
        if post_status not in ('approved','published') then
          raise exception using errcode='P0001',message='JOB_NOT_PUBLISHED';
        end if;
        if post_expires is not null and post_expires<=now() then
          raise exception using errcode='P0001',message='JOB_EXPIRED';
        end if;
        if new.resume_id is not null and not exists(
          select 1 from public.job_candidate_resumes r
          where r.id=new.resume_id and r.candidate_id=seeker_id
        ) then raise exception using errcode='42501',message='FOREIGN_RESUME'; end if;

        new.candidate_profile_id:=seeker_id;
        new.candidate_id:=candidate_record_id;
        new.owner_id:=post_owner;
        new.status:='submitted';
        new.submitted_at:=now();
        new.applied_at:=new.submitted_at;
        return new;
      end $fn$
    $ddl$;
    revoke execute on function public.job_reconcile_application_insert() from public,anon,authenticated;
    create trigger job_applications_reconcile_insert
      before insert on public.job_applications for each row
      execute function public.job_reconcile_application_insert();
  end if;
end $$;

do $$
begin
  if not exists(
    select 1 from pg_trigger t
    where t.tgrelid='public.job_applications'::regclass and not t.tgisinternal
      and (lower(pg_get_functiondef(t.tgfoid)) like '%immutable_application_ownership%'
        or (lower(pg_get_functiondef(t.tgfoid)) like '%old.job_id%'
          and lower(pg_get_functiondef(t.tgfoid)) like '%new.job_id%'
          and lower(pg_get_functiondef(t.tgfoid)) like '%old.candidate_user_id%'
          and lower(pg_get_functiondef(t.tgfoid)) like '%new.candidate_user_id%'))
  ) then
    execute $ddl$
      create function public.job_guard_immutable_application_fields()
      returns trigger language plpgsql set search_path='' as $fn$
      begin
        if old.job_id is distinct from new.job_id
          or old.candidate_user_id is distinct from new.candidate_user_id
          or old.candidate_profile_id is distinct from new.candidate_profile_id
          or old.candidate_id is distinct from new.candidate_id
          or old.owner_id is distinct from new.owner_id
          or old.submitted_at is distinct from new.submitted_at
          or old.applied_at is distinct from new.applied_at then
          raise exception using errcode='42501',message='IMMUTABLE_APPLICATION_OWNERSHIP';
        end if;
        return new;
      end $fn$
    $ddl$;
    revoke execute on function public.job_guard_immutable_application_fields() from public,anon,authenticated;
    create trigger job_applications_immutable_authority
      before update on public.job_applications for each row
      execute function public.job_guard_immutable_application_fields();
  end if;
end $$;

-- Team members may edit job content, but authority-bearing ownership/salon
-- columns must not be movable between users or salons. Preserve an equivalent
-- production guard when one already exists and add this narrow guard otherwise.
do $$
begin
  if not exists(
    select 1 from pg_trigger t
    where t.tgrelid='public.job_posts'::regclass and not t.tgisinternal
      and (lower(pg_get_functiondef(t.tgfoid)) like '%immutable_job_ownership%'
        or (lower(pg_get_functiondef(t.tgfoid)) like '%old.created_by%'
          and lower(pg_get_functiondef(t.tgfoid)) like '%new.created_by%'
          and lower(pg_get_functiondef(t.tgfoid)) like '%old.salon_id%'
          and lower(pg_get_functiondef(t.tgfoid)) like '%new.salon_id%'))
  ) then
    execute $ddl$
      create function public.job_guard_immutable_post_authority()
      returns trigger language plpgsql set search_path='' as $fn$
      begin
        if (to_jsonb(old)->'created_by') is distinct from (to_jsonb(new)->'created_by')
          or (to_jsonb(old)->'owner_id') is distinct from (to_jsonb(new)->'owner_id')
          or (to_jsonb(old)->'salon_id') is distinct from (to_jsonb(new)->'salon_id') then
          raise exception using errcode='42501',message='IMMUTABLE_JOB_OWNERSHIP';
        end if;
        return new;
      end $fn$
    $ddl$;
    revoke execute on function public.job_guard_immutable_post_authority() from public,anon,authenticated;
    create trigger job_posts_immutable_authority
      before update on public.job_posts for each row
      execute function public.job_guard_immutable_post_authority();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. RLS reconciliation. Existing salon/team policies and helper functions are
--    retained. Only missing paths are added; confirmed authenticated USING(true)
--    application policies are removed as unsafe.
-- ---------------------------------------------------------------------------
do $$
declare p record;
begin
  for p in select policyname from pg_policies
    where schemaname='public' and tablename='job_applications'
      and 'authenticated'=any(roles)
      and (coalesce(qual,'')~* '^\s*\(?\s*true\s*\)?\s*$'
        or coalesce(with_check,'')~* '^\s*\(?\s*true\s*\)?\s*$')
  loop
    execute format('drop policy %I on public.job_applications',p.policyname);
    raise notice 'Removed unsafe broad application policy %',p.policyname;
  end loop;
end $$;

-- Existing job post member/read policies remain untouched. Add only missing
-- active-admin paths; job_is_admin() remains the sole admin mechanism.
do $$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='job_posts'
    and cmd in ('SELECT','ALL') and coalesce(qual,'') ilike '%job_is_admin%') then
    create policy job_posts_reconcile_admin_select on public.job_posts for select to authenticated using(public.job_is_admin());
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='job_posts'
    and cmd in ('INSERT','ALL') and coalesce(with_check,'') ilike '%job_is_admin%') then
    create policy job_posts_reconcile_admin_insert on public.job_posts for insert to authenticated with check(public.job_is_admin());
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='job_posts'
    and cmd in ('UPDATE','ALL') and (coalesce(qual,'') ilike '%job_is_admin%' or coalesce(with_check,'') ilike '%job_is_admin%')) then
    create policy job_posts_reconcile_admin_update on public.job_posts for update to authenticated
      using(public.job_is_admin()) with check(public.job_is_admin());
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='job_posts'
    and cmd in ('DELETE','ALL') and coalesce(qual,'') ilike '%job_is_admin%') then
    create policy job_posts_reconcile_admin_delete on public.job_posts for delete to authenticated using(public.job_is_admin());
  end if;
end $$;
grant select,insert,update,delete on public.job_posts to authenticated;

-- Candidate insert policy verifies the caller/status after the preserved
-- validation trigger (or the narrowly added derivation trigger) has replaced
-- all browser-supplied identities. FKs and that trigger validate relationships;
-- querying related RLS tables here would create recursive application policies.
do $$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='job_applications'
    and cmd in ('INSERT','ALL') and coalesce(with_check,'') ilike '%candidate_user_id%auth.uid%') then
    create policy job_applications_reconcile_candidate_insert
      on public.job_applications for insert to authenticated
      with check(candidate_user_id=(select auth.uid()) and status='submitted');
  end if;

  if not exists(select 1 from pg_policies where schemaname='public' and tablename='job_applications'
    and cmd in ('INSERT','ALL') and coalesce(with_check,'') ilike '%job_is_admin%') then
    create policy job_applications_reconcile_admin_insert
      on public.job_applications for insert to authenticated with check(public.job_is_admin());
  end if;

  if not exists(select 1 from pg_policies where schemaname='public' and tablename='job_applications'
    and cmd in ('UPDATE','ALL')
    and (coalesce(qual,'') ilike '%job_my_active_salon_ids%'
      or coalesce(with_check,'') ilike '%job_my_active_salon_ids%')) then
    create policy job_applications_reconcile_manager_status
      on public.job_applications for update to authenticated
      using(job_id in (
        select j.id from public.job_posts j
        where j.salon_id in (select public.job_my_active_salon_ids())
      ))
      with check(job_id in (
        select j.id from public.job_posts j
        where j.salon_id in (select public.job_my_active_salon_ids())
      ));
  end if;

  if not exists(select 1 from pg_policies where schemaname='public' and tablename='job_applications'
    and cmd in ('UPDATE','ALL')
    and coalesce(qual,'') ilike '%job_is_admin%'
    and coalesce(with_check,'') ilike '%job_is_admin%') then
    create policy job_applications_reconcile_admin_update
      on public.job_applications for update to authenticated
      using(public.job_is_admin()) with check(public.job_is_admin());
  end if;

  if not exists(select 1 from pg_policies where schemaname='public' and tablename='job_applications'
    and cmd in ('DELETE','ALL') and coalesce(qual,'') ilike '%job_is_admin%') then
    create policy job_applications_reconcile_admin_delete
      on public.job_applications for delete to authenticated using(public.job_is_admin());
  end if;
end $$;

grant select,insert,delete on public.job_applications to authenticated;
revoke update on public.job_applications from authenticated;
grant update(status,employer_notes) on public.job_applications to authenticated;

-- ---------------------------------------------------------------------------
-- 6. UI RPCs. Preserve valid implementations; replace only a function whose
--    catalog definition demonstrably lacks the required team-aware guard.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.delete_employer_job(uuid)') is null
    or lower(pg_get_functiondef(to_regprocedure('public.delete_employer_job(uuid)')::oid))
      not like '%job_is_active_salon_member%' then
    execute $ddl$
      create or replace function public.delete_employer_job(target_job_id uuid)
      returns void language plpgsql security definer set search_path='' as $fn$
      declare actor uuid:=public.job_assert_authenticated(); post public.job_posts;
      begin
        select * into post from public.job_posts where id=target_job_id for update;
        if not found then raise exception using errcode='P0002',message='JOB_NOT_FOUND'; end if;
        if not public.job_is_admin() and not public.job_is_active_salon_member(post.salon_id) then
          raise exception using errcode='42501',message='SALON_ACCESS_DENIED';
        end if;
        if (to_jsonb(post)->>'status') not in ('draft','rejected','archived') then
          raise exception using errcode='P0001',message='INVALID_JOB_TRANSITION';
        end if;
        if exists(select 1 from public.job_applications a where a.job_id=post.id) then
          raise exception using errcode='P0001',message='JOB_HAS_APPLICATIONS';
        end if;
        delete from public.job_posts where id=post.id;
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
      language plpgsql stable security definer set search_path='' as $fn$
      declare candidate_profile uuid;
      begin
        perform public.job_assert_authenticated();
        if not public.job_can_manage_application(target_application_id) then
          raise exception using errcode='42501',message='SALON_ACCESS_DENIED';
        end if;
        select a.candidate_profile_id into candidate_profile
          from public.job_applications a where a.id=target_application_id;
        if candidate_profile is null then raise exception using errcode='P0002',message='APPLICATION_NOT_FOUND'; end if;
        return query select p.* from public.job_portfolio_items p
          where p.candidate_id=candidate_profile order by p.sort_order,p.created_at;
      end $fn$
    $ddl$;
  end if;
end $$;

revoke execute on function public.delete_employer_job(uuid) from public,anon;
grant execute on function public.delete_employer_job(uuid) to authenticated;
do $$ begin
  if to_regprocedure('public.job_get_applicant_portfolio(uuid)') is not null then
    revoke execute on function public.job_get_applicant_portfolio(uuid) from public,anon;
    grant execute on function public.job_get_applicant_portfolio(uuid) to authenticated;
  end if;
end $$;

-- Transactional employer profile/resume RPCs are created only when absent.
do $$
begin
  if to_regprocedure('public.job_update_employer_profile(text,text,text,text,text,text,text,text,text)') is null then
    execute $ddl$
      create function public.job_update_employer_profile(
        p_business_name text,p_contact_name text,p_phone text default null,
        p_avatar_path text default null,p_description text default null,
        p_website_url text default null,p_instagram_url text default null,
        p_city text default null,p_state text default null)
      returns void language plpgsql security definer set search_path='' as $fn$
      declare actor uuid:=public.job_assert_authenticated(); salon_uuid uuid;
      begin
        if public.job_current_role()<>'employer'
          or char_length(trim(coalesce(p_business_name,'')))<2
          or char_length(trim(coalesce(p_contact_name,'')))<2 then
          raise exception using errcode='22023',message='VALIDATION_ERROR';
        end if;
        select m.salon_id into salon_uuid from public.job_salon_members m
        where m.user_id=actor and m.status='active'
        order by case m.member_role when 'owner' then 0 when 'manager' then 1 else 2 end,m.created_at limit 1;
        if salon_uuid is null then raise exception using errcode='42501',message='SALON_ACCESS_DENIED'; end if;
        update public.profiles set full_name=trim(p_contact_name),phone=nullif(trim(coalesce(p_phone,'')),''),
          avatar_path=nullif(trim(coalesce(p_avatar_path,'')),'') where id=actor;
        update public.job_employer_profiles set display_name=trim(p_contact_name),updated_at=now() where user_id=actor;
        if public.job_is_admin() or exists(select 1 from public.job_salon_members m where m.salon_id=salon_uuid
          and m.user_id=actor and m.status='active' and m.member_role in ('owner','manager')) then
          update public.salons set name=trim(p_business_name),description=nullif(trim(coalesce(p_description,'')),''),
            city=coalesce(nullif(trim(coalesce(p_city,'')),''),city),
            state=coalesce(nullif(trim(coalesce(p_state,'')),''),state) where id=salon_uuid;
          update public.job_salon_profiles set website_url=nullif(trim(coalesce(p_website_url,'')),''),
            instagram_url=nullif(trim(coalesce(p_instagram_url,'')),''),updated_at=now() where salon_id=salon_uuid;
          update public.job_salon_locations set city=coalesce(nullif(trim(coalesce(p_city,'')),''),city),
            state=coalesce(nullif(trim(coalesce(p_state,'')),''),state),updated_at=now()
            where salon_id=salon_uuid and is_primary=true;
        end if;
      end $fn$
    $ddl$;
  end if;

  if to_regprocedure('public.job_create_candidate_resume(text,text,text,bigint,boolean)') is null then
    execute $ddl$
      create function public.job_create_candidate_resume(
        p_storage_path text,p_original_filename text,p_mime_type text,p_file_size bigint,p_is_primary boolean default true)
      returns public.job_candidate_resumes language plpgsql security definer set search_path='' as $fn$
      declare actor uuid:=public.job_assert_authenticated(); profile_id uuid; saved public.job_candidate_resumes;
      begin
        if public.job_current_role()<>'job_seeker' then raise exception using errcode='42501',message='ROLE_NOT_ALLOWED'; end if;
        select c.id into profile_id from public.job_seeker_profiles c where c.user_id=actor for update;
        if profile_id is null then raise exception using errcode='P0002',message='PROFILE_NOT_FOUND'; end if;
        if p_storage_path is null or p_storage_path not like actor::text||'/%'
          or not exists(select 1 from storage.objects o where o.bucket_id='job-resumes' and o.name=p_storage_path)
          or char_length(trim(coalesce(p_original_filename,'')))<1 then
          raise exception using errcode='22023',message='VALIDATION_ERROR';
        end if;
        if coalesce(p_is_primary,true) then
          update public.job_candidate_resumes set is_primary=false where candidate_id=profile_id and is_primary=true;
        end if;
        insert into public.job_candidate_resumes(candidate_id,storage_path,original_filename,mime_type,file_size,is_primary)
          values(profile_id,p_storage_path,trim(p_original_filename),p_mime_type,p_file_size,coalesce(p_is_primary,true))
          returning * into saved;
        return saved;
      end $fn$
    $ddl$;
  end if;

  if to_regprocedure('public.job_set_primary_resume(uuid)') is null then
    execute $ddl$
      create function public.job_set_primary_resume(target_resume_id uuid)
      returns void language plpgsql security definer set search_path='' as $fn$
      declare actor uuid:=public.job_assert_authenticated(); profile_id uuid;
      begin
        select c.id into profile_id from public.job_seeker_profiles c where c.user_id=actor for update;
        if profile_id is null then raise exception using errcode='P0002',message='PROFILE_NOT_FOUND'; end if;
        if not exists(select 1 from public.job_candidate_resumes r where r.id=target_resume_id and r.candidate_id=profile_id) then
          raise exception using errcode='P0002',message='RESUME_NOT_FOUND';
        end if;
        update public.job_candidate_resumes set is_primary=false
          where candidate_id=profile_id and is_primary=true and id<>target_resume_id;
        update public.job_candidate_resumes set is_primary=true
          where candidate_id=profile_id and id=target_resume_id;
      end $fn$
    $ddl$;
  end if;
end $$;

revoke execute on function public.job_update_employer_profile(text,text,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.job_update_employer_profile(text,text,text,text,text,text,text,text,text) to authenticated;
revoke execute on function public.job_create_candidate_resume(text,text,text,bigint,boolean) from public,anon;
grant execute on function public.job_create_candidate_resume(text,text,text,bigint,boolean) to authenticated;
revoke execute on function public.job_set_primary_resume(uuid) from public,anon;
grant execute on function public.job_set_primary_resume(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Private Storage: reuse existing buckets (create only when missing), force
--    private media buckets non-public, and narrow policies by the existing
--    application + job_can_manage_application() relationship (team-aware).
-- ---------------------------------------------------------------------------
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
  ('job-resumes','job-resumes',false,10485760,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('job-certificates','job-certificates',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp']),
  ('job-offers','job-offers',false,10485760,array['application/pdf']),
  ('job-profile-media','job-profile-media',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false
where storage.buckets.public is distinct from false;

do $$
begin
  if to_regprocedure('public.job_can_read_attached_resume(text)') is null
    or lower(pg_get_functiondef(to_regprocedure('public.job_can_read_attached_resume(text)')::oid))
      not like '%job_can_manage_application%'
    or lower(pg_get_functiondef(to_regprocedure('public.job_can_read_attached_resume(text)')::oid))
      not like '%c.user_id%auth.uid%' then
    execute $ddl$
      create or replace function public.job_can_read_attached_resume(target_storage_path text)
      returns boolean language sql stable security definer set search_path='' as $fn$
        select public.job_is_admin() or coalesce(exists(
          select 1 from public.job_candidate_resumes r
          join public.job_seeker_profiles c on c.id=r.candidate_id
          where r.storage_path=target_storage_path and c.user_id=(select auth.uid())
        ),false) or coalesce(exists(
          select 1 from public.job_candidate_resumes r
          join public.job_applications a on a.resume_id=r.id
          where r.storage_path=target_storage_path and public.job_can_manage_application(a.id)
        ),false)
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
      returns boolean language sql stable security definer set search_path='' as $fn$
        select public.job_is_admin() or target_candidate_user_id=(select auth.uid()) or coalesce(exists(
          select 1 from public.job_applications a where a.candidate_user_id=target_candidate_user_id
            and public.job_can_manage_application(a.id)
        ),false)
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
      returns boolean language sql stable security definer set search_path='' as $fn$
        select public.job_is_admin() or coalesce(exists(
          select 1 from public.job_applications a where a.id=target_application_id
            and (a.candidate_user_id=(select auth.uid()) or public.job_can_manage_application(a.id))
        ),false)
      $fn$
    $ddl$;
  end if;
  if to_regprocedure('public.job_can_manage_offer_media(uuid)') is null
    or lower(pg_get_functiondef(to_regprocedure('public.job_can_manage_offer_media(uuid)')::oid))
      not like '%job_can_manage_application%' then
    execute $ddl$
      create or replace function public.job_can_manage_offer_media(target_application_id uuid)
      returns boolean language sql stable security definer set search_path='' as $fn$
        select public.job_is_admin() or public.job_can_manage_application(target_application_id)
      $fn$
    $ddl$;
  end if;
end $$;

revoke execute on function public.job_can_read_attached_resume(text) from public,anon;
grant execute on function public.job_can_read_attached_resume(text) to authenticated;
revoke execute on function public.job_can_read_applicant_media(uuid) from public,anon;
grant execute on function public.job_can_read_applicant_media(uuid) to authenticated;
revoke execute on function public.job_can_read_offer_media(uuid) from public,anon;
grant execute on function public.job_can_read_offer_media(uuid) to authenticated;
revoke execute on function public.job_can_manage_offer_media(uuid) from public,anon;
grant execute on function public.job_can_manage_offer_media(uuid) to authenticated;

drop policy if exists job_resume_employer_read on storage.objects;
create policy job_resume_employer_read on storage.objects for select to authenticated
using(bucket_id='job-resumes' and public.job_can_read_attached_resume(name));

drop policy if exists job_profile_media_applicant_read on storage.objects;
create policy job_profile_media_applicant_read on storage.objects for select to authenticated
using(
  bucket_id='job-profile-media'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.job_can_read_applicant_media(((storage.foldername(name))[1])::uuid)
);

-- The former FOR ALL policy let candidates delete employer-owned offer files.
-- Split read and write while preserving manager/recruiter authorization through
-- job_can_manage_application().
drop policy if exists job_offer_related_access on storage.objects;
drop policy if exists job_offer_related_read on storage.objects;
create policy job_offer_related_read on storage.objects for select to authenticated
using(
  bucket_id='job-offers'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.job_can_read_offer_media(((storage.foldername(name))[1])::uuid)
);
drop policy if exists job_offer_authorized_insert on storage.objects;
create policy job_offer_authorized_insert on storage.objects for insert to authenticated
with check(
  bucket_id='job-offers'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.job_can_manage_offer_media(((storage.foldername(name))[1])::uuid)
);
drop policy if exists job_offer_authorized_update on storage.objects;
create policy job_offer_authorized_update on storage.objects for update to authenticated
using(
  bucket_id='job-offers'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.job_can_manage_offer_media(((storage.foldername(name))[1])::uuid)
)
with check(
  bucket_id='job-offers'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.job_can_manage_offer_media(((storage.foldername(name))[1])::uuid)
);
drop policy if exists job_offer_authorized_delete on storage.objects;
create policy job_offer_authorized_delete on storage.objects for delete to authenticated
using(
  bucket_id='job-offers'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.job_can_manage_offer_media(((storage.foldername(name))[1])::uuid)
);

commit;

-- ---------------------------------------------------------------------------
-- 8. Safe final verification output (read-only; valid in Supabase SQL Editor).
-- ---------------------------------------------------------------------------
select n.nspname as schema_name,c.relname as relation_name,c.relkind,
  c.relrowsecurity as rls_enabled,c.relforcerowsecurity as force_rls
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('candidate_profiles','job_seeker_profiles','job_posts','job_applications')
order by c.relname;

select table_schema,table_name,column_name,ordinal_position,data_type,udt_name,
  is_nullable,column_default
from information_schema.columns
where table_schema='public'
  and table_name in ('candidate_profiles','job_seeker_profiles','job_posts','job_applications')
order by table_name,ordinal_position;

select schemaname,tablename,policyname,cmd,roles,qual,with_check
from pg_policies
where (schemaname='public' and tablename in ('candidate_profiles','job_seeker_profiles','job_posts','job_applications'))
   or (schemaname='storage' and tablename='objects' and policyname like 'job_%')
order by schemaname,tablename,policyname;

select n.nspname as schema_name,c.relname as table_name,t.tgname as trigger_name,
  p.proname as function_name,t.tgenabled
from pg_trigger t
join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
join pg_proc p on p.oid=t.tgfoid
where not t.tgisinternal and n.nspname='public'
  and c.relname in ('candidate_profiles','job_seeker_profiles','job_posts','job_applications','job_application_status_history')
order by c.relname,t.tgname;

select c.conname,c.contype,pg_get_constraintdef(c.oid) as definition
from pg_constraint c
where c.conrelid='public.job_applications'::regclass and c.contype in ('p','u','f','c')
order by c.contype,c.conname;

select tablename,indexname,indexdef from pg_indexes
where schemaname='public'
  and tablename in ('candidate_profiles','job_seeker_profiles','job_posts','job_applications')
order by tablename,indexname;

select p.oid::regprocedure::text as function_signature,p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
  'job_can_manage_application','job_is_active_salon_member','job_is_admin',
  'job_validate_application_transition','job_record_application_history',
  'job_set_updated_at','handle_updated_at','validate_job_application',
  'delete_employer_job','job_get_applicant_portfolio','job_update_employer_profile',
  'job_create_candidate_resume','job_set_primary_resume'
)
order by p.proname,p.oid::regprocedure::text;

-- Non-destructive duplicate evidence. Any returned row requires manual
-- reconciliation; this migration never chooses an application to delete.
select job_id,candidate_user_id,count(*)::bigint as duplicate_count,
  array_agg(id order by submitted_at,id) as application_ids
from public.job_applications
group by job_id,candidate_user_id
having count(*)>1
order by duplicate_count desc,job_id,candidate_user_id;

select id as bucket_id,name,public,file_size_limit,allowed_mime_types
from storage.buckets
where id in ('job-profile-media','job-resumes','job-certificates','job-offers')
order by id;

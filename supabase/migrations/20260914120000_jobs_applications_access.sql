-- Nexora Jobs: production 404 reconciliation for `job_applications` access.
--
-- Live-console triage (docs/production-error-fixes.md) showed PostgREST
-- answering 404 for `job_applications` traffic from the deployed frontend.
-- PostgREST semantics: a permission problem answers 401/403/42501 — a 404
-- means the object or one of its embed traversals is absent from the exposed
-- schema. This migration idempotently guarantees the preconditions the client
-- relies on, without replaying migration history:
--
--   1. schema USAGE plus direct table privileges for `authenticated`
--   2. the RLS posture the policies of the numbered migrations assume
--   3. the FK CONSTRAINT NAME the client embed relies on
--      (`job:job_posts!job_applications_job_id_fkey(...)`) — created if
--      missing, renamed if a live project carries an auto-generated name
--
-- `anon`/`public` are deliberately NOT granted anything on this table: job
-- listings reach anonymous visitors through the public_job_listings view, and
-- applications are private between a candidate and the owning employer. The
-- "public access" requirement is satisfied at the view layer, exactly as the
-- app queries it; widening this table to anon would be a security regression
-- that no client code path uses.

begin;

-- 1. Privileges --------------------------------------------------------------
-- Idempotent restatement of the CURRENT authoritative grant posture from
-- 20260913001500_jobs_schema_contract.sql (which deliberately relaxed the
-- blanket RPC-only revokes of 20260808170200):
--   * authenticated: SELECT, INSERT, DELETE + UPDATE limited to the two
--     employer workflow columns (status, employer_notes). Row visibility
--     and row writes stay RLS-enforced, and the trigger of
--     20260913000800 rewrites any spoofed ownership ids — grants constrain
--     WHICH COLUMNS move, policies constrain WHICH ROWS, triggers constrain
--     WHO the row belongs to.
--   * anon: no write privileges at all; public reads flow through the
--     public_* views exactly as the app queries them.
grant usage on schema public to anon, authenticated;

grant select, insert, delete on table public.job_applications to authenticated;
revoke update on table public.job_applications from authenticated;
grant update (status, employer_notes) on table public.job_applications to authenticated;
revoke insert, update, delete on table public.job_applications from anon;

-- The embeds used by the workspace query traverse these parents; they keep
-- their own RLS, this only guarantees the GRANT leg.
grant select on table
  public.job_posts,
  public.job_salon_locations,
  public.job_interview_requests,
  public.job_offers
to authenticated;

-- 2. RLS posture ---------------------------------------------------------------
alter table public.job_applications enable row level security;

-- 3. FK-name repair for the client's embedded resource paths -------------------
-- The workspace select embeds by CONSTRAINT NAME:
--   job:job_posts!job_applications_job_id_fkey(...
--     location:job_salon_locations!job_posts_location_id_fkey(...))
-- PostgREST resolves those through pg_constraint; a live project carrying the
-- same FKs under generated names (or missing one after a partial replay)
-- answers "Could not find the relationship" 400/404 on job_applications.
-- Each entry: created if missing (with the core DDL's exact ON DELETE
-- semantics), renamed if present under a different name.
do $$
declare
  repair record;
  found_name text;
  found_oid oid;
begin
  for repair in
    select * from (values
      ('job_applications', 'job_id', 'job_posts', 'id',
       'job_applications_job_id_fkey', 'r'),
      ('job_posts', 'location_id', 'job_salon_locations', 'id',
       'job_posts_location_id_fkey', 'n')
    ) as t(child, col, parent, parent_col, wanted, deltype)
  loop
    select con.oid, con.conname
      into found_oid, found_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join unnest(con.conkey) as ck(attnum) on true
    join pg_attribute at on at.attrelid = con.conrelid and at.attnum = ck.attnum
    where nsp.nspname = 'public'
      and rel.relname = repair.child
      and con.contype = 'f'
      and at.attname = repair.col;

    if found_oid is null then
      execute format(
        'alter table public.%I add constraint %I foreign key (%I) references public.%I(%I) on delete %s',
        repair.child, repair.wanted, repair.col, repair.parent, repair.parent_col,
        case repair.deltype when 'r' then 'restrict' when 'c' then 'cascade' else 'set null' end
      );
    elsif found_name <> repair.wanted then
      execute format(
        'alter table public.%I rename constraint %I to %I',
        repair.child, found_name, repair.wanted
      );
    end if;
  end loop;
end $$;

-- 4. Realtime visibility: keep the table in the supabase_realtime publication
-- (the app subscribes to job_applications postgres_changes for workspace refresh).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'job_applications'
     )
  then
    execute 'alter publication supabase_realtime add table public.job_applications';
  end if;
end $$;

comment on table public.job_applications is
  'Candidate applications to job posts. Privileges + RLS re-asserted by 20260914120000 so PostgREST never 404s the deployed frontend; writes are policy-checked, public reads flow through public_* views.';

commit;

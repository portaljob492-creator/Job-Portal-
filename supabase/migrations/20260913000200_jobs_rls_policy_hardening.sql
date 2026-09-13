-- ===========================================================================
-- Nexora Jobs: RLS policy hardening
--
-- The tenant-isolation audit replayed every migration and inspected all 62
-- policies against the live catalog. One of them was broken: the employer
-- branch of `job_conversations_insert_participant` compared two columns of
-- `job_applications` with themselves —
--
--     where a.job_id = job_id and a.candidate_user_id = candidate_user_id
--
-- In that subquery the unqualified names bind to the *inner* table, because
-- `job_applications` has columns with exactly those names. Postgres therefore
-- evaluated `a.job_id = a.job_id and a.candidate_user_id = a.candidate_user_id`
-- — always true — leaving only "the caller manages some salon that has at least
-- one application". The practical effect, reproduced against a real database:
--
--   * an employer of salon B could create a conversation row referencing
--     salon A's job (cross-tenant row injection), and
--   * could open a conversation with any candidate, including people who never
--     applied to that job.
--
-- Both are now impossible; every reference is explicitly qualified to the row
-- being inserted, and the candidate branch additionally requires a live
-- (approved, unexpired) job or an application of their own.
--
-- Idempotent. Apply after the other jobs migrations.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. The membership test the policy needs cannot be a plain subquery: reads of
--    `job_salon_members` are themselves row-filtered, so a candidate checking
--    "is this employer an active member of the job's salon?" would silently get
--    false and no inquiry could ever be opened. SECURITY DEFINER answers the
--    question without exposing the table.
-- ---------------------------------------------------------------------------

create or replace function public.job_salon_member_is_active(target_salon_id uuid, target_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(exists (
    select 1
    from public.job_salon_members m
    join public.job_user_roles r on r.user_id = m.user_id
    join public.salons s on s.id = m.salon_id
    where m.salon_id = target_salon_id
      and m.user_id = target_user_id
      and m.status = 'active'
      and m.member_role in ('owner', 'manager', 'recruiter')
      and r.role in ('employer', 'admin')
      and r.account_status = 'active'
      and s.is_active = true
      and s.deleted_at is null
  ), false);
$$;

revoke execute on function public.job_salon_member_is_active(uuid, uuid) from public, anon;
grant execute on function public.job_salon_member_is_active(uuid, uuid) to authenticated;

-- Candidate inquiry: the job must be live (or already applied to by the caller)
-- and addressed to an active member of the salon that owns it.
create or replace function public.job_can_open_inquiry(target_job_id uuid, target_employer_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(exists (
    select 1
    from public.job_posts j
    where j.id = target_job_id
      and public.job_salon_member_is_active(j.salon_id, target_employer_user_id)
      and (
        (j.status = 'approved' and (j.expires_at is null or j.expires_at > now()))
        or exists (
          select 1 from public.job_applications a
          where a.job_id = j.id
            and a.candidate_user_id = (select auth.uid())
        )
      )
  ), false);
$$;

revoke execute on function public.job_can_open_inquiry(uuid, uuid) from public, anon;
grant execute on function public.job_can_open_inquiry(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. The corrected insert policy (see the header for what was wrong).
-- ---------------------------------------------------------------------------

drop policy if exists job_conversations_insert_participant on public.job_conversations;

create policy job_conversations_insert_participant
on public.job_conversations for insert to authenticated
with check (
  -- Candidate starts an inquiry about a live job, addressed to a member of the
  -- salon that owns the job.
  (
    candidate_user_id = (select auth.uid())
    and public.job_can_open_inquiry(job_id, employer_user_id)
  )
  or
  -- Salon member opens the thread for a candidate who applied to that salon's
  -- own job. Both columns are qualified: inside a subquery an unqualified name
  -- binds to the subquery's table first, which is what made the previous
  -- version of this policy always true.
  (
    employer_user_id = (select auth.uid())
    and exists (
      select 1 from public.job_applications a
      join public.job_posts j on j.id = a.job_id
      where a.job_id = public.job_conversations.job_id
        and a.candidate_user_id = public.job_conversations.candidate_user_id
        and public.job_is_active_salon_member(j.salon_id)
    )
  )
);

comment on policy job_conversations_insert_participant on public.job_conversations is
  'Inserts must name the caller as a participant, and the pair must be backed by the salon that owns the job (candidate inquiry) or by an application to that salon''s job (salon member). Column references are qualified on purpose: an unqualified name inside a subquery binds to the subquery''s own table first.';

comment on function public.job_can_open_inquiry(uuid, uuid) is
  'Tenant-isolation helper for job_conversations inserts: the job must be live (approved and unexpired) or already applied to by the caller, and the employer must be an active member of the salon that owns it.';

-- ---------------------------------------------------------------------------
-- 3. Shared marketplace tables that had RLS switched off entirely.
--
--    `notifications` and `push_subscriptions` are user-private tables: with RLS
--    disabled, any request carrying the public anon key can read and rewrite
--    every row. They only ever hold data for one user, so own-row policies
--    cannot break a legitimate flow while removing the exposure. Written
--    defensively: the tables and the `user_id` column are created outside these
--    migrations, so both are checked before anything is applied.
-- ---------------------------------------------------------------------------

do $do$
declare
  tbl text;
  own text;
begin
  foreach tbl in array array['notifications', 'push_subscriptions'] loop
    if exists (select 1 from information_schema.tables
                where table_schema = 'public' and table_name = tbl) then
      execute format('alter table public.%I enable row level security', tbl);

      if exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = tbl and column_name = 'user_id') then
        foreach own in array array['select', 'insert', 'update', 'delete'] loop
          execute format('drop policy if exists %I on public.%I', tbl || '_own_rows_' || own, tbl);
        end loop;

        execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))',
                       tbl || '_own_rows_select', tbl);
        execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))',
                       tbl || '_own_rows_insert', tbl);
        execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
                       tbl || '_own_rows_update', tbl);
        execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))',
                       tbl || '_own_rows_delete', tbl);

        execute format('comment on table public.%I is %L', tbl,
                       'User-private rows. RLS is enabled with own-row policies only; server-side code writes with the service role, which bypasses RLS.');
      end if;
    end if;
  end loop;
end
$do$;

-- ---------------------------------------------------------------------------
-- 4. Accepted residual risk, recorded so it is a decision and not an oversight.
--
--    `organizations` and `salons` belong to the shared marketplace schema. They
--    carry `check (true)` insert policies for `authenticated`, so any signed-in
--    user can insert a row there. Left unchanged on purpose:
--
--      * nothing in the job portal writes to them from the client — job salons
--        are created by `complete_job_employer_onboarding()`, which runs as the
--        table owner and does not need the policy;
--      * the columns available (`created_by` is nullable, salons have no owner
--        column) are not enough to bind an insert to the caller without risking
--        the other application that shares the schema;
--      * the exposure is junk/unverified business rows, not tenant data, and it
--        cannot reach job listings: there is no client insert policy on
--        `job_salon_members`, `job_salon_profiles` or `job_posts`, so a forged
--        salon can never gain members, enable jobs or publish a posting. That
--        guarantee is pinned by the test suite.
--
--    Tightening these two policies should be done together with the owning
--    application, once its insert path (and whether it sets `created_by`) is
--    known.
-- ---------------------------------------------------------------------------

commit;

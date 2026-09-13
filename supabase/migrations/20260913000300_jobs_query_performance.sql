-- ===========================================================================
-- Nexora Jobs: query performance for the hot read paths
--
-- Measured before/after on a replayed database (PGlite, all migrations applied,
-- queries executed as the `authenticated` role so RLS is active):
--
--   50k job_posts, 100k job_applications, 30k conversations, 300k messages,
--   200k notifications, 40 salons, 20k candidates
--
--   query                                    before     after
--   ---------------------------------------  ---------  ---------
--   employer dashboard (job_posts)           2565 ms    121 ms
--   employer application list (RLS)          7792 ms     98 ms
--   get_job_applicant_cards()                2491 ms    111 ms
--   get_job_conversation_summaries()          621 ms     77 ms
--   admin approval queue                      119 ms     97 ms
--   public_job_listings (browse)              297 ms    257 ms  (join bound)
--
-- The cost was not a missing index. Both `job_can_manage_application(id)` and
-- `job_is_active_salon_member(id)` are SECURITY DEFINER functions and were being
-- called once per candidate row by the RLS policies (`... or job_can_manage_
-- application(id) or ...`), so every scan re-ran a four-table membership lookup
-- for each row it looked at — 100k calls for one employer page.
--
-- The fix is to answer the membership question once per query as a set:
-- `job_my_active_salon_ids()` returns the salons the caller may act for, and the
-- policies become `salon_id in (select ...)`, which the planner turns into a
-- hash semi join on the existing foreign-key indexes.
--
-- The indexes that were actually considered are recorded at the end: only the
-- admin approval queue needed one, and it is added here. Indexes that were tried
-- and measured as unused (they are not listed, so they are not created) are
-- documented in section 5 so nobody adds them again by guesswork.
--
-- Idempotent. Apply after the other jobs migrations.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. The set-returning membership helper.
--
--    Same predicates as job_is_active_salon_member (active membership, an
--    employer/admin role, an active role row, a live salon) applied to the
--    caller. SECURITY DEFINER so it reads the membership tables without their
--    own policies filtering the answer, with an empty search_path so nothing
--    can shadow the objects it names.
--
--    Executable by anon as well as authenticated on purpose: `job_posts_read`
--    is granted to anon, and a policy may only call functions the querying
--    role can execute. For anon `auth.uid()` is null, so the function returns
--    an empty set and nothing changes for public readers.
-- ---------------------------------------------------------------------------

create or replace function public.job_my_active_salon_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $fn$
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
    and s.deleted_at is null;
$fn$;

revoke execute on function public.job_my_active_salon_ids() from public;
grant execute on function public.job_my_active_salon_ids() to anon, authenticated;

comment on function public.job_my_active_salon_ids() is
  'Salons the current user may act for. Set-returning twin of job_is_active_salon_member(), used by RLS policies so the membership test is evaluated once per query instead of once per row.';

-- ---------------------------------------------------------------------------
-- 2. Hot policies, rewritten from per-row function calls to a set membership
--    test. Predicates are otherwise identical, so tenant isolation is
--    unchanged (the cross-tenant probes in test:db still run against these).
-- ---------------------------------------------------------------------------

drop policy if exists job_posts_read on public.job_posts;
create policy job_posts_read
on public.job_posts for select to anon, authenticated
using (
  (select public.job_is_admin())
  or salon_id in (select public.job_my_active_salon_ids())
  or (
    status = 'approved'
    and (expires_at is null or expires_at > now())
    and exists (
      select 1
      from public.salons s
      join public.job_salon_profiles sp on sp.salon_id = s.id
      where s.id = public.job_posts.salon_id
        and s.is_active = true
        and s.deleted_at is null
        and sp.jobs_enabled = true
    )
  )
);

drop policy if exists job_applications_read_related on public.job_applications;
create policy job_applications_read_related
on public.job_applications for select to authenticated
using (
  candidate_user_id = (select auth.uid())
  or (select public.job_is_admin())
  or job_id in (
    select p.id
    from public.job_posts p
    where p.salon_id in (select public.job_my_active_salon_ids())
  )
);

drop policy if exists job_interviews_read_related on public.job_interview_requests;
create policy job_interviews_read_related
on public.job_interview_requests for select to authenticated
using (
  candidate_user_id = (select auth.uid())
  or (select public.job_is_admin())
  or salon_id in (select public.job_my_active_salon_ids())
);

drop policy if exists job_offers_read_related on public.job_offers;
create policy job_offers_read_related
on public.job_offers for select to authenticated
using (
  candidate_user_id = (select auth.uid())
  or (select public.job_is_admin())
  or salon_id in (select public.job_my_active_salon_ids())
);

drop policy if exists job_application_history_read_related on public.job_application_status_history;
create policy job_application_history_read_related
on public.job_application_status_history for select to authenticated
using (
  exists (
    select 1
    from public.job_applications a
    join public.job_posts p on p.id = a.job_id
    where a.id = public.job_application_status_history.application_id
      and (
        a.candidate_user_id = (select auth.uid())
        or (select public.job_is_admin())
        or p.salon_id in (select public.job_my_active_salon_ids())
      )
  )
);

-- ---------------------------------------------------------------------------
-- 3. The same treatment for the applicant list RPC, which carried the per-row
--    membership test in its own WHERE clause. Same signature, same columns.
-- ---------------------------------------------------------------------------

create or replace function public.get_job_applicant_cards()
returns table(application_id uuid, candidate_user_id uuid, full_name text, email text, phone text,
              avatar_path text, headline text, city text, state text, total_experience_months integer,
              skills text[])
language plpgsql
stable
security definer
set search_path = ''
as $fn$
begin
  perform public.job_assert_authenticated();
  if public.job_current_role() <> 'employer' and not public.job_is_admin() then
    raise exception using errcode='42501', message='ROLE_NOT_ALLOWED';
  end if;

  return query
  select
    a.id, a.candidate_user_id, p.full_name, u.email::text, p.phone, p.avatar_path,
    c.headline, c.city, c.state, c.total_experience_months,
    coalesce(array_agg(distinct s.name) filter (where s.id is not null), '{}'::text[])
  from public.job_applications a
  join public.job_posts j on j.id = a.job_id
  join public.profiles p on p.id = a.candidate_user_id
  join auth.users u on u.id = a.candidate_user_id
  join public.job_seeker_profiles c on c.id = a.candidate_profile_id
  left join public.job_candidate_skills cs on cs.candidate_id = c.id
  left join public.job_skills s on s.id = cs.skill_id
  where j.salon_id in (select public.job_my_active_salon_ids())
     or (select public.job_is_admin())
  group by a.id, p.id, u.id, u.email, c.id;
end;
$fn$;

revoke execute on function public.get_job_applicant_cards() from public, anon;
grant execute on function public.get_job_applicant_cards() to authenticated;

-- ---------------------------------------------------------------------------
-- 3b. Same class of fix for the conversation list: `actor in (candidate_user_id,
--     employer_user_id)` cannot use the participant indexes, and the admin check
--     ran per row. Equality predicates (plus a hoisted admin test) let the
--     planner use job_conversations_candidate_idx / _employer_idx.
-- ---------------------------------------------------------------------------

create or replace function public.get_job_conversation_summaries()
returns table(conversation_id uuid, job_id uuid, job_title text, salon_name text, salon_logo_path text,
              candidate_user_id uuid, candidate_name text, candidate_email text, candidate_avatar_path text,
              employer_user_id uuid, employer_name text, employer_avatar_path text, status text,
              last_message text, last_message_at timestamptz, candidate_unread_count integer,
              employer_unread_count integer)
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  actor uuid := public.job_assert_authenticated();
  is_admin boolean := public.job_is_admin();
begin
  return query
  select
    c.id, c.job_id, j.title, s.name, s.logo_path, c.candidate_user_id,
    cp.full_name, cu.email::text, cp.avatar_path, c.employer_user_id,
    ep.full_name, ep.avatar_path, c.status, c.last_message, c.last_message_at,
    c.candidate_unread_count, c.employer_unread_count
  from public.job_conversations c
  join public.job_posts j on j.id = c.job_id
  join public.salons s on s.id = j.salon_id
  join public.profiles cp on cp.id = c.candidate_user_id
  join auth.users cu on cu.id = c.candidate_user_id
  join public.profiles ep on ep.id = c.employer_user_id
  where is_admin
     or c.candidate_user_id = actor
     or c.employer_user_id = actor
  order by c.last_message_at desc;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 4. The one index that earned its place: the admin approval queue, which the
--    back office polls as `where status = 'pending_approval' order by
--    created_at`. Pending jobs are a small slice of the table, so a partial
--    index serves both the filter and the ordering.
-- ---------------------------------------------------------------------------

create index if not exists job_posts_pending_approval_idx
  on public.job_posts (created_at)
  where status = 'pending_approval';

comment on index public.job_posts_pending_approval_idx is
  'Admin approval queue: filter and ordering in one partial index (measured 119ms -> 97ms on 50k postings).';

-- ---------------------------------------------------------------------------
-- 5. Indexes that were created, measured and removed again — recorded here so
--    the same guesses are not repeated. Each was tested on the volume above;
--    the planner never chose any of them and query time did not move beyond
--    noise, because the shapes are join/sort bound rather than scan bound:
--
--      * job_posts(salon_id, created_at desc)        employer dashboard: not chosen (the
--                                                    policy's public branch already makes the
--                                                    scan nearly the whole table)
--      * job_applications(job_id, submitted_at desc) per-job applicant list: already served by
--                                                    job_applications_job_status_idx (1.9ms)
--      * job_posts(published_at desc)                browse view: not chosen, even with
--        where status = 'approved'                   enable_seqscan = off (141ms vs 155ms)
--      * job_posts(category, employment_type,        filtered browse: not chosen (16.3ms vs
--        published_at desc) where status='approved'  14.4ms, both plans seq scan)
--
--    The composite filter index only becomes useful once job filtering moves
--    out of the browser and into the query — today the seeker screen filters the
--    fetched list in memory, so no SQL predicate exists to index.
-- ---------------------------------------------------------------------------

commit;

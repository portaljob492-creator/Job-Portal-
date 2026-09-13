-- ===========================================================================
-- Nexora Jobs: atomic procedures for the workflows that were still multi-step
--
-- A stored procedure is one transaction, so the job-application, interview and
-- offer workflows that already live in RPCs are atomic by construction (they
-- write the application, its status history, notifications and audit rows in a
-- single call — see submit_job_application(), close_job(), mark_candidate_hired()
-- in the earlier migrations). The audit for this migration looked for workflows
-- the *client* still assembles from several writes, and for automation that was
-- missing entirely. Three things came out of it:
--
--   1. Saving a profile wrote two tables from the browser (`profiles` and then
--      `job_seeker_profiles` / `job_employer_profiles`). A failure between them
--      left the account half-updated. -> job_save_profile()
--
--   2. Starting a chat read the job, then guessed the employer from the salon
--      membership table, then scanned the whole salon applicant list to resolve
--      one candidate, then inserted the conversation. Four round trips from the
--      browser, participant resolution done client-side, and a second write
--      (the first message) in a different transaction. -> job_open_conversation()
--      and job_send_message() resolve participants server-side and commit the
--      conversation and its first message together.
--
--   3. Nothing moved an application out of the pipeline when a posting expired.
--      `close_job()` already closes applications, but silently — the candidate
--      was never told. -> close_job() now notifies, and job_expire_stale_jobs()
--      automates expiry (run it from a scheduled job; see the comment on it).
--
-- Idempotent. Apply after the other jobs migrations.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Atomic profile save: `profiles` plus the caller's role-specific row in one
--    transaction. Only the role the account actually has is touched, so a user
--    with both a candidate and an employer row can never have the other side
--    cleared as a side effect.
-- ---------------------------------------------------------------------------

create or replace function public.job_save_profile(
  p_full_name text,
  p_phone text default null,
  p_avatar_path text default null,
  p_headline text default null,
  p_bio text default null,
  p_display_name text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  actor uuid := public.job_assert_authenticated();
  role text := public.job_current_role();
begin
  if p_full_name is null or char_length(trim(p_full_name)) < 2 then
    raise exception using errcode='P0001', message='VALIDATION_ERROR';
  end if;

  update public.profiles
     set full_name = trim(p_full_name),
         phone = nullif(trim(coalesce(p_phone, '')), ''),
         avatar_path = nullif(trim(coalesce(p_avatar_path, '')), '')
   where id = actor;
  if not found then
    raise exception using errcode='P0002', message='PROFILE_NOT_FOUND';
  end if;

  if role = 'job_seeker' then
    update public.job_seeker_profiles
       set headline = nullif(trim(coalesce(p_headline, '')), ''),
           bio = nullif(trim(coalesce(p_bio, '')), '')
     where user_id = actor;
  elsif role in ('employer', 'admin') then
    update public.job_employer_profiles
       set display_name = nullif(trim(coalesce(p_display_name, '')), '')
     where user_id = actor;
  end if;
end
$fn$;

-- ---------------------------------------------------------------------------
-- 2. Atomic conversation open. The caller's side is decided on the server:
--    a salon member opens a thread with a candidate who applied to that salon's
--    posting; anybody else opens their own inquiry about the posting. Both rules
--    mirror the insert policy on job_conversations, which this function bypasses
--    because it is SECURITY DEFINER — the checks below are the boundary.
--    Calling it twice returns the existing conversation instead of failing.
-- ---------------------------------------------------------------------------

create or replace function public.job_open_conversation(
  p_job_id uuid,
  p_conversation_id uuid default null,
  p_candidate_email text default null
)
returns public.job_conversations
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  actor uuid := public.job_assert_authenticated();
  post public.job_posts;
  candidate uuid;
  employer uuid;
  conversation public.job_conversations;
begin
  select * into post from public.job_posts where id = p_job_id;
  if not found then
    raise exception using errcode='P0002', message='JOB_NOT_FOUND';
  end if;

  if post.salon_id in (select public.job_my_active_salon_ids()) then
    -- Salon side: the candidate must be somebody who applied to this posting.
    if p_candidate_email is null or trim(p_candidate_email) = '' then
      raise exception using errcode='P0001', message='VALIDATION_ERROR';
    end if;
    select a.candidate_user_id into candidate
      from public.job_applications a
      join auth.users u on u.id = a.candidate_user_id
     where a.job_id = post.id
       and lower(u.email) = lower(trim(p_candidate_email))
     limit 1;
    if candidate is null then
      raise exception using errcode='P0002', message='CANDIDATE_NOT_FOUND';
    end if;
    employer := actor;
  else
    -- Candidate side: the caller opens their own inquiry about a live posting.
    -- A user has exactly one portal role (job_user_roles is keyed by user_id),
    -- so an employer account cannot open a candidate inquiry here.
    if public.job_current_role() <> 'job_seeker' then
      raise exception using errcode='42501', message='ROLE_NOT_ALLOWED';
    end if;
    candidate := actor;
    select m.user_id into employer
      from public.job_salon_members m
     where m.salon_id = post.salon_id
       and m.status = 'active'
     order by m.created_at
     limit 1;
    if employer is null or not public.job_can_open_inquiry(post.id, employer) then
      raise exception using errcode='P0001', message='JOB_NOT_PUBLISHED';
    end if;
  end if;

  select * into conversation
    from public.job_conversations
   where job_id = post.id
     and candidate_user_id = candidate
     and employer_user_id = employer;

  if not found then
    begin
      insert into public.job_conversations(
        id, job_id, candidate_user_id, employer_user_id, status, last_message
      ) values (
        coalesce(p_conversation_id, gen_random_uuid()), post.id, candidate, employer, 'inquiry', 'Conversation started'
      ) returning * into conversation;
    exception when unique_violation then
      -- Two requests opened the same thread at once; return the winner's row.
      select * into conversation
        from public.job_conversations
       where job_id = post.id
         and candidate_user_id = candidate
         and employer_user_id = employer;
    end;
  end if;

  return conversation;
end
$fn$;

-- ---------------------------------------------------------------------------
-- 3. Atomic message send: the participant check, the message insert and the
--    conversation counters (kept up to date by job_sync_message_conversation)
--    all happen in this one transaction. A stranger gets a clear code instead of
--    a policy violation, and an empty message is rejected before it reaches the
--    table's constraint.
-- ---------------------------------------------------------------------------

create or replace function public.job_send_message(
  p_conversation_id uuid,
  p_body text,
  p_attachment jsonb default null,
  p_message_id uuid default null
)
returns public.job_messages
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  actor uuid := public.job_assert_authenticated();
  conversation public.job_conversations;
  message public.job_messages;
begin
  select * into conversation from public.job_conversations where id = p_conversation_id;
  if not found then
    raise exception using errcode='P0002', message='CONVERSATION_NOT_FOUND';
  end if;
  if actor <> conversation.candidate_user_id and actor <> conversation.employer_user_id then
    raise exception using errcode='42501', message='CONVERSATION_ACCESS_DENIED';
  end if;

  if coalesce(char_length(trim(p_body)), 0) = 0 and p_attachment is null then
    raise exception using errcode='P0001', message='VALIDATION_ERROR';
  end if;
  if char_length(coalesce(p_body, '')) > 4000 then
    raise exception using errcode='P0001', message='VALIDATION_ERROR';
  end if;

  insert into public.job_messages(id, conversation_id, sender_user_id, body, attachment)
  values (coalesce(p_message_id, gen_random_uuid()), conversation.id, actor, coalesce(p_body, ''), p_attachment)
  returning * into message;

  return message;
end
$fn$;

-- ---------------------------------------------------------------------------
-- 4. close_job(), unchanged except that the candidates whose applications were
--    just closed are notified. The affected ids are collected before the update
--    so a second call on the same posting cannot re-notify anybody.
-- ---------------------------------------------------------------------------

create or replace function public.close_job(target_job_id uuid)
returns job_posts
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  actor uuid := public.job_assert_authenticated();
  post public.job_posts;
  closed_ids uuid[];
begin
  select * into post from public.job_posts where id = target_job_id for update;
  if not found then raise exception using errcode='P0002', message='JOB_NOT_FOUND'; end if;
  if not public.job_is_active_salon_member(post.salon_id) then
    raise exception using errcode='42501', message='SALON_ACCESS_DENIED';
  end if;

  select coalesce(array_agg(a.id), '{}'::uuid[]) into closed_ids
    from public.job_applications a
   where a.job_id = target_job_id
     and a.status not in ('hired', 'rejected', 'withdrawn', 'position_closed');

  perform set_config('app.job_trusted_status_change', 'yes', true);
  update public.job_posts set status = 'closed' where id = target_job_id returning * into post;

  perform set_config('app.job_transition_reason', 'Position closed', true);
  update public.job_applications set status = 'position_closed' where id = any(closed_ids);

  insert into public.job_notifications(user_id, type, title, body, entity_type, entity_id)
  select a.candidate_user_id, 'position_closed', 'Position closed',
         'The employer closed the position you applied for.', 'application', a.id
  from public.job_applications a
  where a.id = any(closed_ids);

  insert into public.job_audit_log(actor_user_id, action, entity_type, entity_id, salon_id)
  values (actor, 'job_closed', 'job', post.id, post.salon_id);

  return post;
end
$fn$;

-- ---------------------------------------------------------------------------
-- 5. Expiry automation. Postings carry an `expires_at`; until now nothing moved
--    them out of `approved`, so they stayed in the employer dashboard and their
--    applicants stayed in the pipeline forever. This maintenance procedure
--    flips the stale postings to `expired`, closes their open applications and
--    notifies both sides, in one transaction.
--
--    Callable by an administrator from the back office, or by the service role
--    from a scheduled job — there is no scheduler in this repository, so wire it
--    up with the Supabase scheduler or a cron entry:
--
--      select public.job_expire_stale_jobs();
--
--    Safe to run repeatedly and concurrently (rows are locked with skip locked
--    and only postings that are still `approved` past their date are touched).
-- ---------------------------------------------------------------------------

create or replace function public.job_expire_stale_jobs(p_limit integer default 200)
returns table(expired_jobs integer, closed_applications integer)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  actor uuid := (select auth.uid());
  stale_ids uuid[];
  closed_ids uuid[];
begin
  if actor is not null and not public.job_is_admin() then
    raise exception using errcode='42501', message='ROLE_NOT_ALLOWED';
  end if;

  select coalesce(array_agg(s.id), '{}'::uuid[]) into stale_ids
    from (
      select p.id
      from public.job_posts p
      where p.status = 'approved'
        and p.expires_at is not null
        and p.expires_at <= now()
      order by p.expires_at
      limit greatest(coalesce(p_limit, 200), 1)
      for update skip locked
    ) s;

  if coalesce(array_length(stale_ids, 1), 0) = 0 then
    return query select 0, 0;
    return;
  end if;

  select coalesce(array_agg(a.id), '{}'::uuid[]) into closed_ids
    from public.job_applications a
   where a.job_id = any(stale_ids)
     and a.status not in ('hired', 'rejected', 'withdrawn', 'position_closed');

  perform set_config('app.job_trusted_status_change', 'yes', true);
  perform set_config('app.job_transition_reason', 'Position expired', true);

  update public.job_posts set status = 'expired' where id = any(stale_ids);
  update public.job_applications set status = 'position_closed' where id = any(closed_ids);

  insert into public.job_notifications(user_id, type, title, body, entity_type, entity_id)
  select a.candidate_user_id, 'position_closed', 'Position closed',
         'The position you applied for has expired.', 'application', a.id
  from public.job_applications a
  where a.id = any(closed_ids);

  insert into public.job_notifications(user_id, type, title, body, entity_type, entity_id)
  select distinct m.user_id, 'job_expired', 'Posting expired',
         'Your posting "' || p.title || '" has expired and is no longer listed.', 'job', p.id
  from public.job_posts p
  join public.job_salon_members m on m.salon_id = p.salon_id and m.status = 'active'
  where p.id = any(stale_ids);

  insert into public.job_audit_log(actor_user_id, action, entity_type, entity_id, salon_id)
  select actor, 'job_expired', 'job', p.id, p.salon_id
  from public.job_posts p
  where p.id = any(stale_ids);

  return query select coalesce(array_length(stale_ids, 1), 0), coalesce(array_length(closed_ids, 1), 0);
end
$fn$;

-- ---------------------------------------------------------------------------
-- 6. Privileges: application RPCs are for signed-in users only; the maintenance
--    procedure is also callable by the service role so a scheduler can run it.
-- ---------------------------------------------------------------------------

revoke execute on function public.job_save_profile(text, text, text, text, text, text) from public, anon;
revoke execute on function public.job_open_conversation(uuid, uuid, text) from public, anon;
revoke execute on function public.job_send_message(uuid, text, jsonb, uuid) from public, anon;
revoke execute on function public.job_expire_stale_jobs(integer) from public, anon;
grant execute on function public.job_save_profile(text, text, text, text, text, text) to authenticated;
grant execute on function public.job_open_conversation(uuid, uuid, text) to authenticated;
grant execute on function public.job_send_message(uuid, text, jsonb, uuid) to authenticated;
grant execute on function public.job_expire_stale_jobs(integer) to authenticated, service_role;

comment on function public.job_save_profile(text, text, text, text, text, text) is
  'Saves the caller profile and its role-specific row in one transaction; only the row matching the account role is written.';
comment on function public.job_open_conversation(uuid, uuid, text) is
  'Opens (or returns) a job conversation with server-side participant resolution: a salon member must name a candidate who applied, anybody else opens their own inquiry about a live posting.';
comment on function public.job_send_message(uuid, text, jsonb, uuid) is
  'Inserts a message for a participant of the conversation; the conversation counters are updated by the existing trigger in the same transaction.';
comment on function public.job_expire_stale_jobs(integer) is
  'Maintenance: expires approved postings past expires_at, closes their open applications and notifies both sides. Run from a scheduler (service role) or by an administrator.';

commit;

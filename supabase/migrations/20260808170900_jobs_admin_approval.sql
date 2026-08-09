-- Nexora Jobs: mandatory admin approval for every newly submitted job.
begin;

alter table public.job_posts add column if not exists admin_review_reason text;
alter table public.job_posts add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.job_posts add column if not exists reviewed_at timestamptz;

alter table public.job_posts drop constraint if exists job_posts_status_check;
update public.job_posts set status='approved' where status='published';
alter table public.job_posts alter column status set default 'pending_approval';
alter table public.job_posts add constraint job_posts_status_check check (
  status in ('draft','pending_approval','approved','rejected','paused','closed','expired','archived')
);

create or replace view public.public_job_listings
with (security_barrier=true, security_invoker=false)
as
select
  j.id,j.title,j.category,j.description,j.responsibilities,j.employment_type,
  j.workplace_type,j.experience_min_months,j.experience_max_months,
  j.freshers_allowed,j.salary_min,j.salary_max,j.pay_type,j.incentives,
  j.tips_info,j.benefits,j.working_days,j.working_hours,j.weekly_off,
  j.joining_date,j.openings,j.image_path,j.tags,j.published_at,j.expires_at,
  s.id as salon_id,s.name as salon_name,s.slug as salon_slug,s.logo_path,
  s.verified as salon_verified,s.rating_average,s.review_count,
  coalesce(l.city,s.city) as city,coalesce(l.state,s.state) as state,
  l.id as location_id,l.label as location_label
from public.job_posts j
join public.salons s on s.id=j.salon_id
join public.job_salon_profiles sp on sp.salon_id=s.id
left join public.job_salon_locations l on l.id=j.location_id
where j.status='approved'
  and (j.expires_at is null or j.expires_at>now())
  and s.is_active=true and s.deleted_at is null and sp.jobs_enabled=true;

-- Public/seeker reads only approved jobs; salon members see every status for
-- their own salon and admins see all rows.
drop policy if exists job_posts_read on public.job_posts;
create policy job_posts_read
on public.job_posts for select to anon,authenticated
using (
  public.job_is_admin() or public.job_is_active_salon_member(salon_id) or (
    status='approved' and (expires_at is null or expires_at>now()) and exists(
      select 1 from public.salons s join public.job_salon_profiles sp on sp.salon_id=s.id
      where s.id=job_posts.salon_id and s.is_active=true and s.deleted_at is null and sp.jobs_enabled=true
    )
  )
);

-- Employers may edit drafts/rejected posts only. Pending posts are locked while
-- under review; editing a rejected job requires a fresh submission RPC.
drop policy if exists job_posts_member_update on public.job_posts;
create policy job_posts_member_update
on public.job_posts for update to authenticated
using(public.job_is_active_salon_member(salon_id) and status in ('draft','rejected'))
with check(public.job_is_active_salon_member(salon_id) and status in ('draft','rejected','pending_approval'));

create or replace function public.submit_job_for_approval(target_job_id uuid)
returns public.job_posts language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.job_assert_authenticated(); post public.job_posts;
begin
  select * into post from public.job_posts where id=target_job_id for update;
  if not found then raise exception using errcode='P0002',message='JOB_NOT_FOUND'; end if;
  if not public.job_is_active_salon_member(post.salon_id) or post.status not in ('draft','rejected') then
    raise exception using errcode='42501',message='INVALID_JOB_TRANSITION'; end if;
  perform set_config('app.job_trusted_status_change','yes',true);
  update public.job_posts set status='pending_approval',admin_review_reason=null,reviewed_by=null,reviewed_at=null,published_at=null
  where id=target_job_id returning * into post;
  insert into public.job_audit_log(actor_user_id,action,entity_type,entity_id,salon_id)
  values(actor,'job_submitted_for_approval','job',post.id,post.salon_id);
  return post;
end $$;

create or replace function public.approve_job(target_job_id uuid)
returns public.job_posts language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.job_assert_authenticated(); post public.job_posts;
begin
  if not public.job_is_admin() then raise exception using errcode='42501',message='ROLE_NOT_ALLOWED'; end if;
  select * into post from public.job_posts where id=target_job_id for update;
  if not found then raise exception using errcode='P0002',message='JOB_NOT_FOUND'; end if;
  if post.status<>'pending_approval' then raise exception using errcode='P0001',message='INVALID_JOB_TRANSITION'; end if;
  perform set_config('app.job_trusted_status_change','yes',true);
  update public.job_posts set status='approved',published_at=now(),reviewed_by=actor,reviewed_at=now(),admin_review_reason=null
  where id=target_job_id returning * into post;
  perform public.job_create_match_notifications(target_job_id);
  insert into public.job_notifications(user_id,type,title,body,entity_type,entity_id)
  values(post.created_by,'job_approved','Job post approved','Your job post "'||post.title||'" is now live.','job',post.id);
  insert into public.job_audit_log(actor_user_id,action,entity_type,entity_id,salon_id)
  values(actor,'job_approved','job',post.id,post.salon_id);
  return post;
end $$;

create or replace function public.reject_job(target_job_id uuid,p_reason text default null)
returns public.job_posts language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.job_assert_authenticated(); post public.job_posts;
begin
  if not public.job_is_admin() then raise exception using errcode='42501',message='ROLE_NOT_ALLOWED'; end if;
  select * into post from public.job_posts where id=target_job_id for update;
  if not found then raise exception using errcode='P0002',message='JOB_NOT_FOUND'; end if;
  if post.status<>'pending_approval' then raise exception using errcode='P0001',message='INVALID_JOB_TRANSITION'; end if;
  perform set_config('app.job_trusted_status_change','yes',true);
  update public.job_posts set status='rejected',published_at=null,reviewed_by=actor,reviewed_at=now(),admin_review_reason=nullif(trim(p_reason),'')
  where id=target_job_id returning * into post;
  insert into public.job_notifications(user_id,type,title,body,entity_type,entity_id,metadata)
  values(post.created_by,'job_rejected','Job post needs changes','Your job post "'||post.title||'" was not approved.','job',post.id,jsonb_build_object('reason',p_reason));
  insert into public.job_audit_log(actor_user_id,action,entity_type,entity_id,salon_id,metadata)
  values(actor,'job_rejected','job',post.id,post.salon_id,jsonb_build_object('reason',p_reason));
  return post;
end $$;

-- Backward-compatible name is now admin-only approval.
create or replace function public.publish_job(target_job_id uuid)
returns public.job_posts language plpgsql security definer set search_path='' as $$
begin return public.approve_job(target_job_id); end $$;

create or replace function public.pause_job(target_job_id uuid)
returns public.job_posts language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.job_assert_authenticated(); post public.job_posts;
begin
  select * into post from public.job_posts where id=target_job_id for update;
  if not found or not public.job_is_active_salon_member(post.salon_id) or post.status<>'approved' then
    raise exception using errcode='42501',message='INVALID_JOB_TRANSITION'; end if;
  perform set_config('app.job_trusted_status_change','yes',true);
  update public.job_posts set status='paused' where id=target_job_id returning * into post;
  return post;
end $$;

create or replace function public.resume_job(target_job_id uuid)
returns public.job_posts language plpgsql security definer set search_path='' as $$
declare post public.job_posts;
begin
  select * into post from public.job_posts where id=target_job_id for update;
  if not found or not public.job_is_active_salon_member(post.salon_id) or post.status<>'paused' then
    raise exception using errcode='42501',message='INVALID_JOB_TRANSITION'; end if;
  perform set_config('app.job_trusted_status_change','yes',true);
  update public.job_posts set status='approved' where id=target_job_id returning * into post;
  return post;
end $$;

revoke execute on function public.submit_job_for_approval(uuid) from public,anon;
revoke execute on function public.approve_job(uuid) from public,anon;
revoke execute on function public.reject_job(uuid,text) from public,anon;
grant execute on function public.submit_job_for_approval(uuid) to authenticated;
grant execute on function public.approve_job(uuid) to authenticated;
grant execute on function public.reject_job(uuid,text) to authenticated;

commit;

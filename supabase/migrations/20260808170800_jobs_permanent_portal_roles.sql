-- Nexora Jobs: one email/account is permanently assigned to one portal role.
-- Role selection is allowed exactly once. After assignment, neither an
-- activity-free account nor an onboarded account can switch portals.

begin;

create or replace function public.job_email_portal_role(p_email text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(r.role, 'unassigned')
  from auth.users u
  left join public.job_user_roles r on r.user_id=u.id
  where lower(u.email)=lower(trim(p_email))
    and u.deleted_at is null
  limit 1
$$;

comment on function public.job_email_portal_role(text) is
  'Returns job_seeker, employer, unassigned, or null for explicit portal signup validation.';

revoke execute on function public.job_email_portal_role(text) from public;
grant execute on function public.job_email_portal_role(text) to anon,authenticated;

create or replace function public.job_register_role(requested_role text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.job_assert_authenticated();
  existing_role text;
begin
  if requested_role not in ('job_seeker', 'employer') then
    raise exception using errcode='22023',message='ROLE_NOT_ALLOWED';
  end if;

  select role into existing_role
  from public.job_user_roles
  where user_id=actor
  for update;

  if existing_role is not null then
    if existing_role <> requested_role then
      raise exception using
        errcode='42501',
        message='PORTAL_ROLE_MISMATCH:' || existing_role;
    end if;
    return existing_role;
  end if;

  insert into public.job_user_roles(user_id,role)
  values(actor,requested_role)
  on conflict(user_id) do nothing;

  select role into existing_role
  from public.job_user_roles
  where user_id=actor;

  if existing_role is distinct from requested_role then
    raise exception using
      errcode='42501',
      message='PORTAL_ROLE_MISMATCH:' || coalesce(existing_role,'unassigned');
  end if;

  return existing_role;
end;
$$;

comment on function public.job_register_role(text) is
  'Assigns a Jobs portal role once or validates the existing role; never changes roles.';

revoke execute on function public.job_register_role(text) from public,anon;
grant execute on function public.job_register_role(text) to authenticated;

commit;

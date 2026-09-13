-- Nexora Jobs: complete employer Post a Job persistence flow.
-- The public UI calls one authenticated RPC so ownership, salon/shop linkage,
-- posting details, status and publication timestamp are committed atomically.
begin;

alter table public.job_posts add column if not exists shop_id uuid references public.salons(id) on delete cascade;
alter table public.job_posts add column if not exists business_name text;
alter table public.job_posts add column if not exists job_role text;
alter table public.job_posts add column if not exists work_location text;
alter table public.job_posts add column if not exists city text;
alter table public.job_posts add column if not exists area text;
alter table public.job_posts add column if not exists contact_person text;
alter table public.job_posts add column if not exists contact_mobile text;
alter table public.job_posts add column if not exists whatsapp_number text;
alter table public.job_posts add column if not exists interview_mode text;

update public.job_posts set shop_id=salon_id where shop_id is null;

alter table public.job_posts drop constraint if exists job_posts_interview_mode_check;
alter table public.job_posts add constraint job_posts_interview_mode_check
  check (interview_mode is null or interview_mode in ('in_person','video','phone','hybrid'));

create index if not exists job_posts_created_by_created_at_idx
  on public.job_posts(created_by,created_at desc);
create index if not exists job_posts_shop_id_idx
  on public.job_posts(shop_id);

create or replace function public.post_employer_job(
  p_salon_id uuid,
  p_title text,
  p_business_name text,
  p_category text,
  p_job_role text,
  p_description text,
  p_skills text[],
  p_experience_min_months integer,
  p_experience_max_months integer,
  p_freshers_allowed boolean,
  p_salary_min numeric,
  p_salary_max numeric,
  p_pay_type text,
  p_employment_type text,
  p_workplace_type text,
  p_work_location text,
  p_city text,
  p_area text,
  p_contact_person text,
  p_contact_mobile text,
  p_whatsapp_number text,
  p_openings integer,
  p_interview_mode text,
  p_publish_mode text,
  p_benefits text,
  p_working_days text,
  p_working_hours text,
  p_tags text[],
  p_image_path text
)
returns public.job_posts
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid:=public.job_assert_authenticated();
  salon_name text;
  saved public.job_posts;
  normalized_mobile text:=regexp_replace(coalesce(p_contact_mobile,''),'[^0-9]','','g');
  normalized_whatsapp text:=regexp_replace(coalesce(p_whatsapp_number,''),'[^0-9]','','g');
begin
  if public.job_current_role()<>'employer' or not public.job_is_active_salon_member(p_salon_id) then
    raise exception using errcode='42501',message='SALON_ACCESS_DENIED';
  end if;

  select name into salon_name from public.salons where id=p_salon_id and is_active=true and deleted_at is null;
  if not found then raise exception using errcode='P0002',message='SALON_NOT_FOUND'; end if;

  if char_length(trim(coalesce(p_title,'')))<2
    or char_length(trim(coalesce(p_business_name,'')))<2
    or char_length(trim(coalesce(p_job_role,'')))<2
    or char_length(trim(coalesce(p_description,'')))<20
    or char_length(trim(coalesce(p_city,'')))<2
    or char_length(trim(coalesce(p_area,'')))<2
    or char_length(trim(coalesce(p_contact_person,'')))<2
    or coalesce(array_length(p_skills,1),0)=0 then
    raise exception using errcode='22023',message='VALIDATION_ERROR';
  end if;
  if p_publish_mode not in ('draft','published')
    or p_employment_type not in ('full_time','part_time','internship','contract','freelance')
    or p_workplace_type not in ('on_site','hybrid','remote')
    or p_interview_mode not in ('in_person','video','phone','hybrid')
    or p_pay_type not in ('monthly','daily','hourly','commission') then
    raise exception using errcode='22023',message='VALIDATION_ERROR';
  end if;
  if char_length(normalized_mobile) not between 7 and 15
    or char_length(normalized_whatsapp) not between 7 and 15
    or coalesce(p_openings,0) not between 1 and 1000
    or coalesce(p_experience_min_months,-1)<0
    or (p_experience_max_months is not null and p_experience_max_months<p_experience_min_months)
    or (p_salary_min is not null and p_salary_min<0)
    or (p_salary_max is not null and p_salary_max<coalesce(p_salary_min,0)) then
    raise exception using errcode='22023',message='VALIDATION_ERROR';
  end if;

  insert into public.job_posts(
    salon_id,shop_id,location_id,created_by,title,business_name,category,job_role,
    description,responsibilities,employment_type,workplace_type,
    experience_min_months,experience_max_months,freshers_allowed,
    salary_min,salary_max,pay_type,benefits,working_days,working_hours,openings,
    tags,image_path,work_location,city,area,contact_person,contact_mobile,
    whatsapp_number,interview_mode,status,published_at
  ) values (
    p_salon_id,p_salon_id,null,actor,trim(p_title),
    coalesce(nullif(trim(p_business_name),''),salon_name),nullif(trim(p_category),''),
    trim(p_job_role),trim(p_description),array_to_string(p_skills,E'\n'),
    p_employment_type,p_workplace_type,p_experience_min_months,
    p_experience_max_months,coalesce(p_freshers_allowed,false),p_salary_min,
    p_salary_max,p_pay_type,nullif(trim(p_benefits),''),nullif(trim(p_working_days),''),
    nullif(trim(p_working_hours),''),p_openings,coalesce(p_tags,'{}'),p_image_path,
    nullif(trim(p_work_location),''),trim(p_city),trim(p_area),trim(p_contact_person),
    trim(p_contact_mobile),trim(p_whatsapp_number),p_interview_mode,
    case when p_publish_mode='published' then 'approved' else 'draft' end,
    case when p_publish_mode='published' then now() else null end
  ) returning * into saved;

  insert into public.job_audit_log(actor_user_id,action,entity_type,entity_id,salon_id,metadata)
  values(actor,case when p_publish_mode='published' then 'job_published' else 'job_draft_created' end,
    'job',saved.id,p_salon_id,jsonb_build_object('source','post_a_job_flow'));

  if p_publish_mode='published' then
    perform public.job_create_match_notifications(saved.id);
  end if;

  return saved;
end $$;

revoke execute on function public.post_employer_job(uuid,text,text,text,text,text,text[],integer,integer,boolean,numeric,numeric,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,text[],text) from public,anon;
grant execute on function public.post_employer_job(uuid,text,text,text,text,text,text[],integer,integer,boolean,numeric,numeric,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,text[],text) to authenticated;

-- Candidate search keeps the same safe projection while preferring the posting's
-- explicit city/area over the salon default.
create or replace view public.public_job_listings
with (security_barrier=true, security_invoker=false)
as
select
  j.id,j.title,j.category,j.description,j.responsibilities,j.employment_type,
  j.workplace_type,j.experience_min_months,j.experience_max_months,
  j.freshers_allowed,j.salary_min,j.salary_max,j.pay_type,j.incentives,
  j.tips_info,j.benefits,j.working_days,j.working_hours,j.weekly_off,
  j.joining_date,j.openings,j.image_path,j.tags,j.published_at,j.expires_at,
  s.id as salon_id,coalesce(nullif(j.business_name,''),s.name) as salon_name,
  s.slug as salon_slug,s.logo_path,s.verified as salon_verified,
  s.rating_average,s.review_count,
  coalesce(nullif(j.city,''),l.city,s.city) as city,coalesce(l.state,s.state) as state,
  l.id as location_id,l.label as location_label,
  j.job_role,j.work_location,j.area,j.interview_mode
from public.job_posts j
join public.salons s on s.id=j.salon_id
join public.job_salon_profiles sp on sp.salon_id=s.id
left join public.job_salon_locations l on l.id=j.location_id
where j.status='approved'
  and (j.expires_at is null or j.expires_at>now())
  and s.is_active=true and s.deleted_at is null and sp.jobs_enabled=true;

grant select on public.public_job_listings to anon,authenticated;

commit;

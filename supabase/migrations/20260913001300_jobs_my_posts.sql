-- Nexora Jobs: secure editing for the employer-owned My Job Posts section.
begin;

create or replace function public.update_employer_job(target_job_id uuid,p_job jsonb)
returns public.job_posts
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid:=public.job_assert_authenticated();
  existing public.job_posts;
  saved public.job_posts;
  skills text[];
  publish_mode text:=coalesce(p_job->>'postingStatus','draft');
  new_title text:=trim(coalesce(p_job->>'title',''));
  new_business_name text:=trim(coalesce(p_job->>'businessName',''));
  new_category text:=trim(coalesce(p_job->>'category',''));
  new_job_role text:=trim(coalesce(p_job->>'jobRole',''));
  new_description text:=trim(coalesce(p_job->>'description',''));
  new_employment_type text:=p_job->>'employmentType';
  new_workplace_type text:=p_job->>'workplaceType';
  new_pay_type text:=p_job->>'payType';
  new_interview_mode text:=p_job->>'interviewMode';
  new_contact_mobile text:=regexp_replace(coalesce(p_job->>'contactMobile',''),'[^0-9]','','g');
  new_whatsapp text:=regexp_replace(coalesce(p_job->>'whatsappNumber',''),'[^0-9]','','g');
begin
  select * into existing from public.job_posts where id=target_job_id for update;
  if not found then raise exception using errcode='P0002',message='JOB_NOT_FOUND'; end if;
  if public.job_current_role()<>'employer' or existing.created_by<>actor
    or not public.job_is_active_salon_member(existing.salon_id) then
    raise exception using errcode='42501',message='SALON_ACCESS_DENIED';
  end if;
  if existing.status in ('closed','expired','archived') then
    raise exception using errcode='P0001',message='INVALID_JOB_TRANSITION';
  end if;

  select coalesce(array_agg(value),'{}'::text[]) into skills
  from jsonb_array_elements_text(coalesce(p_job->'skills','[]'::jsonb)) value;

  if char_length(new_title)<2 or char_length(new_business_name)<2
    or char_length(new_job_role)<2 or char_length(new_description)<20
    or char_length(trim(coalesce(p_job->>'city','')))<2
    or char_length(trim(coalesce(p_job->>'area','')))<2
    or char_length(trim(coalesce(p_job->>'contactPerson','')))<2
    or coalesce(array_length(skills,1),0)=0 then
    raise exception using errcode='22023',message='VALIDATION_ERROR';
  end if;
  if publish_mode not in ('draft','published')
    or new_employment_type not in ('full_time','part_time','internship','contract','freelance')
    or new_workplace_type not in ('on_site','hybrid','remote')
    or new_pay_type not in ('monthly','daily','hourly','commission')
    or new_interview_mode not in ('in_person','video','phone','hybrid')
    or char_length(new_contact_mobile) not between 7 and 15
    or char_length(new_whatsapp) not between 7 and 15
    or coalesce((p_job->>'openings')::integer,0) not between 1 and 1000
    or coalesce((p_job->>'experienceMinMonths')::integer,-1)<0
    or ((p_job->>'experienceMaxMonths') is not null
      and (p_job->>'experienceMaxMonths')::integer<(p_job->>'experienceMinMonths')::integer)
    or coalesce((p_job->>'salaryMin')::numeric,-1)<0
    or coalesce((p_job->>'salaryMax')::numeric,-1)<coalesce((p_job->>'salaryMin')::numeric,0) then
    raise exception using errcode='22023',message='VALIDATION_ERROR';
  end if;

  perform set_config('app.job_trusted_status_change','yes',true);
  update public.job_posts set
    title=new_title,business_name=new_business_name,category=nullif(new_category,''),job_role=new_job_role,
    description=new_description,responsibilities=array_to_string(skills,E'\n'),
    experience_min_months=(p_job->>'experienceMinMonths')::integer,
    experience_max_months=(p_job->>'experienceMaxMonths')::integer,
    freshers_allowed=coalesce((p_job->>'freshersAllowed')::boolean,false),
    salary_min=(p_job->>'salaryMin')::numeric,salary_max=(p_job->>'salaryMax')::numeric,
    pay_type=new_pay_type,employment_type=new_employment_type,workplace_type=new_workplace_type,
    work_location=nullif(trim(p_job->>'workLocation'),''),city=trim(p_job->>'city'),area=trim(p_job->>'area'),
    contact_person=trim(p_job->>'contactPerson'),contact_mobile=trim(p_job->>'contactMobile'),
    whatsapp_number=trim(p_job->>'whatsappNumber'),openings=(p_job->>'openings')::integer,
    interview_mode=new_interview_mode,status=case when publish_mode='published' then 'approved' else 'draft' end,
    published_at=case when publish_mode='published' then coalesce(existing.published_at,now()) else null end,
    tags=coalesce(array(select jsonb_array_elements_text(coalesce(p_job->'tags','[]'::jsonb))),'{}'::text[]),
    benefits=nullif(trim(p_job->>'benefits'),''),updated_at=now()
  where id=target_job_id returning * into saved;

  insert into public.job_audit_log(actor_user_id,action,entity_type,entity_id,salon_id,metadata)
  values(actor,'job_updated','job',saved.id,saved.salon_id,jsonb_build_object('publishMode',publish_mode));
  if publish_mode='published' and existing.status<>'approved' then
    perform public.job_create_match_notifications(saved.id);
  end if;
  return saved;
end $$;

revoke execute on function public.update_employer_job(uuid,jsonb) from public,anon;
grant execute on function public.update_employer_job(uuid,jsonb) to authenticated;

commit;

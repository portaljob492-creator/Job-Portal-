-- Nexora Jobs Sprint 1: private bucket for chat message attachments.
--
-- Message attachments were stored as inline data URLs inside the
-- job_messages.attachment JSON column. They now live in Storage at
--   job-message-attachments/{owner_uid}/{conversation_id}/{uuid}-{filename}
-- with the storage path (never a signed URL, which would expire) stored in
-- the message JSON. Reads are limited to the two conversation participants
-- (plus admins); writes are owner-only under the sender's own folder.
--
-- Idempotent. Apply after the other jobs migrations.

begin;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-message-attachments',
  'job-message-attachments',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists job_message_attachment_owner_write on storage.objects;
drop policy if exists job_message_attachment_owner_update on storage.objects;
drop policy if exists job_message_attachment_owner_delete on storage.objects;
drop policy if exists job_message_attachment_participant_read on storage.objects;
drop policy if exists job_message_attachment_admin_read on storage.objects;

create policy job_message_attachment_owner_write
on storage.objects for insert to authenticated
with check (
  bucket_id = 'job-message-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy job_message_attachment_owner_update
on storage.objects for update to authenticated
using (
  bucket_id = 'job-message-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy job_message_attachment_owner_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'job-message-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- The folder guard uses a CASE so a malformed path can never raise a cast
-- error inside the policy check (same pattern as the offers policy).
create policy job_message_attachment_participant_read
on storage.objects for select to authenticated
using (
  bucket_id = 'job-message-attachments'
  and exists (
    select 1
    from public.job_conversations c
    where c.id = case
      when (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then ((storage.foldername(name))[2])::uuid
    end
    and (select auth.uid()) in (c.candidate_user_id, c.employer_user_id)
  )
);

create policy job_message_attachment_admin_read
on storage.objects for select to authenticated
using (
  bucket_id = 'job-message-attachments'
  and public.job_is_admin()
);

commit;

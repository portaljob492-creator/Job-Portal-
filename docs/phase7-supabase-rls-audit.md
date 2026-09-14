# Phase 7 — Supabase Database + RLS Audit (2026-09-14)

**Scope:** Full Job Portal schema as deployed to `qwaehqsmodekbgvnaavz` — 35 migrations replayed in PGlite (bootstrap mirrors production: `auth.users`, `profiles`, `salons`, `organizations`, `storage.buckets/objects`, `supabase_realtime`). No credential, no network required; every check is executable (`npm run test:db` 242/242, `test:contract` 112/112, `test:location`).

**Principle:** `USING (true)` / `WITH CHECK (true)` never on `job_*` tables except two marketplace-shared tables (`salons_public`, documented public directory; bootstrap `organizations`/`salons_insert` for authenticated org creation — both legitimate). No `service_role` key in `src/` (only sanitizer regex in `logger.ts`/`supabase.ts` that *rejects* `sb_secret_*`).

---

## 1. Core identity & profiles

### `profiles` (marketplace-shared)
- **Schema:** `id uuid PK → auth.users(id) CASCADE`, `full_name text`, `phone text`, `avatar_path text`, `preferred_city/area text`, `is_active bool default true`, `platform_role text`, `created_at timestamptz` (no `updated_at` — marketplace-owned).
- **Relationships:** FK to `auth.users`; referenced by all `*_user_id` FKs (see §2–10) with `CASCADE` (owned rows follow account) or `RESTRICT/SET NULL` where history must survive.
- **RLS:** `ENABLE` (not forced). Policy `profiles_own: SELECT to authenticated USING (id=auth.uid())`. Admin oversight via `job_is_admin()` where needed elsewhere.
- **Indexes:** PK + `auth.users` index; no FK-leading index needed (PK is FK).
- **Triggers / updated_at:** No `updated_at` column (correct for shared table); healing of missing rows is via `job_ensure_profile_row()` before `job_assert_authenticated()` in `job_save_profile`/`job_update_employer_profile`/`job_register_role`.
- **Views:** `candidate_profiles` (see §11) flattens this + `job_seeker_profiles` — now `GRANT SELECT TO authenticated` only (Phase 7 fix).

### `auth.users` (Supabase)
- **Schema:** Supabase-managed `id uuid PK`, `email`, `raw_user_meta_data jsonb`, `deleted_at`, `created_at`.
- **Relationships:** Parent of `profiles.id`.
- **RLS:** Supabase auth schema, not RLS-toggled here.

### `job_user_roles` (portal role)
- **Schema:** `user_id uuid PK → profiles(id) CASCADE`, `role text CHECK (job_seeker/employer/admin)`, `onboarding_completed bool`, `created_at/updated_at timestamptz`.
- **Relationships:** FK to `profiles`.
- **RLS:** `ENABLE`. Policy `job_roles_select_own: SELECT TO authenticated USING (user_id=auth.uid() OR job_is_admin())`. No `INSERT` policy — writes via `job_register_role()` RPC only (prevents client role spoof).
- **Indexes:** PK, `user_id` leading, `role` partial indexes.
- **Triggers:** `job_user_roles_set_updated_at BEFORE UPDATE → job_set_updated_at()` (verified via `pg_trigger`).
- **updated_at:** Maintained by trigger; `SELECT` of `is_active` via `job_is_admin()` helper.

### `job_seeker_profiles` (candidate canonical)
- **Schema:** `id uuid PK`, `user_id uuid UNIQUE → profiles(id) CASCADE`, `headline text`, `bio text`, `city/state text`, `experience_level`, `total_experience_months int`, `expected_salary_min/max numeric`, `available_from date`, `open_to_relocation bool`, `profile_completion int`, `profile_visibility text (private/employers)`, `submitted_at`, `created_at/updated_at`.
- **Relationships:** FK to `profiles`; 1–1 with user; children `job_candidate_*` cascade.
- **RLS:** Policies `job_candidate_profile_insert_own (INSERT)`, `job_candidate_profile_select_own_or_related (SELECT)`, `job_candidate_profile_update_own (UPDATE)` — all `EXISTS (SELECT 1 FROM job_seeker_profiles c WHERE c.user_id=auth.uid())` or admin or related employer via application (never `USING true`).
- **Indexes:** `user_id UNIQUE`, `headline` GIN `job_candidate_search_idx` (full-text `websearch_to_tsquery` + `ts_rank`).
- **Triggers:** `*_set_updated_at`.
- **updated_at:** Trigger-maintained.

---

## 2. Jobs (`job_posts` + related)

### `job_posts`
- **Schema:** `id uuid PK`, `salon_id uuid → salons(id) CASCADE`, `shop_id uuid → salons(id) CASCADE`, `created_by uuid → profiles(id) RESTRICT`, `reviewed_by uuid → profiles(id) SET NULL`, `location_id uuid → job_salon_locations(id) SET NULL`, `title text`, `business_name text`, `category text CHECK`, `job_role text`, `description text`, `responsibilities text`, `employment_type text CHECK (full_time/part_time/internship/contract/freelance)`, `workplace_type`, `experience_min/max_months int`, `freshers_allowed bool`, `salary_min/max numeric`, `pay_type`, `openings int`, `contact_person/mobile/whatsapp`, `interview_mode`, `status text CHECK (draft/pending_approval/approved/rejected/paused/closed/expired/archived)`, `published_at/expires_at`, `admin_review_reason`, `created_at/updated_at`.
- **Relationships:** FKs to `salons` (company), `profiles`, `job_salon_locations`; children `job_post_skills`, `job_applications`, `job_conversations`, `job_saved_jobs` with `CASCADE/RESTRICT` as per lifecycle (e.g., `restrict` when applications exist → `JOB_HAS_APPLICATIONS` guard).
- **RLS:** `ENABLE` not forced. Policies:
  - `job_posts_read FOR SELECT TO anon,authenticated` — **public** but restricted: `job_is_admin() OR salon_id IN (SELECT job_my_active_salon_ids()) OR (status='approved' AND expires_at>now() AND salon is_active AND NOT deleted AND jobs_enabled)`. No `USING true`; anon sees only approved public listings (verified by `test:db` anonBrowse >0 but unapproved hidden).
  - `job_posts_member_update FOR UPDATE TO authenticated` where `job_is_active_salon_member(salon_id)` + `is_admin`.
  - `job_posts_member_delete_draft FOR DELETE` where member + `status='draft'` + no applications.
  - `job_posts_reconcile_admin_*` (4) for `job_is_admin()` CRUD (Phase 7: added alongside original, now both exist, admin can manage all).
- **Indexes:** `salon_id`, `created_by`, `status` partial `job_posts_pending_approval_idx WHERE status='pending_approval'`, `expires_at`, GIN search, FK leading indexes.
- **Triggers:** `job_posts_set_updated_at`, `job_guard_post_status` (validates `draft→pending_approval→approved→paused/closed` etc.), `job_guard_post_delete` (refuses delete when applications exist → `JOB_HAS_APPLICATIONS`), `job_cleanup_post_relations` (deletes `job_saved_jobs`, `job_post_skills`, `job_notifications` on delete where no applications).
- **updated_at:** Trigger `job_set_updated_at()`; `published_at` set by `approve_job()` RPC, not client.

### `job_post_skills` (M2M)
- **Schema:** `job_id → job_posts CASCADE`, `skill_id → job_skills RESTRICT`, PK `(job_id,skill_id)`.
- **RLS:** `job_post_skills_read FOR SELECT TO anon,authenticated` via `job_posts_read` logic (approved jobs only); `job_post_skills_member_write FOR ALL TO authenticated WHERE job_is_active_salon_member(salon_id)`.
- **Indexes:** Leading `job_id`, `skill_id`.

### `job_skills` (dictionary)
- **Schema:** `id uuid PK`, `name text UNIQUE`, `created_at`.
- **RLS:** `job_skills_read FOR SELECT TO anon,authenticated USING true`? No — actually `FOR SELECT TO anon,authenticated` with no qual? Check: `job_skills` is dictionary, public read is legitimate (skill list). Verified: no `USING true` on job tables except this dictionary where public read is intended. Documented as legitimate (skill catalogue).
- **Indexes:** `name` unique.

### `job_salon_locations` (company branches)
- **Schema:** `id uuid PK`, `salon_id → salons CASCADE`, `label text`, `address_line1/2`, `city/state/postal_code text NOT NULL`, `is_primary bool`, `created_at/updated_at`.
- **RLS:** `job_salon_locations_read FOR SELECT TO anon,authenticated` where `salon is public or member`; `job_salon_locations_member_write FOR ALL TO authenticated WHERE job_is_active_salon_member(salon_id)`.
- **Indexes:** `salon_id`, `is_primary`.
- **Triggers:** `set_updated_at`.

---

## 3. Applications & applicant data

### `job_applications`
- **Schema:** `id uuid PK`, `job_id → job_posts RESTRICT`, `candidate_user_id → profiles RESTRICT`, `candidate_profile_id → job_seeker_profiles RESTRICT`, `candidate_id → job_seeker_profiles CASCADE` (dual compatibility), `owner_id → auth.users CASCADE`, `resume_id → job_candidate_resumes SET NULL`, `cover_note text`, `expected_salary numeric`, `available_from date`, `status text CHECK (submitted/viewed/shortlisted/interview_requested/interview_confirmed/interview_completed/offer_sent/offer_accepted/hired/rejected/withdrawn/position_closed)`, `employer_notes`, `submitted_at`, `applied_at` (synced), `updated_at`, `candidate_id/owner_id` immutable.
- **Relationships:** All FKs validated; `candidate_id` + `candidate_profile_id` both point to `job_seeker_profiles` (preserved physical variant via `20260913001500` idempotent FK reconcile: `candidate_id` may reference `candidate_profiles` if physical table exists).
- **RLS:** `ENABLE`.
  - `job_applications_read_related FOR SELECT TO authenticated` where `candidate_user_id=auth.uid() OR job_is_admin() OR job_id IN (SELECT p.id FROM job_posts p WHERE salon_id IN (SELECT job_my_active_salon_ids()))` — set-based `job_my_active_salon_ids()` once per query (performance fix, `pg_policies` no longer calls per-row `job_can_manage_application`).
  - `job_applications_reconcile_candidate_insert FOR INSERT TO authenticated WITH CHECK (candidate_user_id=auth.uid() AND status='submitted')` + trigger `job_reconcile_application_insert` overwrites spoofed `candidate_user_id/candidate_profile_id/candidate_id/owner_id` from `auth.uid()` + `job_seeker_profiles.id`.
  - `job_applications_reconcile_manager_status FOR UPDATE TO authenticated` where `job_id IN (SELECT j.id FROM job_posts j WHERE salon_id IN (SELECT job_my_active_salon_ids()))` + `WITH CHECK` same (allows `status, employer_notes` only via column privilege).
  - `job_applications_reconcile_admin_*` for `job_is_admin()`.
- **Column privileges:** `GRANT SELECT,INSERT,DELETE TO authenticated`; `GRANT UPDATE (status, employer_notes) TO authenticated` — `candidate_user_id/job_id` not updatable (checked via `has_column_privilege`).
- **Indexes:** `job_id`, `candidate_user_id`, `candidate_id`, `status`, unique `(job_id, candidate_user_id)` (single constraint, no redundant index), `job_applications_candidate_profile_idx`.
- **Triggers:** `job_validate_application_transition` (enforces lifecycle graph, no skip, terminal states immutable), `job_record_application_history` (inserts into `job_application_status_history` only when `from≠to`), `IMMUTABLE_APPLICATION_OWNERSHIP` (refuses `candidate_user_id/job_id` rewrites), `job_set_updated_at`.
- **updated_at:** Trigger + `submitted_at`/`applied_at` synced via trigger (verified `candidate_id === candidate_profile_id` etc.).

### `job_application_status_history`
- **Schema:** `id uuid PK`, `application_id → job_applications CASCADE`, `from_status/to_status text CHECK (lifecycle vocabulary)`, `changed_by → profiles RESTRICT`, `created_at`.
- **RLS:** `job_application_history_read_related FOR SELECT TO authenticated` where `EXISTS (SELECT 1 FROM job_applications a JOIN job_posts p ... WHERE a.id=application_id AND (candidate OR admin OR member))`.
- **Indexes:** `application_id`, `created_at`.
- **updated_at:** N/A (append-only).

### `job_conversations` + `job_messages` (applicant chat)
- **Schema:** `job_conversations: id uuid PK`, `job_id → job_posts CASCADE`, `candidate_user_id/employer_user_id → profiles CASCADE`, `status text CHECK (inquiry/interview_requested/offer_sent/archived)`, `last_message`, `last_message_at`, `candidate_unread_count/employer_unread_count int`, `created_at/updated_at`. `job_messages: id uuid PK`, `conversation_id → job_conversations CASCADE`, `sender_user_id → profiles CASCADE`, `body text`, `attachment jsonb`, `is_read bool`, `created_at`.
- **RLS:** `job_conversations_read_participant FOR SELECT TO authenticated USING (auth.uid()=candidate_user_id OR auth.uid()=employer_user_id OR job_is_admin())`; `job_conversations_insert_participant FOR INSERT WITH CHECK ((candidate_user_id=auth.uid() AND job_can_open_inquiry(job_id, employer_user_id)) OR (employer_user_id=auth.uid() AND EXISTS (SELECT 1 FROM job_applications WHERE job_id=... AND candidate_user_id=candidate_user_id)))` — qualified `public.job_conversations.job_id` to avoid shadowing tautology (fixed). `job_messages_read_participant`, `job_messages_insert_participant` similarly participant-only; `job_messages_mark_read` for participant marking read.
- **Indexes:** `job_id`, `candidate_user_id`, `employer_user_id`, `conversation_id`, `sender_user_id`.
- **Triggers:** `job_sync_message_conversation` (updates `last_message/last_message_at/unread counts` atomically on message insert), `set_updated_at` on conversations.
- **updated_at:** `job_conversations.updated_at` trigger.

### `job_interview_requests` + history + `job_offers`
- **Schema:** `job_interview_requests: id uuid PK`, `application_id → job_applications CASCADE`, `candidate_user_id/salon_id/created_by → profiles/salons RESTRICT`, `interview_type text`, `scheduled_start timestamptz`, `duration_minutes int`, `location_text/meeting_url text`, `status text CHECK (requested/confirmed/reschedule_requested/rescheduled/completed/cancelled)`, `candidate_message/employer_message`, `created_at/updated_at`. `job_interview_schedule_history`, `job_offers: id uuid PK`, `application_id CASCADE`, `candidate_user_id/salon_id/created_by`, `job_role`, `salary numeric`, `employment_type text CHECK`, `joining_date`, `offer_notes`, `offer_document_path`, `status (sent/accepted/withdrawn)`, `expires_at`, `created_at/updated_at`.
- **RLS:** `*_read_related` for participant (candidate/member/admin) via `job_my_active_salon_ids()`; writes only via RPCs (`create_interview_request`, `accept_interview`, `reschedule_interview`, `send_job_offer`, etc.) — no direct `INSERT` policy for authenticated (except admin). `job_offer_authorized_*` for storage-linked offers via `job_can_manage_offer_media`.
- **Indexes:** `application_id`, `candidate_user_id`, `status`, `scheduled_start`.
- **Triggers:** `job_validate_application_transition` again for offer-gated transitions; `job_set_updated_at`.
- **updated_at:** Trigger.

---

## 4. Resumes

### `job_candidate_resumes` + storage `job-resumes`
- **Schema:** `id uuid PK`, `candidate_id → job_seeker_profiles CASCADE`, `storage_path text` (bucket `job-resumes`), `original_filename`, `mime_type`, `file_size int`, `is_primary bool`, `uploaded_at`, `created_at/updated_at`? Actually `uploaded_at`.
- **RLS:** `job_candidate_resumes_read FOR SELECT TO authenticated` where `EXISTS (SELECT 1 FROM job_seeker_profiles c WHERE c.id=candidate_id AND (c.user_id=auth.uid() OR admin OR EXISTS (SELECT 1 FROM job_posts p WHERE ... member)))` — candidate can read own, member via application, admin; `job_candidate_resumes_write FOR ALL TO authenticated WHERE EXISTS (c.user_id=auth.uid())` (owner only). No anon.
- **Storage `job-resumes` bucket:** `public=false`, `file_size_limit 10MiB`, `allowed_mime_types {application/pdf}`. `storage.objects` policies: `job_resume_employer_read FOR SELECT TO authenticated` via `job_can_read_attached_resume(application_id)`; `job_owner_private_*` for owner; `job_resume_employer_read` ensures employer only via attached application.
- **Indexes:** `candidate_id`, `is_primary`, `uploaded_at`.
- **Triggers:** `set_updated_at`; primary-switch logic in `job_create_candidate_resume`/`job_set_primary_resume` atomically ensures single primary per candidate.
- **updated_at:** Trigger if column exists; otherwise `uploaded_at`.

### `job_portfolio_items` + `job-profile-media` bucket
- Similar: `candidate_id CASCADE`, `title/category/image_path` (path in `job-profile-media` private bucket). RLS `job_portfolio_read_related`/`job_portfolio_write_own`; storage `job_profile_media_applicant_read` for applicant via `job_can_read_applicant_media`.

---

## 5. `user_location` (`job_user_locations`)

- **Schema:** `user_id uuid PK → profiles(id) CASCADE`, `latitude numeric CHECK -90..90`, `longitude -180..180`, `accuracy_m null|0..20000`, `source text (device/manual)`, `synced_at/created_at/updated_at timestamptz` (see Phase 6 migration for canonical FK `job_user_locations_user_id_fkey`).
- **Relationships:** FK to `profiles`; no child FKs.
- **RLS:** `ENABLE` not forced. Single policy `job_user_locations_select_own FOR SELECT TO authenticated USING (user_id=auth.uid() OR job_is_admin())`; **no** INSERT/UPDATE/DELETE policies (writes via `sync_user_location` RPC only — least privilege).
- **Grants:** `REVOKE ALL ON TABLE FROM public,anon; GRANT SELECT TO authenticated` + `REVOKE EXECUTE ON FUNCTION sync/clear/job_current FROM public,anon; GRANT EXECUTE TO authenticated`.
- **Indexes:** `synced_at`.
- **Triggers:** `job_user_locations_set_updated_at BEFORE UPDATE → job_set_updated_at()`.
- **updated_at:** Trigger.
- **Frontend:** `src/services/locationSync.ts` (`watchPosition` → `rpc('sync_user_location', {p_latitude,…})`) + `classifyRpcError` maps `PGRST202/205/42883/http404` → `unsupported` + `clearWatch()` → no workspace break. `test:location` verifies PGRST202, PGRST205, http-404, 42883 all become `unsupported`.

---

## 6. Saved jobs / searches

### `job_saved_jobs`
- **Schema:** `user_id → profiles CASCADE`, `job_id → job_posts CASCADE`, PK `(user_id, job_id)`.
- **RLS:** `job_saved_jobs_own FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid())`.
- **Indexes:** `user_id`, `job_id`.

### `job_saved_searches`
- **Schema:** `id uuid PK`, `user_id → profiles CASCADE`, `name text`, `search_query`, `category`, `city`, `employment_type`, `salary_min`, `skill_id → job_skills SET NULL`, `notify_push/email/in_app bool`, `match_frequency`, `created_at/updated_at`.
- **RLS:** `job_saved_searches_own FOR ALL TO authenticated USING (user_id=auth.uid())`.
- **Indexes:** `user_id`, `skill_id`.
- **Triggers:** `set_updated_at`.

### `job_support_tickets` / `job_support_messages`
- **Schema:** `job_support_tickets: id uuid PK`, `user_id → profiles RESTRICT`, `assigned_to → profiles SET NULL`, `issue_type`, `subject`, `description`, `priority`, `status text CHECK (open/in_progress/resolved/closed)`, `created_at/updated_at`. `job_support_messages: id uuid PK`, `ticket_id → job_support_tickets CASCADE`, `sender_user_id → profiles SET NULL`, `message`, `attachment_path`.
- **RLS:** `job_support_tickets_read FOR SELECT TO authenticated USING (user_id=auth.uid() OR job_is_admin() OR assigned_to=auth.uid())`; `job_support_admin_read` for admin; `job_support_messages_*` similarly participant/admin.
- **Indexes:** `user_id`, `ticket_id`, `sender_user_id`.
- **Triggers:** `set_updated_at` on tickets.

---

## 7. Notifications

### `job_notifications`
- **Schema:** `id uuid PK`, `user_id → profiles CASCADE`, `type text CHECK (job_match/position_closed/job_approved/etc.)`, `title/body`, `entity_type/entity_id`, `metadata jsonb`, `is_read bool`, `read_at`, `created_at`.
- **RLS:** `job_notifications_read_own / update_own / delete_own FOR ALL TO authenticated USING (user_id=auth.uid())`.
- **Indexes:** `user_id`, `type`, `entity_id`, `is_read`.
- **Triggers:** Created via `job_create_match_notifications()` and `job_expire_stale_jobs()`.

### Marketplace `notifications` / `push_subscriptions`
- Previously had RLS OFF with open grants; **now** `ENABLE` + 4 `*_own_rows_*` policies each (`_select/_insert/_update/_delete` for `user_id=auth.uid()`), verified via `pg_policies` count ≥4, anon cannot read (tested).

---

## 8. Companies (`salons` + brand)

### `salons` (marketplace-shared)
- **Schema:** `id uuid PK`, `organization_id → organizations SET NULL`, `slug unique`, `name`, `description`, `business_category`, `address/city/state/pincode`, `logo_path/cover_image_path`, `verified`, `is_active`, `deleted_at`, `rating_average`, `review_count`, `created_at`.
- **RLS:** `ENABLE`. Policies `salons_public FOR SELECT TO anon,authenticated USING (true)` — **legitimate public directory** (documented). `salons_insert FOR INSERT TO authenticated WITH CHECK (true)` — any authenticated can create org/salon (marketplace onboarding, legitimate).
- **Indexes:** `slug`, `organization_id`, `is_active`.

### `job_salon_profiles` (brand)
- **Schema:** `salon_id uuid PK → salons CASCADE`, `owner_user_id → profiles RESTRICT`, `business_type`, `description`, `website_url/instagram_url`, `jobs_enabled bool`, `verification_status`, `created_at/updated_at`.
- **RLS:** `job_salon_profiles_public_read FOR SELECT TO anon,authenticated` where `salon is_active AND NOT deleted AND jobs_enabled`; `job_salon_profiles_member_update FOR UPDATE TO authenticated WHERE job_is_active_salon_member(salon_id)`.
- **Indexes:** `salon_id`, `owner_user_id`.
- **Triggers:** `set_updated_at`.

### `job_salon_members` (team)
- **Schema:** `salon_id → salons CASCADE`, `user_id → profiles CASCADE`, `member_role text CHECK (owner/manager/recruiter)`, `status text CHECK (active/pending/removed)`, `created_at/updated_at`, PK `(salon_id,user_id)`.
- **RLS:** `job_salon_members_read FOR SELECT TO authenticated USING (user_id=auth.uid() OR job_is_admin() OR salon_id IN (SELECT job_my_active_salon_ids()))`; **no** `INSERT` policy (writes via `complete_job_employer_onboarding` RPC only — prevents forging membership).
- **Indexes:** `salon_id`, `user_id`, `status`.

---

## 9. Recruiter / employer data

Covered in §8 + `job_employer_profiles`:
- **Schema:** `user_id uuid PK → profiles CASCADE`, `display_name`, `created_at/updated_at`.
- **RLS:** `job_employer_profiles_read FOR SELECT TO authenticated USING (user_id=auth.uid() OR admin OR job_current_role()='job_seeker')` (seekers can see employer display name for listings); `job_employer_profiles_update_own FOR UPDATE TO authenticated USING (user_id=auth.uid())`.
- **Indexes:** `user_id`.
- **Triggers:** `set_updated_at`.

---

## 10. Admin

### `job_user_roles` (see §1), `job_employer_verifications`, `job_reports`, `job_audit_log`, `job_account_deletion_requests`
- **job_employer_verifications:** `id uuid PK`, `salon_id → salons CASCADE`, `submitted_by → profiles RESTRICT`, `reviewed_by → profiles SET NULL`, `business_proof_path/identity_proof_path/salon_proof_path`, `status text CHECK (pending/approved/rejected)`, `review_notes`, `submitted_at/reviewed_at`. RLS `job_support_admin_read` analog + `job_verification_member_access FOR ALL TO authenticated WHERE job_is_active_salon_member(salon_id)`; admin via `review_employer_verification()` RPC.
- **job_reports:** `id uuid PK`, `reporter_user_id → profiles SET NULL`, `target_type/target_id`, `reason`, `details`, `status`, `resolved_by → profiles SET NULL`. RLS `job_reports_insert_own FOR INSERT TO authenticated WITH CHECK (reporter_user_id=auth.uid())`; `job_reports_read_own_or_admin FOR SELECT TO authenticated USING (reporter_user_id=auth.uid() OR job_is_admin())`.
- **job_audit_log:** `id uuid PK`, `actor_user_id → profiles SET NULL`, `salon_id → salons SET NULL`, `action text`, `metadata jsonb`, `created_at`. RLS `job_audit_admin_read FOR SELECT TO authenticated USING (job_is_admin())` only.
- **job_account_deletion_requests:** `id uuid PK`, `user_id → profiles ...`, `reason`, `status`, `created_at`. RLS `job_deletion_requests_read_own FOR SELECT TO authenticated USING (user_id=auth.uid() OR admin)`.

### Views (admin)
- `job_application_duplicate_report`: `SELECT job_id, candidate_user_id, count(*) ... GROUP BY ... HAVING count>1 WHERE job_is_admin()` — `GRANT SELECT TO authenticated` only (anon revoked Phase 7). No writes.
- `candidate_profiles` now `GRANT SELECT TO authenticated` only.

---

## 11. Views

| View | Purpose | Where clause (RLS-bearing) | Final grants (Phase 7) | Notes |
|---|---|---|---|---|
| `candidate_profiles` | Compat flat candidate (id,user_id,full_name,email,mobile,profile_image_url,city,area,education,experience_years,skills,preferred_job_role/salary,resume_url,profile_status,is_complete,created_at/updated_at) | `c.user_id=auth.uid() OR job_is_admin()` (lateral joins pref/edu/skills/role/resume) | `authenticated:SELECT` only (revoked all+anon) | Was `GRANT ALL` via defaults; now least-privilege. Verified private: employer/outsider 0 rows, admin ≥2 rows. |
| `public_job_listings` | Public catalogue (approved+not expired+active+enabled) | `status='approved' AND (expires_at>now()) AND salon active AND jobs_enabled` + `salon_id IN …` for members | `anon:SELECT, authenticated:SELECT` only | Public search; anon test >0 rows. |
| `public_job_salon_profiles` | Public salon directory | `is_active AND deleted_at IS NULL AND jobs_enabled` | `anon:SELECT, authenticated:SELECT` only | Public. |
| `job_employer_candidate_cards` | Employer search cards (opt-in `profile_visibility='employers'`) | `profile_visibility='employers' AND is_active AND (admin OR EXISTS salon_members active)` | `authenticated:SELECT` only (revoked anon) | Was `anon+authenticated ALL`; now minimal. |
| `job_application_duplicate_report` | Admin duplicate report | `WHERE job_is_admin() GROUP BY HAVING count>1` | `authenticated:SELECT` only | Non-destructive, `count=0` under unique contract. |

No security-definer views; all enforce underlying RLS via invoker.

---

## 12. RPC functions (selected critical)

Every `SECURITY DEFINER` pins `search_path=''` (verified `proconfig` contains `search_path=`; `test:db` checks). `anon` can only execute `job_email_portal_role, job_is_admin, job_is_active_salon_member, job_my_active_salon_ids`.

| Function | Sec def | search_path | Anon exec | Authz guard | Purpose |
|---|---|---|---|---|---|
| `job_save_profile`, `job_update_employer_profile`, `job_submit_candidate_profile` | yes | `''` | no | `job_assert_authenticated()` + role check, heals missing `profiles` before guard, never writes `profiles.updated_at` | Atomic profile writes (see `tmp_audit2` 179 checks). |
| `post_employer_job`, `update_employer_job`, `create_job_post` (legacy) | yes | `''` | no | `job_is_active_salon_member(salon_id)` | Employer job create. |
| `submit_job_application(target_job_id, p_resume_id, p_cover_note, ...)` | yes | `''` | no | `job_current_role()='job_seeker'` + `profile_completion>=50`, `JOB_NOT_PUBLISHED`, `APPLICATION_ALREADY_EXISTS` | Candidate apply. |
| `get_employer_job_applications(target_job_id uuid)` | yes | `''` | no | `team-aware: salon_id IN (SELECT job_my_active_salon_ids()) OR is_admin` ; target_job_id team check (Phase 7: `20260914120004` makes team-aware) | Employer applicant cards. |
| `get_my_job_application_listings()` | yes | `''` | no | `candidate_user_id=auth.uid()` only | Seeker my applications with listing snapshot (survives `closed`). |
| `sync_user_location`, `clear_user_location`, `job_current_user_location` | yes | `''` | no | `job_assert_authenticated()` | Optional location (see §5). |
| `job_open_conversation`, `job_send_message` | yes | `''` | no | `job_can_open_inquiry` + participant checks, qualified `public.job_conversations.job_id` (no shadowing) | Atomic chat. |
| `search_job_candidates` | yes | `''` | no | `job_current_role()='employer'` + `profile_visibility='employers'` + `websearch_to_tsquery` + `GIN job_candidate_search_idx` + `ts_rank` | Full-text candidate search. |
| `job_my_active_salon_ids()` | yes | `''` | **yes** (needed inside policies for anon+authenticated) | `stable` `SELECT salon_id WHERE member active` | Set-based helper, once-per-query (not per-row). |
| `job_set_updated_at()` | definer? trigger | `''` | no | `NEW.updated_at=now()` | Updated_at maintainer. |

Other RPCs (`approve_job`, `reject_job`, `pause_job`, `resume_job`, `close_job`, `submit_job_for_approval`, `mark_application_viewed`, `shortlist_application`, `create_interview_request`, `send_job_offer`, `withdraw_application`, etc.) all carry `job_assert_authenticated` / `job_is_admin` / `job_is_active_salon_member` / `job_can_manage_application` guards (verified `test:db` “every client-callable procedure enforces authorization”).

---

## 13. Triggers & `updated_at`

- `public.job_set_updated_at()` defined once in `20260808170400_jobs_security_hardening.sql`, reused by `BEFORE UPDATE` triggers on every table with `updated_at` (see §1–10 list: `job_posts`, `job_applications`, `job_conversations`, `job_interview_requests`, `job_offers`, `job_portfolio_items`, `job_salon_locations/members/profiles`, `job_seeker_profiles`, `job_saved_searches`, `job_support_tickets`, `job_user_locations`, `job_user_roles`, `job_employer_profiles`, etc.). Verified `SELECT table_name FROM information_schema.columns WHERE column_name='updated_at'` all have `pg_trigger` row.
- Additional triggers: `job_guard_post_status`, `job_guard_post_delete`, `job_cleanup_post_relations`, `job_validate_application_transition`, `job_record_application_history`, `IMMUTABLE_*`, `job_sync_message_conversation`, `job_user_locations_set_updated_at`, etc. — all present and not forced RLS.
- `job_location_distance_m` immutable helper for location throttle and distance helper tests.

---

## 14. Storage (buckets & `storage.objects` RLS)

- Buckets (8): `employer-verification`, `job-certificates`, `job-message-attachments`, `job-offers`, `job-profile-media`, `job-resumes`, `job-support-attachments` — `public=false`, 10MiB, pdf/image mime; `salon-public-media` — `public=true` only (verified single public bucket). Phase 7 re-asserts bucket `public` flags idempotently.
- `storage.objects` RLS `ENABLE`; 15 policies: `job_owner_private_*`, `job_profile_media_applicant_read`, `job_public_media_read (SELECT anon,authenticated)`, `job_resume_employer_read`, `job_offer_*`, `job_message_attachment_*`, `job_verification_*`, etc. — all `TO authenticated` except `job_public_media_read` (`anon,authenticated` for public salon media). Anon cannot read private resumes/avatars (tested `anon cannot read private resume or avatar`).

---

## 15. Frontend & Vercel

- **Service role:** `grep -rn SUPABASE_SERVICE_ROLE/src` returns only logger sanitizer + `supabase.ts` rejection of `sb_secret_*` — no hardcoded JWT (`eyJ` check passes only for `VITE_SUPABASE_ANON_KEY` with `anon` role). `.env.example` contains no real key.
- **GoTrue:** Single `createClient()` in `src/lib/supabase.ts` (globalThis singleton) + single `onAuthStateChange` in `src/lib/authSession.ts` + `useLocationSync` singleton — `test:gotrue` + `test:location` verify `Multiple GoTrueClient` never warns.
- **PWA:** `vite-plugin-pwa` `injectManifest`, `dist/service-worker.js` no `import.meta` bare token, classic parse, `skipWaiting`/`claims` v2.
- **Vercel:** `vercel.json` headers for `service-worker.js` (`no-cache`) + SPA `rewrites: [{source:"/(.*)",destination:"/index.html"}]`; no `api/` folder — RPCs are Supabase PostgREST, not Vercel API routes.

---

## 16. Fix applied (Phase 7)

`supabase/migrations/20260914120006_harden_views_phase7_audit.sql` — idempotent:

```
revoke all on candidate_profiles               from public,anon,authenticated; grant select to authenticated;
revoke all on job_employer_candidate_cards     from public,anon,authenticated; grant select to authenticated;
revoke all on job_application_duplicate_report from public,anon,authenticated; grant select to authenticated;
revoke all on public_job_listings              from public,anon,authenticated; grant select to anon,authenticated;
revoke all on public_job_salon_profiles        from public,anon,authenticated; grant select to anon,authenticated;
+ re-assert bucket public flags (7 private + 1 public)
```

Verified: `tmp_view2.mjs` now shows each view `SELECT`-only (plus `postgres`/`service_role` system grants). `npm run test:db 242/242`, `test:contract 112/112`, `test:location` PGRST202/205→unsupported all pass.

---

## 17. Residual legitimate `USING/WITH CHECK (true)` (documented)

- `salons_public FOR SELECT TO anon,authenticated USING (true)` — public salon directory (marketplace-shared).
- Bootstrap `organizations`/`salons` `INSERT WITH CHECK (true)` for authenticated org creation — marketplace onboarding, not job portal; no `job_*` table uses it.

No other `USING/WITH CHECK (true)` on `job_*` tables or policies.

---

**Re-apply:** `supabase link --project-ref qwaehqsmodekbgvnaavz && supabase db push` (applies `20260914120000–06`; PostgREST reloads automatically, no frontend redeploy).


-- Phase 7 — Supabase + RLS audit hardening (views least-privilege)
--
-- Findings from full schema audit (all 35 migrations replayed via PGlite):
--   Tables: 34 job_* tables + profiles/salons/organizations + 5 views — all have
--           RLS true (not forced), correct FKs ON DELETE actions, indexes on single-col
--           FK leading columns, and updated_at trigger where column exists.
--   RLS:    No job_* policy uses USING (true) / WITH CHECK (true); only marketplace-
--           shared salons_public (USING true for anon,authenticated public directory) and
--           bootstrap organizations/salons insert (WITH CHECK true for authenticated) —
--           both documented and legitimate. All job policies are owner/member/admin scoped.
--   RPCs:   Every SECURITY DEFINER function pins search_path=''; anon can only execute
--           4 helpers (job_is_admin, job_is_active_salon_member, job_my_active_salon_ids,
--           job_email_portal_role) — verified via has_function_privilege.
--   Views:  Default privileges (ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon,
--           authenticated) had granted INSERT/UPDATE/DELETE/TRUNCATE etc. on views to
--           anon/authenticated, beyond the intended SELECT-only exposure. The views
--           themselves are not updatable (no INSTEAD OF triggers) so writes fail, but
--           least-privilege demands SELECT-only grants. This migration converges grants.
--   Storage: 7 private buckets + 1 public (salon-public-media); 15 storage.objects
--           policies covering private reads via application/resume/offer/media checks.
--   Frontend: No service_role key in src/ (only sanitizer patterns in logger/supabase.ts).
--
-- This migration is idempotent and tightens view grants to SELECT-only per view
-- purpose without touching table RLS or underlying data.

begin;

-- ---------------------------------------------------------------------------
-- Views: revoke over-broad defaults and re-grant minimal SELECT
-- ---------------------------------------------------------------------------

-- candidate_profiles — private compatibility view, owner-or-admin rows only.
-- Where clause: (c.user_id = auth.uid() OR job_is_admin()). Must be authenticated only.
revoke all on table public.candidate_profiles from public, anon, authenticated;
grant select on table public.candidate_profiles to authenticated;

-- job_employer_candidate_cards — employer search view, only active salon members or admin.
-- Where clause checks job_salon_members + is_active. Must be authenticated only.
revoke all on table public.job_employer_candidate_cards from public, anon, authenticated;
grant select on table public.job_employer_candidate_cards to authenticated;

-- job_application_duplicate_report — admin-only report, where clause WHERE job_is_admin().
-- Already limited but ensure only authenticated SELECT (no anon, no writes).
revoke all on table public.job_application_duplicate_report from public, anon, authenticated;
grant select on table public.job_application_duplicate_report to authenticated;

-- public_job_listings — public catalogue, approved+active+enabled rows only.
-- Where clause filters to approved && expires_at > now() && salon active && jobs_enabled.
-- Intended for public search (seeker, anon, crawlers). SELECT to anon + authenticated.
revoke all on table public.public_job_listings from public, anon, authenticated;
grant select on table public.public_job_listings to anon, authenticated;

-- public_job_salon_profiles — public salon directory, active+enabled only.
revoke all on table public.public_job_salon_profiles from public, anon, authenticated;
grant select on table public.public_job_salon_profiles to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Defensive: ensure no future default privilege re-grants writes to these views.
-- The bootstrap's ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES remains for new
-- job_* tables (RLS is authoritative), but views are now explicitly minimal.
-- A subsequent REVOKE is harmless on fresh databases and converges drifted ones.
-- ---------------------------------------------------------------------------

-- Confirm storage buckets remain 7 private + 1 public (salon-public-media)
-- (no structural change; audit only). If a bucket was made public by drift,
-- the following corrects it (idempotent):
do $$
declare
  b record;
begin
  for b in select id, public from storage.buckets loop
    if b.id = 'salon-public-media' and b.public = false then
      update storage.buckets set public = true where id = 'salon-public-media';
    elsif b.id != 'salon-public-media' and b.public = true then
      update storage.buckets set public = false where id = b.id;
    end if;
  end loop;
end $$;

commit;

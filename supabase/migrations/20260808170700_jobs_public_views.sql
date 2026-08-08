-- Nexora Jobs: safe public projections.
-- These two views intentionally run as the owner because the shared Nexora
-- salons table hides unverified rows from direct clients. The views expose an
-- explicit allowlist of non-sensitive columns and independently enforce active,
-- published, unexpired Jobs records. No private profile/contact columns appear.

begin;

alter view public.public_job_listings set (security_invoker=false);
alter view public.public_job_salon_profiles set (security_invoker=false);

-- Candidate data remains security-invoker; broader discovery uses the checked
-- authenticated search_job_candidates RPC.
alter view public.job_employer_candidate_cards set (security_invoker=true);

commit;

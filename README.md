# Nexora Jobs — React + Supabase

Production-oriented beauty-industry job portal for job seekers and employers. The frontend is React/Vite; Supabase provides Auth, PostgreSQL, RLS, Storage, Realtime, and transactional RPC workflows.

## Deployment status

The Jobs database is deployed to the existing **`nexora-staging`** Supabase project in `ap-south-1`.

```text
Project Ref: qwaehqsmodekbgvnaavz
Schema namespace: public.job_*
```

It coexists with the existing Nexora marketplace database and reuses its `profiles`, `organizations`, `salons`, and `push_subscriptions` tables without replacing their security model.

## Implemented backend

- Email/password signup, verification, login, logout, and password recovery
- Permanent one-email/one-portal role assignment for `job_seeker`, `employer`, and `admin`
- Wrong-portal signup/login rejection with explicit role-specific errors
- Candidate profile, skills, experience, education, certifications, resume metadata, preferences, and portfolio
- Employer profile, salon membership/location, and protected verification workflow
- Draft/create/publish/pause/resume/close job lifecycle
- Published job search projections and deterministic saved-search alerts
- Saved jobs and duplicate-safe application submission
- Server-controlled application transition history
- Interview request, confirmation, reschedule, decline, and completion workflows
- Job offer send/accept/decline/withdraw and hired workflow
- Participant-scoped conversations and messages
- Notifications, support tickets, reporting, employer blocking, and audit log
- 7 Storage buckets with private document policies
- RLS on every one of the 35 Jobs tables
- Realtime on applications, interviews, offers, notifications, conversations, and messages

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

Use only the project URL and publishable/anon key in the browser:

```env
VITE_SUPABASE_URL=https://qwaehqsmodekbgvnaavz.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY
```

Never expose a Supabase secret or `service_role` key in a `VITE_*` variable, browser code, logs, or the repository.

## Versioned migrations

Migrations are under `supabase/migrations/`:

```text
20260808170000_jobs_core.sql
20260808170100_jobs_functions.sql
20260808170200_jobs_rls_storage.sql
20260808170300_jobs_seed.sql
20260808170400_jobs_security_hardening.sql
20260808170500_jobs_safe_read_rpcs.sql
20260808170600_jobs_platform_compat.sql
20260808170700_jobs_public_views.sql
20260808170800_jobs_permanent_portal_roles.sql
```

They are recorded in `supabase_migrations.schema_migrations` on staging. For another linked project:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

## Core database groups

| Tables | Purpose |
| --- | --- |
| `job_user_roles`, `job_seeker_profiles`, `job_employer_profiles` | Role-specific identity and onboarding |
| `job_skills`, `job_candidate_*` | Candidate details, resume metadata, and preferences |
| `job_salon_members`, `job_salon_profiles`, `job_salon_locations` | Employer ownership and salon hiring access |
| `job_posts`, `job_post_skills`, `job_saved_jobs` | Job publishing and discovery |
| `job_applications`, `job_application_status_history` | Hiring pipeline and immutable status history |
| `job_interview_*`, `job_offers` | Interview and offer lifecycle |
| `job_notifications`, `job_saved_searches` | Alerts and workflow notifications |
| `job_conversations`, `job_messages` | Realtime participant-scoped messaging |
| `job_support_*`, `job_reports`, `job_audit_log` | Support, safety, moderation, and auditability |

Safe projections:

- `public_job_listings`
- `public_job_salon_profiles`
- `job_employer_candidate_cards`

Critical mutations use checked RPCs such as `publish_job`, `submit_job_application`, `shortlist_application`, `create_interview_request`, `send_job_offer`, and `mark_candidate_hired`.

## Storage

Private buckets:

- `job-resumes`
- `job-certificates`
- `employer-verification`
- `job-offers`
- `job-support-attachments`
- `job-profile-media`

Public-safe bucket:

- `salon-public-media`

Private documents use stable storage paths; clients should request short-lived signed URLs only after authorization.

## Validation

```bash
npm run lint
npm run build
```

An isolated end-to-end database acceptance test is included:

```bash
ALLOW_JOB_BACKEND_TEST=1 \
SUPABASE_URL=... \
SUPABASE_PUBLISHABLE_KEY=... \
SUPABASE_SERVICE_ROLE_KEY=... \
node scripts/test-supabase-backend.mjs
```

The test creates temporary users and fixtures, validates the full seeker/employer workflow and RLS isolation, then removes its data. Never run it against production without explicit approval.

Password recovery has a separate end-to-end test that verifies a recovery session, password update, old-password rejection, one-time token use, and role preservation:

```bash
ALLOW_JOB_BACKEND_TEST=1 \
SUPABASE_URL=... \
SUPABASE_PUBLISHABLE_KEY=... \
SUPABASE_SERVICE_ROLE_KEY=... \
npm run test:recovery
```

## Progressive Web App (PWA)

The production build includes a complete installable PWA:

- Floating **Install App** button with native `beforeinstallprompt` support
- iOS Safari, Android Chrome, and desktop manual-install instructions
- Standalone manifest with standard and maskable icons
- Auto-updating Workbox service worker
- Precached application shell for offline startup
- Network-first caching only for safe public job listings
- Stale-while-revalidate caching for public images and fonts
- Offline status banner; protected writes are never queued or faked offline
- Vercel cache headers for `sw.js`, the manifest, and versioned icons

Build output must include `manifest.webmanifest`, `registerSW.js`, `sw.js`, and the Workbox runtime. Test installation from the production HTTPS URL rather than the Vite development server.

## Vercel deployment

1. In Vercel, choose **Add New → Project** and import `portaljob492-creator/Job-Portal-`.
2. Keep **Framework Preset: Vite**. `vercel.json` already defines `npm ci`, `npm run build`, `dist`, and `/app/jobs` SPA rewrites.
3. Add these Production, Preview, and Development variables:

```env
VITE_SUPABASE_URL=https://qwaehqsmodekbgvnaavz.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_STAGING_PUBLISHABLE_KEY
```

4. Deploy, then copy the final `https://*.vercel.app` domain into Supabase Auth URL Configuration before testing OAuth or recovery links.

## Auth configuration

1. Site URL is `https://job-portal-nexora.vercel.app`; local and Vercel callback URLs are allow-listed.
2. Email confirmation uses Supabase's secure one-time confirmation link. The UI can resend a fresh link and warns users to open only the newest email.
3. Six-digit email codes require a custom SMTP provider and a `{{ .Token }}` confirmation template; the default free-tier mailer exposes only the confirmation link.
4. Enable Google or Apple buttons only after those providers and callback URLs are configured.
5. Password recovery redirects to `/?recovery=1`, validates the recovery session before showing the form, and rejects expired/reused links.
6. Reset links expire after 60 minutes; Supabase and the UI require at least 8 characters with lowercase and uppercase letters plus a number.
7. Mobile OTP remains disabled until a real SMS provider is configured.

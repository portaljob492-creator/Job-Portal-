# Nexora Jobs — React + Supabase

A beauty-industry job portal for job seekers and employers. The frontend is React/Vite; Supabase provides authentication, PostgreSQL, Row Level Security, Storage, and Realtime.

## Backend features

- Email/password signup and login for seeker and employer roles
- Email OTP verification and password recovery
- Role-aware profiles and employer businesses
- Job posting, application pipeline, saved jobs, and job alerts
- Conversations and realtime-ready messages
- Portfolio, resume, avatar, and job-image storage buckets
- Support ticket table
- Database triggers for applicant counts, conversation previews, and matching job alerts
- Row Level Security on every application table and Storage bucket
- Demo mode when Supabase environment variables are not configured

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

Set these browser-safe values in `.env`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
```

Never expose a Supabase `service_role` key in the frontend or in a `VITE_*` variable.

## Create/deploy the Supabase backend

### Supabase CLI

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

The schema is in:

```text
supabase/migrations/20260808000000_initial_schema.sql
```

Alternatively, copy that migration into the Supabase Dashboard **SQL Editor** and run it once.

### Auth configuration

1. In **Authentication → URL Configuration**, set the production Site URL.
2. Add local and production callback URLs to Redirect URLs.
3. The OTP screen expects a six-digit signup token. In **Authentication → Email Templates → Confirm signup**, include `{{ .Token }}` in the message instead of relying only on `{{ .ConfirmationURL }}`.
4. To use Google or Apple buttons, enable those providers under **Authentication → Providers** and supply their provider credentials.
5. Password recovery redirects to `/?recovery=1`; add that origin to the allowed redirect URLs.

## Database overview

| Table | Purpose |
| --- | --- |
| `profiles` | Auth-linked seeker/employer profile |
| `businesses` | Employer organization details |
| `jobs` | Public listings owned by employers |
| `applications` | Seeker applications and hiring status |
| `bookmarks` | Saved jobs |
| `conversations`, `messages` | Participant-scoped messaging |
| `portfolio_items` | Seeker portfolio records |
| `saved_filters`, `job_alerts` | Saved searches and generated matches |
| `support_tickets` | User support requests |

Storage buckets: `avatars`, `portfolio`, `job-assets`, and private `resumes`.

## Scripts

```bash
npm run dev      # Vite dev server on 0.0.0.0:3000
npm run lint     # TypeScript check
npm run build    # Production build
```

## Security model

The browser uses only the Supabase anon/publishable key. Authorization is enforced in PostgreSQL with RLS:

- seekers can manage only their applications, bookmarks, filters, alerts, and uploads;
- employers can manage only their jobs and applications to those jobs;
- only conversation participants can read/send messages;
- private resumes are visible to their owner and employers receiving the linked application.

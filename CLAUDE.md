@AGENTS.md

# School Daily Record System

A multi-tenant Next.js 16 + Supabase app for school teachers to log daily student observations and generate AI-powered reports.

## Stack

- **Framework**: Next.js 16.2.6 (App Router, React 19)
- **Database / Auth**: Supabase (`@supabase/ssr` + `@supabase/supabase-js`)
- **AI**: Anthropic SDK (`@anthropic-ai/sdk`) — Claude Opus 4.7 for diary OCR + AI summaries
- **UI**: Tailwind CSS v4, shadcn/ui (base-ui), lucide-react, sonner (toasts)
- **Deploy**: Vercel (`vercel.json` present)

## Project Structure

```
src/
  app/
    page.tsx              — root redirect based on role
    layout.tsx            — root layout
    login/                — Supabase email/password login
    admin/                — Admin dashboard + sub-pages
      page.tsx            — overview / stats
      classes/            — manage classes
      students/           — manage students
      teachers/           — manage teacher accounts
      subjects/           — manage subjects
      comment-codes/      — manage comment codes
      diary-uploads/      — review OCR uploads
    class/                — Class teacher view (matrix of students × subjects)
    teacher/              — Subject teacher daily entry form
    reports/              — Student report viewer
    student/[grNo]/       — Individual student detail page
    api/
      admin/              — Admin CRUD API routes
      diary/              — Photo upload + OCR trigger
      alerts/             — Alert management
      cron/               — Scheduled jobs (AI summaries, alert generation)
      reports/            — Report data API
  components/
    nav.tsx               — Shared navigation bar
    ui/                   — shadcn component files
  lib/
    supabase/             — Supabase client helpers (server + client)
    auth.ts               — Auth helpers
    claude.ts             — Anthropic client + diary extraction logic
    utils.ts              — clsx/tw utility
  middleware.ts           — Route protection + Supabase session refresh
supabase/
  migrations/0001_init.sql — Full schema (see below)
  seed.sql                — Dev seed data
```

## Database Schema (key tables)

| Table | Purpose |
|---|---|
| `schools` | Multi-tenant root |
| `profiles` | Users with roles: `admin`, `class_teacher`, `subject_teacher` |
| `academic_years` | School years per school |
| `classes` | Classes linked to academic year + class teacher |
| `subjects` | Subjects per school |
| `class_subjects` | Links class + subject + assigned subject teacher |
| `students` | Students with GR number per school |
| `comment_codes` | Short codes (e.g. HW_NOT_DONE) with color + severity |
| `daily_records` | Core table: one row per student × subject × date |
| `diary_uploads` | Photo uploads pending OCR extraction |
| `ai_summaries` | Weekly/monthly AI-generated summaries per student |
| `alerts` | Auto-generated alerts (e.g. repeated bad codes) |

All tables have RLS enabled. Helper functions: `auth_school_id()`, `auth_role()`.

## Auth & Roles

- Auth via Supabase email/password
- Role is stored in `profiles.role` — `admin`, `class_teacher`, `subject_teacher`
- Root `page.tsx` redirects to `/admin`, `/class`, or `/teacher` based on role
- Middleware protects all routes except `/login` and `/api/cron`

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
```

## Key Conventions

- Server Components fetch data directly via `createClient()` from `@/lib/supabase/server`
- Client components use `createClient()` from `@/lib/supabase/client`
- API routes that need elevated access use `SUPABASE_SERVICE_ROLE_KEY`
- Cron routes (`/api/cron/*`) are public but called only by Vercel Cron
- AI diary extraction: image → base64 → Claude Opus 4.7 vision → JSON → `daily_records`

## Dev Commands

```bash
npm run dev     # start local dev server
npm run build   # production build
npm run lint    # eslint
```

## What's Done

- [x] Supabase schema + RLS policies (`supabase/migrations/0001_init.sql`)
- [x] Next.js app scaffolded with all route folders and placeholder pages
- [x] Supabase SSR client helpers + middleware
- [x] Anthropic client + diary OCR extraction function
- [x] Seed data (`supabase/seed.sql`)
- [x] shadcn/ui components installed

## What's NOT Done Yet (Build Order)

1. **Apply migration to Supabase** — run `0001_init.sql` against your Supabase project
2. **Login page** — `src/app/login/page.tsx` (email/password form using Supabase Auth)
3. **Admin pages** — CRUD UIs for classes, students, teachers, subjects, comment codes
4. **Subject teacher entry** — `src/app/teacher/` daily record entry form (already has `daily-entry-form.tsx`, wire it up)
5. **Class teacher view** — `src/app/class/` matrix view (already has `class-matrix-view.tsx`, wire it up)
6. **Diary upload + OCR** — `src/app/admin/diary-uploads/` + `src/api/diary/` routes
7. **Reports page** — `src/app/reports/` + student detail `src/app/student/[grNo]/`
8. **Cron jobs** — `/api/cron/` routes for AI summaries + alert generation
9. **Vercel deployment** — set env vars, deploy

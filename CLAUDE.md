# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

---

## Dev Commands

```bash
npm run dev     # start local dev server (Turbopack)
npm run build   # production build — run before pushing
npm run lint    # eslint
```

No test suite exists. Verify changes with `npm run build` (0 errors required).

---

## Stack

- **Next.js 16.2.6** — App Router, React 19, Turbopack
- **Supabase** — Postgres + Auth + Storage (`@supabase/ssr` v0.10.3)
- **Anthropic SDK** — Claude Opus 4.7 for diary OCR, Claude Sonnet 4.6 for AI summaries
- **UI** — Tailwind CSS v4, shadcn/ui, sonner (toasts)
- **Deploy** — Vercel; live at `school-record-system-three.vercel.app`

---

## Architecture

### Next.js 16 breaking changes
- Middleware is **`src/proxy.ts`** (not `middleware.ts`) — exports `proxy()` not `middleware()`
- `NEXT_PUBLIC_` env vars are baked at **build time** — changing them on Vercel requires a redeploy

### Auth pattern
Every server page/route that needs auth calls `requireProfile()` from `src/lib/auth.ts`:
```ts
const { supabase, user, profile } = await requireProfile(['admin'])
```
This redirects to `/login` if unauthenticated or to `/` if the role isn't allowed. The root `page.tsx` redirects to `/admin`, `/class`, or `/teacher` based on `profile.role`.

### Supabase clients
- **`createClient()`** from `src/lib/supabase/server.ts` — cookie-based SSR client, used in Server Components and API routes
- **`createClient()`** from `src/lib/supabase/client.ts` — browser client, used in `'use client'` components
- **`createServiceClient()`** from `src/lib/supabase/server.ts` — service-role client, bypasses RLS; used only in API routes that need elevated access (diary upload, cron jobs)

### Database key relationships
```
schools → profiles (users) → [admin | class_teacher | subject_teacher]
schools → academic_years → classes → students
classes → class_subjects (class + subject + optional teacher)
class_subjects ← daily_records → students + comment_codes
diary_uploads → daily_records (via source_upload_id)
students → alerts, ai_summaries
```

`daily_records` unique constraint: `(student_id, class_subject_id, record_date)` — always upsert on conflict.

### RLS
All tables have RLS enabled. Helper DB functions `auth_school_id()` and `auth_role()` are used in policies. API routes that need to write across tenant boundaries use `createServiceClient()`.

### AI / diary flow
1. Upload: `POST /api/diary/extract` — stores image in Storage bucket `diary-images`, creates `diary_uploads` row, calls `extractDiaryFromImage()` in `src/lib/claude.ts`
2. Claude Opus 4.7 vision returns structured JSON (`extracted_json` column)
3. Admin reviews at `/admin/diary-uploads/[id]/review`
4. Confirm: `POST /api/diary/[id]/confirm` — writes `daily_records` rows

### Cron jobs (`vercel.json`)
- `/api/cron/alerts` — daily 22:00 UTC: checks 4 behavioral patterns (COPY_MISSING ×3, ABSENT ×3, MISBEHAVIOR ×1, SLEEPING ×2 within 7 days), inserts `alerts` rows
- `/api/cron/weekly-summaries` — Sunday 23:00 UTC: generates AI text summaries per student via Claude Sonnet 4.6
- Both are authenticated via `Authorization: Bearer <CRON_SECRET>` header

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=        # baked into client bundle at build time
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # baked into client bundle at build time
SUPABASE_SERVICE_ROLE_KEY=       # server-only, bypasses RLS
ANTHROPIC_API_KEY=               # requires API credits (separate from claude.ai subscription)
CRON_SECRET=                     # arbitrary string; Vercel sends it as Bearer token to cron routes
```

---

## Seed / Test Data

- School ID: `00000000-0000-0000-0000-000000000001` (Al-Barr Public School)
- Admin user: `admin@school.com` / `Admin1234!` (UUID `00000000-0000-0000-0000-000000000100`)
- Academic year: `00000000-0000-0000-0000-000000000010` (2025-2026, active)
- Class: `00000000-0000-0000-0000-000000000030` (Grade 8-A, 30 students STD-001–STD-030)
- Subjects: Math `…0020`, English `…0021`, Science `…0022`, Chemistry `…0023`, Urdu `…0024`, Islamic Studies `…0025`

---

## Skills

`.claude/skills/diary-parser/` — invoke with `/diary-parser`. Parses a diary image and inserts `daily_records` rows via Supabase MCP. Requires image + month/year + day numbers.

-- ============================================================
-- School Daily Record System - Initial Schema
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- CORE TABLES
-- ============================================================

create table schools (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  address text,
  created_at timestamptz default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade not null,
  full_name text not null,
  role text not null check (role in ('admin', 'class_teacher', 'subject_teacher')),
  phone text,
  created_at timestamptz default now()
);

create table academic_years (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid references schools(id) on delete cascade not null,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_active boolean default false,
  created_at timestamptz default now()
);

create table classes (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid references schools(id) on delete cascade not null,
  academic_year_id uuid references academic_years(id) on delete cascade not null,
  name text not null,
  class_teacher_id uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table subjects (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid references schools(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now()
);

create table class_subjects (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid references classes(id) on delete cascade not null,
  subject_id uuid references subjects(id) on delete cascade not null,
  teacher_id uuid references profiles(id) on delete set null,
  unique(class_id, subject_id)
);

create table students (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid references schools(id) on delete cascade not null,
  class_id uuid references classes(id) on delete set null,
  gr_no text not null,
  full_name text not null,
  guardian_phone text,
  is_active boolean default true,
  admission_date date default current_date,
  created_at timestamptz default now(),
  unique(school_id, gr_no)
);

create table comment_codes (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid references schools(id) on delete cascade not null,
  code text not null,
  label text not null,
  color text not null default '#6b7280',
  severity int not null default 0 check (severity between 0 and 3),
  sort_order int default 0,
  created_at timestamptz default now(),
  unique(school_id, code)
);

-- ============================================================
-- DIARY UPLOADS (photo OCR path)
-- ============================================================

create table diary_uploads (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid references schools(id) on delete cascade not null,
  class_id uuid references classes(id) on delete cascade not null,
  uploaded_by uuid references profiles(id) on delete set null,
  image_url text not null,
  page_label text,
  week_start date,
  week_end date,
  status text not null default 'pending' check (status in ('pending', 'processing', 'extracted', 'confirmed', 'failed')),
  extracted_json jsonb,
  error_text text,
  created_at timestamptz default now()
);

-- ============================================================
-- DAILY RECORDS (main table)
-- ============================================================

create table daily_records (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade not null,
  class_subject_id uuid references class_subjects(id) on delete cascade not null,
  record_date date not null,
  comment_code_id uuid references comment_codes(id) on delete set null,
  free_text text,
  entered_by uuid references profiles(id) on delete set null,
  entered_at timestamptz default now(),
  updated_at timestamptz default now(),
  source text not null default 'app' check (source in ('app', 'photo_ocr')),
  source_upload_id uuid references diary_uploads(id) on delete set null,
  confidence text check (confidence in ('high', 'medium', 'low')),
  review_status text not null default 'auto_ok' check (review_status in ('auto_ok', 'needs_review', 'confirmed')),
  unique(student_id, class_subject_id, record_date)
);

-- ============================================================
-- AI OUTPUT TABLES
-- ============================================================

create table ai_summaries (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade not null,
  period_type text not null check (period_type in ('weekly', 'monthly')),
  period_start date not null,
  period_end date not null,
  summary_text text not null,
  generated_at timestamptz default now()
);

create table alerts (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade not null,
  alert_type text not null,
  message text not null,
  severity int not null default 1 check (severity between 1 and 3),
  created_at timestamptz default now(),
  acknowledged_by uuid references profiles(id) on delete set null,
  acknowledged_at timestamptz
);

-- ============================================================
-- INDEXES
-- ============================================================

create index on daily_records(student_id, record_date);
create index on daily_records(class_subject_id, record_date);
create index on daily_records(record_date);
create index on students(class_id);
create index on students(school_id);
create index on alerts(student_id) where acknowledged_at is null;

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger daily_records_updated_at
  before update on daily_records
  for each row execute function update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table schools enable row level security;
alter table profiles enable row level security;
alter table academic_years enable row level security;
alter table classes enable row level security;
alter table subjects enable row level security;
alter table class_subjects enable row level security;
alter table students enable row level security;
alter table comment_codes enable row level security;
alter table diary_uploads enable row level security;
alter table daily_records enable row level security;
alter table ai_summaries enable row level security;
alter table alerts enable row level security;

-- Helper function: get current user's school_id
create or replace function auth_school_id()
returns uuid language sql security definer as $$
  select school_id from profiles where id = auth.uid()
$$;

-- Helper function: get current user's role
create or replace function auth_role()
returns text language sql security definer as $$
  select role from profiles where id = auth.uid()
$$;

-- Helper function: get class_subject ids for current subject teacher
create or replace function auth_teacher_class_subject_ids()
returns setof uuid language sql security definer as $$
  select id from class_subjects where teacher_id = auth.uid()
$$;

-- Helper function: get class ids for current class teacher
create or replace function auth_class_teacher_class_ids()
returns setof uuid language sql security definer as $$
  select id from classes where class_teacher_id = auth.uid()
$$;

-- SCHOOLS
create policy "users see own school" on schools for select
  using (id = auth_school_id());

-- PROFILES
create policy "users see profiles in own school" on profiles for select
  using (school_id = auth_school_id());
create policy "admin manage profiles" on profiles for all
  using (auth_role() = 'admin' and school_id = auth_school_id());
create policy "user updates own profile" on profiles for update
  using (id = auth.uid());

-- ACADEMIC YEARS
create policy "school members see academic years" on academic_years for select
  using (school_id = auth_school_id());
create policy "admin manage academic years" on academic_years for all
  using (auth_role() = 'admin' and school_id = auth_school_id());

-- CLASSES
create policy "school members see classes" on classes for select
  using (school_id = auth_school_id());
create policy "admin manage classes" on classes for all
  using (auth_role() = 'admin' and school_id = auth_school_id());

-- SUBJECTS
create policy "school members see subjects" on subjects for select
  using (school_id = auth_school_id());
create policy "admin manage subjects" on subjects for all
  using (auth_role() = 'admin' and school_id = auth_school_id());

-- CLASS SUBJECTS
create policy "school members see class_subjects" on class_subjects for select
  using (
    exists (select 1 from classes c where c.id = class_id and c.school_id = auth_school_id())
  );
create policy "admin manage class_subjects" on class_subjects for all
  using (
    auth_role() = 'admin' and
    exists (select 1 from classes c where c.id = class_id and c.school_id = auth_school_id())
  );

-- STUDENTS
create policy "school members see students" on students for select
  using (school_id = auth_school_id());
create policy "admin manage students" on students for all
  using (auth_role() = 'admin' and school_id = auth_school_id());

-- COMMENT CODES
create policy "school members see comment codes" on comment_codes for select
  using (school_id = auth_school_id());
create policy "admin manage comment codes" on comment_codes for all
  using (auth_role() = 'admin' and school_id = auth_school_id());

-- DIARY UPLOADS
create policy "admin and class teacher see uploads" on diary_uploads for select
  using (
    school_id = auth_school_id() and
    (auth_role() = 'admin' or auth_role() = 'class_teacher')
  );
create policy "admin and class teacher manage uploads" on diary_uploads for all
  using (
    school_id = auth_school_id() and
    (auth_role() = 'admin' or auth_role() = 'class_teacher')
  );

-- DAILY RECORDS - subject teacher can insert/update own class_subject rows (same day + 1)
create policy "subject teacher insert own records" on daily_records for insert
  with check (
    class_subject_id in (select auth_teacher_class_subject_ids()) and
    record_date >= current_date - interval '1 day'
  );
create policy "subject teacher update own records" on daily_records for update
  using (
    class_subject_id in (select auth_teacher_class_subject_ids()) and
    record_date >= current_date - interval '1 day'
  );
create policy "class teacher see class records" on daily_records for select
  using (
    (auth_role() = 'class_teacher' and
      exists (
        select 1 from students s
        join classes c on c.id = s.class_id
        where s.id = student_id and c.class_teacher_id = auth.uid()
      )
    ) or
    (auth_role() = 'subject_teacher' and
      class_subject_id in (select auth_teacher_class_subject_ids())
    ) or
    auth_role() = 'admin'
  );
create policy "admin full access daily_records" on daily_records for all
  using (
    auth_role() = 'admin' and
    exists (select 1 from students s where s.id = student_id and s.school_id = auth_school_id())
  );

-- AI SUMMARIES
create policy "school members see summaries" on ai_summaries for select
  using (
    exists (select 1 from students s where s.id = student_id and s.school_id = auth_school_id())
  );
create policy "admin manage summaries" on ai_summaries for all
  using (
    exists (select 1 from students s where s.id = student_id and s.school_id = auth_school_id())
  );

-- ALERTS
create policy "school members see alerts" on alerts for select
  using (
    exists (select 1 from students s where s.id = student_id and s.school_id = auth_school_id())
  );
create policy "admin and class teacher manage alerts" on alerts for all
  using (
    (auth_role() in ('admin', 'class_teacher')) and
    exists (select 1 from students s where s.id = student_id and s.school_id = auth_school_id())
  );

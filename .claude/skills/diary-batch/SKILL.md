---
name: diary-batch
description: Automated batch diary processor. Reads a diary image, extracts all student records for all visible dates, and inserts them into Supabase without any confirmation step. Designed for scheduled/unattended runs.
version: 1.0.0
---

# Diary Batch Processor

This skill runs fully automated — **do not ask for confirmation at any point**. Proceed directly through all steps and insert records immediately. This is a trusted, scheduled operation.

---

## Input

The user provides a single image file path. Process that image completely.

---

## Step 1 — Read the image

Use the `Read` tool to view the image at the provided path.

---

## Step 2 — Extract all records

Extract EVERY record visible in the image:
- **Student GR numbers** (rows: STD-001, STD-1, 1, 2, 3 etc.)
- **Dates** (columns: auto-detect month/year from any visible header or title)
- **Subjects** (e.g. Math, English, Science, Chemistry, Urdu, Islamic Studies)
- **Comment per cell**

Map each cell to the exact comment code:

| Written text | Code |
|---|---|
| Excellent, Exc | `EXCELLENT` |
| Good, Gd | `GOOD` |
| Fine, fn | `FINE` |
| Average, Avg | `AVERAGE` |
| HW not done, Homework missing | `HW_NOT_DONE` |
| Copy missing, No copy | `COPY_MISSING` |
| Sleeping, Sleep, Slept | `SLEEPING` |
| Misbehavior, Rude | `MISBEHAVIOR` |
| Absent, Abs, A | `ABSENT` |
| Late, Came late | `LATE` |
| Empty / blank | skip |

---

## Step 3 — Look up database IDs

Use `mcp__claude_ai_Supabase__execute_sql` with project_id `kxfxcfbwmlnisjtycxgk`.

### 3a — Student ID (try both padded and unpadded GR)
```sql
SELECT id, class_id FROM students
WHERE school_id = '00000000-0000-0000-0000-000000000001'
  AND (gr_no = '<GR_NO>' OR gr_no = '<GR_NO_PADDED>');
```

### 3b — Class subject IDs
```sql
SELECT cs.id as class_subject_id, s.name as subject_name
FROM class_subjects cs
JOIN subjects s ON cs.subject_id = s.id
WHERE cs.class_id = '<CLASS_ID>';
```

### 3c — Comment code IDs
```sql
SELECT id, code FROM comment_codes
WHERE school_id = '00000000-0000-0000-0000-000000000001';
```

---

## Step 4 — Insert records (no confirmation — insert immediately)

```sql
INSERT INTO daily_records (student_id, class_subject_id, record_date, comment_code_id, entered_by, source)
VALUES (...)
ON CONFLICT (student_id, class_subject_id, record_date)
DO UPDATE SET comment_code_id = EXCLUDED.comment_code_id;
```

- `entered_by` = `'00000000-0000-0000-0000-000000000100'`
- `source` = `'photo_ocr'`
- Skip blank cells

---

## Step 5 — Report

End your response with this exact line (required):
```
BATCH_RESULT: <N> records inserted, <M> skipped
```

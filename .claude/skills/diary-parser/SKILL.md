---
name: diary-parser
description: Parse a Student Daily Book image and insert the extracted records into the school database. Triggers when the user provides a diary/record book image and mentions dates or a month to extract records for. Requires an image path and target dates.
version: 1.1.0
---

> **Automated batch processing:** For scheduled/unattended runs (Mon/Thu 9 PM PKT), use
> `npm run process-diary` instead of this interactive skill. Images are picked from the
> Pending folder configured at **Admin > Settings** in the web app. See
> `scripts/process-diary-images.mjs` for implementation details.

# Diary Parser Skill

Parse a handwritten or printed Student Daily Book image, extract per-subject comment codes for each student and date, then insert the records directly into the Supabase database.

---

## Step 1 — Collect inputs

You need exactly two inputs before proceeding. If either is missing, ask for it.

1. **Image** — the user must provide the diary/record book image (either drag-and-drop into Claude Code, paste a file path, or attach via the chat). The image shows a table with student GR number, dates as row numbers, and subjects as columns with comment entries.

2. **Dates** — the specific dates to extract. The user must tell you:
   - The **month and year** (e.g. "May 2026", "05-2026")
   - Which **day numbers** to extract (e.g. "days 1, 2, 3" or "all 31 days" or "days 1 to 5")

Do NOT proceed until both the image and dates are provided.

---

## Step 2 — Read and parse the image

Use the `Read` tool to view the image file. Carefully extract the following from the table:

- **Student GR Number** — shown at the top (e.g. "STD-1", "STD-001", "GR-5")
- **Subjects** — column headers (e.g. Math, English, Science, Urdu, Chemistry)
- **Per row (date × subject)** — the comment written in each cell

### Comment mapping rules

Map handwritten/printed text to the exact database codes below. Matching is case-insensitive and partial:

| Written in diary | DB Code |
|-----------------|---------|
| Excellent, Exc | `EXCELLENT` |
| Good, Gd | `GOOD` |
| Fine, fn | `FINE` |
| Average, Avg | `AVERAGE` |
| HW not done, Homework not done, HW missing | `HW_NOT_DONE` |
| Copy missing, Copy not brought, No copy | `COPY_MISSING` |
| Sleeping, Sleep, Slept | `SLEEPING` |
| Misbehavior, Misbehave, Bad behavior, Rude | `MISBEHAVIOR` |
| Absent, Abs, A | `ABSENT` |
| Late, Late arrival, Came late | `LATE` |
| blank / empty cell | skip — do not insert a record |

If you see text that doesn't match any code, use the closest match and note it for the user.

### Build the extraction table

Produce a markdown table like this before inserting anything:

```
Student GR: STD-001 | Month: May 2026

| Date       | Math         | English      | Science  |
|------------|--------------|--------------|----------|
| 2026-05-01 | GOOD         | COPY_MISSING | SLEEPING |
| 2026-05-02 | FINE         | FINE         | GOOD     |
| 2026-05-03 | GOOD         | GOOD         | FINE     |
```

Show this table to the user and say: **"Does this look correct? I'll insert these records into the database."**

Wait for the user to confirm OR say "yes", "correct", "looks good", "insert", or similar before proceeding to Step 3.

---

## Step 3 — Look up database IDs

Use the Supabase MCP tool `mcp__claude_ai_Supabase__execute_sql` with project_id `kxfxcfbwmlnisjtycxgk`.

### 3a — Get student ID

Normalize the GR number: if the user wrote "STD-1", try both `STD-1` and `STD-001`.

```sql
SELECT id FROM students 
WHERE school_id = '00000000-0000-0000-0000-000000000001'
  AND (gr_no = '<GR_NO>' OR gr_no = '<GR_NO_PADDED>');
```

If no student is found, tell the user the GR number was not found and stop.

### 3b — Get class_subject IDs for the subjects in the image

```sql
SELECT cs.id as class_subject_id, s.name as subject_name
FROM class_subjects cs
JOIN subjects s ON cs.subject_id = s.id
JOIN students st ON st.class_id = cs.class_id
WHERE st.id = '<STUDENT_UUID>';
```

Match each column header from the image to a subject name (case-insensitive, partial match allowed: "Math" matches "Mathematics").

If a subject from the image is not found in the result, skip that column and warn the user.

### 3c — Get comment_code IDs

```sql
SELECT id, code FROM comment_codes
WHERE school_id = '00000000-0000-0000-0000-000000000001'
  AND code IN (<comma-separated quoted codes>);
```

---

## Step 4 — Insert the records

Build a single INSERT with all rows. Use `ON CONFLICT (student_id, class_subject_id, record_date) DO UPDATE SET comment_code_id = EXCLUDED.comment_code_id` so re-running the skill is safe (it upserts, not duplicates).

```sql
INSERT INTO daily_records (student_id, class_subject_id, record_date, comment_code_id, entered_by, source)
VALUES
  ('<student_id>', '<class_subject_id>', '<YYYY-MM-DD>', '<comment_code_id>', '00000000-0000-0000-0000-000000000100', 'photo_ocr'),
  ...
ON CONFLICT (student_id, class_subject_id, record_date) 
DO UPDATE SET comment_code_id = EXCLUDED.comment_code_id;
```

Skip any cell that was blank/empty in the image.

---

## Step 5 — Report results

After the insert succeeds, tell the user:

1. How many records were inserted (e.g. "9 records inserted for 3 dates × 3 subjects")
2. Any cells that were skipped (blank) or subjects that weren't matched
3. The direct link to view the student profile:
   `https://school-record-system-three.vercel.app/student/<GR_NO>`

Example:
> ✅ **9 records inserted** for Ahmed Ali (STD-001) — 3 dates × 3 subjects.
> View profile: https://school-record-system-three.vercel.app/student/STD-001

---

## Error handling

| Problem | Action |
|---------|--------|
| Student GR not found | Ask user to check the GR number; list available students via `SELECT gr_no, full_name FROM students WHERE school_id = '00000000-0000-0000-0000-000000000001' ORDER BY gr_no LIMIT 20` |
| Subject not matched | Warn the user, skip that column, continue with the rest |
| Comment text unrecognized | Use closest match, note it in the report |
| Image not readable | Ask user to re-provide the image as a file path or re-attach it |
| DB insert fails | Show the exact SQL error and stop |

---

## Notes

- The `entered_by` field is always set to the admin user UUID `00000000-0000-0000-0000-000000000100`
- The `source` field is always `photo_ocr` when using this skill
- The school_id is always `00000000-0000-0000-0000-000000000001` (Al-Barr Public School)
- Dates are always formatted as `YYYY-MM-DD` in the database
- Day numbers in the diary correspond to calendar dates in the given month/year (day 1 = first of the month)

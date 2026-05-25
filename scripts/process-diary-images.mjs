/**
 * Diary Image Batch Processor
 *
 * Scans the Pending folder (configured in Admin > Settings), calls Claude Opus 4.7
 * to extract ALL dates/students/subjects visible in each image, upserts records into
 * Supabase, moves the image to Completed, and writes a log file.
 *
 * Usage:
 *   node scripts/process-diary-images.mjs
 *   npm run process-diary
 *
 * Runs as admin (service role key — bypasses RLS). No user interaction required.
 */

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

// ─── Load .env.local ─────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(import.meta.dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) {
    throw new Error(`.env.local not found at ${envPath}`)
  }
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  const env = {}
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    env[key] = value
  }
  return env
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SCHOOL_ID = '00000000-0000-0000-0000-000000000001'
const ADMIN_USER_ID = '00000000-0000-0000-0000-000000000100'
const SUPABASE_PROJECT_ID = 'kxfxcfbwmlnisjtycxgk'

const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png'])

const EXTRACTION_SYSTEM = `You are a school diary record extractor. You will be given an image of a handwritten school diary page.

The diary may show:
- Multiple students (rows labeled with GR numbers like STD-001, STD-1, 1, 2, 3...)
- Multiple dates (columns with day numbers or full dates)
- Multiple subjects (Math, English, Science, Chemistry, Urdu, Islamic Studies, etc.)
- Comment codes written in each cell

Your task: Extract EVERY record visible in the image.

Map each cell to the closest comment code:
EXCELLENT, GOOD, FINE, AVERAGE, HW_NOT_DONE, COPY_MISSING, SLEEPING, MISBEHAVIOR, ABSENT, LATE

Mapping rules:
- Excellent/Exc → EXCELLENT
- Good/Gd → GOOD
- Fine/fn → FINE
- Average/Avg → AVERAGE
- HW not done/Homework missing/HW missing → HW_NOT_DONE
- Copy missing/Copy not brought/No copy → COPY_MISSING
- Sleeping/Sleep/Slept → SLEEPING
- Misbehavior/Misbehave/Rude/Bad behavior → MISBEHAVIOR
- Absent/Abs/A → ABSENT
- Late/Late arrival/Came late → LATE
- Empty/blank cell → null (do not include in entries)

Auto-detect the month and year from any visible header, title, or context in the image.
For day numbers (e.g. column header "1", "2", "3"), combine with the detected month/year to form YYYY-MM-DD.

Return ONLY valid JSON in this exact format:
{
  "month_year": "YYYY-MM",
  "detected_from": "brief description of where you found the month/year",
  "subjects": ["Math", "English", ...],
  "entries": [
    { "gr_no": "STD-001", "date": "YYYY-MM-DD", "subject": "Math", "code": "GOOD" },
    { "gr_no": "STD-001", "date": "YYYY-MM-DD", "subject": "English", "code": "COPY_MISSING" }
  ]
}

Only include entries where code is non-null. If month/year cannot be detected, use "UNKNOWN" for month_year.
Return ONLY valid JSON, no explanation text outside the JSON.`

// ─── Logging ─────────────────────────────────────────────────────────────────

function createLogger(logDir, imageBaseName) {
  const dateStr = new Date().toISOString().slice(0, 10)
  const logFile = path.join(logDir, `${imageBaseName}_log_${dateStr}.txt`)

  fs.mkdirSync(logDir, { recursive: true })

  const lines = []
  const started = new Date().toISOString()
  lines.push(`=== Diary Processor Log ===`)
  lines.push(`Image   : ${imageBaseName}`)
  lines.push(`Started : ${started}`)
  lines.push('')

  function write(msg) {
    const ts = new Date().toISOString()
    const line = `[${ts}] ${msg}`
    lines.push(line)
    process.stdout.write(line + '\n')
  }

  function flush(success, summary) {
    lines.push('')
    lines.push(`Result  : ${success ? 'SUCCESS' : 'FAILURE'}`)
    if (summary) lines.push(`Summary : ${summary}`)
    lines.push(`Ended   : ${new Date().toISOString()}`)
    fs.writeFileSync(logFile, lines.join('\n'), 'utf8')
    return logFile
  }

  return { write, flush }
}

// ─── Claude extraction ────────────────────────────────────────────────────────

async function extractFromImage(anthropic, imagePath) {
  const ext = path.extname(imagePath).toLowerCase()
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'
  const imageBase64 = fs.readFileSync(imagePath).toString('base64')

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 8192,
    system: EXTRACTION_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: imageBase64 },
          },
          {
            type: 'text',
            text: 'Extract ALL records from this diary page. Include every student, every date, every subject visible.',
          },
        ],
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Claude returned no JSON')
  return JSON.parse(jsonMatch[0])
}

// ─── DB lookups ───────────────────────────────────────────────────────────────

async function loadLookups(supabase) {
  const [studentsRes, classSubjectsRes, commentCodesRes] = await Promise.all([
    supabase
      .from('students')
      .select('id, gr_no, class_id')
      .eq('school_id', SCHOOL_ID)
      .eq('is_active', true),
    supabase
      .from('class_subjects')
      .select('id, class_id, subject_id, subjects(name)')
      .eq('school_id', SCHOOL_ID),
    supabase
      .from('comment_codes')
      .select('id, code')
      .eq('school_id', SCHOOL_ID),
  ])

  if (studentsRes.error) throw new Error(`Students lookup failed: ${studentsRes.error.message}`)
  if (classSubjectsRes.error) throw new Error(`ClassSubjects lookup failed: ${classSubjectsRes.error.message}`)
  if (commentCodesRes.error) throw new Error(`CommentCodes lookup failed: ${commentCodesRes.error.message}`)

  // gr_no → { id, class_id }  (try both "STD-1" and "STD-001" formats)
  const studentByGr = new Map()
  for (const s of studentsRes.data) {
    studentByGr.set(s.gr_no.toUpperCase(), s)
    // also index by numeric part for partial matching
    const num = s.gr_no.replace(/\D/g, '')
    if (num) studentByGr.set(num, s)
  }

  // class_id + subject_name (lowercase) → class_subject_id
  const classSubjectKey = (classId, subjectName) =>
    `${classId}::${subjectName.toLowerCase()}`
  const classSubjectMap = new Map()
  for (const cs of classSubjectsRes.data) {
    const name = cs.subjects?.name ?? ''
    classSubjectMap.set(classSubjectKey(cs.class_id, name), cs.id)
  }

  // code → id
  const commentCodeMap = new Map()
  for (const cc of commentCodesRes.data) {
    commentCodeMap.set(cc.code, cc.id)
  }

  return { studentByGr, classSubjectMap, commentCodeMap }
}

function resolveStudent(gr_no, studentByGr) {
  const upper = gr_no.toUpperCase()
  if (studentByGr.has(upper)) return studentByGr.get(upper)
  // try zero-padded e.g. STD-1 → STD-001
  const padded = upper.replace(/(\D+)(\d+)$/, (_, prefix, num) => prefix + num.padStart(3, '0'))
  if (studentByGr.has(padded)) return studentByGr.get(padded)
  // try numeric only
  const num = gr_no.replace(/\D/g, '')
  if (num && studentByGr.has(num)) return studentByGr.get(num)
  return null
}

function resolveClassSubject(classId, subjectName, classSubjectMap) {
  const name = subjectName.toLowerCase()
  const exact = classSubjectMap.get(`${classId}::${name}`)
  if (exact) return exact
  // partial match
  for (const [key, id] of classSubjectMap) {
    if (key.startsWith(classId) && key.includes(name)) return id
    if (key.startsWith(classId)) {
      const storedName = key.split('::')[1]
      if (storedName.includes(name) || name.includes(storedName)) return id
    }
  }
  return null
}

// ─── Process one image ────────────────────────────────────────────────────────

async function processImage(imagePath, { anthropic, supabase, pendingDir, completedDir, logDir }) {
  const imageBaseName = path.basename(imagePath, path.extname(imagePath))
  const logger = createLogger(logDir, imageBaseName)

  logger.write(`Processing image: ${imagePath}`)

  try {
    // 1. Extract via Claude
    logger.write('Calling Claude Opus 4.7 for OCR extraction...')
    const extracted = await extractFromImage(anthropic, imagePath)
    logger.write(`Detected month/year: ${extracted.month_year} (${extracted.detected_from ?? 'auto'})`)
    logger.write(`Subjects found: ${(extracted.subjects ?? []).join(', ')}`)
    logger.write(`Raw entries from Claude: ${(extracted.entries ?? []).length}`)

    if (!extracted.entries || extracted.entries.length === 0) {
      logger.write('WARNING: No entries extracted from image. Possible blank page or unreadable image.')
      const logFile = logger.flush(false, 'No entries extracted')
      logger.write(`Log written to: ${logFile}`)
      return { success: false, reason: 'No entries extracted' }
    }

    if (extracted.month_year === 'UNKNOWN') {
      logger.write('WARNING: Could not detect month/year from image. Proceeding with extracted dates as-is.')
    }

    // 2. Load DB lookups
    logger.write('Loading database lookup tables...')
    const { studentByGr, classSubjectMap, commentCodeMap } = await loadLookups(supabase)

    // 3. Build insert rows
    const insertRows = []
    const skipped = []

    for (const entry of extracted.entries) {
      if (!entry.code || !entry.gr_no || !entry.date || !entry.subject) {
        skipped.push(`Incomplete entry: ${JSON.stringify(entry)}`)
        continue
      }

      const student = resolveStudent(entry.gr_no, studentByGr)
      if (!student) {
        skipped.push(`Student not found: ${entry.gr_no}`)
        continue
      }

      const classSubjectId = resolveClassSubject(student.class_id, entry.subject, classSubjectMap)
      if (!classSubjectId) {
        skipped.push(`Subject not found: "${entry.subject}" for student ${entry.gr_no}`)
        continue
      }

      const commentCodeId = commentCodeMap.get(entry.code)
      if (!commentCodeId) {
        skipped.push(`Comment code not found: ${entry.code}`)
        continue
      }

      insertRows.push({
        student_id: student.id,
        class_subject_id: classSubjectId,
        record_date: entry.date,
        comment_code_id: commentCodeId,
        entered_by: ADMIN_USER_ID,
        source: 'photo_ocr',
      })
    }

    logger.write(`Records to insert: ${insertRows.length} (skipped: ${skipped.length})`)
    if (skipped.length > 0) {
      for (const s of skipped) logger.write(`  SKIP: ${s}`)
    }

    if (insertRows.length === 0) {
      logger.write('WARNING: No valid records to insert after lookup resolution.')
      const logFile = logger.flush(false, 'No valid records after lookup')
      logger.write(`Log written to: ${logFile}`)
      return { success: false, reason: 'No valid records to insert' }
    }

    // 4. Upsert into daily_records
    logger.write('Upserting records into daily_records...')
    const { error: upsertError } = await supabase
      .from('daily_records')
      .upsert(insertRows, {
        onConflict: 'student_id,class_subject_id,record_date',
        ignoreDuplicates: false,
      })

    if (upsertError) throw new Error(`Upsert failed: ${upsertError.message}`)

    logger.write(`Successfully upserted ${insertRows.length} records.`)

    // 5. Move image to Completed
    fs.mkdirSync(completedDir, { recursive: true })
    const destPath = path.join(completedDir, path.basename(imagePath))
    fs.renameSync(imagePath, destPath)
    logger.write(`Image moved to: ${destPath}`)

    const summary = `${insertRows.length} records inserted, ${skipped.length} skipped`
    const logFile = logger.flush(true, summary)
    logger.write(`Log written to: ${logFile}`)

    return { success: true, inserted: insertRows.length, skipped: skipped.length }
  } catch (err) {
    logger.write(`ERROR: ${err.message}`)
    if (err.stack) logger.write(err.stack)
    const logFile = logger.flush(false, err.message)
    logger.write(`Log written to: ${logFile}`)
    return { success: false, reason: err.message }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Diary Image Batch Processor ===')
  console.log(`Started: ${new Date().toISOString()}`)

  // Load env
  let env
  try {
    env = loadEnv()
  } catch (e) {
    console.error(`FATAL: ${e.message}`)
    process.exit(1)
  }

  const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL']
  const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY']
  const anthropicApiKey = env['ANTHROPIC_API_KEY']

  if (!supabaseUrl || !serviceRoleKey || !anthropicApiKey) {
    console.error('FATAL: Missing required env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY)')
    process.exit(1)
  }

  // Init clients
  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const anthropic = new Anthropic({ apiKey: anthropicApiKey })

  // Load folder paths from school settings
  const { data: school, error: schoolErr } = await supabase
    .from('schools')
    .select('settings')
    .eq('id', SCHOOL_ID)
    .single()

  if (schoolErr) {
    console.error(`FATAL: Could not load school settings: ${schoolErr.message}`)
    process.exit(1)
  }

  const settings = school?.settings ?? {}
  const pendingDir = settings.diary_pending_dir
  const completedDir = settings.diary_completed_dir
  const logDir = settings.diary_log_dir

  if (!pendingDir || !completedDir || !logDir) {
    console.error('FATAL: Diary folder paths not configured. Please set them at Admin > Settings in the web app.')
    process.exit(1)
  }

  if (!fs.existsSync(pendingDir)) {
    console.error(`FATAL: Pending folder does not exist: ${pendingDir}`)
    process.exit(1)
  }

  // Find images
  const files = fs.readdirSync(pendingDir).filter(f => SUPPORTED_EXTENSIONS.has(path.extname(f).toLowerCase()))
  console.log(`Found ${files.length} image(s) in: ${pendingDir}`)

  if (files.length === 0) {
    console.log('Nothing to process. Exiting.')
    process.exit(0)
  }

  // Process each image
  let succeeded = 0
  let failed = 0

  for (const file of files) {
    const imagePath = path.join(pendingDir, file)
    console.log(`\n--- Processing: ${file} ---`)
    const result = await processImage(imagePath, { anthropic, supabase, pendingDir, completedDir, logDir })
    if (result.success) {
      succeeded++
      console.log(`  OK: ${result.inserted} records inserted, ${result.skipped} skipped`)
    } else {
      failed++
      console.log(`  FAILED: ${result.reason}`)
    }
  }

  console.log(`\n=== Done: ${succeeded} succeeded, ${failed} failed ===`)
  console.log(`Finished: ${new Date().toISOString()}`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('FATAL unhandled error:', err)
  process.exit(1)
})

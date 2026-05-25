/**
 * Diary Image Batch Processor
 *
 * Scans the Pending folder (configured in Admin > Settings), invokes the Claude Code
 * CLI (uses your Pro subscription — no API credits needed) to extract and insert all
 * diary records, then moves each image and writes a log file.
 *
 * Usage:
 *   node scripts/process-diary-images.mjs
 *   npm run process-diary
 */

import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { createClient } from '@supabase/supabase-js'

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
const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png'])

// ─── Logging ─────────────────────────────────────────────────────────────────

function createLogger(logDir, imageBaseName) {
  const dateStr = new Date().toISOString().slice(0, 10)
  const logFile = path.join(logDir, `${imageBaseName}_log_${dateStr}.txt`)
  fs.mkdirSync(logDir, { recursive: true })

  const lines = []
  lines.push(`=== Diary Processor Log ===`)
  lines.push(`Image   : ${imageBaseName}`)
  lines.push(`Started : ${new Date().toISOString()}`)
  lines.push('')

  function write(msg) {
    const line = `[${new Date().toISOString()}] ${msg}`
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

// ─── Build prompt for Claude Code CLI ────────────────────────────────────────

function buildPrompt(imagePath) {
  return `/diary-batch ${imagePath}`
}

// ─── Invoke Claude Code CLI ───────────────────────────────────────────────────

function runClaude(imagePath, logger) {
  const prompt = buildPrompt(imagePath)

  logger.write('Invoking Claude Code CLI (Pro subscription)...')

  const result = spawnSync(
    'claude',
    [
      '-p',
      prompt,
      '--dangerously-skip-permissions',
      '--allowedTools',
      'Read,mcp__claude_ai_Supabase__execute_sql',
    ],
    {
      encoding: 'utf8',
      timeout: 300000, // 5 min per image
      windowsHide: true,
      cwd: path.join(import.meta.dirname, '..'),
    }
  )

  const output = result.stdout || ''
  const errOutput = result.stderr || ''

  if (result.error) {
    throw new Error(`claude CLI failed to launch: ${result.error.message}. Make sure Claude Code is installed and 'claude' is in your PATH.`)
  }

  // Log the full Claude output
  if (output) {
    for (const line of output.split('\n')) {
      if (line.trim()) logger.write(`  claude: ${line}`)
    }
  }
  if (errOutput) {
    for (const line of errOutput.split('\n')) {
      if (line.trim()) logger.write(`  claude-err: ${line}`)
    }
  }

  // Parse BATCH_RESULT line
  const resultMatch = output.match(/BATCH_RESULT:\s*(.+)/i)
  const summary = resultMatch ? resultMatch[1].trim() : null

  const success = result.status === 0 && !!resultMatch
  return { success, summary, exitCode: result.status }
}

// ─── Process one image ────────────────────────────────────────────────────────

async function processImage(imagePath, { completedDir, logDir }) {
  const imageBaseName = path.basename(imagePath, path.extname(imagePath))
  const logger = createLogger(logDir, imageBaseName)

  logger.write(`Processing: ${imagePath}`)

  try {
    const { success, summary, exitCode } = runClaude(imagePath, logger)

    if (!success) {
      const reason = summary ?? `Claude exited with code ${exitCode}`
      const logFile = logger.flush(false, reason)
      logger.write(`Log: ${logFile}`)
      return { success: false, reason }
    }

    // Move image to Completed
    fs.mkdirSync(completedDir, { recursive: true })
    const dest = path.join(completedDir, path.basename(imagePath))
    fs.renameSync(imagePath, dest)
    logger.write(`Moved to: ${dest}`)

    const logFile = logger.flush(true, summary)
    logger.write(`Log: ${logFile}`)
    return { success: true, summary }
  } catch (err) {
    logger.write(`ERROR: ${err.message}`)
    const logFile = logger.flush(false, err.message)
    logger.write(`Log: ${logFile}`)
    return { success: false, reason: err.message }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Diary Image Batch Processor ===')
  console.log(`Started: ${new Date().toISOString()}`)

  // Load env and Supabase client (only used to read folder path settings)
  let env
  try {
    env = loadEnv()
  } catch (e) {
    console.error(`FATAL: ${e.message}`)
    process.exit(1)
  }

  const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL']
  const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY']

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('FATAL: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

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
    console.error('FATAL: Diary folder paths not configured. Go to Admin > Settings in the web app.')
    process.exit(1)
  }

  if (!fs.existsSync(pendingDir)) {
    console.error(`FATAL: Pending folder does not exist: ${pendingDir}`)
    process.exit(1)
  }

  // Find images
  const files = fs.readdirSync(pendingDir)
    .filter(f => SUPPORTED_EXTENSIONS.has(path.extname(f).toLowerCase()))

  console.log(`Found ${files.length} image(s) in: ${pendingDir}`)
  if (files.length === 0) {
    console.log('Nothing to process.')
    process.exit(0)
  }

  let succeeded = 0
  let failed = 0

  for (const file of files) {
    const imagePath = path.join(pendingDir, file)
    console.log(`\n--- Processing: ${file} ---`)
    const result = await processImage(imagePath, { completedDir, logDir })
    if (result.success) {
      succeeded++
      console.log(`  OK: ${result.summary}`)
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
  console.error('FATAL:', err)
  process.exit(1)
})

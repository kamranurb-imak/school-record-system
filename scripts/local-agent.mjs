/**
 * Local Agent — runs on the school PC, exposes HTTP API on port 3099.
 * The browser (Vercel or localhost) talks directly to this agent for
 * local filesystem operations and Windows Task Scheduler management.
 *
 * Usage:  npm run local-agent
 * Or:     node scripts/local-agent.mjs
 */

import fs from 'fs'
import path from 'path'
import http from 'http'
import { spawnSync } from 'child_process'
import { createClient } from '@supabase/supabase-js'

const PORT = 3099
const TASK_NAME = 'DiaryImageProcessor'
const SCHOOL_ID = '00000000-0000-0000-0000-000000000001'
const CONFIG_FILE = path.join(import.meta.dirname, '.schedule-config.json')

// ─── .env.local loader ───────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(import.meta.dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) throw new Error(`.env.local not found at ${envPath}`)
  const env = {}
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
  return env
}

// ─── Startup: load folder paths ──────────────────────────────────────────────

let pendingDir = null

async function loadPendingDir() {
  try {
    const env = loadEnv()
    const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY'])
    const { data } = await supabase.from('schools').select('settings').eq('id', SCHOOL_ID).single()
    pendingDir = data?.settings?.diary_pending_dir ?? null
    console.log(`Pending dir: ${pendingDir ?? '(not configured)'}`)
  } catch (e) {
    console.warn(`Could not load pending dir: ${e.message}`)
  }
}

// ─── PowerShell helpers ───────────────────────────────────────────────────────

function runPs(command) {
  const result = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', command], {
    encoding: 'utf8',
    timeout: 30000,
  })
  return { stdout: (result.stdout ?? '').trim(), stderr: (result.stderr ?? '').trim(), status: result.status }
}

function getScheduleStatus() {
  const { stdout } = runPs(
    `$t = Get-ScheduledTask -TaskName '${TASK_NAME}' -ErrorAction SilentlyContinue; ` +
    `if ($null -eq $t) { Write-Output 'NOT_FOUND' } else { ` +
    `$i = Get-ScheduledTaskInfo -TaskName '${TASK_NAME}'; ` +
    `$lr = if ($i.LastRunTime -and $i.LastRunTime.Year -gt 2000) { $i.LastRunTime.ToString('s') } else { '' }; ` +
    `Write-Output "FOUND|$lr|$($i.LastTaskResult)" }`
  )
  return stdout
}

function buildRegisterPs(days, time, batFile) {
  const lines = []
  const vars = []
  for (const day of days) {
    const v = `$t${day}`
    lines.push(`${v} = New-ScheduledTaskTrigger -Weekly -DaysOfWeek ${day} -At "${time}"`)
    vars.push(v)
  }
  // Escape backslashes for PowerShell string
  const bat = batFile.replace(/\\/g, '\\\\')
  lines.push(`$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c \`"${bat}\`""`)
  lines.push(`$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable:$false -ExecutionTimeLimit (New-TimeSpan -Hours 1)`)
  lines.push(
    `Register-ScheduledTask -TaskName "${TASK_NAME}" -Action $action ` +
    `-Trigger ${vars.join(', ')} -Settings $settings ` +
    `-Description "Diary batch processor (configured via web UI)" -RunLevel Highest -Force`
  )
  return lines.join('; ')
}

// ─── CORS headers ─────────────────────────────────────────────────────────────

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  // Required for Chrome's Private Network Access policy:
  // allows public HTTPS sites (Vercel) to call http://localhost:3099
  res.setHeader('Access-Control-Allow-Private-Network', 'true')
}

function json(res, status, data) {
  setCors(res)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', c => (body += c))
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')) } catch { resolve({}) }
    })
    req.on('error', reject)
  })
}

// ─── Route handlers ───────────────────────────────────────────────────────────

function handleHealth(res) {
  let pendingCount = 0
  if (pendingDir && fs.existsSync(pendingDir)) {
    const exts = new Set(['.jpg', '.jpeg', '.png'])
    pendingCount = fs.readdirSync(pendingDir).filter(f => exts.has(path.extname(f).toLowerCase())).length
  }
  json(res, 200, { ok: true, pendingDir, pendingCount })
}

async function handleUpload(req, res) {
  const { filename, data } = await readBody(req)
  if (!filename || !data) return json(res, 400, { error: 'filename and data required' })
  if (!pendingDir) return json(res, 400, { error: 'Pending folder not configured. Set it in Admin > Folder Paths.' })
  if (!fs.existsSync(pendingDir)) {
    try { fs.mkdirSync(pendingDir, { recursive: true }) } catch (e) {
      return json(res, 500, { error: `Cannot create pending dir: ${e.message}` })
    }
  }
  const ext = path.extname(filename).toLowerCase()
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) return json(res, 400, { error: 'Only JPG/PNG files allowed' })
  const dest = path.join(pendingDir, path.basename(filename))
  try {
    fs.writeFileSync(dest, Buffer.from(data, 'base64'))
    json(res, 200, { ok: true, path: dest })
  } catch (e) {
    json(res, 500, { error: e.message })
  }
}

function handleGetSchedule(res) {
  const raw = getScheduleStatus()
  let registered = false
  let lastRun = null
  let lastResult = null

  if (raw.startsWith('FOUND')) {
    registered = true
    const parts = raw.split('|')
    lastRun = parts[1] || null
    lastResult = parts[2] ? parseInt(parts[2], 10) : null
  }

  let config = { days: [], time: '' }
  if (fs.existsSync(CONFIG_FILE)) {
    try { config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) } catch {}
  }

  json(res, 200, { registered, days: config.days, time: config.time, lastRun, lastResult })
}

async function handlePostSchedule(req, res) {
  const { days, time } = await readBody(req)
  if (!Array.isArray(days) || !days.length || !time) {
    return json(res, 400, { error: 'days (array) and time (HH:MM) required' })
  }

  const projectRoot = path.join(import.meta.dirname, '..')
  const batFile = path.join(projectRoot, 'scripts', 'run-diary-processor.bat')
  if (!fs.existsSync(batFile)) {
    return json(res, 500, { error: `Launcher not found: ${batFile}` })
  }

  const psCommand = buildRegisterPs(days, time, batFile)
  const { stdout, stderr, status } = runPs(psCommand)

  if (status !== 0) {
    return json(res, 500, { error: stderr || stdout || 'PowerShell command failed' })
  }

  // Save config
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ days, time }), 'utf8')

  json(res, 200, { ok: true, message: `Schedule registered for ${days.join(', ')} at ${time}` })
}

function handleDeleteSchedule(res) {
  const { stdout, stderr, status } = runPs(
    `Unregister-ScheduledTask -TaskName "${TASK_NAME}" -Confirm:$false -ErrorAction SilentlyContinue`
  )
  if (status !== 0) {
    return json(res, 500, { error: stderr || stdout || 'Could not remove schedule' })
  }
  if (fs.existsSync(CONFIG_FILE)) fs.unlinkSync(CONFIG_FILE)
  json(res, 200, { ok: true })
}

// ─── Server ───────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)

  // Preflight
  if (req.method === 'OPTIONS') {
    setCors(res)
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method === 'GET' && url.pathname === '/health') return handleHealth(res)
  if (req.method === 'POST' && url.pathname === '/upload') return handleUpload(req, res)
  if (req.method === 'GET' && url.pathname === '/schedule') return handleGetSchedule(res)
  if (req.method === 'POST' && url.pathname === '/schedule') return handlePostSchedule(req, res)
  if (req.method === 'DELETE' && url.pathname === '/schedule') return handleDeleteSchedule(res)

  json(res, 404, { error: 'Not found' })
})

await loadPendingDir()

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Local agent running at http://localhost:${PORT}`)
  console.log('Endpoints: GET /health  POST /upload  GET/POST/DELETE /schedule')
  console.log('Press Ctrl+C to stop.')
})

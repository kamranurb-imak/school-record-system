# Diary Image Batch Processor — Setup Guide

Automated diary image processing that runs every Monday and Thursday at 9 PM PKT using Claude Code Pro subscription (no Anthropic API credits needed).

---

## How It Works

1. Place diary images (JPG/PNG) in the **Pending** folder
2. The processor runs automatically on schedule (or manually)
3. Claude Code extracts all student records from each image
4. Records are upserted into Supabase `daily_records`
5. Processed images move to **Completed**, a log file is written to **Log**

Folder paths are configured at: **Admin > Settings** in the web app.

---

## Manual Execution

From the project root in any terminal:

```bash
npm run process-diary
```

Or double-click `scripts\run-diary-processor.bat`.

---

## Windows Task Scheduler Setup

Run this **once** to register the scheduled task. Must be run in **PowerShell as Administrator**.

### Step 1 — Open PowerShell as Administrator

Press **Win + X** → click **"Windows PowerShell (Admin)"** or **"Terminal (Admin)"**

### Step 2 — Run the registration command

```powershell
$projectRoot = "C:\Users\Salman TRaders\Desktop\Claude Code\claude code project\school-record-system"
$batFile = Join-Path $projectRoot "scripts\run-diary-processor.bat"

$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$batFile`""
$triggerMon = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At "9:00PM"
$triggerThu = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Thursday -At "9:00PM"
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable:$false -ExecutionTimeLimit (New-TimeSpan -Hours 1)

Register-ScheduledTask `
  -TaskName "DiaryImageProcessor" `
  -Action $action `
  -Trigger $triggerMon, $triggerThu `
  -Settings $settings `
  -Description "Processes pending diary images Mon/Thu 9PM PKT. Runs on startup if missed." `
  -RunLevel Highest `
  -Force
```

### Step 3 — Verify registration

```powershell
Get-ScheduledTask -TaskName "DiaryImageProcessor"
```

Expected output:
```
TaskPath  TaskName             State
--------  --------             -----
\         DiaryImageProcessor  Ready
```

---

## Useful Task Scheduler Commands

| Action | Command |
|--------|---------|
| Run immediately (test) | `Start-ScheduledTask -TaskName "DiaryImageProcessor"` |
| Check status | `Get-ScheduledTask -TaskName "DiaryImageProcessor"` |
| View last run result | `(Get-ScheduledTaskInfo -TaskName "DiaryImageProcessor").LastTaskResult` |
| Disable the task | `Disable-ScheduledTask -TaskName "DiaryImageProcessor"` |
| Re-enable the task | `Enable-ScheduledTask -TaskName "DiaryImageProcessor"` |
| Remove the task | `Unregister-ScheduledTask -TaskName "DiaryImageProcessor" -Confirm:$false` |

---

## Schedule Details

| Setting | Value |
|---------|-------|
| Days | Monday and Thursday |
| Time | 9:00 PM PKT (local time) |
| Missed run behaviour | Fires on next PC startup (`-StartWhenAvailable`) |
| Max runtime | 1 hour per run |
| Runs as | Current user (Highest privilege) |

---

## File Structure

```
scripts/
  process-diary-images.mjs   # Main batch processor (Node.js)
  run-diary-processor.bat    # Windows launcher used by Task Scheduler

.claude/skills/
  diary-batch/SKILL.md       # Claude Code skill for automated extraction
  diary-parser/SKILL.md      # Interactive skill for manual one-off use
```

---

## Prerequisites

- Node.js installed
- `claude` CLI installed and logged in (`claude --version` to verify)
- `.env.local` present in project root with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Folder paths configured at **Admin > Settings** in the web app
- Pending/Completed/Log folders must exist on disk before first run

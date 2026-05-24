import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Run nightly to check for behavior patterns
export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const today = new Date().toISOString().split('T')[0]

  // Get comment code IDs we care about
  const { data: codes } = await service.from('comment_codes').select('id, code')
  const codeMap = Object.fromEntries((codes ?? []).map((c: any) => [c.code, c.id]))

  // Rule 1: 3+ COPY_MISSING in 7 days
  await checkPattern(service, {
    codeId: codeMap['COPY_MISSING'],
    threshold: 3,
    window: sevenDaysAgo,
    alertType: 'repeated_copy_missing',
    messageTemplate: (name: string, count: number) => `${name} has missed their copy ${count} times in the past 7 days.`,
    severity: 2,
  })

  // Rule 2: 3+ ABSENT in 7 days
  await checkPattern(service, {
    codeId: codeMap['ABSENT'],
    threshold: 3,
    window: sevenDaysAgo,
    alertType: 'repeated_absence',
    messageTemplate: (name: string, count: number) => `${name} has been absent ${count} times in the past 7 days.`,
    severity: 2,
  })

  // Rule 3: Any MISBEHAVIOR in past 2 days
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  await checkPattern(service, {
    codeId: codeMap['MISBEHAVIOR'],
    threshold: 1,
    window: twoDaysAgo,
    alertType: 'misbehavior',
    messageTemplate: (name: string, count: number) => `${name} had a misbehavior record in the past 2 days.`,
    severity: 3,
  })

  // Rule 4: 2+ SLEEPING in 7 days
  await checkPattern(service, {
    codeId: codeMap['SLEEPING'],
    threshold: 2,
    window: sevenDaysAgo,
    alertType: 'sleeping_in_class',
    messageTemplate: (name: string, count: number) => `${name} was found sleeping in class ${count} times in 7 days.`,
    severity: 2,
  })

  return NextResponse.json({ success: true })
}

async function checkPattern(service: any, opts: {
  codeId: string
  threshold: number
  window: string
  alertType: string
  messageTemplate: (name: string, count: number) => string
  severity: number
}) {
  if (!opts.codeId) return

  const { data: records } = await service
    .from('daily_records')
    .select('student_id, students(full_name)')
    .eq('comment_code_id', opts.codeId)
    .gte('record_date', opts.window)

  if (!records?.length) return

  // Count per student
  const counts: Record<string, { count: number; name: string }> = {}
  for (const r of records) {
    const sid = r.student_id
    const name = (r.students as any)?.full_name ?? 'Unknown'
    if (!counts[sid]) counts[sid] = { count: 0, name }
    counts[sid].count++
  }

  for (const [studentId, { count, name }] of Object.entries(counts)) {
    if (count < opts.threshold) continue

    // Check if alert already exists (unacknowledged) in past 7 days
    const { data: existing } = await service
      .from('alerts')
      .select('id')
      .eq('student_id', studentId)
      .eq('alert_type', opts.alertType)
      .is('acknowledged_at', null)
      .gte('created_at', opts.window)
      .limit(1)

    if (existing?.length) continue

    await service.from('alerts').insert({
      student_id: studentId,
      alert_type: opts.alertType,
      message: opts.messageTemplate(name, count),
      severity: opts.severity,
    })
  }
}

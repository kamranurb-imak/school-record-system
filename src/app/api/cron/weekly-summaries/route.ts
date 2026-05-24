import { createServiceClient } from '@/lib/supabase/server'
import { anthropic, DIARY_EXTRACTION_SYSTEM } from '@/lib/claude'
import { NextResponse } from 'next/server'

// Triggered weekly (e.g. Vercel Cron Sunday 23:00 UTC)
// Set a CRON_SECRET env var and pass it as Authorization: Bearer <secret>
export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()
  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Get all active students
  const { data: students } = await service
    .from('students')
    .select('id, full_name, school_id')
    .eq('is_active', true)

  if (!students?.length) return NextResponse.json({ processed: 0 })

  // Get comment codes once per school (for caching)
  const schoolIds = [...new Set(students.map((s: any) => s.school_id))]
  const { data: allCodes } = await service.from('comment_codes').select('*').in('school_id', schoolIds)

  let processed = 0
  let errors = 0

  for (const student of students as any[]) {
    const { data: records } = await service
      .from('daily_records')
      .select(`
        record_date,
        comment_codes(code, label, severity),
        class_subjects(subjects(name)),
        free_text
      `)
      .eq('student_id', student.id)
      .gte('record_date', sevenDaysAgo)
      .lte('record_date', today)
      .order('record_date')

    if (!records?.length) continue

    const recordText = records.map((r: any) => {
      const subj = (r.class_subjects as any)?.subjects?.name
      const cc = (r.comment_codes as any)
      return `${r.record_date} | ${subj}: ${cc?.label ?? 'N/A'}${r.free_text ? ` (${r.free_text})` : ''}`
    }).join('\n')

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        system: `You are a school coordinator generating a concise weekly behavior and academic summary for a student. Be factual, brief, and constructive. Write 3–5 sentences.`,
        messages: [
          {
            role: 'user',
            content: `Student: ${student.full_name}\nWeek: ${sevenDaysAgo} to ${today}\n\nDaily records:\n${recordText}\n\nGenerate a weekly summary.`,
          },
        ],
      })

      const summaryText = response.content[0].type === 'text' ? response.content[0].text : ''

      await service.from('ai_summaries').insert({
        student_id: student.id,
        period_type: 'weekly',
        period_start: sevenDaysAgo,
        period_end: today,
        summary_text: summaryText,
      })
      processed++
    } catch {
      errors++
    }
  }

  return NextResponse.json({ processed, errors })
}

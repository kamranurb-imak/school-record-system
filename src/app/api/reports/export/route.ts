import { createClient } from '@/lib/supabase/server'
import type { UserProfile } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase.from('profiles').select('role, school_id').eq('id', user.id).single()
  const profile = data as UserProfile | null
  if (!profile || !['admin', 'class_teacher'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format') ?? 'csv'
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const classId = searchParams.get('class_id')
  const subjectId = searchParams.get('subject_id')

  if (!dateFrom || !dateTo) return NextResponse.json({ error: 'date_from and date_to required' }, { status: 400 })

  let query = supabase
    .from('daily_records')
    .select(`
      record_date,
      source,
      free_text,
      students!inner(gr_no, full_name, school_id, classes(name)),
      comment_codes(label),
      class_subjects!inner(subjects(name))
    `)
    .eq('students.school_id', profile.school_id)
    .gte('record_date', dateFrom)
    .lte('record_date', dateTo)
    .order('record_date', { ascending: false })
    .order('students(gr_no)')

  if (classId) {
    query = query.eq('students.class_id', classId)
  }
  if (subjectId) {
    query = query.eq('class_subjects.subject_id', subjectId)
  }

  const { data: records, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (format === 'json') {
    return new NextResponse(JSON.stringify(records, null, 2), {
      headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment' },
    })
  }

  // Build CSV
  const rows = [['Date', 'GR No', 'Student Name', 'Class', 'Subject', 'Comment', 'Free Text', 'Source']]
  for (const r of (records as any[]) ?? []) {
    const student = r.students as any
    rows.push([
      r.record_date,
      student?.gr_no ?? '',
      student?.full_name ?? '',
      student?.classes?.name ?? '',
      (r.class_subjects as any)?.subjects?.name ?? '',
      (r.comment_codes as any)?.label ?? '',
      r.free_text ?? '',
      r.source,
    ])
  }

  const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="school-records.csv"`,
    },
  })
}

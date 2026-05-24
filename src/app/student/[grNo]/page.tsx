import { requireProfile } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { StudentProfile } from './student-profile'

export default async function StudentPage({ params }: { params: Promise<{ grNo: string }> }) {
  const { grNo } = await params
  const { supabase, profile } = await requireProfile()

  const { data: student } = await supabase
    .from('students')
    .select('*, classes(name)')
    .eq('school_id', profile.school_id)
    .eq('gr_no', grNo)
    .single()

  if (!student) notFound()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [{ data: records }, { data: alerts }, { data: summary }] = await Promise.all([
    supabase
      .from('daily_records')
      .select('record_date, class_subject_id, comment_code_id, free_text, comment_codes(label, color, code, severity), class_subjects(subjects(name))')
      .eq('student_id', (student as any).id)
      .gte('record_date', thirtyDaysAgo)
      .order('record_date', { ascending: false }),
    supabase
      .from('alerts')
      .select('*')
      .eq('student_id', (student as any).id)
      .is('acknowledged_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('ai_summaries')
      .select('*')
      .eq('student_id', (student as any).id)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single(),
  ])

  return (
    <StudentProfile
      student={student as any}
      records={(records as any[]) ?? []}
      alerts={(alerts as any[]) ?? []}
      latestSummary={summary as any ?? null}
    />
  )
}

import { requireProfile } from '@/lib/auth'
import { ClassMatrixView } from './class-matrix-view'

export default async function ClassPage() {
  const { supabase, user, profile } = await requireProfile()

  if (profile.role === 'admin') {
    const { redirect } = await import('next/navigation')
    redirect('/admin')
  }

  const today = new Date().toISOString().split('T')[0]

  const { data: classes } = await supabase
    .from('classes')
    .select('id, name')
    .eq('school_id', profile.school_id)
    .eq('class_teacher_id', user.id)
    .order('name')

  if (!classes || classes.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p>No classes assigned to you as class teacher.</p>
      </div>
    )
  }

  const activeClassId = (classes[0] as any).id

  const [{ data: students }, { data: classSubjects }] = await Promise.all([
    supabase.from('students').select('id, gr_no, full_name').eq('class_id', activeClassId).eq('is_active', true).order('gr_no'),
    supabase.from('class_subjects').select('id, subjects(name)').eq('class_id', activeClassId),
  ])

  const csIds = ((classSubjects as any[]) ?? []).map((cs: any) => cs.id)
  const { data: records } = csIds.length
    ? await supabase.from('daily_records')
        .select('student_id, class_subject_id, comment_code_id, comment_codes(label, color)')
        .in('class_subject_id', csIds)
        .eq('record_date', today)
    : { data: [] }

  const { data: commentCodes } = await supabase
    .from('comment_codes').select('*').eq('school_id', profile.school_id).order('sort_order')

  return (
    <ClassMatrixView
      classes={classes}
      initialClassId={activeClassId}
      students={students ?? []}
      classSubjects={(classSubjects as any[]) ?? []}
      records={(records as any[]) ?? []}
      commentCodes={(commentCodes as any[]) ?? []}
      today={today}
    />
  )
}

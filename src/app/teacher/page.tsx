import { requireProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DailyEntryForm } from './daily-entry-form'

export default async function TeacherPage() {
  const { supabase, user, profile } = await requireProfile()
  if (profile.role === 'admin') redirect('/admin')

  const today = new Date().toISOString().split('T')[0]

  const { data: classSubjects } = await supabase
    .from('class_subjects')
    .select('id, class_id, classes(id, name), subjects(id, name)')
    .eq('teacher_id', user.id)

  if (!classSubjects || classSubjects.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-lg">No subjects assigned to you yet.</p>
        <p className="text-sm mt-1">Contact admin to assign your class-subjects.</p>
      </div>
    )
  }

  const classMap = new Map<string, { classId: string; className: string; classSubjects: any[] }>()
  for (const cs of classSubjects as any[]) {
    const c = cs.classes as any
    if (!c) continue
    if (!classMap.has(c.id)) classMap.set(c.id, { classId: c.id, className: c.name, classSubjects: [] })
    classMap.get(c.id)!.classSubjects.push(cs)
  }

  const classes = Array.from(classMap.values())
  if (classes.length === 0) {
    return <div className="text-center py-16 text-gray-500"><p>No classes found.</p></div>
  }

  const defaultClassId = classes[0].classId
  const defaultClassSubjectIds = classes[0].classSubjects.map((cs: any) => cs.id)

  const [{ data: students }, { data: commentCodes }, { data: existingRecords }] = await Promise.all([
    supabase.from('students').select('id, gr_no, full_name').eq('class_id', defaultClassId).eq('is_active', true).order('gr_no'),
    supabase.from('comment_codes').select('*').eq('school_id', profile.school_id).order('sort_order'),
    supabase.from('daily_records').select('id, student_id, class_subject_id, comment_code_id, free_text')
      .in('class_subject_id', defaultClassSubjectIds).eq('record_date', today),
  ])

  return (
    <DailyEntryForm
      classes={classes as any}
      initialClassId={defaultClassId}
      students={students ?? []}
      commentCodes={(commentCodes as any[]) ?? []}
      existingRecords={(existingRecords as any[]) ?? []}
      today={today}
      teacherId={user.id}
    />
  )
}

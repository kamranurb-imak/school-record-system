import { requireProfile } from '@/lib/auth'
import { StudentTable } from './student-table'

export default async function StudentsPage() {
  const { supabase, profile } = await requireProfile(['admin'])

  const [{ data: students }, { data: classes }] = await Promise.all([
    supabase
      .from('students')
      .select('*, classes(name)')
      .eq('school_id', profile.school_id)
      .order('gr_no'),
    supabase
      .from('classes')
      .select('id, name')
      .eq('school_id', profile.school_id)
      .order('name'),
  ])

  return (
    <StudentTable
      students={(students as any[]) ?? []}
      classes={classes ?? []}
      schoolId={profile.school_id}
    />
  )
}

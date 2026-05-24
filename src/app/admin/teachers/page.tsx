import { requireProfile } from '@/lib/auth'
import { TeacherManager } from './teacher-manager'

export default async function TeachersPage() {
  const { supabase, profile } = await requireProfile(['admin'])

  const { data: teachers } = await supabase
    .from('profiles')
    .select('*')
    .eq('school_id', profile.school_id)
    .order('full_name')

  return <TeacherManager teachers={(teachers as any[]) ?? []} schoolId={profile.school_id} />
}

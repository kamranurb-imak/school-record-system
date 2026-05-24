import { requireProfile } from '@/lib/auth'
import { SubjectManager } from './subject-manager'

export default async function SubjectsPage() {
  const { supabase, profile } = await requireProfile(['admin'])

  const { data: subjects } = await supabase.from('subjects').select('*').eq('school_id', profile.school_id).order('name')

  return <SubjectManager subjects={(subjects as any[]) ?? []} schoolId={profile.school_id} />
}

import { requireProfile } from '@/lib/auth'
import { ClassManager } from './class-manager'

export default async function ClassesPage() {
  const { supabase, profile } = await requireProfile(['admin'])

  const [{ data: classes }, { data: subjects }, { data: teachers }, { data: years }] = await Promise.all([
    supabase.from('classes').select('*, class_subjects(id, subject_id, teacher_id, subjects(name), profiles(full_name))').eq('school_id', profile.school_id).order('name'),
    supabase.from('subjects').select('id, name').eq('school_id', profile.school_id).order('name'),
    supabase.from('profiles').select('id, full_name, role').eq('school_id', profile.school_id).order('full_name'),
    supabase.from('academic_years').select('id, name').eq('school_id', profile.school_id).eq('is_active', true),
  ])

  return (
    <ClassManager
      classes={(classes as any[]) ?? []}
      subjects={subjects ?? []}
      teachers={(teachers as any[]) ?? []}
      academicYears={years ?? []}
      schoolId={profile.school_id}
    />
  )
}

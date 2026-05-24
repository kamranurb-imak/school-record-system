import { requireProfile } from '@/lib/auth'
import { ReportsClient } from './reports-client'

export default async function ReportsPage() {
  const { supabase, profile } = await requireProfile(['admin', 'class_teacher'])

  const [{ data: classes }, { data: subjects }] = await Promise.all([
    supabase.from('classes').select('id, name').eq('school_id', profile.school_id).order('name'),
    supabase.from('subjects').select('id, name').eq('school_id', profile.school_id).order('name'),
  ])

  return <ReportsClient classes={classes ?? []} subjects={subjects ?? []} />
}

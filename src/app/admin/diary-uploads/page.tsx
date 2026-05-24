import { requireProfile } from '@/lib/auth'
import { DiaryUploadsClient } from './diary-uploads-client'

export default async function DiaryUploadsPage() {
  const { supabase, profile } = await requireProfile(['admin', 'class_teacher'])

  const [{ data: classes }, { data: uploads }] = await Promise.all([
    supabase.from('classes').select('id, name').eq('school_id', profile.school_id).order('name'),
    supabase.from('diary_uploads')
      .select('id, class_id, page_label, week_start, week_end, status, created_at, classes(name)')
      .eq('school_id', profile.school_id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return <DiaryUploadsClient classes={classes ?? []} uploads={(uploads as any[]) ?? []} />
}

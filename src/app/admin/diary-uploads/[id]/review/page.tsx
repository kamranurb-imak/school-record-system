import { requireProfile } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { ReviewClient } from './review-client'

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, profile } = await requireProfile(['admin', 'class_teacher'])

  const { data: upload } = await supabase
    .from('diary_uploads')
    .select('*')
    .eq('id', id)
    .single()

  const typedUpload = upload as any
  if (!typedUpload || typedUpload.status === 'failed') notFound()

  const [{ data: students }, { data: classSubjects }, { data: commentCodes }] = await Promise.all([
    supabase.from('students').select('id, gr_no, full_name').eq('class_id', typedUpload.class_id).eq('is_active', true).order('gr_no'),
    supabase.from('class_subjects').select('id, subjects(id, name)').eq('class_id', typedUpload.class_id),
    supabase.from('comment_codes').select('*').eq('school_id', profile.school_id).order('sort_order'),
  ])

  return (
    <ReviewClient
      upload={typedUpload}
      students={students ?? []}
      classSubjects={(classSubjects as any[]) ?? []}
      commentCodes={(commentCodes as any[]) ?? []}
    />
  )
}

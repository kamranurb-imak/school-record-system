import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { UserProfile } from '@/lib/auth'
import { NextResponse } from 'next/server'

interface ReviewRow {
  studentId: string
  classSubjectId: string
  recordDate: string
  commentCodeId: string | null
  freeText?: string
  confidence: 'high' | 'medium' | 'low'
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: uploadId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase.from('profiles').select('role, school_id').eq('id', user.id).single()
  const profile = data as UserProfile | null
  if (!profile || !['admin', 'class_teacher'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { rows }: { rows: ReviewRow[] } = await req.json()
  if (!rows?.length) return NextResponse.json({ error: 'No rows provided' }, { status: 400 })

  const service = createServiceClient()

  const toInsert = rows
    .filter(r => r.commentCodeId)
    .map(r => ({
      student_id: r.studentId,
      class_subject_id: r.classSubjectId,
      record_date: r.recordDate,
      comment_code_id: r.commentCodeId,
      free_text: r.freeText || null,
      entered_by: user.id,
      source: 'photo_ocr' as const,
      source_upload_id: uploadId,
      confidence: r.confidence,
      review_status: 'confirmed' as const,
    }))

  const { error } = await service.from('daily_records').upsert(toInsert, {
    onConflict: 'student_id,class_subject_id,record_date',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await service.from('diary_uploads').update({ status: 'confirmed' }).eq('id', uploadId)

  return NextResponse.json({ success: true, inserted: toInsert.length })
}

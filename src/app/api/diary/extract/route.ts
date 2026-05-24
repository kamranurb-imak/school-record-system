import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { UserProfile } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { extractDiaryFromImage } from '@/lib/claude'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase.from('profiles').select('role, school_id').eq('id', user.id).single()
  const profile = data as UserProfile | null
  if (!profile || !['admin', 'class_teacher'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('image') as File
  const classId = formData.get('class_id') as string
  const pageLabel = formData.get('page_label') as string
  const weekStart = formData.get('week_start') as string
  const weekEnd = formData.get('week_end') as string

  if (!file || !classId) {
    return NextResponse.json({ error: 'image and class_id required' }, { status: 400 })
  }

  const service = createServiceClient()

  // Upload image to Supabase Storage
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const fileName = `diary-uploads/${profile.school_id}/${classId}/${Date.now()}-${file.name}`

  const { data: storageData, error: storageError } = await service.storage
    .from('diary-images')
    .upload(fileName, buffer, { contentType: file.type })

  if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 })

  const { data: { publicUrl } } = service.storage.from('diary-images').getPublicUrl(fileName)

  // Create upload record
  const { data: upload, error: uploadError } = await service.from('diary_uploads').insert({
    school_id: profile.school_id,
    class_id: classId,
    uploaded_by: user.id,
    image_url: publicUrl,
    page_label: pageLabel || null,
    week_start: weekStart || null,
    week_end: weekEnd || null,
    status: 'processing',
  }).select().single()

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  // Run Claude extraction
  try {
    const base64 = buffer.toString('base64')
    const extracted = await extractDiaryFromImage(base64, file.type)

    await service.from('diary_uploads').update({
      status: 'extracted',
      extracted_json: extracted,
    }).eq('id', upload.id)

    return NextResponse.json({ uploadId: upload.id, extracted })
  } catch (e: any) {
    await service.from('diary_uploads').update({
      status: 'failed',
      error_text: e.message,
    }).eq('id', upload.id)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

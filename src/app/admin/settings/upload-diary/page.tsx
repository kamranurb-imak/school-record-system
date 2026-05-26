import { requireProfile } from '@/lib/auth'
import { UploadDiaryClient } from './upload-diary-client'

export default async function UploadDiaryPage() {
  await requireProfile(['admin'])
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold">Upload Diary Images</h1>
      <UploadDiaryClient />
    </div>
  )
}

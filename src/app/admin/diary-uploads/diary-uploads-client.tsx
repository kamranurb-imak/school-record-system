'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import Link from 'next/link'

interface Upload {
  id: string; class_id: string; page_label: string | null
  week_start: string | null; week_end: string | null
  status: string; created_at: string
  classes: { name: string } | null
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'secondary', processing: 'secondary', extracted: 'default',
  confirmed: 'default', failed: 'destructive',
}

export function DiaryUploadsClient({ classes, uploads }: {
  classes: Array<{ id: string; name: string }>
  uploads: Upload[]
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({ class_id: '', page_label: '', week_start: '', week_end: '' })
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setPreview(URL.createObjectURL(file))
  }

  async function handleUpload() {
    if (!selectedFile || !form.class_id) {
      toast.error('Please select a class and image file')
      return
    }

    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('image', selectedFile)
      fd.append('class_id', form.class_id)
      fd.append('page_label', form.page_label)
      fd.append('week_start', form.week_start)
      fd.append('week_end', form.week_end)

      const res = await fetch('/api/diary/extract', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      toast.success('Image uploaded and extracted — review the results')
      setSelectedFile(null)
      setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
      router.push(`/admin/diary-uploads/${data.uploadId}/review`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Diary Photo Uploads</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Upload New Diary Page</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Class</Label>
              <Select value={form.class_id} onValueChange={v => setForm(f => ({ ...f, class_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Page Label (optional)</Label>
              <Input value={form.page_label} onChange={e => setForm(f => ({ ...f, page_label: e.target.value }))} placeholder="e.g. Week 3, May 2026" />
            </div>
            <div>
              <Label>Week Start</Label>
              <Input type="date" value={form.week_start} onChange={e => setForm(f => ({ ...f, week_start: e.target.value }))} />
            </div>
            <div>
              <Label>Week End</Label>
              <Input type="date" value={form.week_end} onChange={e => setForm(f => ({ ...f, week_end: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Diary Page Photo</Label>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="text-sm" />
            {preview && (
              <img src={preview} alt="Preview" className="max-h-48 rounded border object-contain" />
            )}
          </div>

          <Button onClick={handleUpload} disabled={uploading || !selectedFile || !form.class_id}>
            {uploading ? 'Uploading & Extracting...' : 'Upload & Extract with AI'}
          </Button>
          {uploading && <p className="text-sm text-gray-500">Claude is reading the diary image. This may take 15–30 seconds...</p>}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="font-semibold text-sm text-gray-600">Recent Uploads</h2>
        {uploads.length === 0 && <p className="text-gray-400 text-sm">No uploads yet</p>}
        {uploads.map(u => (
          <div key={u.id} className="bg-white border rounded p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{(u.classes as any)?.name ?? '—'}</p>
              <p className="text-xs text-gray-400">{u.page_label ?? ''} {u.week_start ?? ''}{u.week_end ? ` → ${u.week_end}` : ''}</p>
              <p className="text-xs text-gray-400">{new Date(u.created_at).toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={(STATUS_COLOR[u.status] as any) ?? 'secondary'}>{u.status}</Badge>
              {(u.status === 'extracted') && (
                <Link href={`/admin/diary-uploads/${u.id}/review`}>
                  <Button size="sm" variant="outline">Review</Button>
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

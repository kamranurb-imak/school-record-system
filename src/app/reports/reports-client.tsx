'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export function ReportsClient({ classes, subjects }: {
  classes: Array<{ id: string; name: string }>
  subjects: Array<{ id: string; name: string }>
}) {
  const [form, setForm] = useState({
    class_id: '',
    subject_id: '',
    date_from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0],
  })
  const [loading, setLoading] = useState(false)

  async function download(format: 'csv' | 'json') {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        format,
        date_from: form.date_from,
        date_to: form.date_to,
        ...(form.class_id && { class_id: form.class_id }),
        ...(form.subject_id && { subject_id: form.subject_id }),
      })

      const res = await fetch(`/api/reports/export?${params}`)
      if (!res.ok) throw new Error((await res.json()).error)

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `school-records-${form.date_from}-${form.date_to}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Report downloaded')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-xl font-bold">Reports & Export</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Filter Records</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Date From</Label>
              <Input type="date" value={form.date_from} onChange={e => setForm(f => ({ ...f, date_from: e.target.value }))} />
            </div>
            <div>
              <Label>Date To</Label>
              <Input type="date" value={form.date_to} onChange={e => setForm(f => ({ ...f, date_to: e.target.value }))} />
            </div>
          </div>

          <div>
            <Label>Class (optional — all classes if empty)</Label>
            <Select value={form.class_id} onValueChange={v => setForm(f => ({ ...f, class_id: v === 'all' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="All classes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Subject (optional)</Label>
            <Select value={form.subject_id} onValueChange={v => setForm(f => ({ ...f, subject_id: v === 'all' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="All subjects" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={() => download('csv')} disabled={loading}>
              {loading ? 'Generating...' : 'Export CSV'}
            </Button>
            <Button variant="outline" onClick={() => download('json')} disabled={loading}>
              Export JSON
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="text-sm text-gray-500 space-y-1">
        <p>CSV columns: Date, Student GR No, Student Name, Class, Subject, Comment, Free Text, Source</p>
        <p>Use date range up to 3 months for best performance.</p>
      </div>
    </div>
  )
}

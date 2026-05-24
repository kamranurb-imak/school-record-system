'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface CommentCode {
  id: string; school_id: string; code: string; label: string
  color: string; severity: number; sort_order: number
}

const SEVERITY_LABELS = ['None', 'Low', 'Medium', 'High']

export function CommentCodeManager({ codes: initial, schoolId }: { codes: CommentCode[]; schoolId: string }) {
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CommentCode | null>(null)
  const [form, setForm] = useState({ code: '', label: '', color: '#22c55e', severity: '0', sort_order: '0' })
  const [saving, setSaving] = useState(false)

  function openAdd() {
    setEditing(null)
    setForm({ code: '', label: '', color: '#22c55e', severity: '0', sort_order: String(initial.length + 1) })
    setOpen(true)
  }

  function openEdit(c: CommentCode) {
    setEditing(c)
    setForm({ code: c.code, label: c.label, color: c.color, severity: String(c.severity), sort_order: String(c.sort_order) })
    setOpen(true)
  }

  async function save() {
    setSaving(true)
    try {
      const payload = { code: form.code.toUpperCase().replace(/\s+/g, '_'), label: form.label, color: form.color, severity: Number(form.severity), sort_order: Number(form.sort_order) }
      if (editing) {
        const { error } = await supabase.from('comment_codes').update(payload).eq('id', editing.id)
        if (error) throw error
        toast.success('Code updated')
      } else {
        const { error } = await supabase.from('comment_codes').insert({ ...payload, school_id: schoolId })
        if (error) throw error
        toast.success('Code added')
      }
      setOpen(false)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this code?')) return
    await supabase.from('comment_codes').delete().eq('id', id)
    toast.success('Code deleted')
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Comment Codes</h1>
        <Button size="sm" onClick={openAdd}>+ Add Code</Button>
      </div>

      <div className="bg-white rounded border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2">Code</th>
              <th className="text-left px-4 py-2">Label</th>
              <th className="text-left px-4 py-2">Color</th>
              <th className="text-left px-4 py-2">Severity</th>
              <th className="text-left px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {initial.map(c => (
              <tr key={c.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2 font-mono text-xs">{c.code}</td>
                <td className="px-4 py-2">
                  <Badge style={{ backgroundColor: c.color, color: '#fff', border: 'none' }}>{c.label}</Badge>
                </td>
                <td className="px-4 py-2">
                  <span className="inline-block w-6 h-6 rounded" style={{ backgroundColor: c.color }} />
                </td>
                <td className="px-4 py-2 text-gray-500">{SEVERITY_LABELS[c.severity]}</td>
                <td className="px-4 py-2 flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>Edit</Button>
                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => remove(c.id)}>Delete</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Code' : 'Add Code'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Code (auto-formatted)</Label>
              <Input value={form.code} disabled={!!editing} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="COPY_MISSING" />
            </div>
            <div>
              <Label>Label (shown to teachers)</Label>
              <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Copy Missing" />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border" />
                <Input value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="font-mono" />
              </div>
            </div>
            <div>
              <Label>Severity (used for alerts)</Label>
              <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 — None</SelectItem>
                  <SelectItem value="1">1 — Low</SelectItem>
                  <SelectItem value="2">2 — Medium</SelectItem>
                  <SelectItem value="3">3 — High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sort Order</Label>
              <Input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface Subject { id: string; name: string }

export function SubjectManager({ subjects: initial, schoolId }: { subjects: Subject[]; schoolId: string }) {
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<Subject | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      if (editing) {
        const { error } = await supabase.from('subjects').update({ name }).eq('id', editing.id)
        if (error) throw error
        toast.success('Subject updated')
      } else {
        const { error } = await supabase.from('subjects').insert({ school_id: schoolId, name })
        if (error) throw error
        toast.success('Subject added')
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
    if (!confirm('Delete this subject? This will affect class assignments.')) return
    await supabase.from('subjects').delete().eq('id', id)
    toast.success('Subject deleted')
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Subjects</h1>
        <Button size="sm" onClick={() => { setEditing(null); setName(''); setOpen(true) }}>+ Add Subject</Button>
      </div>

      <div className="bg-white rounded border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Subject Name</th>
              <th className="text-left px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {initial.map(s => (
              <tr key={s.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2">{s.name}</td>
                <td className="px-4 py-2 flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(s); setName(s.name); setOpen(true) }}>Edit</Button>
                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => remove(s.id)}>Delete</Button>
                </td>
              </tr>
            ))}
            {initial.length === 0 && <tr><td colSpan={2} className="px-4 py-8 text-center text-gray-400">No subjects yet</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Subject' : 'Add Subject'}</DialogTitle></DialogHeader>
          <div>
            <Label>Subject Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Mathematics" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !name.trim()}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

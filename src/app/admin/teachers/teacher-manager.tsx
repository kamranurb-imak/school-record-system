'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface Profile {
  id: string
  full_name: string
  role: string
  phone: string | null
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  class_teacher: 'Class Teacher',
  subject_teacher: 'Subject Teacher',
}

export function TeacherManager({ teachers, schoolId }: { teachers: Profile[]; schoolId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [form, setForm] = useState({ full_name: '', role: 'subject_teacher', phone: '', email: '', password: '' })
  const [saving, setSaving] = useState(false)

  function openEdit(t: Profile) {
    setEditing(t)
    setForm({ full_name: t.full_name, role: t.role, phone: t.phone ?? '', email: '', password: '' })
    setOpen(true)
  }

  function openAdd() {
    setEditing(null)
    setForm({ full_name: '', role: 'subject_teacher', phone: '', email: '', password: '' })
    setOpen(true)
  }

  async function save() {
    setSaving(true)
    try {
      if (editing) {
        const res = await fetch('/api/admin/teachers', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editing.id, full_name: form.full_name, role: form.role, phone: form.phone }),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        toast.success('Teacher updated')
      } else {
        const res = await fetch('/api/admin/teachers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, school_id: schoolId }),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        toast.success('Teacher created — they can now log in')
      }
      setOpen(false)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Teachers & Staff</h1>
        <Button size="sm" onClick={openAdd}>+ Add Teacher</Button>
      </div>

      <div className="bg-white rounded border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-4 py-2 font-medium">Role</th>
              <th className="text-left px-4 py-2 font-medium">Phone</th>
              <th className="text-left px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map(t => (
              <tr key={t.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2">{t.full_name}</td>
                <td className="px-4 py-2">
                  <Badge variant={t.role === 'admin' ? 'default' : 'secondary'}>
                    {ROLE_LABELS[t.role] ?? t.role}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-gray-500">{t.phone ?? '—'}</td>
                <td className="px-4 py-2">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>Edit</Button>
                </td>
              </tr>
            ))}
            {teachers.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No staff yet</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Teacher' : 'Add Teacher'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Full Name</Label>
              <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Miss Sana" />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="subject_teacher">Subject Teacher</SelectItem>
                  <SelectItem value="class_teacher">Class Teacher</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Phone (optional)</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="03001234567" />
            </div>
            {!editing && (
              <>
                <div>
                  <Label>Email (login)</Label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="teacher@school.com" />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 8 characters" />
                </div>
              </>
            )}
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

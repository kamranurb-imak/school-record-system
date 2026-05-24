'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'

interface Student {
  id: string
  gr_no: string
  full_name: string
  guardian_phone: string | null
  is_active: boolean
  class_id: string | null
  classes?: { name: string } | null
}

interface Class { id: string; name: string }

export function StudentTable({ students: initial, classes, schoolId }: {
  students: Student[]
  classes: Class[]
  schoolId: string
}) {
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const [students, setStudents] = useState(initial)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [form, setForm] = useState({ gr_no: '', full_name: '', guardian_phone: '', class_id: '' })
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const filtered = students.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.gr_no.toLowerCase().includes(search.toLowerCase())
  )

  function openAdd() {
    setEditing(null)
    setForm({ gr_no: '', full_name: '', guardian_phone: '', class_id: '' })
    setOpen(true)
  }

  function openEdit(s: Student) {
    setEditing(s)
    setForm({ gr_no: s.gr_no, full_name: s.full_name, guardian_phone: s.guardian_phone ?? '', class_id: s.class_id ?? '' })
    setOpen(true)
  }

  async function save() {
    setSaving(true)
    try {
      if (editing) {
        const { error } = await supabase.from('students').update({
          full_name: form.full_name,
          guardian_phone: form.guardian_phone || null,
          class_id: form.class_id || null,
        }).eq('id', editing.id)
        if (error) throw error
        toast.success('Student updated')
      } else {
        const { error } = await supabase.from('students').insert({
          school_id: schoolId,
          gr_no: form.gr_no,
          full_name: form.full_name,
          guardian_phone: form.guardian_phone || null,
          class_id: form.class_id || null,
        })
        if (error) throw error
        toast.success('Student added')
      }
      setOpen(false)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(s: Student) {
    await supabase.from('students').update({ is_active: !s.is_active }).eq('id', s.id)
    setStudents(prev => prev.map(x => x.id === s.id ? { ...x, is_active: !x.is_active } : x))
    toast.success(s.is_active ? 'Student deactivated' : 'Student activated')
  }

  function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse<{ gr_no: string; full_name: string; guardian_phone?: string; class_name?: string }>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async ({ data }) => {
        let count = 0
        for (const row of data) {
          if (!row.gr_no || !row.full_name) continue
          const classMatch = classes.find(c => c.name.toLowerCase() === (row.class_name ?? '').toLowerCase())
          const { error } = await supabase.from('students').upsert({
            school_id: schoolId,
            gr_no: row.gr_no.trim(),
            full_name: row.full_name.trim(),
            guardian_phone: row.guardian_phone?.trim() || null,
            class_id: classMatch?.id || null,
          }, { onConflict: 'school_id,gr_no' })
          if (!error) count++
        }
        toast.success(`Imported ${count} students`)
        router.refresh()
      },
    })
    e.target.value = ''
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Students</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            Import CSV
          </Button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
          <Button size="sm" onClick={openAdd}>+ Add Student</Button>
        </div>
      </div>

      <p className="text-xs text-gray-500">CSV columns: <code>gr_no, full_name, guardian_phone (optional), class_name (optional)</code></p>

      <Input
        placeholder="Search by name or GR No..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2 font-medium">GR No</th>
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-4 py-2 font-medium">Class</th>
              <th className="text-left px-4 py-2 font-medium">Phone</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-left px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2 font-mono text-xs">
                  <Link href={`/student/${s.gr_no}`} className="text-blue-600 hover:underline">{s.gr_no}</Link>
                </td>
                <td className="px-4 py-2">
                  <Link href={`/student/${s.gr_no}`} className="hover:text-blue-600 hover:underline">{s.full_name}</Link>
                </td>
                <td className="px-4 py-2 text-gray-600">{s.classes?.name ?? '—'}</td>
                <td className="px-4 py-2 text-gray-600">{s.guardian_phone ?? '—'}</td>
                <td className="px-4 py-2">
                  <Badge variant={s.is_active ? 'default' : 'secondary'}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="px-4 py-2 flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleActive(s)}>
                    {s.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No students found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Student' : 'Add Student'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>GR Number</Label>
              <Input value={form.gr_no} disabled={!!editing}
                onChange={e => setForm(f => ({ ...f, gr_no: e.target.value }))}
                placeholder="STD-001" />
            </div>
            <div>
              <Label>Full Name</Label>
              <Input value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="Ahmed Ali" />
            </div>
            <div>
              <Label>Guardian Phone (optional)</Label>
              <Input value={form.guardian_phone}
                onChange={e => setForm(f => ({ ...f, guardian_phone: e.target.value }))}
                placeholder="03001234567" />
            </div>
            <div>
              <Label>Class</Label>
              <Select value={form.class_id} onValueChange={v => setForm(f => ({ ...f, class_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
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

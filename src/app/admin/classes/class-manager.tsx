'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface ClassRow {
  id: string
  name: string
  academic_year_id: string
  class_teacher_id: string | null
  class_subjects: Array<{
    id: string
    subject_id: string
    teacher_id: string | null
    subjects: { name: string } | null
    profiles: { full_name: string } | null
  }>
}

export function ClassManager({ classes, subjects, teachers, academicYears, schoolId }: {
  classes: ClassRow[]
  subjects: Array<{ id: string; name: string }>
  teachers: Array<{ id: string; full_name: string; role: string }>
  academicYears: Array<{ id: string; name: string }>
  schoolId: string
}) {
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const [open, setOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [selected, setSelected] = useState<ClassRow | null>(null)
  const [form, setForm] = useState({ name: '', academic_year_id: '', class_teacher_id: '' })
  const [assignForm, setAssignForm] = useState({ subject_id: '', teacher_id: '' })
  const [saving, setSaving] = useState(false)

  async function saveClass() {
    setSaving(true)
    try {
      const { error } = await supabase.from('classes').insert({
        school_id: schoolId,
        name: form.name,
        academic_year_id: form.academic_year_id,
        class_teacher_id: form.class_teacher_id || null,
      })
      if (error) throw error
      toast.success('Class created')
      setOpen(false)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function assignSubject() {
    if (!selected) return
    setSaving(true)
    try {
      const { error } = await supabase.from('class_subjects').upsert({
        class_id: selected.id,
        subject_id: assignForm.subject_id,
        teacher_id: assignForm.teacher_id || null,
      }, { onConflict: 'class_id,subject_id' })
      if (error) throw error
      toast.success('Subject assigned')
      setAssignOpen(false)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function removeSubject(classSubjectId: string) {
    await supabase.from('class_subjects').delete().eq('id', classSubjectId)
    toast.success('Subject removed')
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Classes</h1>
        <Button size="sm" onClick={() => {
          setForm({ name: '', academic_year_id: academicYears[0]?.id ?? '', class_teacher_id: '' })
          setOpen(true)
        }}>+ Add Class</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {classes.map(cls => (
          <Card key={cls.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                {cls.name}
                <Button size="sm" variant="outline" onClick={() => {
                  setSelected(cls)
                  setAssignForm({ subject_id: '', teacher_id: '' })
                  setAssignOpen(true)
                }}>+ Subject</Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {cls.class_subjects.length === 0 && (
                <p className="text-sm text-gray-400">No subjects assigned</p>
              )}
              {cls.class_subjects.map(cs => (
                <div key={cs.id} className="flex items-center justify-between text-sm">
                  <span>
                    <span className="font-medium">{cs.subjects?.name}</span>
                    {cs.profiles && <span className="text-gray-500"> — {cs.profiles.full_name}</span>}
                  </span>
                  <button onClick={() => removeSubject(cs.id)} className="text-red-400 hover:text-red-600 text-xs ml-2">✕</button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Class</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Class Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Grade 8-A" />
            </div>
            <div>
              <Label>Academic Year</Label>
              <Select value={form.academic_year_id} onValueChange={v => setForm(f => ({ ...f, academic_year_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                <SelectContent>
                  {academicYears.map(y => <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Class Teacher (optional)</Label>
              <Select value={form.class_teacher_id} onValueChange={v => setForm(f => ({ ...f, class_teacher_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                <SelectContent>
                  {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={saveClass} disabled={saving}>{saving ? 'Saving...' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Subject to {selected?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Subject</Label>
              <Select value={assignForm.subject_id} onValueChange={v => setAssignForm(f => ({ ...f, subject_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>
                  {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Teacher (optional)</Label>
              <Select value={assignForm.teacher_id} onValueChange={v => setAssignForm(f => ({ ...f, teacher_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                <SelectContent>
                  {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={assignSubject} disabled={saving || !assignForm.subject_id}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'

interface CommentCode { id: string; code: string; label: string; color: string; severity: number }
interface Student { id: string; gr_no: string; full_name: string }
interface ClassSubjectInfo {
  id: string
  class_id: string
  classes: { id: string; name: string } | null
  subjects: { id: string; name: string } | null
}
interface ClassInfo { classId: string; className: string; classSubjects: ClassSubjectInfo[] }

interface ExistingRecord {
  id: string
  student_id: string
  class_subject_id: string
  comment_code_id: string | null
  free_text: string | null
}

type RecordMap = Record<string, { commentCodeId: string | null; freeText: string; dirty: boolean }>
// key: `${studentId}|${classSubjectId}`

export function DailyEntryForm({
  classes,
  initialClassId,
  students: initialStudents,
  commentCodes,
  existingRecords,
  today,
  teacherId,
}: {
  classes: ClassInfo[]
  initialClassId: string
  students: Student[]
  commentCodes: CommentCode[]
  existingRecords: ExistingRecord[]
  today: string
  teacherId: string
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const [activeClassId, setActiveClassId] = useState(initialClassId)
  const [students, setStudents] = useState(initialStudents)
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(
    classes.find(c => c.classId === initialClassId)?.classSubjects[0]?.id ?? null
  )
  const [records, setRecords] = useState<RecordMap>(() => {
    const map: RecordMap = {}
    for (const r of existingRecords as any[]) {
      map[`${r.student_id}|${r.class_subject_id}`] = { commentCodeId: r.comment_code_id, freeText: r.free_text ?? '', dirty: false }
    }
    return map
  })
  const [noteDialog, setNoteDialog] = useState<{ studentId: string; key: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const activeClass = classes.find(c => c.classId === activeClassId)
  const activeClassSubjects = activeClass?.classSubjects ?? []

  async function switchClass(classId: string) {
    const newClass = classes.find(c => c.classId === classId)
    if (!newClass) return
    const newSubjectId = newClass.classSubjects[0]?.id ?? null
    setActiveClassId(classId)
    setActiveSubjectId(newSubjectId)

    // Load students for the new class
    const { data } = await supabase.from('students').select('id, gr_no, full_name')
      .eq('class_id', classId).eq('is_active', true).order('gr_no')
    setStudents(data ?? [])

    // Load existing records for today for this class's subjects
    const csIds = newClass.classSubjects.map(cs => cs.id)
    const { data: recs } = await supabase.from('daily_records')
      .select('id, student_id, class_subject_id, comment_code_id, free_text')
      .in('class_subject_id', csIds).eq('record_date', today)

    const map: RecordMap = {}
    for (const r of (recs as any[]) ?? []) {
      map[`${r.student_id}|${r.class_subject_id}`] = { commentCodeId: r.comment_code_id, freeText: r.free_text ?? '', dirty: false }
    }
    setRecords(prev => ({ ...prev, ...map }))
  }

  function setCode(studentId: string, classSubjectId: string, codeId: string | null) {
    const key = `${studentId}|${classSubjectId}`
    setRecords(prev => ({ ...prev, [key]: { ...(prev[key] ?? { freeText: '', dirty: false }), commentCodeId: codeId, dirty: true } }))
  }

  async function markAllGood() {
    if (!activeSubjectId) return
    const goodCode = commentCodes.find(c => c.code === 'GOOD')
    if (!goodCode) return
    setRecords(prev => {
      const next = { ...prev }
      for (const s of students) {
        const key = `${s.id}|${activeSubjectId}`
        if (!next[key]?.commentCodeId) {
          next[key] = { commentCodeId: goodCode.id, freeText: '', dirty: true }
        }
      }
      return next
    })
  }

  async function saveAll() {
    if (!activeSubjectId) return
    setSaving(true)
    const dirty = students.filter(s => {
      const key = `${s.id}|${activeSubjectId}`
      return records[key]?.dirty
    })

    let errors = 0
    for (const student of dirty) {
      const key = `${student.id}|${activeSubjectId}`
      const rec = records[key]
      if (!rec?.commentCodeId) continue

      const { error } = await supabase.from('daily_records').upsert({
        student_id: student.id,
        class_subject_id: activeSubjectId,
        record_date: today,
        comment_code_id: rec.commentCodeId,
        free_text: rec.freeText || null,
        entered_by: teacherId,
        source: 'app',
      }, { onConflict: 'student_id,class_subject_id,record_date' })

      if (error) errors++
      else {
        setRecords(prev => ({ ...prev, [key]: { ...prev[key], dirty: false } }))
      }
    }

    setSaving(false)
    if (errors === 0) toast.success('Records saved')
    else toast.error(`${errors} record(s) failed to save`)
  }

  const dirtyCount = activeSubjectId
    ? students.filter(s => records[`${s.id}|${activeSubjectId}`]?.dirty).length
    : 0

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Daily Entry</h1>
        <span className="text-sm text-gray-500">{today}</span>
      </div>

      {/* Class tabs */}
      {classes.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {classes.map(c => (
            <button
              key={c.classId}
              onClick={() => switchClass(c.classId)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeClassId === c.classId ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {c.className}
            </button>
          ))}
        </div>
      )}

      {/* Subject tabs */}
      {activeClassSubjects.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {activeClassSubjects.map(cs => {
            const subj = cs.subjects as any
            return (
              <button
                key={cs.id}
                onClick={() => setActiveSubjectId(cs.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  activeSubjectId === cs.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {subj?.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Actions bar */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={markAllGood}>Mark All Good</Button>
        <Button size="sm" onClick={saveAll} disabled={saving || dirtyCount === 0}>
          {saving ? 'Saving...' : `Save${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}
        </Button>
      </div>

      {/* Student list */}
      <div className="bg-white rounded border overflow-hidden">
        {students.map((student, idx) => {
          const key = activeSubjectId ? `${student.id}|${activeSubjectId}` : ''
          const record = records[key]
          const selectedCode = commentCodes.find(c => c.id === record?.commentCodeId)

          return (
            <div key={student.id} className={`flex items-center gap-3 px-4 py-3 ${idx > 0 ? 'border-t' : ''}`}>
              <span className="text-xs text-gray-400 w-6 shrink-0 font-mono">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{student.full_name}</p>
                <p className="text-xs text-gray-400">{student.gr_no}</p>
              </div>
              <div className="flex items-center gap-2">
                {/* Comment code picker */}
                <div className="w-36">
                  <Select
                    value={record?.commentCodeId ?? ''}
                    onValueChange={v => setCode(student.id, activeSubjectId!, v || null)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select...">
                        {selectedCode && (
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: selectedCode.color }} />
                            {selectedCode.label}
                          </span>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {commentCodes.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                            {c.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Note button */}
                <button
                  onClick={() => setNoteDialog({ studentId: student.id, key })}
                  className={`text-sm px-2 py-1 rounded transition-colors ${record?.freeText ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}
                  title="Add note"
                >
                  {record?.freeText ? '📝' : '＋'}
                </button>
              </div>
              {record?.dirty && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" title="Unsaved" />}
            </div>
          )
        })}
        {students.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">No students in this class</div>
        )}
      </div>

      {/* Note dialog */}
      {noteDialog && (
        <Dialog open onOpenChange={() => setNoteDialog(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Note</DialogTitle></DialogHeader>
            <Input
              value={records[noteDialog.key]?.freeText ?? ''}
              onChange={e => {
                const val = e.target.value
                setRecords(prev => ({
                  ...prev,
                  [noteDialog.key]: { ...(prev[noteDialog.key] ?? { commentCodeId: null, dirty: false }), freeText: val, dirty: true }
                }))
              }}
              placeholder="Optional additional note..."
            />
            <DialogFooter>
              <Button onClick={() => setNoteDialog(null)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

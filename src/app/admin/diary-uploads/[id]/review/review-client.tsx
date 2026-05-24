'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface Student { id: string; gr_no: string; full_name: string }
interface ClassSubject { id: string; subjects: { id: string; name: string } | null }
interface CommentCode { id: string; code: string; label: string; color: string; severity: number }
interface DiaryUpload {
  id: string; image_url: string; class_id: string
  week_start: string | null; week_end: string | null
  page_label: string | null; extracted_json: any
}

type CellState = { commentCodeId: string | null; confidence: 'high' | 'medium' | 'low'; modified: boolean }
type GridState = Record<string, CellState> // key: `${studentId}|${classSubjectId}`

export function ReviewClient({ upload, students, classSubjects, commentCodes }: {
  upload: DiaryUpload
  students: Student[]
  classSubjects: ClassSubject[]
  commentCodes: CommentCode[]
}) {
  const router = useRouter()
  const extracted = upload.extracted_json as any

  // Build initial grid from extracted_json
  const initialGrid = useMemo<GridState>(() => {
    const grid: GridState = {}
    if (!extracted?.rows) return grid

    for (const row of extracted.rows) {
      const student = students.find(s =>
        s.gr_no === row.row_label ||
        s.gr_no.replace('STD-', '') === String(row.row_label).replace('STD-', '') ||
        students.indexOf(s) + 1 === Number(row.row_label)
      )
      if (!student) continue

      for (const cell of row.cells ?? []) {
        const cs = classSubjects.find(cs => {
          const subj = cs.subjects as any
          return subj?.name?.toLowerCase() === cell.subject?.toLowerCase()
        })
        if (!cs) continue

        const code = commentCodes.find(c => c.code === cell.code)
        const key = `${student.id}|${cs.id}`
        grid[key] = {
          commentCodeId: code?.id ?? null,
          confidence: cell.confidence ?? 'medium',
          modified: false,
        }
      }
    }
    return grid
  }, [extracted, students, classSubjects, commentCodes])

  const [grid, setGrid] = useState(initialGrid)
  const [submitting, setSubmitting] = useState(false)
  const recordDate = upload.week_start ?? new Date().toISOString().split('T')[0]

  function setCell(studentId: string, csId: string, codeId: string | null) {
    const key = `${studentId}|${csId}`
    setGrid(prev => ({ ...prev, [key]: { ...(prev[key] ?? { confidence: 'high', modified: false }), commentCodeId: codeId, modified: true } }))
  }

  async function confirmAll() {
    setSubmitting(true)
    const rows = []
    for (const student of students) {
      for (const cs of classSubjects) {
        const key = `${student.id}|${cs.id}`
        const cell = grid[key]
        if (!cell?.commentCodeId) continue
        rows.push({
          studentId: student.id,
          classSubjectId: cs.id,
          recordDate,
          commentCodeId: cell.commentCodeId,
          confidence: cell.confidence,
        })
      }
    }

    try {
      const res = await fetch(`/api/diary/${upload.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`${data.inserted} records saved to database`)
      router.push('/admin/diary-uploads')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const lowConfidenceCount = Object.values(grid).filter(c => c.confidence === 'low').length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Review Extracted Records</h1>
          <p className="text-sm text-gray-500">{upload.page_label} — {recordDate}</p>
        </div>
        <div className="flex items-center gap-3">
          {lowConfidenceCount > 0 && (
            <Badge variant="destructive">{lowConfidenceCount} low-confidence cells</Badge>
          )}
          <Button onClick={confirmAll} disabled={submitting}>
            {submitting ? 'Saving...' : 'Confirm & Save All'}
          </Button>
        </div>
      </div>

      <div className="flex gap-4 lg:flex-row flex-col">
        {/* Original image */}
        <div className="lg:w-1/2">
          <p className="text-sm font-medium mb-1 text-gray-600">Original Diary Page</p>
          <img src={upload.image_url} alt="Diary page" className="w-full rounded border object-contain max-h-[600px]" />
        </div>

        {/* Extracted table */}
        <div className="lg:w-1/2 overflow-x-auto">
          <p className="text-sm font-medium mb-1 text-gray-600">Extracted Data (editable)</p>
          <div className="bg-white border rounded overflow-hidden">
            <table className="text-xs w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-2 py-2 text-left font-medium sticky left-0 bg-gray-50">Student</th>
                  {classSubjects.map(cs => (
                    <th key={cs.id} className="px-2 py-2 text-center font-medium whitespace-nowrap">
                      {(cs.subjects as any)?.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((student, idx) => (
                  <tr key={student.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-2 py-1.5 sticky left-0 bg-inherit border-r">
                      <p className="font-medium">{student.full_name}</p>
                      <p className="text-gray-400">{student.gr_no}</p>
                    </td>
                    {classSubjects.map(cs => {
                      const key = `${student.id}|${cs.id}`
                      const cell = grid[key]
                      const isLow = cell?.confidence === 'low'

                      return (
                        <td key={cs.id} className={`px-1 py-1 text-center ${isLow ? 'bg-yellow-50' : ''}`}>
                          <Select
                            value={cell?.commentCodeId ?? ''}
                            onValueChange={v => setCell(student.id, cs.id, v || null)}
                          >
                            <SelectTrigger className={`h-7 text-xs px-1 ${isLow ? 'border-yellow-400' : ''}`}>
                              <SelectValue placeholder="—">
                                {cell?.commentCodeId && (() => {
                                  const c = commentCodes.find(x => x.id === cell.commentCodeId)
                                  return c ? <span style={{ color: c.color }} className="font-medium">{c.label}</span> : '—'
                                })()}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">— Clear —</SelectItem>
                              {commentCodes.map(c => (
                                <SelectItem key={c.id} value={c.id}>
                                  <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                                    {c.label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'

interface Student { id: string; gr_no: string; full_name: string }
interface ClassSubject { id: string; subjects: { name: string } | null }
interface Record { student_id: string; class_subject_id: string; comment_code_id: string | null; comment_codes: { label: string; color: string } | null }
interface CommentCode { id: string; code: string; label: string; color: string }

export function ClassMatrixView({ classes, initialClassId, students, classSubjects, records, commentCodes, today }: {
  classes: Array<{ id: string; name: string }>
  initialClassId: string
  students: Student[]
  classSubjects: ClassSubject[]
  records: Record[]
  commentCodes: CommentCode[]
  today: string
}) {
  const [search, setSearch] = useState('')

  const filtered = students.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.gr_no.toLowerCase().includes(search.toLowerCase())
  )

  function getRecord(studentId: string, csId: string) {
    return records.find(r => r.student_id === studentId && r.class_subject_id === csId)
  }

  const absentCode = commentCodes.find(c => c.code === 'ABSENT')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{classes.find(c => c.id === initialClassId)?.name} — Daily Record</h1>
          <p className="text-sm text-gray-500">{today}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {classes.map(c => (
            <Link key={c.id} href="/class" className={`px-3 py-1 rounded-full text-sm font-medium ${c.id === initialClassId ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
              {c.name}
            </Link>
          ))}
        </div>
      </div>

      <Input
        placeholder="Search student..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-xs"
      />

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2 text-xs">
        {commentCodes.map(cc => {
          const count = records.filter(r => r.comment_code_id === cc.id).length
          if (count === 0) return null
          return (
            <span key={cc.id} className="px-2 py-1 rounded-full text-white font-medium" style={{ backgroundColor: cc.color }}>
              {cc.label}: {count}
            </span>
          )
        })}
      </div>

      {/* Matrix table — mirrors the paper diary layout */}
      <div className="overflow-x-auto rounded border bg-white">
        <table className="text-xs w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-3 py-2 text-left font-medium sticky left-0 bg-gray-50 min-w-[160px]">#  Student</th>
              {classSubjects.map(cs => (
                <th key={cs.id} className="px-3 py-2 text-center font-medium whitespace-nowrap min-w-[90px]">
                  {(cs.subjects as any)?.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((student, idx) => {
              const isAllAbsent = classSubjects.length > 0 && classSubjects.every(cs => {
                const rec = getRecord(student.id, cs.id)
                return rec?.comment_code_id === absentCode?.id
              })

              return (
                <tr key={student.id} className={`border-b ${isAllAbsent ? 'bg-gray-50 opacity-60' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                  <td className="px-3 py-2 sticky left-0 bg-inherit border-r">
                    <Link href={`/student/${student.gr_no}`} className="hover:underline">
                      <span className="text-gray-400 mr-2">{idx + 1}.</span>
                      <span className="font-medium">{student.full_name}</span>
                    </Link>
                  </td>
                  {classSubjects.map(cs => {
                    const rec = getRecord(student.id, cs.id)
                    const cc = rec?.comment_codes
                    return (
                      <td key={cs.id} className="px-2 py-2 text-center">
                        {cc ? (
                          <span
                            className="px-1.5 py-0.5 rounded text-white text-xs font-medium whitespace-nowrap"
                            style={{ backgroundColor: cc.color }}
                          >
                            {cc.label}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={classSubjects.length + 1} className="px-4 py-8 text-center text-gray-400">No students found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

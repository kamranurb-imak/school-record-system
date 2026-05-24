'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useState } from 'react'

interface DailyEntry {
  record_date: string
  class_subject_id: string
  comment_code_id: string | null
  free_text: string | null
  comment_codes: { label: string; color: string; code: string; severity: number } | null
  class_subjects: { subjects: { name: string } | null } | null
}

interface Alert {
  id: string; alert_type: string; message: string; severity: number; created_at: string
}

interface AiSummary {
  summary_text: string; period_start: string; period_end: string; generated_at: string
}

interface Student {
  id: string; gr_no: string; full_name: string; guardian_phone: string | null
  admission_date: string; is_active: boolean
  classes: { name: string } | null
}

export function StudentProfile({ student, records, alerts, latestSummary }: {
  student: Student
  records: DailyEntry[]
  alerts: Alert[]
  latestSummary: AiSummary | null
}) {
  const [ackLoading, setAckLoading] = useState<string | null>(null)

  // Group records by date
  const byDate = records.reduce<Record<string, DailyEntry[]>>((acc, r) => {
    if (!acc[r.record_date]) acc[r.record_date] = []
    acc[r.record_date].push(r)
    return acc
  }, {})

  // Attendance stats
  const absentCount = records.filter(r => r.comment_codes?.code === 'ABSENT').length
  const total = records.length
  const presentCount = total - absentCount
  const attendancePct = total > 0 ? Math.round((presentCount / total) * 100) : 100

  // Behavior stats
  const severityAvg = records.reduce((sum, r) => sum + (r.comment_codes?.severity ?? 0), 0) / (total || 1)

  async function acknowledge(alertId: string) {
    setAckLoading(alertId)
    const res = await fetch(`/api/alerts/${alertId}/acknowledge`, { method: 'POST' })
    if (res.ok) {
      toast.success('Alert acknowledged')
      window.location.reload()
    } else {
      toast.error('Failed')
    }
    setAckLoading(null)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{student.full_name}</h1>
          <p className="text-gray-500">{student.gr_no} · {(student.classes as any)?.name}</p>
          {student.guardian_phone && <p className="text-sm text-gray-400">Guardian: {student.guardian_phone}</p>}
        </div>
        <Badge variant={student.is_active ? 'default' : 'secondary'}>
          {student.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-green-600">{attendancePct}%</p>
            <p className="text-xs text-gray-500">Attendance (30d)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-red-500">{absentCount}</p>
            <p className="text-xs text-gray-500">Absences (30d)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className={`text-2xl font-bold ${severityAvg < 1 ? 'text-green-600' : severityAvg < 2 ? 'text-yellow-500' : 'text-red-500'}`}>
              {severityAvg.toFixed(1)}
            </p>
            <p className="text-xs text-gray-500">Avg Severity (30d)</p>
          </CardContent>
        </Card>
      </div>

      {/* Open Alerts */}
      {alerts.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-600">Open Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map(a => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span>{a.message}</span>
                <Button size="sm" variant="outline" disabled={ackLoading === a.id} onClick={() => acknowledge(a.id)}>
                  Acknowledge
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* AI Summary */}
      {latestSummary && (
        <Card className="border-blue-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-blue-700">AI Weekly Summary</CardTitle>
            <p className="text-xs text-gray-400">{latestSummary.period_start} → {latestSummary.period_end}</p>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-line">{latestSummary.summary_text}</p>
          </CardContent>
        </Card>
      )}

      {/* Daily record timeline */}
      <div>
        <h2 className="font-semibold mb-3">Last 30 Days</h2>
        <div className="space-y-3">
          {Object.entries(byDate).map(([date, dayEntries]) => (
            <div key={date} className="bg-white border rounded p-3">
              <p className="text-xs font-medium text-gray-500 mb-2">{date}</p>
              <div className="flex flex-wrap gap-2">
                {(dayEntries as DailyEntry[]).map((r, i) => {
                  const subj = (r.class_subjects as any)?.subjects?.name
                  const cc = r.comment_codes
                  return (
                    <div key={i} className="flex items-center gap-1 text-xs">
                      <span className="text-gray-500">{subj}:</span>
                      {cc ? (
                        <span className="px-1.5 py-0.5 rounded text-white font-medium" style={{ backgroundColor: cc.color }}>
                          {cc.label}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                      {r.free_text && <span className="text-gray-400 italic">({r.free_text})</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {Object.keys(byDate).length === 0 && (
            <p className="text-gray-400 text-sm">No records in last 30 days</p>
          )}
        </div>
      </div>
    </div>
  )
}

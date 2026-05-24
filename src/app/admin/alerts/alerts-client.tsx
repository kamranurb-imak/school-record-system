'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface AlertRow {
  id: string
  alert_type: string
  message: string
  severity: number
  created_at: string
  students: { full_name: string; gr_no: string; classes: { name: string } | null } | null
}

const SEVERITY_VARIANT: Record<number, 'default' | 'secondary' | 'destructive'> = {
  1: 'secondary',
  2: 'default',
  3: 'destructive',
}

const SEVERITY_LABEL: Record<number, string> = { 1: 'Low', 2: 'Medium', 3: 'High' }

export function AlertsClient({ alerts: initial }: { alerts: AlertRow[] }) {
  const router = useRouter()
  const [alerts, setAlerts] = useState(initial)
  const [loading, setLoading] = useState<string | null>(null)

  async function acknowledge(id: string) {
    setLoading(id)
    try {
      const res = await fetch(`/api/alerts/${id}/acknowledge`, { method: 'POST' })
      if (!res.ok) throw new Error((await res.json()).error)
      setAlerts(prev => prev.filter(a => a.id !== id))
      toast.success('Alert acknowledged')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(null)
    }
  }

  async function acknowledgeAll() {
    setLoading('all')
    let count = 0
    for (const a of alerts) {
      const res = await fetch(`/api/alerts/${a.id}/acknowledge`, { method: 'POST' })
      if (res.ok) count++
    }
    setAlerts([])
    toast.success(`${count} alerts acknowledged`)
    setLoading(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Open Alerts</h1>
        {alerts.length > 0 && (
          <Button size="sm" variant="outline" onClick={acknowledgeAll} disabled={loading === 'all'}>
            {loading === 'all' ? 'Processing...' : `Acknowledge All (${alerts.length})`}
          </Button>
        )}
      </div>

      {alerts.length === 0 && (
        <div className="py-16 text-center text-gray-400">
          <p className="text-lg">No open alerts</p>
          <p className="text-sm mt-1">All caught up!</p>
        </div>
      )}

      <div className="space-y-2">
        {alerts.map(a => {
          const student = a.students as any
          return (
            <div key={a.id} className="bg-white border rounded-lg p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={SEVERITY_VARIANT[a.severity] ?? 'default'}>
                    {SEVERITY_LABEL[a.severity] ?? 'Alert'}
                  </Badge>
                  <span className="text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm">{a.message}</p>
                {student && (
                  <Link
                    href={`/student/${encodeURIComponent(student.gr_no)}`}
                    className="text-xs text-blue-600 hover:underline mt-0.5 block"
                  >
                    {student.full_name} · {student.gr_no} · {student.classes?.name ?? '—'}
                  </Link>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => acknowledge(a.id)}
                disabled={loading === a.id}
              >
                {loading === a.id ? '...' : 'Acknowledge'}
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

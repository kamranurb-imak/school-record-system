'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const AGENT_URL = 'http://localhost:3099'

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_SHORT: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
  Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
}

interface ScheduleData {
  registered: boolean
  days: string[]
  time: string
  lastRun: string | null
  lastResult: number | null
}

type View = 'status' | 'form' | 'confirm'

function fmt24to12(time: string) {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function useIsLocalhost() {
  const [isLocal, setIsLocal] = useState<boolean | null>(null)
  useEffect(() => { setIsLocal(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') }, [])
  return isLocal
}

export function ScheduleClient() {
  const isLocal = useIsLocalhost()
  const [agentOnline, setAgentOnline] = useState(false)
  const [schedule, setSchedule] = useState<ScheduleData | null>(null)
  const [view, setView] = useState<View>('status')
  const [selectedDays, setSelectedDays] = useState<string[]>(['Monday', 'Thursday'])
  const [time, setTime] = useState('21:00')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  useEffect(() => { if (isLocal) loadSchedule() }, [isLocal])

  if (isLocal === null) return null // hydration guard

  if (!isLocal) return (
    <div className="bg-amber-50 border border-amber-200 rounded p-5 text-sm text-amber-900 space-y-2">
      <p className="font-semibold">Local features require the local dev server</p>
      <p>Schedule management communicates with your PC&apos;s Windows Task Scheduler via the local agent. It only works when accessed via <strong>localhost</strong>.</p>
      <p>Open this page at: <a href="http://localhost:3000/admin/settings/schedule" className="underline font-medium text-blue-700">http://localhost:3000/admin/settings/schedule</a></p>
      <p className="text-xs text-amber-700">Make sure <code className="bg-amber-100 px-1 rounded">npm run dev</code> and <code className="bg-amber-100 px-1 rounded">npm run local-agent</code> are both running on your PC.</p>
    </div>
  )

  async function loadSchedule() {
    try {
      const res = await fetch(`${AGENT_URL}/schedule`, { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        const data: ScheduleData = await res.json()
        setSchedule(data)
        setAgentOnline(true)
        if (data.days?.length) setSelectedDays(data.days)
        if (data.time) setTime(data.time)
      } else {
        setAgentOnline(false)
      }
    } catch {
      setAgentOnline(false)
    }
  }

  function toggleDay(day: string) {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  function handleSaveClick() {
    if (!selectedDays.length) { toast.error('Select at least one day'); return }
    if (!time) { toast.error('Select a time'); return }
    setView('confirm')
  }

  async function confirmSave() {
    setSaving(true)
    try {
      const res = await fetch(`${AGENT_URL}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: selectedDays, time }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to register schedule')
      toast.success('Schedule registered successfully')
      await loadSchedule()
      setView('status')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  async function removeSchedule() {
    setRemoving(true)
    try {
      const res = await fetch(`${AGENT_URL}/schedule`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to remove schedule')
      toast.success('Schedule removed')
      setSchedule(prev => prev ? { ...prev, registered: false } : null)
      setConfirmRemove(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setRemoving(false)
    }
  }

  const agentOffline = (
    <div className="flex items-center gap-2 px-4 py-3 rounded border bg-red-50 border-red-200 text-red-800 text-sm">
      <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
      Local Agent Offline — run <code className="bg-red-100 px-1 rounded text-xs mx-1">npm run local-agent</code> on the school PC
    </div>
  )

  if (!agentOnline) return <div className="space-y-4">{agentOffline}</div>

  // Confirmation step
  if (view === 'confirm') {
    const dayList = selectedDays.map(d => DAY_SHORT[d]).join(', ')
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-4 py-3 rounded border bg-green-50 border-green-200 text-green-800 text-sm">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />Local Agent Running
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded p-6 space-y-4">
          <h2 className="font-semibold text-amber-900">Confirm Schedule</h2>
          <p className="text-sm text-amber-800">
            The diary processor will run automatically on <strong>{dayList}</strong> at <strong>{fmt24to12(time)}</strong>.
            Missed runs (if the PC is off) will fire on the next startup.
          </p>
          <div className="flex gap-3">
            <Button onClick={confirmSave} disabled={saving}>
              {saving ? 'Registering...' : 'Confirm & Register'}
            </Button>
            <Button variant="outline" onClick={() => setView('form')} disabled={saving}>Back</Button>
          </div>
        </div>
      </div>
    )
  }

  // Edit form
  if (view === 'form') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-4 py-3 rounded border bg-green-50 border-green-200 text-green-800 text-sm">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />Local Agent Running
        </div>
        <div className="bg-white border rounded p-6 space-y-6">
          <div>
            <h2 className="font-semibold text-gray-800 mb-1">Set Schedule</h2>
            <p className="text-sm text-gray-500">Choose which days and time the diary processor runs automatically.</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Days</p>
            <div className="flex flex-wrap gap-2">
              {ALL_DAYS.map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`px-3 py-1.5 rounded border text-sm font-medium transition-colors ${
                    selectedDays.includes(day)
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400'
                  }`}
                >
                  {DAY_SHORT[day]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Time</p>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400">Uses your PC&apos;s local time (PKT)</p>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSaveClick}>Review & Save</Button>
            <Button variant="outline" onClick={() => setView('status')}>Cancel</Button>
          </div>
        </div>
      </div>
    )
  }

  // Status view (default)
  const lastRunStr = schedule?.lastRun ? new Date(schedule.lastRun).toLocaleString() : 'Never'
  const lastResultOk = schedule?.lastResult === 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-4 py-3 rounded border bg-green-50 border-green-200 text-green-800 text-sm">
        <span className="inline-block w-2 h-2 rounded-full bg-green-500" />Local Agent Running
      </div>

      <div className="bg-white border rounded p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-800 mb-1">Current Schedule</h2>
          {schedule?.registered ? (
            <div className="space-y-2 text-sm text-gray-700">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                <span className="font-medium text-green-700">Active</span>
              </div>
              <p>
                Runs on <strong>{schedule.days.map(d => DAY_SHORT[d] ?? d).join(', ')}</strong>{' '}
                at <strong>{fmt24to12(schedule.time)}</strong>
              </p>
              <p className="text-gray-500 text-xs">
                Last run: {lastRunStr}
                {schedule.lastRun && (
                  <span className={`ml-2 ${lastResultOk ? 'text-green-600' : 'text-red-600'}`}>
                    ({lastResultOk ? 'Success' : `Error ${schedule.lastResult}`})
                  </span>
                )}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No schedule configured.</p>
          )}
        </div>

        <div className="flex gap-3">
          <Button onClick={() => setView('form')}>
            {schedule?.registered ? 'Edit Schedule' : 'Set Up Schedule'}
          </Button>
          {schedule?.registered && !confirmRemove && (
            <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setConfirmRemove(true)}>
              Remove Schedule
            </Button>
          )}
          {confirmRemove && (
            <>
              <Button variant="outline" className="text-red-600 border-red-600" onClick={removeSchedule} disabled={removing}>
                {removing ? 'Removing...' : 'Confirm Remove'}
              </Button>
              <Button variant="outline" onClick={() => setConfirmRemove(false)} disabled={removing}>Cancel</Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

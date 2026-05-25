'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface DiarySettings {
  diary_pending_dir?: string
  diary_completed_dir?: string
  diary_log_dir?: string
}

export function SettingsForm({ schoolId, settings }: { schoolId: string; settings: DiarySettings }) {
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const [pending, setPending] = useState(settings.diary_pending_dir ?? '')
  const [completed, setCompleted] = useState(settings.diary_completed_dir ?? '')
  const [log, setLog] = useState(settings.diary_log_dir ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('schools')
        .update({
          settings: {
            ...settings,
            diary_pending_dir: pending.trim(),
            diary_completed_dir: completed.trim(),
            diary_log_dir: log.trim(),
          },
        })
        .eq('id', schoolId)
      if (error) throw error
      toast.success('Settings saved')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded border p-6 space-y-6">
      <div>
        <h2 className="font-semibold text-gray-800 mb-1">Diary Auto-Processor Folders</h2>
        <p className="text-sm text-gray-500 mb-4">
          Full Windows paths used by the automated diary batch processor (Mon/Thu 9 PM schedule).
          Example: <code className="bg-gray-100 px-1 rounded text-xs">D:\Family\Kamran\albarr school diary images\Pending</code>
        </p>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Pending Folder</Label>
            <Input
              value={pending}
              onChange={e => setPending(e.target.value)}
              placeholder="D:\Family\Kamran\albarr school diary images\Pending"
            />
            <p className="text-xs text-gray-400">Place new diary images here before the scheduled run</p>
          </div>
          <div className="space-y-1">
            <Label>Completed Folder</Label>
            <Input
              value={completed}
              onChange={e => setCompleted(e.target.value)}
              placeholder="D:\Family\Kamran\albarr school diary images\Completed"
            />
            <p className="text-xs text-gray-400">Successfully processed images are moved here automatically</p>
          </div>
          <div className="space-y-1">
            <Label>Log Folder</Label>
            <Input
              value={log}
              onChange={e => setLog(e.target.value)}
              placeholder="D:\Family\Kamran\albarr school diary images\Log"
            />
            <p className="text-xs text-gray-400">Per-image log files are written here (success and failure)</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  )
}

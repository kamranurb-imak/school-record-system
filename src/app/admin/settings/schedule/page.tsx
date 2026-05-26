import { requireProfile } from '@/lib/auth'
import { ScheduleClient } from './schedule-client'

export default async function SchedulePage() {
  await requireProfile(['admin'])
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold">Processor Schedule</h1>
      <ScheduleClient />
    </div>
  )
}

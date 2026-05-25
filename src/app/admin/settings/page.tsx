import { requireProfile } from '@/lib/auth'
import { SettingsForm } from './settings-form'

export default async function SettingsPage() {
  const { supabase, profile } = await requireProfile(['admin'])

  const { data: school } = await supabase
    .from('schools')
    .select('id, settings')
    .eq('id', profile.school_id)
    .single()

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold">School Settings</h1>
      <SettingsForm
        schoolId={profile.school_id}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        settings={(school as any)?.settings ?? {}}
      />
    </div>
  )
}

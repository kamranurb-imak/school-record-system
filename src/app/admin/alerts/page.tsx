import { requireProfile } from '@/lib/auth'
import { AlertsClient } from './alerts-client'

export default async function AlertsPage() {
  const { supabase } = await requireProfile(['admin', 'class_teacher'])

  const { data: alerts } = await supabase
    .from('alerts')
    .select('*, students(full_name, gr_no, classes(name))')
    .is('acknowledged_at', null)
    .order('severity', { ascending: false })
    .order('created_at', { ascending: false })

  return <AlertsClient alerts={(alerts as any[]) ?? []} />
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const profile = data as { role: string } | null
  if (!profile) redirect('/login')

  if (profile.role === 'admin') redirect('/admin')
  if (profile.role === 'class_teacher') redirect('/class')
  if (profile.role === 'subject_teacher') redirect('/teacher')

  redirect('/login')
}

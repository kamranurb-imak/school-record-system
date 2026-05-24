import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export interface UserProfile {
  id: string
  school_id: string
  full_name: string
  role: 'admin' | 'class_teacher' | 'subject_teacher'
  phone: string | null
}

export async function requireProfile(allowedRoles?: UserProfile['role'][]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('profiles')
    .select('id, school_id, full_name, role, phone')
    .eq('id', user.id)
    .single()

  const profile = data as UserProfile | null
  if (!profile) redirect('/login')
  if (allowedRoles && !allowedRoles.includes(profile.role)) redirect('/')

  return { supabase, user, profile }
}

import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'School Record System',
  description: 'Daily student record management',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let profile: { full_name: string; role: string } | null = null

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
      profile = data as any
    }
  } catch {
    // Supabase not configured — render without nav, pages handle auth individually
  }

  return (
    <html lang="en">
      <body className={`${geist.className} bg-gray-50 min-h-screen antialiased`}>
        {profile && (
          <Nav
            role={profile.role as 'admin' | 'class_teacher' | 'subject_teacher'}
            userName={profile.full_name}
          />
        )}
        <main className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  )
}

'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface NavProps {
  role: 'admin' | 'class_teacher' | 'subject_teacher'
  userName: string
}

type NavItem = { href: string; label: string } | { section: string }

const navLinks: Record<string, NavItem[]> = {
  admin: [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/classes', label: 'Classes' },
    { href: '/admin/students', label: 'Students' },
    { href: '/admin/teachers', label: 'Teachers' },
    { href: '/admin/subjects', label: 'Subjects' },
    { href: '/admin/diary-uploads', label: 'Diary Uploads' },
    { href: '/admin/alerts', label: 'Alerts' },
    { href: '/reports', label: 'Reports' },
    { section: 'Settings' },
    { href: '/admin/settings/folders', label: 'Folder Paths' },
    { href: '/admin/settings/upload-diary', label: 'Upload Diary' },
    { href: '/admin/settings/schedule', label: 'Schedule' },
  ],
  class_teacher: [
    { href: '/class', label: 'My Class' },
    { href: '/admin/diary-uploads', label: 'Diary Uploads' },
    { href: '/admin/alerts', label: 'Alerts' },
    { href: '/reports', label: 'Reports' },
  ],
  subject_teacher: [
    { href: '/teacher', label: 'Daily Entry' },
  ],
}

export function Nav({ role, userName }: NavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const links = navLinks[role] || []

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14 gap-4">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <span className="font-semibold text-blue-700 mr-3 shrink-0 text-sm">SRS</span>
          {links.map((item, i) => {
            if ('section' in item) {
              return (
                <span key={`section-${i}`} className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 whitespace-nowrap select-none">
                  {item.section}
                </span>
              )
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap transition-colors',
                  pathname.startsWith(item.href)
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-gray-500 hidden sm:block">{userName}</span>
          <Button variant="outline" size="sm" onClick={handleLogout}>Logout</Button>
        </div>
      </div>
    </header>
  )
}

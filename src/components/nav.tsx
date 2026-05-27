'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

interface NavProps {
  role: 'admin' | 'class_teacher' | 'subject_teacher'
  userName: string
}

type NavLink = { href: string; label: string }
type NavItem = NavLink | { group: string; children: NavLink[] }

const navLinks: Record<string, NavItem[]> = {
  admin: [
    { href: '/admin', label: 'Dashboard' },
    {
      group: 'Setup',
      children: [
        { href: '/admin/classes', label: 'Classes' },
        { href: '/admin/students', label: 'Students' },
        { href: '/admin/teachers', label: 'Teachers' },
        { href: '/admin/subjects', label: 'Subjects' },
      ],
    },
    {
      group: 'Diary',
      children: [
        { href: '/admin/diary-uploads', label: 'Diary Uploads' },
        { href: '/admin/alerts', label: 'Alerts' },
      ],
    },
    { href: '/reports', label: 'Reports' },
    {
      group: 'Settings',
      children: [
        { href: '/admin/settings/folders', label: 'Folder Paths' },
      ],
    },
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

function isActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin'
  return pathname.startsWith(href)
}

interface DropdownGroupProps {
  group: string
  children: NavLink[]
  pathname: string
}

function DropdownGroup({ group, children, pathname }: DropdownGroupProps) {
  const active = children.some(c => isActive(pathname, c.href))

  return (
    <div className="relative group">
      {/* Trigger */}
      <button
        className={cn(
          'flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap transition-colors cursor-pointer',
          active
            ? 'bg-blue-50 text-blue-700'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        )}
      >
        {group}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {/* Bridge: invisible gap filler so moving mouse into dropdown doesn't close it */}
      <div className="absolute left-0 top-full h-2 w-full" />

      {/* Dropdown panel */}
      <div className="absolute hidden group-hover:block top-full left-0 mt-1 bg-white border border-gray-200 shadow-lg rounded-md py-1 z-50 min-w-[160px]">
        {children.map(child => (
          <Link
            key={child.href}
            href={child.href}
            className={cn(
              'block px-4 py-2 text-sm transition-colors',
              isActive(pathname, child.href)
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            {child.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

export function Nav({ role, userName }: NavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const items = navLinks[role] || []

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14 gap-4">
        <div className="flex items-center gap-1">
          <span className="font-semibold text-blue-700 mr-3 shrink-0 text-sm">SRS</span>
          {items.map((item, i) => {
            if ('group' in item) {
              return (
                <DropdownGroup
                  key={`group-${i}`}
                  group={item.group}
                  children={item.children}
                  pathname={pathname}
                />
              )
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap transition-colors',
                  isActive(pathname, item.href)
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

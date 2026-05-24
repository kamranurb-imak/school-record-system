import { requireProfile } from '@/lib/auth'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function AdminDashboard() {
  const { supabase, profile } = await requireProfile(['admin'])

  const [studentsRes, classesRes, subjectsRes, alertsRes] = await Promise.all([
    supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id).eq('is_active', true),
    supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id),
    supabase.from('subjects').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id),
    supabase.from('alerts').select('id', { count: 'exact', head: true }).is('acknowledged_at', null),
  ])

  const stats = [
    { label: 'Active Students', value: studentsRes.count ?? 0, href: '/admin/students' },
    { label: 'Classes', value: classesRes.count ?? 0, href: '/admin/classes' },
    { label: 'Subjects', value: subjectsRes.count ?? 0, href: '/admin/subjects' },
    { label: 'Open Alerts', value: alertsRes.count ?? 0, href: '/admin/alerts' },
  ]

  const quickLinks = [
    { href: '/admin/students', label: 'Manage Students', desc: 'Add, edit, import via CSV' },
    { href: '/admin/classes', label: 'Manage Classes', desc: 'Classes & subject assignments' },
    { href: '/admin/teachers', label: 'Manage Teachers', desc: 'Teacher accounts & roles' },
    { href: '/admin/diary-uploads', label: 'Diary Photo Uploads', desc: 'Upload & review paper records' },
    { href: '/admin/comment-codes', label: 'Comment Codes', desc: 'Customize grade/comment labels' },
    { href: '/reports', label: 'Reports', desc: 'Export student data' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map(s => (
          <Link key={s.href} href={s.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-3xl font-bold text-blue-700">{s.value}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm text-gray-600">{s.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {quickLinks.map(l => (
          <Link key={l.href} href={l.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader className="pb-1">
                <CardTitle className="text-base">{l.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">{l.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

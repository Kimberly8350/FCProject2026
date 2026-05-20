import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const ADMIN_EMAIL = 'kimberly@qwtransport.com'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== ADMIN_EMAIL) redirect('/loads')

  return (
    <div>
      <div className="flex items-center gap-1 mb-6 border-b border-gray-200 pb-4">
        <h1 className="text-lg font-bold text-gray-900 mr-4">Admin</h1>
        <Link
          href="/admin/yards"
          className="px-3 py-1.5 rounded text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          Yards
        </Link>
        <Link
          href="/admin/drivers"
          className="px-3 py-1.5 rounded text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          Drivers
        </Link>
      </div>
      {children}
    </div>
  )
}

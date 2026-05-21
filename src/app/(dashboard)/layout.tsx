import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import NavBar from '@/components/ui/NavBar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch unread dispatch notification count for the bell icon
  let unreadCount = 0
  try {
    const sb = await createServiceClient()
    const { count } = await sb
      .from('dispatch_notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null)
    unreadCount = count ?? 0
  } catch {
    // Non-fatal — bell just shows no badge
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar userEmail={user.email ?? ''} unreadCount={unreadCount} />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl">
        {children}
      </main>
    </div>
  )
}

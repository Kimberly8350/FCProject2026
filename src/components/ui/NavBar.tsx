'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS = [
  { href: '/loads',          label: 'Loads Board' },
  { href: '/paperwork',      label: 'Paperwork' },
  { href: '/history',        label: 'History' },
  { href: '/email-settings', label: 'Email Settings' },
]

const ADMIN_EMAIL = 'kimberly@qwtransport.com'

export default function NavBar({
  userEmail,
  unreadCount,
}: {
  userEmail: string
  unreadCount: number
}) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="bg-gray-900 text-white shadow-md">
      <div className="container mx-auto px-4 max-w-7xl flex items-center justify-between h-14">
        <div className="flex items-center gap-1">
          <span className="font-bold text-red-500 mr-4 text-sm tracking-wide uppercase">
            Fuel City
          </span>
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                pathname.startsWith(item.href)
                  ? 'bg-red-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800'
              }`}
            >
              {item.label}
            </Link>
          ))}
          {userEmail === ADMIN_EMAIL && (
            <Link
              href="/admin"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                pathname.startsWith('/admin')
                  ? 'bg-red-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800'
              }`}
            >
              Admin
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Notification bell */}
          <Link
            href="/notifications"
            className="relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-800 transition-colors"
            title="Dispatch notifications"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>

          <span className="text-xs text-gray-400 hidden sm:block">{userEmail}</span>
          <button
            onClick={handleSignOut}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  )
}

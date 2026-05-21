import { createServiceClient } from '@/lib/supabase/server'
import { markNotificationsRead } from '@/app/actions/loads'

export default async function NotificationsPage() {
  const sb = await createServiceClient()

  const { data: notifications } = await sb
    .from('dispatch_notifications')
    .select('*')
    .order('created_at', { ascending: false })

  // Mark all as read now that the page is viewed
  await markNotificationsRead()

  const fmt = (ts: string) =>
    new Date(ts).toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    })

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Dispatch Notifications</h1>

      {(!notifications || notifications.length === 0) ? (
        <div className="text-center py-20 text-gray-500">
          No notifications yet. When dispatch emails notify@fuelcityportal.com, messages will appear here.
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map(n => (
            <div
              key={n.id}
              className={`bg-white rounded-xl border p-4 shadow-sm ${
                !n.read_at ? 'border-red-300 bg-red-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {!n.read_at && (
                    <span className="inline-block w-2 h-2 rounded-full bg-red-500 shrink-0 mt-0.5" />
                  )}
                  <span className="font-semibold text-gray-900 text-sm">{n.subject}</span>
                  {n.ce_id && (
                    <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      CE #{n.ce_id}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                  {fmt(n.created_at)}
                </span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{n.message}</p>
              <p className="text-xs text-gray-400 mt-2">From: {n.from_address}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

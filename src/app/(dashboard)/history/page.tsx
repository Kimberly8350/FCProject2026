import { createClient } from '@/lib/supabase/server'

const CHANGE_LABELS: Record<string, string> = {
  terminal_change:       'Terminal Change',
  supplier_change:       'Supplier Change',
  load_before_5pm:       'Load Before 5 PM',
  load_after_5pm:        'Load After 5 PM',
  load_after_midnight:   'Load After Midnight',
  delay:                 'Delay Request',
  move_up:               'Move Up Request',
  cancel:                'Cancel Request',
  needs_review:          'Needs Review',
  general_notification:  'Dispatch Note',
}

const CHANGE_COLORS: Record<string, string> = {
  terminal_change:       'bg-blue-50 text-blue-700',
  supplier_change:       'bg-indigo-50 text-indigo-700',
  cancel:                'bg-red-50 text-red-700',
  needs_review:          'bg-orange-50 text-orange-700',
  delay:                 'bg-yellow-50 text-yellow-700',
  move_up:               'bg-green-50 text-green-700',
  general_notification:  'bg-gray-100 text-gray-700',
}

export default async function HistoryPage() {
  const supabase = await createClient()

  // 14-day window
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: changes }, { data: generalNotes }] = await Promise.all([
    supabase
      .from('load_changes')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false }),
    supabase
      .from('general_notifications')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false }),
  ])

  const allItems = [
    ...(changes ?? []).map(c => ({ ...c, _type: 'load' as const })),
    ...(generalNotes ?? []).map(n => ({
      id: n.id,
      ce_id: null,
      change_type: 'general_notification',
      description: 'General Notification',
      notes: n.message,
      dispatch_response: n.dispatch_response,
      response_received_at: n.response_received_at,
      created_at: n.created_at,
      _type: 'general' as const,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">History</h1>
          <p className="text-xs text-gray-500 mt-0.5">Rolling 14-day log — read only</p>
        </div>
      </div>

      {allItems.length === 0 ? (
        <div className="text-center py-20 text-gray-500">No activity in the past 14 days.</div>
      ) : (
        <div className="space-y-3">
          {allItems.map(item => (
            <div key={item.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap mt-0.5 ${CHANGE_COLORS[item.change_type] ?? 'bg-gray-100 text-gray-700'}`}>
                    {CHANGE_LABELS[item.change_type] ?? item.change_type}
                  </span>
                  <div className="min-w-0">
                    {item.ce_id && (
                      <p className="text-xs font-mono text-gray-500">CE #{item.ce_id}</p>
                    )}
                    {item.notes && (
                      <p className="text-sm text-gray-800 mt-0.5">{item.notes}</p>
                    )}
                    {item.dispatch_response && (
                      <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg p-2">
                        <p className="text-xs text-blue-600 font-medium mb-0.5">Dispatch response:</p>
                        <p className="text-sm text-blue-900">{item.dispatch_response}</p>
                        {item.response_received_at && (
                          <p className="text-xs text-blue-400 mt-1">{formatTime(item.response_received_at)}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                  {formatTime(item.created_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState, useTransition } from 'react'
import { getLoadHistory } from '@/app/actions/queries'

type Change = {
  id: string
  change_type: string
  description: string | null
  old_value: string | null
  new_value: string | null
  notes: string | null
  dispatch_response: string | null
  response_received_at: string | null
  created_at: string
}

type PaperworkItem = {
  id: string
  file_name: string
  storage_path: string
  uploaded_at: string
  signedUrl: string | null
}

const TYPE_LABELS: Record<string, string> = {
  terminal_change:    'Terminal Change',
  supplier_change:    'Supplier Change',
  settings_update:    'Settings Updated',
  load_before_5pm:    'Load before 5 PM',
  load_after_5pm:     'Load after 5 PM',
  load_after_midnight:'Load after midnight',
  delay:              'Delay',
  move_up:            'Move Up',
  cancel:             'Cancel',
  needs_review:       'Needs Review',
  general_notification: 'Dispatch Note',
}

const fmt = (ts: string) =>
  new Date(ts).toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })

export default function LoadHistoryModal({
  ceId,
  onClose,
}: {
  ceId: number
  onClose: () => void
}) {
  const [changes, setChanges] = useState<Change[]>([])
  const [paperwork, setPaperwork] = useState<PaperworkItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getLoadHistory(ceId).then(({ changes, paperwork }) => {
      setChanges(changes as Change[])
      setPaperwork(paperwork as PaperworkItem[])
      setLoading(false)
    })
  }, [ceId])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Load History</h2>
            <p className="text-xs text-gray-500 font-mono mt-0.5">CE #{ceId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {loading ? (
            <div className="text-center py-10 text-gray-400 text-sm">Loading…</div>
          ) : (
            <>
              {/* BOL Paperwork */}
              {paperwork.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    BOL Paperwork
                  </h3>
                  <div className="space-y-1">
                    {paperwork.map(p => (
                      <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-xs text-gray-700">{p.file_name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">{fmt(p.uploaded_at)}</span>
                          {p.signedUrl ? (
                            <a
                              href={p.signedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-red-600 hover:text-red-700 font-medium"
                            >
                              View PDF
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400">Unavailable</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Change Log */}
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Change Log
                </h3>
                {changes.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No changes recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {changes.map(c => (
                      <div key={c.id} className="border border-gray-100 rounded-lg p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-gray-800">
                            {TYPE_LABELS[c.change_type] ?? c.change_type}
                          </span>
                          <span className="text-gray-400 shrink-0">{fmt(c.created_at)}</span>
                        </div>

                        {c.description && (
                          <p className="text-gray-600">{c.description}</p>
                        )}
                        {c.notes && (
                          <p className="text-gray-500 italic">Notes: {c.notes}</p>
                        )}
                        {c.old_value && (
                          <p className="text-gray-500">
                            <span className="font-medium">Previous:</span> {c.old_value}
                          </p>
                        )}
                        {c.new_value && (
                          <p className="text-gray-700">
                            <span className="font-medium">Updated to:</span> {c.new_value}
                          </p>
                        )}

                        {/* Dispatch response */}
                        {c.dispatch_response && (
                          <div className="mt-2 bg-blue-50 border border-blue-100 rounded p-2">
                            <p className="text-blue-700 font-medium mb-0.5">
                              Dispatch replied {c.response_received_at ? `· ${fmt(c.response_received_at)}` : ''}
                            </p>
                            <p className="text-blue-800 whitespace-pre-wrap">{c.dispatch_response}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

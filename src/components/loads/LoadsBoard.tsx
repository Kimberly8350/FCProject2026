'use client'

import { useState, useTransition } from 'react'
import { Load, Terminal, Supplier, Driver, ETAResult, LOAD_STATUS_LABELS, LOCKED_STATUSES } from '@/types'
import { sendGeneralNotification } from '@/app/actions/loads'
import LoadCard from './LoadCard'
import MassUpdatePanel from './MassUpdatePanel'

interface Props {
  bySite: Record<string, Load[]>
  allLoads: Load[]
  terminals: Pick<Terminal, 'terminal_id' | 'terminal_name' | 'is_fuel_city' | 'is_custom'>[]
  suppliers: Pick<Supplier, 'supplier_id' | 'supplier_name' | 'supplier_loading_number'>[]
  settingsMap: Record<number, any>
  sites: { site_id: number; site_name: string; latitude: number | null; longitude: number | null }[]
  etaMap: Record<number, ETAResult>
  drivers: Driver[]
  isAdmin: boolean
}

const STATUS_SORT: Record<number, number> = {
  12: 0, 20: 1, 22: 2, 24: 3, 10: 4, 2: 5, 1: 6, 26: 7,
}

export default function LoadsBoard({
  bySite, allLoads, terminals, suppliers, settingsMap, sites, etaMap, drivers, isAdmin,
}: Props) {
  const [selectMode, setSelectMode]           = useState(false)
  const [selectedCeIds, setSelectedCeIds]     = useState<number[]>([])
  const [showGeneralNotif, setShowGeneralNotif] = useState(false)
  const [generalMessage, setGeneralMessage]   = useState('')
  const [notifPending, startNotifTransition]  = useTransition()
  const [notifFeedback, setNotifFeedback]     = useState<string | null>(null)

  function toggleSelect(ceId: number) {
    setSelectedCeIds(prev =>
      prev.includes(ceId) ? prev.filter(id => id !== ceId) : [...prev, ceId]
    )
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedCeIds([])
  }

  async function handleGeneralNotif() {
    if (!generalMessage.trim()) return
    startNotifTransition(async () => {
      await sendGeneralNotification({ message: generalMessage })
      setGeneralMessage('')
      setShowGeneralNotif(false)
      setNotifFeedback('Notification sent to dispatch.')
      setTimeout(() => setNotifFeedback(null), 4000)
    })
  }

  const siteKeys = Object.keys(bySite).sort((a, b) => {
    const siteA = a.split(':')[1]
    const siteB = b.split(':')[1]
    return siteA.localeCompare(siteB)
  })

  return (
    <div className={selectedCeIds.length > 0 ? 'pb-40' : ''}>
      {/* Top action bar */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {/* General Notification */}
        <button
          onClick={() => setShowGeneralNotif(!showGeneralNotif)}
          className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          Notify Dispatch
        </button>

        {/* Select mode toggle */}
        {!selectMode ? (
          <button
            onClick={() => setSelectMode(true)}
            className="flex items-center gap-1.5 text-xs border border-gray-300 hover:border-gray-400 text-gray-700 px-3 py-1.5 rounded-lg font-medium transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Select Multiple
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 font-medium">
              {selectedCeIds.length} selected
            </span>
            <button
              onClick={exitSelectMode}
              className="text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded-lg font-medium"
            >
              Cancel
            </button>
          </div>
        )}

        {notifFeedback && (
          <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
            {notifFeedback}
          </span>
        )}
      </div>

      {/* General Notification panel */}
      {showGeneralNotif && (
        <div className="mb-5 bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-blue-800">General Notification to Dispatch</p>
          <p className="text-xs text-blue-600">Not tied to a specific load — e.g. "Tank test at these locations tomorrow."</p>
          <textarea
            rows={3}
            value={generalMessage}
            onChange={e => setGeneralMessage(e.target.value)}
            placeholder="Type your message to dispatch…"
            className="w-full border border-blue-300 rounded px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none bg-white"
          />
          <div className="flex gap-2">
            <button
              onClick={handleGeneralNotif}
              disabled={notifPending || !generalMessage.trim()}
              className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg font-medium"
            >
              {notifPending ? 'Sending…' : 'Send to Dispatch'}
            </button>
            <button
              onClick={() => { setShowGeneralNotif(false); setGeneralMessage('') }}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Load cards by site */}
      <div className="space-y-8">
        {siteKeys.map(siteKey => {
          const [siteIdStr, siteName] = siteKey.split(':')
          const siteId = parseInt(siteIdStr)
          const siteCoords = sites.find(s => s.site_id === siteId)

          const loadsByCeId: Record<number, Load[]> = {}
          for (const load of bySite[siteKey]) {
            if (!loadsByCeId[load.ce_id]) loadsByCeId[load.ce_id] = []
            loadsByCeId[load.ce_id].push(load)
          }

          const ceIds = Object.keys(loadsByCeId)
            .map(Number)
            .sort((a, b) => {
              const statusA = loadsByCeId[a][0].load_status
              const statusB = loadsByCeId[b][0].load_status
              return (STATUS_SORT[statusA] ?? 9) - (STATUS_SORT[statusB] ?? 9)
            })

          return (
            <section key={siteKey}>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-base font-bold text-gray-800">{siteName}</h2>
                <span className="text-xs text-gray-500 bg-gray-200 rounded-full px-2 py-0.5">
                  {ceIds.length} load{ceIds.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {ceIds.map(ceId => (
                  <LoadCard
                    key={ceId}
                    loads={loadsByCeId[ceId]}
                    allDriverLoads={allLoads.filter(l =>
                      l.first_name === loadsByCeId[ceId][0].first_name &&
                      l.last_name === loadsByCeId[ceId][0].last_name
                    )}
                    terminals={terminals}
                    suppliers={suppliers}
                    settings={settingsMap[ceId] ?? null}
                    eta={etaMap[ceId] ?? null}
                    drivers={drivers}
                    isAdmin={isAdmin}
                    siteCoords={
                      siteCoords?.latitude && siteCoords?.longitude
                        ? { lat: siteCoords.latitude, lng: siteCoords.longitude }
                        : null
                    }
                    inSelectMode={selectMode}
                    isSelected={selectedCeIds.includes(ceId)}
                    onToggleSelect={toggleSelect}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {/* Mass update panel — slides up when loads are selected */}
      {selectMode && selectedCeIds.length > 0 && (
        <MassUpdatePanel
          selectedCeIds={selectedCeIds}
          terminals={terminals}
          suppliers={suppliers}
          onClose={exitSelectMode}
          onSuccess={exitSelectMode}
        />
      )}
    </div>
  )
}

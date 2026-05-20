'use client'

import { Load, Terminal, Supplier, ETAResult, LOAD_STATUS_LABELS, LOCKED_STATUSES } from '@/types'
import LoadCard from './LoadCard'

interface Props {
  bySite: Record<string, Load[]>
  allLoads: Load[]
  terminals: Pick<Terminal, 'terminal_id' | 'terminal_name' | 'is_fuel_city' | 'is_custom'>[]
  suppliers: Pick<Supplier, 'supplier_id' | 'supplier_name' | 'supplier_loading_number'>[]
  settingsMap: Record<number, any>
  sites: { site_id: number; site_name: string; latitude: number | null; longitude: number | null }[]
  etaMap: Record<number, ETAResult>
}

// Sort loads: active statuses first (12, 20, 22, 24), then confirmed (10), then others
const STATUS_SORT: Record<number, number> = {
  12: 0, 20: 1, 22: 2, 24: 3, 10: 4, 2: 5, 1: 6, 26: 7,
}

export default function LoadsBoard({
  bySite, allLoads, terminals, suppliers, settingsMap, sites, etaMap,
}: Props) {
  const siteKeys = Object.keys(bySite).sort((a, b) => {
    const siteA = a.split(':')[1]
    const siteB = b.split(':')[1]
    return siteA.localeCompare(siteB)
  })

  return (
    <div className="space-y-8">
      {siteKeys.map(siteKey => {
        const [siteIdStr, siteName] = siteKey.split(':')
        const siteId = parseInt(siteIdStr)
        const siteCoords = sites.find(s => s.site_id === siteId)

        // Group by CE_ID (one logical load = one CE_ID, may have multiple product rows)
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
                  siteCoords={
                    siteCoords?.latitude && siteCoords?.longitude
                      ? { lat: siteCoords.latitude, lng: siteCoords.longitude }
                      : null
                  }
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { FUEL_CITY_SITE_IDS, LOCKED_STATUSES, ETAResult } from '@/types'
import { calculateETA } from '@/lib/eta'
import LoadsBoard from '@/components/loads/LoadsBoard'
import DatePicker from '@/components/loads/DatePicker'

interface PageProps {
  searchParams: Promise<{ date?: string }>
}

function todayCT(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

export default async function LoadsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const selectedDate = params.date ?? todayCT()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAdmin = user?.email === 'kimberly@qwtransport.com'

  // Parallel data fetches
  const [
    { data: allLoads },
    { data: terminals },
    { data: suppliers },
    { data: sites },
    { data: drivers },
  ] = await Promise.all([
    supabase
      .from('loads')
      .select('*')
      .eq('delivery_date', selectedDate)
      .order('load_status', { ascending: true }),
    supabase
      .from('terminals')
      .select('terminal_id, terminal_name, is_fuel_city, is_custom, latitude, longitude')
      .order('terminal_name'),
    supabase
      .from('suppliers')
      .select('supplier_id, supplier_name, supplier_loading_number')
      .order('supplier_name'),
    supabase
      .from('sites')
      .select('site_id, site_name, latitude, longitude'),
    supabase
      .from('drivers')
      .select('*, yard:yards(*)')
      .eq('active', true),
  ])

  // Fuel City loads only
  const fcLoads = (allLoads ?? []).filter(l => FUEL_CITY_SITE_IDS.includes(l.site_id))

  // Load settings
  const ceIds = [...new Set(fcLoads.map(l => l.ce_id))]
  const { data: settings } = ceIds.length
    ? await supabase.from('load_settings').select('*').in('ce_id', ceIds)
    : { data: [] }

  const settingsMap = Object.fromEntries((settings ?? []).map(s => [s.ce_id, s]))

  // Group FC loads by CE_ID for ETA computation
  const byCeId: Record<number, typeof fcLoads> = {}
  for (const load of fcLoads) {
    if (!byCeId[load.ce_id]) byCeId[load.ce_id] = []
    byCeId[load.ce_id].push(load)
  }

  // Compute ETAs in parallel for all FC load groups
  const etaEntries = await Promise.all(
    Object.entries(byCeId).map(async ([ceIdStr, ceLoads]) => {
      const ceId = parseInt(ceIdStr)
      const primary = ceLoads[0]

      // Locked / delivered: return dispatch values without a Maps API call
      if (LOCKED_STATUSES.includes(primary.load_status)) {
        const eta: ETAResult = {
          terminal_eta: primary.arrived_at_rack_time
            ? new Date(primary.arrived_at_rack_time).toLocaleString('en-US', {
                timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', hour12: true,
              })
            : null,
          site_eta: primary.delivery_eta
            ? new Date(primary.delivery_eta).toLocaleString('en-US', {
                timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', hour12: true,
              })
            : null,
          basis: 'dispatch',
        }
        return [ceId, eta] as const
      }

      // Terminal coords (use saved setting terminal, fall back to feed terminal)
      const termId = settingsMap[ceId]?.terminal_id ?? primary.terminal_id
      const term = (terminals ?? []).find(t => t.terminal_id === termId)
      const terminalCoords = term?.latitude && term?.longitude
        ? { lat: Number(term.latitude), lng: Number(term.longitude) }
        : null

      // FC site coords
      const site = (sites ?? []).find(s => s.site_id === primary.site_id)
      const siteCoords = site?.latitude && site?.longitude
        ? { lat: Number(site.latitude), lng: Number(site.longitude) }
        : null

      // Match driver: by name from feed first, then fall back to manual assignment in settings
      let driver = (drivers ?? []).find(d =>
        primary.first_name && primary.last_name &&
        d.first_name?.toLowerCase() === primary.first_name?.toLowerCase() &&
        d.last_name?.toLowerCase() === primary.last_name?.toLowerCase()
      )
      if (!driver && settingsMap[ceId]?.driver_id) {
        driver = (drivers ?? []).find(d => d.driver_id === settingsMap[ceId].driver_id)
      }
      const yard = driver?.yard
      const driverInfo = driver && yard?.latitude && yard?.longitude
        ? {
            startTime:    driver.default_start_time,
            yardCoords:   { lat: Number(yard.latitude), lng: Number(yard.longitude) },
            deliveryDate: selectedDate,
          }
        : null

      const eta = await calculateETA(primary, allLoads ?? [], terminalCoords, siteCoords, driverInfo)
      return [ceId, eta] as const
    })
  )

  const etaMap = Object.fromEntries(etaEntries) as Record<number, ETAResult>

  // Group FC loads by site for the board
  const bySite: Record<string, typeof fcLoads> = {}
  for (const load of fcLoads) {
    const key = `${load.site_id}:${load.site_name}`
    if (!bySite[key]) bySite[key] = []
    bySite[key].push(load)
  }

  const syncedAt = allLoads?.[0]?.synced_at ?? null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Loads Board</h1>
          {syncedAt && (
            <p className="text-xs text-gray-500 mt-0.5">
              Last synced: {new Date(syncedAt).toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT
            </p>
          )}
        </div>
        <DatePicker selectedDate={selectedDate} />
      </div>

      {fcLoads.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          No Fuel City loads found for {selectedDate}.
        </div>
      ) : (
        <LoadsBoard
          bySite={bySite}
          allLoads={allLoads ?? []}
          terminals={terminals ?? []}
          suppliers={suppliers ?? []}
          settingsMap={settingsMap}
          sites={sites ?? []}
          etaMap={etaMap}
          drivers={drivers ?? []}
          isAdmin={isAdmin}
        />
      )}
    </div>
  )
}

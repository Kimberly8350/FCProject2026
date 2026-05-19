import { createClient } from '@/lib/supabase/server'
import { FUEL_CITY_SITE_IDS, LOAD_STATUS_LABELS } from '@/types'
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

  // All loads for the selected date (all customers — needed for ETA driver context)
  const { data: allLoads } = await supabase
    .from('loads')
    .select('*')
    .eq('delivery_date', selectedDate)
    .order('load_status', { ascending: true })

  // Fuel City loads only (filtered by site_id)
  const fcLoads = (allLoads ?? []).filter(l =>
    FUEL_CITY_SITE_IDS.includes(l.site_id)
  )

  // Fuel City terminals for dropdown
  const { data: terminals } = await supabase
    .from('terminals')
    .select('terminal_id, terminal_name, is_fuel_city, is_custom')
    .order('terminal_name')

  // All suppliers
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('supplier_id, supplier_name, supplier_loading_number')
    .order('supplier_name')

  // Load settings (user's saved terminal/supplier selections)
  const ceIds = [...new Set(fcLoads.map(l => l.ce_id))]
  const { data: settings } = ceIds.length
    ? await supabase
        .from('load_settings')
        .select('*')
        .in('ce_id', ceIds)
    : { data: [] }

  // Fuel City sites (for coords)
  const { data: sites } = await supabase
    .from('sites')
    .select('site_id, site_name, latitude, longitude')

  // Group FC loads by site
  const bySite: Record<string, typeof fcLoads> = {}
  for (const load of fcLoads) {
    const key = `${load.site_id}:${load.site_name}`
    if (!bySite[key]) bySite[key] = []
    bySite[key].push(load)
  }

  const settingsMap = Object.fromEntries((settings ?? []).map(s => [s.ce_id, s]))
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
        />
      )}
    </div>
  )
}

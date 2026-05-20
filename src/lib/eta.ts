/**
 * ETA calculation for Fuel City loads.
 *
 * Priority:
 * 1. If load is en route / at site / delivered → show dispatch-provided times (no Maps call)
 * 2. If driver is at a prior site (status 24) → calculate from there
 * 3. If driver is at the terminal loading (status 20) → calculate from there
 * 4. If driver info (start time + yard) is available → project forward from shift start,
 *    accounting for estimated prior stops before the FC load
 * 5. Fall back to dispatch-provided delivery_eta
 */

import { Load, ETAResult, LOCKED_STATUSES } from '@/types'

const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY!
const DROP_TIME_MIN  = 45   // time to unload at a site
const LOAD_TIME_MIN  = 45   // time to load at a terminal
const STOP_EST_MIN   = 180  // rough estimate per prior stop when route is unknown (3 hours)

interface LatLng {
  lat: number
  lng: number
}

export interface DriverInfo {
  startTime: string    // "06:00:00" or "06:00"
  yardCoords: LatLng
  deliveryDate: string // "2026-05-20"
}

async function getDrivingMinutes(origin: LatLng, destination: LatLng): Promise<number | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json')
  url.searchParams.set('origins',      `${origin.lat},${origin.lng}`)
  url.searchParams.set('destinations', `${destination.lat},${destination.lng}`)
  url.searchParams.set('mode',   'driving')
  url.searchParams.set('units',  'imperial')
  url.searchParams.set('key',    GOOGLE_MAPS_KEY)

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 900 } })
    const data = await res.json()
    const element = data?.rows?.[0]?.elements?.[0]
    if (element?.status === 'OK') {
      return Math.ceil(element.duration.value / 60)
    }
  } catch {
    // fall through
  }
  return null
}

function addMinutes(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60_000)
}

function formatCT(d: Date): string {
  return d.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/** Convert a date string + time string (CT) to a UTC Date object */
function ctToDate(dateStr: string, timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number)
  // Determine DST offset: CDT (UTC-5) Mar–Nov, CST (UTC-6) Nov–Mar
  const month = parseInt(dateStr.split('-')[1]) - 1  // 0-indexed
  const offset = (month >= 2 && month <= 10) ? '-05:00' : '-06:00'
  const hh = String(h).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  return new Date(`${dateStr}T${hh}:${mm}:00${offset}`)
}

async function fetchSiteCoords(siteId: number): Promise<LatLng | null> {
  try {
    const { createServiceClient } = await import('@/lib/supabase/server')
    const sb = await createServiceClient()
    const { data } = await sb
      .from('all_sites')
      .select('latitude, longitude')
      .eq('site_id', siteId)
      .single()
    if (data?.latitude && data?.longitude) {
      return { lat: Number(data.latitude), lng: Number(data.longitude) }
    }
  } catch {
    // ignore
  }
  return null
}

export async function calculateETA(
  fcLoad: Load,
  allDriverLoads: Load[],
  terminalCoords: LatLng | null,
  siteCoords: LatLng | null,
  driverInfo?: DriverInfo | null,
): Promise<ETAResult> {
  const dispatchSiteEta = fcLoad.delivery_eta ? new Date(fcLoad.delivery_eta) : null

  // ── Already in transit / delivered: show dispatch times, no Maps call ───────
  if (LOCKED_STATUSES.includes(fcLoad.load_status) || fcLoad.load_status === 22) {
    return {
      terminal_eta: fcLoad.arrived_at_rack_time
        ? formatCT(new Date(fcLoad.arrived_at_rack_time))
        : null,
      site_eta: dispatchSiteEta ? formatCT(dispatchSiteEta) : null,
      basis: dispatchSiteEta ? 'dispatch' : 'unavailable',
    }
  }

  const now = new Date()
  const priorLoads = allDriverLoads.filter(l => l.ce_id !== fcLoad.ce_id)

  // ── Driver is currently at a prior site ─────────────────────────────────────
  const atSiteLoad = priorLoads.find(l => l.load_status === 24)
  if (atSiteLoad && terminalCoords) {
    const originCoords = atSiteLoad.site_id ? await fetchSiteCoords(atSiteLoad.site_id) : null
    const driveMin = originCoords
      ? await getDrivingMinutes(originCoords, terminalCoords) ?? 60
      : 60
    const terminalEta = addMinutes(now, DROP_TIME_MIN + driveMin)
    const siteEta = siteCoords
      ? addMinutes(terminalEta, LOAD_TIME_MIN + (await getDrivingMinutes(terminalCoords, siteCoords) ?? 60))
      : null
    return {
      terminal_eta: formatCT(terminalEta),
      site_eta: siteEta ? formatCT(siteEta) : (dispatchSiteEta ? formatCT(dispatchSiteEta) : null),
      basis: 'calculated',
    }
  }

  // ── Driver is loading at the terminal ───────────────────────────────────────
  const atTerminalLoad = priorLoads.find(l => l.load_status === 20)
  if (atTerminalLoad && terminalCoords && siteCoords) {
    const driveMin = await getDrivingMinutes(terminalCoords, siteCoords) ?? 60
    const siteEta = addMinutes(now, LOAD_TIME_MIN + driveMin)
    return {
      terminal_eta: formatCT(now),
      site_eta: formatCT(siteEta),
      basis: 'calculated',
    }
  }

  // ── Project forward from driver's shift start ────────────────────────────────
  if (driverInfo && terminalCoords) {
    const shiftStart = ctToDate(driverInfo.deliveryDate, driverInfo.startTime)

    // Count prior (non-FC) loads to estimate how long before driver reaches FC stop
    const priorCount = priorLoads.length

    // Base = shift start + rough time through prior stops
    // Use STOP_EST_MIN (3 hrs) per prior stop as a conservative estimate
    const priorOffsetMs = priorCount * STOP_EST_MIN * 60_000
    const estimatedBase = new Date(shiftStart.getTime() + priorOffsetMs)

    // Use whichever is later: the estimated time through prior stops, or now
    const base = estimatedBase > now ? estimatedBase : now

    // Drive from yard to FC terminal
    const driveToTerminalMin = await getDrivingMinutes(driverInfo.yardCoords, terminalCoords) ?? 60
    const terminalEta = addMinutes(base, driveToTerminalMin)

    let siteEta: Date | null = null
    if (siteCoords) {
      const driveToSiteMin = await getDrivingMinutes(terminalCoords, siteCoords) ?? 60
      siteEta = addMinutes(terminalEta, LOAD_TIME_MIN + driveToSiteMin)
    }

    return {
      terminal_eta: formatCT(terminalEta),
      site_eta: siteEta ? formatCT(siteEta) : (dispatchSiteEta ? formatCT(dispatchSiteEta) : null),
      basis: 'calculated',
    }
  }

  // ── Fallback: dispatch-provided ETA only ─────────────────────────────────────
  if (dispatchSiteEta) {
    return {
      terminal_eta: null,
      site_eta: formatCT(dispatchSiteEta),
      basis: 'dispatch',
    }
  }

  return { terminal_eta: null, site_eta: null, basis: 'unavailable' }
}

/**
 * ETA calculation for Fuel City loads.
 *
 * Logic:
 * 1. Find all loads for the same driver on the same delivery date.
 * 2. Identify prior loads (not yet the FC load in the sequence).
 * 3. If any prior load is At Site (status 24):
 *    - Add 45 min drop time
 *    - Add drive time from that site to the FC terminal (via Google Distance Matrix)
 *    - That gives us Terminal ETA
 * 4. Terminal ETA + 45 min load time + drive from terminal to FC site = Site ETA
 * 5. If dispatch has already set a delivery_eta, prefer that for Site ETA.
 */

import { Load, ETAResult, LOCKED_STATUSES } from '@/types'

const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY!
const DROP_TIME_MIN = 45
const LOAD_TIME_MIN = 45

interface LatLng {
  lat: number
  lng: number
}

async function getDrivingMinutes(origin: LatLng, destination: LatLng): Promise<number | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json')
  url.searchParams.set('origins', `${origin.lat},${origin.lng}`)
  url.searchParams.set('destinations', `${destination.lat},${destination.lng}`)
  url.searchParams.set('mode', 'driving')
  url.searchParams.set('units', 'imperial')
  url.searchParams.set('key', GOOGLE_MAPS_KEY)

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 900 } }) // cache 15 min
    const data = await res.json()
    const element = data?.rows?.[0]?.elements?.[0]
    if (element?.status === 'OK') {
      return Math.ceil(element.duration.value / 60) // seconds → minutes
    }
  } catch {
    // fall through
  }
  return null
}

function addMinutes(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60 * 1000)
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

export async function calculateETA(
  fcLoad: Load,
  allDriverLoads: Load[],
  terminalCoords: LatLng | null,
  siteCoords: LatLng | null,
): Promise<ETAResult> {
  // If dispatch already gave us a delivery ETA, use it as the site ETA
  const dispatchSiteEta = fcLoad.delivery_eta ? new Date(fcLoad.delivery_eta) : null

  // If the load is already en route to site, at site, or delivered, just show dispatch ETA
  if (LOCKED_STATUSES.includes(fcLoad.load_status) || fcLoad.load_status === 22) {
    return {
      terminal_eta: fcLoad.arrived_at_rack_time
        ? formatCT(new Date(fcLoad.arrived_at_rack_time))
        : null,
      site_eta: dispatchSiteEta ? formatCT(dispatchSiteEta) : null,
      basis: dispatchSiteEta ? 'dispatch' : 'unavailable',
    }
  }

  // Find the most advanced prior load — preferably status 24 (at site)
  const priorLoads = allDriverLoads.filter(
    l => l.ce_id !== fcLoad.ce_id
  )

  const atSiteLoad = priorLoads.find(l => l.load_status === 24)
  const atTerminalLoad = priorLoads.find(l => l.load_status === 20)

  // Case: driver is currently at a site (finishing a prior delivery)
  if (atSiteLoad && terminalCoords) {
    const originCoords = atSiteLoad.site_id
      ? await fetchSiteCoords(atSiteLoad.site_id)
      : null

    const now = new Date()
    let terminalEta: Date

    if (originCoords) {
      const driveMinutes = await getDrivingMinutes(originCoords, terminalCoords)
      if (driveMinutes !== null) {
        terminalEta = addMinutes(now, DROP_TIME_MIN + driveMinutes)
      } else {
        terminalEta = addMinutes(now, DROP_TIME_MIN + 60) // fallback estimate
      }
    } else {
      terminalEta = addMinutes(now, DROP_TIME_MIN + 60)
    }

    let siteEta: Date | null = null
    if (siteCoords) {
      const loadToSiteMinutes = await getDrivingMinutes(terminalCoords, siteCoords)
      if (loadToSiteMinutes !== null) {
        siteEta = addMinutes(terminalEta, LOAD_TIME_MIN + loadToSiteMinutes)
      }
    }

    return {
      terminal_eta: formatCT(terminalEta),
      site_eta: siteEta ? formatCT(siteEta) : (dispatchSiteEta ? formatCT(dispatchSiteEta) : null),
      basis: 'calculated',
    }
  }

  // Case: driver is at the terminal loading
  if (atTerminalLoad && terminalCoords && siteCoords) {
    const now = new Date()
    const terminalEta = now // already there
    const driveMinutes = await getDrivingMinutes(terminalCoords, siteCoords)
    const siteEta = driveMinutes !== null
      ? addMinutes(now, LOAD_TIME_MIN + driveMinutes)
      : null

    return {
      terminal_eta: formatCT(terminalEta),
      site_eta: siteEta ? formatCT(siteEta) : (dispatchSiteEta ? formatCT(dispatchSiteEta) : null),
      basis: 'calculated',
    }
  }

  // Fallback: use dispatch-provided ETA
  if (dispatchSiteEta) {
    return {
      terminal_eta: null,
      site_eta: formatCT(dispatchSiteEta),
      basis: 'dispatch',
    }
  }

  return { terminal_eta: null, site_eta: null, basis: 'unavailable' }
}

async function fetchSiteCoords(siteId: number): Promise<LatLng | null> {
  // Called server-side — import Supabase service client dynamically
  try {
    const { createServiceClient } = await import('@/lib/supabase/server')
    const sb = await createServiceClient()
    const { data } = await sb
      .from('all_sites')
      .select('latitude, longitude')
      .eq('site_id', siteId)
      .single()
    if (data?.latitude && data?.longitude) {
      return { lat: data.latitude, lng: data.longitude }
    }
  } catch {
    // ignore
  }
  return null
}

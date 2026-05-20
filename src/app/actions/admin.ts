'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = 'kimberly@qwtransport.com'

async function requireAdmin() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) redirect('/loads')
}

// ── Yards ────────────────────────────────────────────────────────────────────

export async function saveYard(input: {
  yard_id?: number
  yard_name: string
  address: string | null
  city: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
}) {
  await requireAdmin()
  const sb = await createServiceClient()
  const { yard_id, ...fields } = input

  if (yard_id) {
    await sb.from('yards').update(fields).eq('yard_id', yard_id)
  } else {
    await sb.from('yards').insert(fields)
  }
  revalidatePath('/admin/yards')
}

export async function deleteYard(yardId: number) {
  await requireAdmin()
  const sb = await createServiceClient()
  await sb.from('yards').delete().eq('yard_id', yardId)
  revalidatePath('/admin/yards')
}

// ── Drivers ──────────────────────────────────────────────────────────────────

export async function saveDriver(input: {
  driver_id?: number
  first_name: string
  last_name: string
  yard_id: number | null
  default_start_time: string
  active: boolean
}) {
  await requireAdmin()
  const sb = await createServiceClient()
  const { driver_id, ...fields } = input

  if (driver_id) {
    await sb.from('drivers').update(fields).eq('driver_id', driver_id)
  } else {
    await sb.from('drivers').insert(fields)
  }
  revalidatePath('/admin/drivers')
}

export async function deleteDriver(driverId: number) {
  await requireAdmin()
  const sb = await createServiceClient()
  await sb.from('drivers').delete().eq('driver_id', driverId)
  revalidatePath('/admin/drivers')
}

// ── Sync drivers from today's loads ─────────────────────────────────────────

export async function syncDriversFromLoads() {
  await requireAdmin()
  const sb = await createServiceClient()

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })

  const { data: loads } = await sb
    .from('loads')
    .select('first_name, last_name')
    .eq('delivery_date', today)
    .not('first_name', 'is', null)
    .not('last_name', 'is', null)

  if (!loads?.length) return { created: 0 }

  // Unique names from today's loads
  const unique = [...new Map(loads.map(l => [`${l.first_name}|${l.last_name}`, l])).values()]

  // Existing driver names
  const { data: existing } = await sb
    .from('drivers')
    .select('first_name, last_name')

  const existingSet = new Set((existing ?? []).map(d => `${d.first_name}|${d.last_name}`))
  const toCreate = unique.filter(l => !existingSet.has(`${l.first_name}|${l.last_name}`))

  if (toCreate.length) {
    await sb.from('drivers').insert(
      toCreate.map(l => ({
        first_name: l.first_name,
        last_name: l.last_name,
        active: true,
      }))
    )
  }

  revalidatePath('/admin/drivers')
  return { created: toCreate.length }
}

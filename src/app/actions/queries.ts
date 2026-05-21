'use server'

import { createServiceClient } from '@/lib/supabase/server'

/** Fetch the full history for one CE ID (change log + paperwork with signed URLs). */
export async function getLoadHistory(ceId: number) {
  const sb = await createServiceClient()

  const [{ data: changes }, { data: paperwork }] = await Promise.all([
    sb.from('load_changes')
      .select('id, change_type, description, old_value, new_value, notes, dispatch_response, response_received_at, created_at')
      .eq('ce_id', ceId)
      .order('created_at', { ascending: false }),
    sb.from('paperwork')
      .select('id, file_name, storage_path, uploaded_at')
      .eq('ce_id', ceId)
      .order('uploaded_at', { ascending: false }),
  ])

  // Generate 1-hour signed URLs for each BOL
  const paperworkWithUrls = await Promise.all(
    (paperwork ?? []).map(async p => {
      const { data } = await sb.storage
        .from('paperwork')
        .createSignedUrl(p.storage_path, 3600)
      return { ...p, signedUrl: data?.signedUrl ?? null }
    })
  )

  return {
    changes: changes ?? [],
    paperwork: paperworkWithUrls,
  }
}

/** Count of unread dispatch notifications — used by NavBar bell. */
export async function getUnreadNotificationCount(): Promise<number> {
  const sb = await createServiceClient()
  const { count } = await sb
    .from('dispatch_notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  return count ?? 0
}

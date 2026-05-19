/**
 * POST /api/email/inbound
 *
 * Resend inbound email webhook. Two cases:
 *   1. Dispatch reply to a notification → recorded as dispatch_response on the load_change/notification record
 *   2. BOL PDF from bol@creative123.com → PDF uploaded to Supabase Storage, linked to CE_ID by filename
 *
 * Webhook secret validated via INBOUND_EMAIL_SECRET header.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const BOL_SENDER = 'bol@creative123.com'

export async function POST(req: NextRequest) {
  // Validate webhook secret
  const secret = req.headers.get('x-resend-signature') ?? req.headers.get('x-webhook-secret')
  if (secret !== process.env.INBOUND_EMAIL_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: any
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const fromAddress: string = payload?.from?.address ?? payload?.from ?? ''
  const subject: string = payload?.subject ?? ''
  const textBody: string = payload?.text ?? payload?.body ?? ''
  const inReplyTo: string = payload?.in_reply_to ?? payload?.headers?.['in-reply-to'] ?? ''
  const attachments: any[] = payload?.attachments ?? []

  const sb = await createServiceClient()

  // ── Case 1: BOL PDF from dispatch software ──────────────────────────────
  if (fromAddress.toLowerCase().includes(BOL_SENDER)) {
    for (const attachment of attachments) {
      if (!attachment?.filename?.toLowerCase().endsWith('.pdf')) continue

      // Filename = CE_ID.pdf
      const ceIdStr = attachment.filename.replace(/\.pdf$/i, '').trim()
      const ceId = parseInt(ceIdStr)
      if (isNaN(ceId)) continue

      // Decode base64 attachment
      const buffer = Buffer.from(attachment.content ?? attachment.data ?? '', 'base64')
      const storagePath = `bol/${ceId}/${attachment.filename}`

      const { error: uploadError } = await sb.storage
        .from('paperwork')
        .upload(storagePath, buffer, {
          contentType: 'application/pdf',
          upsert: true,
        })

      if (!uploadError) {
        await sb.from('paperwork').upsert({
          ce_id: ceId,
          file_name: attachment.filename,
          storage_path: storagePath,
          uploaded_at: new Date().toISOString(),
        })
      }
    }
    return NextResponse.json({ ok: true })
  }

  // ── Case 2: Dispatch reply to a notification ────────────────────────────
  if (inReplyTo) {
    // Look up which record this reply belongs to
    const { data: thread } = await sb
      .from('email_threads')
      .select('reference_type, reference_id')
      .eq('message_id', inReplyTo)
      .single()

    if (thread) {
      const responseText = textBody.trim()
      const now = new Date().toISOString()

      if (thread.reference_type === 'load_change') {
        await sb.from('load_changes')
          .update({ dispatch_response: responseText, response_received_at: now })
          .eq('id', thread.reference_id)
      } else if (thread.reference_type === 'general_notification') {
        await sb.from('general_notifications')
          .update({ dispatch_response: responseText, response_received_at: now })
          .eq('id', thread.reference_id)
      }
    }
  }

  return NextResponse.json({ ok: true })
}

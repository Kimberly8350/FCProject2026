/**
 * POST /api/email/inbound
 *
 * Resend inbound email webhook (event type: email.received).
 * Two cases:
 *   1. BOL PDF from bol@creative123.com → PDF uploaded to Supabase Storage, linked by CE_ID filename
 *   2. Dispatch reply (has In-Reply-To header) → recorded as dispatch_response on the load_change/notification
 *
 * Signature verified via Svix using INBOUND_EMAIL_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { createServiceClient } from '@/lib/supabase/server'

const BOL_SENDER = 'bol@creative123.com'

/** Extract bare email address from "Name <email@domain.com>" or "email@domain.com" */
function parseEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/)
  return (match ? match[1] : raw).toLowerCase().trim()
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Verify Svix signature
  const secret = process.env.INBOUND_EMAIL_SECRET!
  const wh = new Webhook(secret)
  let payload: any

  try {
    payload = wh.verify(rawBody, {
      'svix-id':        req.headers.get('svix-id') ?? '',
      'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
      'svix-signature': req.headers.get('svix-signature') ?? '',
    })
  } catch {
    // Fallback: accept if secret matches x-webhook-secret directly (dev/testing)
    const simpleSecret = req.headers.get('x-webhook-secret')
    if (simpleSecret !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    try { payload = JSON.parse(rawBody) } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
  }

  // Resend wraps inbound email data under payload.data
  const data = payload?.data ?? payload

  const fromAddress = parseEmail(data?.from ?? '')
  const subject: string    = data?.subject ?? ''
  const textBody: string   = data?.text ?? data?.body ?? ''
  const inReplyTo: string  = data?.in_reply_to ?? data?.headers?.find?.((h: any) => h.name?.toLowerCase() === 'in-reply-to')?.value ?? ''
  const attachments: any[] = data?.attachments ?? []

  const sb = await createServiceClient()

  // ── Case 1: BOL PDF from dispatch software ────────────────────────────────
  if (fromAddress.includes(BOL_SENDER.split('@')[1]) || fromAddress === BOL_SENDER) {
    for (const attachment of attachments) {
      const filename: string = attachment?.filename ?? attachment?.name ?? ''
      if (!filename.toLowerCase().endsWith('.pdf')) continue

      const ceIdStr = filename.replace(/\.pdf$/i, '').trim()
      const ceId = parseInt(ceIdStr)
      if (isNaN(ceId)) continue

      const content = attachment.content ?? attachment.data ?? ''
      const buffer = Buffer.from(content, 'base64')
      const storagePath = `bol/${ceId}/${filename}`

      const { error: uploadError } = await sb.storage
        .from('paperwork')
        .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true })

      if (!uploadError) {
        await sb.from('paperwork').upsert({
          ce_id: ceId,
          file_name: filename,
          storage_path: storagePath,
          uploaded_at: new Date().toISOString(),
        })
      }
    }
    return NextResponse.json({ ok: true })
  }

  // ── Case 2: Dispatch reply to a notification ──────────────────────────────
  if (inReplyTo) {
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

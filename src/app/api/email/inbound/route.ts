/**
 * POST /api/email/inbound
 *
 * Resend inbound email webhook (event type: email.received).
 * Two cases:
 *   1. Email TO bol@fuelcityportal.com with PDF attachment(s) → PDF uploaded to
 *      Supabase Storage "paperwork" bucket; linked by CE_ID (the PDF filename).
 *   2. Dispatch reply (has In-Reply-To header) → recorded as dispatch_response
 *      on the matching load_change or general_notification row.
 *
 * Signature verified via Svix using INBOUND_EMAIL_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { createServiceClient } from '@/lib/supabase/server'

const BOL_ADDRESS = 'bol@fuelcityportal.com'

/** Extract bare email address from "Name <email@domain.com>" or "email@domain.com" */
function parseEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/)
  return (match ? match[1] : raw).toLowerCase().trim()
}

/** Return true if any recipient in the to/cc fields is the BOL address */
function isToBol(data: any): boolean {
  // Resend may send `to` as a string, an array of strings, or an array of objects
  const toRaw: unknown = data?.to ?? data?.headers?.find?.((h: any) => h.name?.toLowerCase() === 'to')?.value ?? ''
  const candidates: string[] = Array.isArray(toRaw)
    ? toRaw.map((t: any) => (typeof t === 'string' ? t : t?.email ?? t?.address ?? ''))
    : [String(toRaw)]
  return candidates.some(addr => parseEmail(addr) === BOL_ADDRESS)
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

  const textBody: string   = data?.text ?? data?.body ?? ''
  const inReplyTo: string  = data?.in_reply_to ?? data?.headers?.find?.((h: any) => h.name?.toLowerCase() === 'in-reply-to')?.value ?? ''
  const attachments: any[] = data?.attachments ?? []

  const sb = await createServiceClient()

  // ── Case 1: BOL PDF — any email addressed to bol@fuelcityportal.com ───────
  if (isToBol(data)) {
    for (const attachment of attachments) {
      const filename: string = attachment?.filename ?? attachment?.name ?? ''
      if (!filename.toLowerCase().endsWith('.pdf')) continue

      // Filename is the CE ID, e.g. "239877.pdf"
      const ceIdStr = filename.replace(/\.pdf$/i, '').trim()
      const ceId = parseInt(ceIdStr, 10)
      if (isNaN(ceId)) {
        console.warn(`BOL inbound: could not parse CE ID from filename "${filename}"`)
        continue
      }

      const content = attachment.content ?? attachment.data ?? ''
      const buffer = Buffer.from(content, 'base64')
      const storagePath = `bol/${ceId}/${filename}`

      const { error: uploadError } = await sb.storage
        .from('paperwork')
        .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true })

      if (uploadError) {
        console.error(`BOL upload failed for CE ${ceId}:`, uploadError.message)
      } else {
        await sb.from('paperwork').upsert(
          {
            ce_id: ceId,
            file_name: filename,
            storage_path: storagePath,
            uploaded_at: new Date().toISOString(),
          },
          { onConflict: 'ce_id,file_name' }
        )
        console.log(`BOL uploaded for CE #${ceId}: ${filename}`)
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

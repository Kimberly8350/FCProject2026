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

const OUR_DOMAIN = 'fuelcityportal.com'

/** Extract bare email address from "Name <email@domain.com>" or "email@domain.com" */
function parseEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/)
  return (match ? match[1] : raw).toLowerCase().trim()
}

/**
 * Return true if any recipient is a BOL address at our domain.
 * Matches bol@, bols@, BOL@, etc. — any local part starting with "bol".
 */
function isToBol(data: any): boolean {
  const toRaw: unknown = data?.to ?? data?.headers?.find?.((h: any) => h.name?.toLowerCase() === 'to')?.value ?? ''
  const candidates: string[] = Array.isArray(toRaw)
    ? toRaw.map((t: any) => (typeof t === 'string' ? t : t?.email ?? t?.address ?? ''))
    : [String(toRaw)]
  return candidates.some(addr => {
    const a = parseEmail(addr)
    const [local, domain] = a.split('@')
    return domain === OUR_DOMAIN && local.startsWith('bol')
  })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Verify Svix signature (Resend signs inbound webhooks via Svix)
  const secret = process.env.INBOUND_EMAIL_SECRET ?? ''
  let payload: any

  if (secret && secret !== 'placeholder123') {
    const wh = new Webhook(secret)
    try {
      payload = wh.verify(rawBody, {
        'svix-id':        req.headers.get('svix-id') ?? '',
        'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
        'svix-signature': req.headers.get('svix-signature') ?? '',
      })
    } catch (err) {
      console.error('Inbound webhook signature verification failed:', err)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    // No real secret configured — accept the request but log a warning
    console.warn('INBOUND_EMAIL_SECRET not set or is placeholder; skipping signature verification')
    try { payload = JSON.parse(rawBody) } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
  }

  // Resend wraps inbound email data under payload.data
  const data = payload?.data ?? payload

  const textBody: string   = data?.text ?? data?.body ?? ''
  const inReplyTo: string  = data?.in_reply_to ?? data?.headers?.find?.((h: any) => h.name?.toLowerCase() === 'in-reply-to')?.value ?? ''
  const attachments: any[] = data?.attachments ?? []

  // Diagnostic log — visible in Vercel Function Logs
  console.log('Inbound email received:', {
    from: data?.from,
    to: data?.to,
    subject: data?.subject,
    attachmentCount: attachments.length,
    attachmentNames: attachments.map((a: any) => a?.filename ?? a?.name ?? '(unnamed)'),
    isToBol: isToBol(data),
    hasInReplyTo: Boolean(inReplyTo),
  })

  const sb = await createServiceClient()

  // ── Case 1: BOL PDF — any email to bols@/bol@fuelcityportal.com ──────────
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

      // Log attachment details so we can see exactly what Resend sends
      console.log(`BOL attachment for CE #${ceId}:`, {
        filename,
        contentType: attachment.contentType ?? attachment.mimeType ?? '(none)',
        contentFieldType: typeof content,
        isBuffer: Buffer.isBuffer(content),
        isNodeBuffer: typeof content === 'object' && content?.type === 'Buffer',
        contentLength: typeof content === 'string' ? content.length : JSON.stringify(content).length,
        contentPreview: typeof content === 'string' ? content.slice(0, 80) : JSON.stringify(content).slice(0, 80),
      })

      let buffer: Buffer
      if (Buffer.isBuffer(content)) {
        // Already a Buffer
        buffer = content
      } else if (typeof content === 'object' && content?.type === 'Buffer' && Array.isArray(content?.data)) {
        // Node.js Buffer serialized as JSON
        buffer = Buffer.from(content.data)
      } else if (typeof content === 'string' && content.startsWith('http')) {
        // Resend sent a URL — fetch the actual bytes
        const resp = await fetch(content)
        buffer = Buffer.from(await resp.arrayBuffer())
      } else if (typeof content === 'string') {
        // Assume base64
        buffer = Buffer.from(content, 'base64')
      } else {
        console.error(`BOL: unrecognised content format for CE #${ceId}`)
        continue
      }

      // Sanity check — valid PDFs start with %PDF
      if (buffer.length < 4 || buffer.toString('ascii', 0, 4) !== '%PDF') {
        console.error(`BOL: decoded content for CE #${ceId} is not a valid PDF (first bytes: ${buffer.toString('hex', 0, 8)})`)
        // Don't skip — upload anyway so we can inspect, but log clearly
      }

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

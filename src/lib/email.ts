/**
 * Email sending via Resend.
 * Outbound: notifications to dispatch + receipt to user.
 * Thread tracking: stores Message-ID in email_threads so inbound replies route correctly.
 */

import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY!)
const FROM = process.env.RESEND_FROM_ADDRESS!

export interface SendNotificationOptions {
  subject: string
  body: string
  referenceType: 'load_change' | 'general_notification'
  referenceId: string | undefined
  ceId: number | null
}

export async function sendNotificationEmail(opts: SendNotificationOptions) {
  const sb = await createServiceClient()

  // Get all active addresses that should receive notifications
  const { data: recipients } = await sb
    .from('email_notifications')
    .select('email, send, receive')
    .eq('active', true)

  const receiveAddresses = (recipients ?? [])
    .filter(r => r.receive)
    .map(r => r.email)

  if (receiveAddresses.length === 0) return

  const replyTo = FROM // dispatch replies go back to the portal's inbound address

  const htmlBody = opts.body
    .split('\n')
    .map(l => `<p style="margin:4px 0;font-family:sans-serif;font-size:14px">${l}</p>`)
    .join('')

  try {
    const { data: sent } = await resend.emails.send({
      from: `Fuel City Portal <${FROM}>`,
      to: receiveAddresses,
      reply_to: replyTo,
      subject: opts.subject,
      html: `
        <div style="max-width:600px;margin:0 auto;padding:24px">
          ${htmlBody}
          <hr style="margin:24px 0;border:none;border-top:1px solid #eee"/>
          <p style="font-size:12px;color:#999;font-family:sans-serif">
            Reply to this email to respond. Your reply will be recorded in the Fuel City Portal.
          </p>
        </div>
      `,
    })

    // Store the Message-ID for reply threading
    if (sent?.id && opts.referenceId) {
      await sb.from('email_threads').insert({
        message_id: sent.id,
        reference_type: opts.referenceType,
        reference_id: opts.referenceId,
      })
    }
  } catch (err) {
    console.error('Failed to send email:', err)
  }
}

export async function sendReceiptEmail(opts: {
  to: string
  subject: string
  body: string
}) {
  const { data: senders } = await (await createServiceClient())
    .from('email_notifications')
    .select('email')
    .eq('send', true)
    .eq('active', true)

  const sendAddresses = (senders ?? []).map(s => s.email)
  if (!sendAddresses.includes(opts.to)) return

  try {
    await resend.emails.send({
      from: `Fuel City Portal <${FROM}>`,
      to: opts.to,
      subject: opts.subject,
      html: `<div style="font-family:sans-serif;font-size:14px;max-width:600px;margin:0 auto;padding:24px">${opts.body}</div>`,
    })
  } catch (err) {
    console.error('Failed to send receipt email:', err)
  }
}

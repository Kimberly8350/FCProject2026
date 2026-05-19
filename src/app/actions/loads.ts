'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { sendNotificationEmail } from '@/lib/email'
import { ChangeRequestType } from '@/types'

// ── Save terminal/supplier/notes for a load ─────────────────────────────────

export async function saveLoadSettings(input: {
  ceId: number
  terminalId: string | null
  supplierId: number | null
  supplierNumber: string | null
  notes: string | null
  needsReview: boolean
  needsReviewNotes: string | null
}) {
  const sb = await createServiceClient()

  // Handle custom terminal — save it to the terminals table if new
  if (input.terminalId?.startsWith('custom:')) {
    const name = input.terminalId.replace('custom:', '')
    const { data: existing } = await sb
      .from('terminals')
      .select('terminal_id')
      .eq('terminal_name', name)
      .eq('is_custom', true)
      .single()

    if (!existing) {
      const newId = `custom-${Date.now()}`
      await sb.from('terminals').insert({
        terminal_id: newId,
        terminal_name: name,
        is_custom: true,
        is_fuel_city: false,
      })
      input.terminalId = newId
    } else {
      input.terminalId = existing.terminal_id
    }
  }

  // Fetch existing settings to detect what changed
  const { data: existing } = await sb
    .from('load_settings')
    .select('*')
    .eq('ce_id', input.ceId)
    .single()

  await sb.from('load_settings').upsert({
    ce_id: input.ceId,
    terminal_id: input.terminalId,
    supplier_id: input.supplierId,
    supplier_number: input.supplierNumber,
    notes: input.notes,
    needs_review: input.needsReview,
    needs_review_notes: input.needsReviewNotes,
    updated_at: new Date().toISOString(),
  })

  // Log terminal change
  if (existing?.terminal_id !== input.terminalId) {
    const { data: changeRecord } = await sb.from('load_changes').insert({
      ce_id: input.ceId,
      change_type: 'terminal_change',
      old_value: existing?.terminal_id ?? null,
      new_value: input.terminalId,
      description: `Terminal updated to ${input.terminalId}`,
    }).select().single()

    await sendNotificationEmail({
      subject: `[CE #${input.ceId}] Terminal Updated`,
      body: `CE ID: ${input.ceId}\nTerminal changed to: ${input.terminalId}\nNotes: ${input.notes ?? '—'}`,
      referenceType: 'load_change',
      referenceId: changeRecord?.id,
      ceId: input.ceId,
    })
  }

  // Log supplier change
  if (existing?.supplier_id !== input.supplierId || existing?.supplier_number !== input.supplierNumber) {
    const { data: changeRecord } = await sb.from('load_changes').insert({
      ce_id: input.ceId,
      change_type: 'supplier_change',
      old_value: existing?.supplier_number ?? null,
      new_value: input.supplierNumber,
      description: `Supplier updated`,
    }).select().single()

    await sendNotificationEmail({
      subject: `[CE #${input.ceId}] Supplier Updated`,
      body: `CE ID: ${input.ceId}\nSupplier #: ${input.supplierNumber}\nNotes: ${input.notes ?? '—'}`,
      referenceType: 'load_change',
      referenceId: changeRecord?.id,
      ceId: input.ceId,
    })
  }

  revalidatePath('/loads')
}

// ── Submit a change request (delay/cancel/timing) ───────────────────────────

export async function submitChangeRequest(input: {
  ceId: number
  changeType: ChangeRequestType
  notes: string | null
}) {
  const sb = await createServiceClient()

  const LABELS: Record<string, string> = {
    load_before_5pm:    'Load before 5 PM',
    load_after_5pm:     'Load after 5 PM',
    load_after_midnight:'Load after midnight',
    delay:              'Delay load',
    move_up:            'Move load up',
    cancel:             'Cancel load',
    needs_review:       'Needs review',
  }

  const { data: changeRecord } = await sb.from('load_changes').insert({
    ce_id: input.ceId,
    change_type: input.changeType,
    description: LABELS[input.changeType] ?? input.changeType,
    notes: input.notes,
  }).select().single()

  await sendNotificationEmail({
    subject: `[CE #${input.ceId}] ${LABELS[input.changeType] ?? input.changeType}`,
    body: `CE ID: ${input.ceId}\nRequest: ${LABELS[input.changeType]}\nNotes: ${input.notes ?? '—'}`,
    referenceType: 'load_change',
    referenceId: changeRecord?.id,
    ceId: input.ceId,
  })

  revalidatePath('/loads')
}

// ── Send a dispatch note (non-change notification) ──────────────────────────

export async function sendDispatchNote(input: { ceId: number; message: string }) {
  const sb = await createServiceClient()

  const { data: changeRecord } = await sb.from('load_changes').insert({
    ce_id: input.ceId,
    change_type: 'general_notification',
    description: 'Dispatch note',
    notes: input.message,
  }).select().single()

  await sendNotificationEmail({
    subject: `[CE #${input.ceId}] Dispatch Note`,
    body: `CE ID: ${input.ceId}\nMessage: ${input.message}`,
    referenceType: 'load_change',
    referenceId: changeRecord?.id,
    ceId: input.ceId,
  })

  revalidatePath('/loads')
}

// ── Send a general (account-level) notification ──────────────────────────────

export async function sendGeneralNotification(input: { message: string }) {
  const sb = await createServiceClient()

  const { data: record } = await sb.from('general_notifications').insert({
    message: input.message,
  }).select().single()

  await sendNotificationEmail({
    subject: '[Fuel City] General Notification',
    body: input.message,
    referenceType: 'general_notification',
    referenceId: record?.id,
    ceId: null,
  })
}

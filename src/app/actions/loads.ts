'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { sendNotificationEmail } from '@/lib/email'
import { ChangeRequestType } from '@/types'

// ── Save terminal/supplier/notes for a load ─────────────────────────────────

export async function saveLoadSettings(input: {
  ceId: number
  driverId: number | null
  terminalId: string | null
  supplierId: number | null
  supplierNumber: string | null
  bioTerminalId: string | null
  bioSupplierId: number | null
  bioSupplierNumber: string | null
  notes: string | null
  needsReview: boolean
  needsReviewNotes: string | null
}) {
  const sb = await createServiceClient()

  // Handle custom terminal — save it to the terminals table if new
  async function resolveCustomTerminal(id: string | null): Promise<string | null> {
    if (!id?.startsWith('custom:')) return id
    const name = id.replace('custom:', '')
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
      return newId
    }
    return existing.terminal_id
  }

  /** Look up a human-readable terminal name by ID */
  async function terminalName(id: string | null): Promise<string> {
    if (!id) return '—'
    const { data } = await sb.from('terminals').select('terminal_name').eq('terminal_id', id).single()
    return data?.terminal_name ?? id
  }

  /** Look up a supplier name by ID */
  async function supplierName(id: number | null): Promise<string> {
    if (!id) return '—'
    const { data } = await sb.from('suppliers').select('supplier_name').eq('supplier_id', id).single()
    return data?.supplier_name ?? String(id)
  }

  input.terminalId    = await resolveCustomTerminal(input.terminalId)
  input.bioTerminalId = await resolveCustomTerminal(input.bioTerminalId)

  // Fetch existing settings to detect what changed
  const { data: existing } = await sb
    .from('load_settings')
    .select('*')
    .eq('ce_id', input.ceId)
    .single()

  // Detect changes across all tracked fields
  const changedTerminal     = existing?.terminal_id        !== input.terminalId
  const changedSupplier     = existing?.supplier_id        !== input.supplierId
  const changedSupplierNum  = existing?.supplier_number    !== input.supplierNumber
  const changedBioTerminal  = existing?.bio_terminal_id    !== input.bioTerminalId
  const changedBioSupplier  = existing?.bio_supplier_id    !== input.bioSupplierId
  const changedBioSupNum    = existing?.bio_supplier_number !== input.bioSupplierNumber
  const changedNotes        = existing?.notes              !== input.notes

  const anyChanged =
    changedTerminal || changedSupplier || changedSupplierNum ||
    changedBioTerminal || changedBioSupplier || changedBioSupNum || changedNotes

  // Persist settings regardless
  await sb.from('load_settings').upsert({
    ce_id: input.ceId,
    driver_id: input.driverId,
    terminal_id: input.terminalId,
    supplier_id: input.supplierId,
    supplier_number: input.supplierNumber,
    bio_terminal_id: input.bioTerminalId,
    bio_supplier_id: input.bioSupplierId,
    bio_supplier_number: input.bioSupplierNumber,
    notes: input.notes,
    needs_review: input.needsReview,
    needs_review_notes: input.needsReviewNotes,
    updated_at: new Date().toISOString(),
  })

  // Only send one consolidated email if something actually changed
  if (anyChanged) {
    // Resolve all display names in parallel
    const [
      oldTermName, newTermName,
      oldBioTermName, newBioTermName,
      oldSupName, newSupName,
      oldBioSupName, newBioSupName,
    ] = await Promise.all([
      terminalName(existing?.terminal_id ?? null),
      terminalName(input.terminalId),
      terminalName(existing?.bio_terminal_id ?? null),
      terminalName(input.bioTerminalId),
      supplierName(existing?.supplier_id ?? null),
      supplierName(input.supplierId),
      supplierName(existing?.bio_supplier_id ?? null),
      supplierName(input.bioSupplierId),
    ])

    /** Build one table row: shows "No Change" when the field is unchanged */
    function row(
      field: string,
      prevVal: string,
      newVal: string,
      changed: boolean,
    ): string {
      const updatedCell = changed
        ? `<strong style="color:#1d4ed8">${newVal}</strong>`
        : `<span style="color:#9ca3af">No Change</span>`
      return `
        <tr>
          <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;white-space:nowrap">${field}</td>
          <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#6b7280">${prevVal}</td>
          <td style="padding:8px 12px;border:1px solid #e5e7eb">${updatedCell}</td>
        </tr>`
    }

    const tableRows = [
      row('Terminal',      oldTermName,                           newTermName,                           changedTerminal),
      row('Supplier',      oldSupName,                            newSupName,                            changedSupplier),
      row('Supplier #',    existing?.supplier_number    ?? '—',   input.supplierNumber    ?? '—',        changedSupplierNum),
      row('Bio Terminal',  oldBioTermName,                        newBioTermName,                        changedBioTerminal),
      row('Bio Supplier',  oldBioSupName,                         newBioSupName,                         changedBioSupplier),
      row('Bio Supplier #',existing?.bio_supplier_number ?? '—',  input.bioSupplierNumber ?? '—',        changedBioSupNum),
      row('Notes',         existing?.notes              ?? '—',   input.notes             ?? '—',        changedNotes),
    ].join('')

    const htmlContent = `
      <h2 style="margin:0 0 16px;font-size:18px;color:#111827">
        Load Updates &mdash; CE #${input.ceId}
      </h2>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <thead>
          <tr style="background:#f9fafb">
            <th style="text-align:left;padding:8px 12px;border:1px solid #e5e7eb;color:#374151">Field</th>
            <th style="text-align:left;padding:8px 12px;border:1px solid #e5e7eb;color:#374151">Previous</th>
            <th style="text-align:left;padding:8px 12px;border:1px solid #e5e7eb;color:#374151">Updated To</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>`

    // Log a single change record
    const { data: changeRecord } = await sb.from('load_changes').insert({
      ce_id: input.ceId,
      change_type: 'settings_update',
      description: 'Load settings updated',
      notes: input.notes,
    }).select().single()

    await sendNotificationEmail({
      subject: `Load Updates for CE #${input.ceId}`,
      body: `Load settings updated for CE #${input.ceId}`,
      html: htmlContent,
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

  const label = LABELS[input.changeType] ?? input.changeType

  const { data: changeRecord } = await sb.from('load_changes').insert({
    ce_id: input.ceId,
    change_type: input.changeType,
    description: label,
    notes: input.notes,
  }).select().single()

  const htmlContent = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827">
      Change Request &mdash; CE #${input.ceId}
    </h2>
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      <tbody>
        <tr>
          <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;width:140px">CE ID</td>
          <td style="padding:8px 12px;border:1px solid #e5e7eb">${input.ceId}</td>
        </tr>
        <tr style="background:#f9fafb">
          <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600">Request</td>
          <td style="padding:8px 12px;border:1px solid #e5e7eb"><strong>${label}</strong></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600">Notes</td>
          <td style="padding:8px 12px;border:1px solid #e5e7eb;color:${input.notes ? '#111827' : '#9ca3af'}">${input.notes ?? '—'}</td>
        </tr>
      </tbody>
    </table>`

  await sendNotificationEmail({
    subject: `Change Request for CE #${input.ceId}`,
    body: `Change request for CE #${input.ceId}: ${label}. Notes: ${input.notes ?? '—'}`,
    html: htmlContent,
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
    subject: `Dispatch Note for CE #${input.ceId}`,
    body: `Dispatch note for CE #${input.ceId}: ${input.message}`,
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

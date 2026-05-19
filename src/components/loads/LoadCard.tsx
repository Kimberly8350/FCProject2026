'use client'

import { useState, useTransition } from 'react'
import { Load, Terminal, Supplier, LOAD_STATUS_LABELS, LOCKED_STATUSES } from '@/types'
import { saveLoadSettings, submitChangeRequest, sendDispatchNote } from '@/app/actions/loads'

interface Props {
  loads: Load[]                // all product rows for this CE_ID
  allDriverLoads: Load[]       // all loads for this driver today (for ETA context)
  terminals: Pick<Terminal, 'terminal_id' | 'terminal_name' | 'is_fuel_city' | 'is_custom'>[]
  suppliers: Pick<Supplier, 'supplier_id' | 'supplier_name' | 'supplier_loading_number'>[]
  settings: {
    terminal_id: string | null
    supplier_id: number | null
    supplier_number: string | null
    notes: string | null
    needs_review: boolean
    needs_review_notes: string | null
  } | null
  siteCoords: { lat: number; lng: number } | null
}

const STATUS_COLORS: Record<number, string> = {
  1:  'bg-gray-100 text-gray-600',
  2:  'bg-yellow-50 text-yellow-700',
  10: 'bg-blue-50 text-blue-700',
  12: 'bg-indigo-50 text-indigo-700',
  20: 'bg-purple-50 text-purple-700',
  22: 'bg-orange-50 text-orange-700',
  24: 'bg-amber-50 text-amber-700',
  26: 'bg-green-50 text-green-700',
}

const CHANGE_OPTIONS = [
  { value: 'load_before_5pm',    label: 'Load before 5 PM' },
  { value: 'load_after_5pm',     label: 'Load after 5 PM' },
  { value: 'load_after_midnight',label: 'Load after midnight' },
  { value: 'delay',              label: 'Delay load' },
  { value: 'move_up',            label: 'Move up load' },
  { value: 'cancel',             label: 'Cancel load' },
]

export default function LoadCard({ loads, allDriverLoads, terminals, suppliers, settings, siteCoords }: Props) {
  const primary = loads[0]
  const ceId = primary.ce_id
  const isLocked = LOCKED_STATUSES.includes(primary.load_status)
  const isDelivered = primary.load_status === 26

  // Local state mirroring saved settings
  const [terminalId, setTerminalId] = useState(settings?.terminal_id ?? primary.terminal_id ?? '')
  const [supplierId, setSupplierId] = useState<string>(settings?.supplier_id?.toString() ?? '')
  const [supplierNumber, setSupplierNumber] = useState(settings?.supplier_number ?? '')
  const [notes, setNotes] = useState(settings?.notes ?? '')
  const [needsReview, setNeedsReview] = useState(settings?.needs_review ?? false)
  const [needsReviewNotes, setNeedsReviewNotes] = useState(settings?.needs_review_notes ?? '')

  // UI toggles
  const [showNotify, setShowNotify] = useState(false)
  const [showChange, setShowChange] = useState(false)
  const [showNeedsReview, setShowNeedsReview] = useState(false)
  const [changeType, setChangeType] = useState('')
  const [notifyMessage, setNotifyMessage] = useState('')
  const [addTerminalMode, setAddTerminalMode] = useState(false)
  const [customTerminalName, setCustomTerminalName] = useState('')

  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)

  // Filter suppliers for the selected terminal's available numbers
  const selectedSupplier = suppliers.find(s => s.supplier_id.toString() === supplierId)
  const supplierOptions = suppliers.filter(s => s.supplier_name === selectedSupplier?.supplier_name)

  function notify(msg: string) {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 4000)
  }

  async function handleSaveSettings() {
    startTransition(async () => {
      await saveLoadSettings({
        ceId,
        terminalId: terminalId || null,
        supplierId: supplierId ? parseInt(supplierId) : null,
        supplierNumber: supplierNumber || null,
        notes: notes || null,
        needsReview,
        needsReviewNotes: needsReviewNotes || null,
      })
      notify('Saved — notification sent to dispatch.')
    })
  }

  async function handleChangeRequest() {
    if (!changeType) return
    startTransition(async () => {
      await submitChangeRequest({ ceId, changeType: changeType as any, notes: notifyMessage || null })
      setShowChange(false)
      setChangeType('')
      setNotifyMessage('')
      notify('Change request sent to dispatch.')
    })
  }

  async function handleDispatchNote() {
    if (!notifyMessage.trim()) return
    startTransition(async () => {
      await sendDispatchNote({ ceId, message: notifyMessage })
      setShowNotify(false)
      setNotifyMessage('')
      notify('Note sent to dispatch.')
    })
  }

  async function handleNeedsReview() {
    startTransition(async () => {
      await saveLoadSettings({
        ceId,
        terminalId: terminalId || null,
        supplierId: supplierId ? parseInt(supplierId) : null,
        supplierNumber: supplierNumber || null,
        notes: notes || null,
        needsReview: true,
        needsReviewNotes: needsReviewNotes || null,
      })
      await submitChangeRequest({ ceId, changeType: 'needs_review', notes: needsReviewNotes || null })
      setNeedsReview(true)
      setShowNeedsReview(false)
      notify('Flagged for review — dispatch notified.')
    })
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm border ${needsReview ? 'border-orange-400' : 'border-gray-200'} p-4 flex flex-col gap-3`}>

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-gray-500 font-mono">CE #{ceId}</p>
          <p className="text-sm font-semibold text-gray-900 mt-0.5">{primary.site_name}</p>
          {primary.first_name && (
            <p className="text-xs text-gray-500">{primary.first_name} {primary.last_name}</p>
          )}
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${STATUS_COLORS[primary.load_status] ?? 'bg-gray-100 text-gray-600'}`}>
          {LOAD_STATUS_LABELS[primary.load_status] ?? `Status ${primary.load_status}`}
        </span>
      </div>

      {/* Products */}
      <div className="bg-gray-50 rounded-lg p-2 space-y-0.5">
        {loads.map((l, i) => (
          <div key={i} className="flex justify-between text-xs">
            <span className="text-gray-700">{l.product_name}</span>
            <span className="text-gray-500">{l.gallons_ordered?.toLocaleString()} gal</span>
          </div>
        ))}
      </div>

      {/* ETA row — shown from dispatch data for now; ETA endpoint enriches this */}
      {(primary.delivery_eta || primary.arrived_at_rack_time) && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          {primary.arrived_at_rack_time && (
            <div className="bg-gray-50 rounded p-2">
              <p className="text-gray-400 uppercase tracking-wide text-[10px]">Terminal ETA</p>
              <p className="font-medium text-gray-800 mt-0.5">
                {new Date(primary.arrived_at_rack_time).toLocaleTimeString('en-US', {
                  timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', hour12: true,
                })}
              </p>
            </div>
          )}
          {primary.delivery_eta && (
            <div className="bg-gray-50 rounded p-2">
              <p className="text-gray-400 uppercase tracking-wide text-[10px]">Delivery ETA</p>
              <p className="font-medium text-gray-800 mt-0.5">
                {new Date(primary.delivery_eta).toLocaleTimeString('en-US', {
                  timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', hour12: true,
                })}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Terminal selector */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Terminal</label>
        {addTerminalMode ? (
          <div className="flex gap-2">
            <input
              className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
              placeholder="Terminal name"
              value={customTerminalName}
              onChange={e => setCustomTerminalName(e.target.value)}
            />
            <button
              onClick={() => {
                // Saved via server action — for now just set local state
                setTerminalId(`custom:${customTerminalName}`)
                setAddTerminalMode(false)
              }}
              className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
            >
              Add
            </button>
          </div>
        ) : (
          <select
            value={terminalId}
            onChange={e => {
              if (e.target.value === '__add__') {
                setAddTerminalMode(true)
              } else {
                setTerminalId(e.target.value)
              }
            }}
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
          >
            <option value="">— Select terminal —</option>
            {terminals
              .filter(t => t.is_fuel_city || t.is_custom)
              .map(t => (
                <option key={t.terminal_id} value={t.terminal_id}>{t.terminal_name}</option>
              ))}
            <option value="__add__">+ Add new terminal…</option>
          </select>
        )}
      </div>

      {/* Supplier selector */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Supplier</label>
          <select
            value={supplierId}
            onChange={e => { setSupplierId(e.target.value); setSupplierNumber('') }}
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
          >
            <option value="">— Select —</option>
            {[...new Map(suppliers.map(s => [s.supplier_name, s])).values()].map(s => (
              <option key={s.supplier_id} value={s.supplier_id.toString()}>{s.supplier_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Supplier #</label>
          <select
            value={supplierNumber}
            onChange={e => setSupplierNumber(e.target.value)}
            disabled={!supplierId}
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-50"
          >
            <option value="">— Select —</option>
            {suppliers
              .filter(s => s.supplier_name === selectedSupplier?.supplier_name)
              .map(s => (
                <option key={s.supplier_id} value={s.supplier_loading_number}>
                  {s.supplier_loading_number}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
        <textarea
          rows={2}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Add notes for this load…"
          className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400 resize-none"
        />
      </div>

      {/* Save button */}
      <button
        onClick={handleSaveSettings}
        disabled={isPending}
        className="w-full text-xs bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white py-1.5 rounded-lg font-medium transition-colors"
      >
        {isPending ? 'Saving…' : 'Save & Notify Dispatch'}
      </button>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => { setShowNotify(!showNotify); setShowChange(false); setShowNeedsReview(false) }}
          className="flex-1 text-xs border border-gray-300 hover:border-gray-400 rounded-lg py-1.5 font-medium text-gray-700 transition-colors"
        >
          Notify Dispatch
        </button>
        {!isLocked && (
          <button
            onClick={() => { setShowChange(!showChange); setShowNotify(false); setShowNeedsReview(false) }}
            className="flex-1 text-xs border border-red-200 hover:border-red-400 rounded-lg py-1.5 font-medium text-red-700 transition-colors"
          >
            Request Change
          </button>
        )}
        {isDelivered && (
          <button
            onClick={() => { setShowNeedsReview(!showNeedsReview); setShowNotify(false); setShowChange(false) }}
            className={`flex-1 text-xs border rounded-lg py-1.5 font-medium transition-colors ${
              needsReview
                ? 'bg-orange-100 border-orange-400 text-orange-700'
                : 'border-orange-200 hover:border-orange-400 text-orange-700'
            }`}
          >
            {needsReview ? '⚠ Needs Review' : 'Flag for Review'}
          </button>
        )}
      </div>

      {/* Notify Dispatch panel */}
      {showNotify && (
        <div className="border-t border-gray-100 pt-3 space-y-2">
          <textarea
            rows={3}
            value={notifyMessage}
            onChange={e => setNotifyMessage(e.target.value)}
            placeholder="Message to dispatch…"
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400 resize-none"
          />
          <button
            onClick={handleDispatchNote}
            disabled={isPending || !notifyMessage.trim()}
            className="w-full text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-1.5 rounded-lg font-medium"
          >
            Send Note
          </button>
        </div>
      )}

      {/* Request Change panel */}
      {showChange && !isLocked && (
        <div className="border-t border-gray-100 pt-3 space-y-2">
          <select
            value={changeType}
            onChange={e => setChangeType(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
          >
            <option value="">— Select request type —</option>
            {CHANGE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <textarea
            rows={2}
            value={notifyMessage}
            onChange={e => setNotifyMessage(e.target.value)}
            placeholder="Additional notes (optional)…"
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400 resize-none"
          />
          <button
            onClick={handleChangeRequest}
            disabled={isPending || !changeType}
            className="w-full text-xs bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-1.5 rounded-lg font-medium"
          >
            Submit Request
          </button>
        </div>
      )}

      {/* Needs Review panel */}
      {showNeedsReview && isDelivered && (
        <div className="border-t border-gray-100 pt-3 space-y-2">
          <textarea
            rows={3}
            value={needsReviewNotes}
            onChange={e => setNeedsReviewNotes(e.target.value)}
            placeholder="Describe the issue with this delivery…"
            className="w-full border border-orange-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400 resize-none"
          />
          <button
            onClick={handleNeedsReview}
            disabled={isPending}
            className="w-full text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-1.5 rounded-lg font-medium"
          >
            Flag & Notify Dispatch
          </button>
        </div>
      )}

      {/* Feedback toast */}
      {feedback && (
        <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          {feedback}
        </div>
      )}
    </div>
  )
}

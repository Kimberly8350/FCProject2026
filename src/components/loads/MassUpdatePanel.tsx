'use client'

import { useState, useTransition } from 'react'
import { Terminal, Supplier, CHANGE_OPTIONS } from '@/types'
import { applyMassUpdate } from '@/app/actions/loads'

interface Props {
  selectedCeIds: number[]
  terminals: Pick<Terminal, 'terminal_id' | 'terminal_name' | 'is_fuel_city' | 'is_custom'>[]
  suppliers: Pick<Supplier, 'supplier_id' | 'supplier_name' | 'supplier_loading_number'>[]
  onClose: () => void
  onSuccess: () => void
}

export default function MassUpdatePanel({ selectedCeIds, terminals, suppliers, onClose, onSuccess }: Props) {
  const [terminalId, setTerminalId]         = useState('')
  const [supplierId, setSupplierId]         = useState('')
  const [supplierNumber, setSupplierNumber] = useState('')
  const [bioTerminalId, setBioTerminalId]   = useState('')
  const [bioSupplierId, setBioSupplierId]   = useState('')
  const [bioSupplierNumber, setBioSupplierNumber] = useState('')
  const [notes, setNotes]                   = useState('')
  const [changeType, setChangeType]         = useState('')
  const [changeNotes, setChangeNotes]       = useState('')
  const [tab, setTab]                       = useState<'settings' | 'request'>('settings')
  const [feedback, setFeedback]             = useState<string | null>(null)
  const [isPending, startTransition]        = useTransition()

  const selectedSupplier  = suppliers.find(s => s.supplier_id.toString() === supplierId)
  const selectedBioSupplier = suppliers.find(s => s.supplier_id.toString() === bioSupplierId)

  const uniqueSuppliers = [...new Map(suppliers.map(s => [s.supplier_name, s])).values()]

  async function handleApplySettings() {
    startTransition(async () => {
      await applyMassUpdate({
        ceIds: selectedCeIds,
        terminalId:       terminalId       || undefined,
        supplierId:       supplierId       ? parseInt(supplierId) : undefined,
        supplierNumber:   supplierNumber   || undefined,
        bioTerminalId:    bioTerminalId    || undefined,
        bioSupplierId:    bioSupplierId    ? parseInt(bioSupplierId) : undefined,
        bioSupplierNumber: bioSupplierNumber || undefined,
        notes:            notes            || undefined,
        changeType: null,
        changeNotes: null,
      })
      setFeedback(`Settings applied to ${selectedCeIds.length} load${selectedCeIds.length !== 1 ? 's' : ''}.`)
      setTimeout(() => { setFeedback(null); onSuccess() }, 2500)
    })
  }

  async function handleApplyChangeRequest() {
    if (!changeType) return
    startTransition(async () => {
      await applyMassUpdate({
        ceIds: selectedCeIds,
        changeType,
        changeNotes: changeNotes || null,
      })
      setFeedback(`Change request sent for ${selectedCeIds.length} load${selectedCeIds.length !== 1 ? 's' : ''}.`)
      setTimeout(() => { setFeedback(null); onSuccess() }, 2500)
    })
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-red-500 shadow-2xl">
      <div className="container mx-auto px-4 max-w-7xl py-3">
        {/* Title bar */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-gray-900">
              {selectedCeIds.length} load{selectedCeIds.length !== 1 ? 's' : ''} selected
            </span>
            <span className="text-xs text-gray-500">
              CE #{selectedCeIds.join(', #')}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-3">
          {(['settings', 'request'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded text-xs font-medium transition-colors ${
                tab === t ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t === 'settings' ? 'Apply Settings' : 'Change Request'}
            </button>
          ))}
        </div>

        {feedback ? (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            {feedback}
          </div>
        ) : tab === 'settings' ? (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Fill in only the fields you want to apply. Empty fields are left unchanged.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {/* Terminal */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Terminal</label>
                <select value={terminalId} onChange={e => setTerminalId(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400">
                  <option value="">— No change —</option>
                  {terminals.filter(t => t.is_fuel_city || t.is_custom).map(t => (
                    <option key={t.terminal_id} value={t.terminal_id}>{t.terminal_name}</option>
                  ))}
                </select>
              </div>
              {/* Supplier */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Supplier</label>
                <select value={supplierId} onChange={e => { setSupplierId(e.target.value); setSupplierNumber('') }}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400">
                  <option value="">— No change —</option>
                  {uniqueSuppliers.map(s => (
                    <option key={s.supplier_id} value={s.supplier_id.toString()}>{s.supplier_name}</option>
                  ))}
                </select>
              </div>
              {/* Supplier # */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Supplier #</label>
                <select value={supplierNumber} onChange={e => setSupplierNumber(e.target.value)}
                  disabled={!supplierId}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-50">
                  <option value="">— No change —</option>
                  {suppliers.filter(s => s.supplier_name === selectedSupplier?.supplier_name).map(s => (
                    <option key={s.supplier_id} value={s.supplier_loading_number}>{s.supplier_loading_number}</option>
                  ))}
                </select>
              </div>
              {/* Bio Terminal */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Bio Terminal</label>
                <select value={bioTerminalId} onChange={e => setBioTerminalId(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400">
                  <option value="">— No change —</option>
                  {terminals.filter(t => t.is_fuel_city || t.is_custom).map(t => (
                    <option key={t.terminal_id} value={t.terminal_id}>{t.terminal_name}</option>
                  ))}
                </select>
              </div>
              {/* Bio Supplier */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Bio Supplier</label>
                <select value={bioSupplierId} onChange={e => { setBioSupplierId(e.target.value); setBioSupplierNumber('') }}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400">
                  <option value="">— No change —</option>
                  {uniqueSuppliers.map(s => (
                    <option key={s.supplier_id} value={s.supplier_id.toString()}>{s.supplier_name}</option>
                  ))}
                </select>
              </div>
              {/* Bio Supplier # */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Bio Supplier #</label>
                <select value={bioSupplierNumber} onChange={e => setBioSupplierNumber(e.target.value)}
                  disabled={!bioSupplierId}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-50">
                  <option value="">— No change —</option>
                  {suppliers.filter(s => s.supplier_name === selectedBioSupplier?.supplier_name).map(s => (
                    <option key={s.supplier_id} value={s.supplier_loading_number}>{s.supplier_loading_number}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Notes spans full width */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Apply same notes to all selected loads…"
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400" />
              </div>
              <button
                onClick={handleApplySettings}
                disabled={isPending || (!terminalId && !supplierId && !supplierNumber && !bioTerminalId && !bioSupplierId && !bioSupplierNumber && !notes)}
                className="px-4 py-1.5 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-xs rounded-lg font-medium whitespace-nowrap"
              >
                {isPending ? 'Applying…' : 'Apply to Selected'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 items-end">
            <div className="w-48">
              <label className="block text-xs font-medium text-gray-600 mb-1">Request Type</label>
              <select value={changeType} onChange={e => setChangeType(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400">
                <option value="">— Select —</option>
                {CHANGE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
              <input type="text" value={changeNotes} onChange={e => setChangeNotes(e.target.value)}
                placeholder="Additional notes…"
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400" />
            </div>
            <button
              onClick={handleApplyChangeRequest}
              disabled={isPending || !changeType}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs rounded-lg font-medium whitespace-nowrap"
            >
              {isPending ? 'Submitting…' : 'Submit for Selected'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

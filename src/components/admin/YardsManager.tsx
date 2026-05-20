'use client'

import { useState, useTransition } from 'react'
import { Yard } from '@/types'
import { saveYard, deleteYard } from '@/app/actions/admin'

const EMPTY: Omit<Yard, 'yard_id'> = {
  yard_name: '', address: null, city: null, state: 'TX', latitude: null, longitude: null,
}

export default function YardsManager({ yards }: { yards: Yard[] }) {
  const [editing, setEditing] = useState<Yard | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)

  function notify(msg: string) {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 3000)
  }

  function startEdit(yard: Yard) {
    setEditing(yard)
    setForm({ yard_name: yard.yard_name, address: yard.address, city: yard.city, state: yard.state, latitude: yard.latitude, longitude: yard.longitude })
    setShowForm(true)
  }

  function startAdd() {
    setEditing(null)
    setForm(EMPTY)
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditing(null)
    setForm(EMPTY)
  }

  function handleSave() {
    startTransition(async () => {
      await saveYard({ yard_id: editing?.yard_id, ...form })
      cancelForm()
      notify(editing ? 'Yard updated.' : 'Yard added.')
    })
  }

  function handleDelete(yardId: number, name: string) {
    if (!confirm(`Delete yard "${name}"? Drivers assigned to it will lose their yard.`)) return
    startTransition(async () => {
      await deleteYard(yardId)
      notify('Yard deleted.')
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Yard Locations</h2>
        <button
          onClick={startAdd}
          className="text-xs bg-gray-900 hover:bg-gray-800 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
        >
          + Add Yard
        </button>
      </div>

      {feedback && (
        <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          {feedback}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500 uppercase tracking-wide">
              <th className="pb-2 pr-4 font-medium">Name</th>
              <th className="pb-2 pr-4 font-medium">Address</th>
              <th className="pb-2 pr-4 font-medium">City</th>
              <th className="pb-2 pr-4 font-medium">State</th>
              <th className="pb-2 pr-4 font-medium">Lat</th>
              <th className="pb-2 pr-4 font-medium">Lng</th>
              <th className="pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {yards.map(yard => (
              <tr key={yard.yard_id} className="hover:bg-gray-50">
                <td className="py-2 pr-4 font-medium text-gray-900">{yard.yard_name}</td>
                <td className="py-2 pr-4 text-gray-600">{yard.address ?? '—'}</td>
                <td className="py-2 pr-4 text-gray-600">{yard.city ?? '—'}</td>
                <td className="py-2 pr-4 text-gray-600">{yard.state ?? '—'}</td>
                <td className="py-2 pr-4 text-gray-500 font-mono">{yard.latitude ?? '—'}</td>
                <td className="py-2 pr-4 text-gray-500 font-mono">{yard.longitude ?? '—'}</td>
                <td className="py-2 whitespace-nowrap">
                  <button onClick={() => startEdit(yard)} className="text-blue-600 hover:underline mr-3">Edit</button>
                  <button onClick={() => handleDelete(yard.yard_id, yard.yard_name)} className="text-red-600 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
            {yards.length === 0 && (
              <tr><td colSpan={7} className="py-6 text-center text-gray-400">No yards yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">{editing ? 'Edit Yard' : 'Add Yard'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Yard Name</label>
              <input
                value={form.yard_name}
                onChange={e => setForm(f => ({ ...f, yard_name: e.target.value }))}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
                placeholder="e.g. Dallas"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
              <input
                value={form.address ?? ''}
                onChange={e => setForm(f => ({ ...f, address: e.target.value || null }))}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
                placeholder="Street address"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
              <input
                value={form.city ?? ''}
                onChange={e => setForm(f => ({ ...f, city: e.target.value || null }))}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
              <input
                value={form.state ?? ''}
                onChange={e => setForm(f => ({ ...f, state: e.target.value || null }))}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
                placeholder="TX"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Latitude</label>
              <input
                type="number"
                step="0.0001"
                value={form.latitude ?? ''}
                onChange={e => setForm(f => ({ ...f, latitude: e.target.value ? parseFloat(e.target.value) : null }))}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-400 font-mono"
                placeholder="32.8211"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Longitude</label>
              <input
                type="number"
                step="0.0001"
                value={form.longitude ?? ''}
                onChange={e => setForm(f => ({ ...f, longitude: e.target.value ? parseFloat(e.target.value) : null }))}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-400 font-mono"
                placeholder="-96.8543"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={isPending || !form.yard_name.trim()}
              className="text-xs bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg font-medium transition-colors"
            >
              {isPending ? 'Saving…' : editing ? 'Save Changes' : 'Add Yard'}
            </button>
            <button
              onClick={cancelForm}
              className="text-xs border border-gray-300 hover:border-gray-400 text-gray-700 px-4 py-1.5 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

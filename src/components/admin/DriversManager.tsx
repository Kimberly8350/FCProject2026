'use client'

import { useState, useTransition } from 'react'
import { Driver, Yard } from '@/types'
import { saveDriver, deleteDriver, syncDriversFromLoads } from '@/app/actions/admin'

interface Props {
  drivers: Driver[]
  yards: Yard[]
}

const EMPTY = {
  first_name: '',
  last_name: '',
  yard_id: null as number | null,
  default_start_time: '06:00',
  active: true,
}

function fmt12(timeStr: string): string {
  // "06:00:00" or "06:00" → "6:00 AM"
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function toTimeInput(timeStr: string): string {
  // "06:00:00" → "06:00"
  return timeStr.slice(0, 5)
}

export default function DriversManager({ drivers, yards }: Props) {
  const [editing, setEditing] = useState<Driver | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [showForm, setShowForm] = useState(false)
  const [filterYard, setFilterYard] = useState<string>('all')
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)

  function notify(msg: string) {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 4000)
  }

  function startEdit(driver: Driver) {
    setEditing(driver)
    setForm({
      first_name: driver.first_name,
      last_name: driver.last_name,
      yard_id: driver.yard_id,
      default_start_time: toTimeInput(driver.default_start_time),
      active: driver.active,
    })
    setShowForm(true)
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
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
      await saveDriver({
        driver_id: editing?.driver_id,
        ...form,
        default_start_time: form.default_start_time + ':00',
      })
      cancelForm()
      notify(editing ? 'Driver updated.' : 'Driver added.')
    })
  }

  function handleDelete(driverId: number, name: string) {
    if (!confirm(`Remove driver "${name}"?`)) return
    startTransition(async () => {
      await deleteDriver(driverId)
      notify('Driver removed.')
    })
  }

  function handleSync() {
    startTransition(async () => {
      const { created } = await syncDriversFromLoads()
      notify(created > 0 ? `${created} new driver(s) added from today's loads.` : "All drivers from today's loads are already in the list.")
    })
  }

  const displayed = filterYard === 'all'
    ? drivers
    : filterYard === 'none'
      ? drivers.filter(d => !d.yard_id)
      : drivers.filter(d => d.yard_id === parseInt(filterYard))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-800">Drivers</h2>
          <span className="text-xs text-gray-500 bg-gray-200 rounded-full px-2 py-0.5">{drivers.length}</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={filterYard}
            onChange={e => setFilterYard(e.target.value)}
            className="text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-400"
          >
            <option value="all">All yards</option>
            {yards.map(y => (
              <option key={y.yard_id} value={y.yard_id}>{y.yard_name}</option>
            ))}
            <option value="none">No yard assigned</option>
          </select>
          <button
            onClick={handleSync}
            disabled={isPending}
            className="text-xs border border-gray-300 hover:border-gray-400 text-gray-700 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            Sync from Today's Loads
          </button>
          <button
            onClick={startAdd}
            className="text-xs bg-gray-900 hover:bg-gray-800 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
          >
            + Add Driver
          </button>
        </div>
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
              <th className="pb-2 pr-4 font-medium">Last Name</th>
              <th className="pb-2 pr-4 font-medium">First Name</th>
              <th className="pb-2 pr-4 font-medium">Home Yard</th>
              <th className="pb-2 pr-4 font-medium">Start Time</th>
              <th className="pb-2 pr-4 font-medium">Active</th>
              <th className="pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayed.map(driver => (
              <tr key={driver.driver_id} className={`hover:bg-gray-50 ${!driver.active ? 'opacity-50' : ''}`}>
                <td className="py-2 pr-4 font-medium text-gray-900">{driver.last_name}</td>
                <td className="py-2 pr-4 text-gray-700">{driver.first_name}</td>
                <td className="py-2 pr-4 text-gray-600">
                  {driver.yard?.yard_name ?? (
                    <span className="text-orange-500 font-medium">⚠ Not set</span>
                  )}
                </td>
                <td className="py-2 pr-4 text-gray-600 font-mono">
                  {fmt12(driver.default_start_time)}
                </td>
                <td className="py-2 pr-4">
                  <span className={`px-1.5 py-0.5 rounded-full font-medium ${driver.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {driver.active ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="py-2 whitespace-nowrap">
                  <button onClick={() => startEdit(driver)} className="text-blue-600 hover:underline mr-3">Edit</button>
                  <button onClick={() => handleDelete(driver.driver_id, `${driver.first_name} ${driver.last_name}`)} className="text-red-600 hover:underline">Remove</button>
                </td>
              </tr>
            ))}
            {displayed.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-gray-400">No drivers found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">{editing ? 'Edit Driver' : 'Add Driver'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">First Name</label>
              <input
                value={form.first_name}
                onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Last Name</label>
              <input
                value={form.last_name}
                onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Home Yard</label>
              <select
                value={form.yard_id ?? ''}
                onChange={e => setForm(f => ({ ...f, yard_id: e.target.value ? parseInt(e.target.value) : null }))}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
              >
                <option value="">— Not assigned —</option>
                {yards.map(y => (
                  <option key={y.yard_id} value={y.yard_id}>{y.yard_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Default Start Time</label>
              <input
                type="time"
                value={form.default_start_time}
                onChange={e => setForm(f => ({ ...f, default_start_time: e.target.value }))}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.active}
              onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
              className="rounded"
            />
            Active driver
          </label>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={isPending || !form.first_name.trim() || !form.last_name.trim()}
              className="text-xs bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg font-medium transition-colors"
            >
              {isPending ? 'Saving…' : editing ? 'Save Changes' : 'Add Driver'}
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

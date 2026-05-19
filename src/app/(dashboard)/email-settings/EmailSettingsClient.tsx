'use client'

import { useState, useTransition } from 'react'
import { updateEmailNotification, addEmailNotification, deleteEmailNotification } from '@/app/actions/email'

interface Email {
  email_id: number
  name: string
  email: string
  send: boolean
  receive: boolean
  active: boolean
}

export default function EmailSettingsClient({ emails: initial }: { emails: Email[] }) {
  const [emails, setEmails] = useState(initial)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newSend, setNewSend] = useState(false)
  const [newReceive, setNewReceive] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  async function handleToggle(id: number, field: 'send' | 'receive' | 'active', value: boolean) {
    setEmails(prev => prev.map(e => e.email_id === id ? { ...e, [field]: value } : e))
    startTransition(async () => {
      await updateEmailNotification({ emailId: id, field, value })
    })
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!newEmail.includes('@')) { setError('Enter a valid email address.'); return }
    startTransition(async () => {
      const result = await addEmailNotification({ name: newName, email: newEmail, send: newSend, receive: newReceive })
      if (result?.error) {
        setError(result.error)
        return
      }
      if (result?.record) {
        setEmails(prev => [...prev, result.record as Email])
      }
      setNewName(''); setNewEmail(''); setNewSend(false); setNewReceive(false)
    })
  }

  async function handleDelete(id: number) {
    setEmails(prev => prev.filter(e => e.email_id !== id))
    startTransition(async () => {
      await deleteEmailNotification({ emailId: id })
    })
  }

  return (
    <div className="space-y-6">
      {/* Existing emails */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Name</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Email</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Send</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Receive</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Active</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {emails.map(e => (
              <tr key={e.email_id} className={`hover:bg-gray-50 transition-colors ${!e.active ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 text-gray-900 font-medium">{e.name}</td>
                <td className="px-4 py-3 text-gray-600 font-mono text-xs">{e.email}</td>
                <td className="px-4 py-3 text-center">
                  <Toggle checked={e.send} onChange={v => handleToggle(e.email_id, 'send', v)} />
                </td>
                <td className="px-4 py-3 text-center">
                  <Toggle checked={e.receive} onChange={v => handleToggle(e.email_id, 'receive', v)} />
                </td>
                <td className="px-4 py-3 text-center">
                  <Toggle checked={e.active} onChange={v => handleToggle(e.email_id, 'active', v)} />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDelete(e.email_id)}
                    className="text-xs text-red-500 hover:text-red-700 transition-colors"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add new email */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-4">Add email address</h2>
        <form onSubmit={handleAdd} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              required
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-red-400"
              placeholder="Jane Smith"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              required
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-red-400"
              placeholder="jane@example.com"
            />
          </div>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="checkbox" checked={newSend} onChange={e => setNewSend(e.target.checked)} className="rounded" />
            Send
          </label>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="checkbox" checked={newReceive} onChange={e => setNewReceive(e.target.checked)} className="rounded" />
            Receive
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
          >
            Add
          </button>
        </form>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-red-600' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-1'}`} />
    </button>
  )
}

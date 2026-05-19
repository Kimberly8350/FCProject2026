'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

export default function DatePicker({ selectedDate }: { selectedDate: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('date', e.target.value)
      router.push(`/loads?${params.toString()}`)
    },
    [router, searchParams]
  )

  return (
    <input
      type="date"
      value={selectedDate}
      onChange={handleChange}
      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
    />
  )
}

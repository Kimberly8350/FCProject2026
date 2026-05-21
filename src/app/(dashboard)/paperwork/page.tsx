import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export default async function PaperworkPage() {
  const supabase = await createClient()

  const { data: paperwork } = await supabase
    .from('paperwork')
    .select('id, ce_id, file_name, storage_path, uploaded_at')
    .order('uploaded_at', { ascending: false })

  // Join with loads to get site name and delivery date
  const ceIds = [...new Set((paperwork ?? []).map(p => p.ce_id))]
  const { data: loads } = ceIds.length
    ? await supabase
        .from('loads')
        .select('ce_id, site_name, delivery_date')
        .in('ce_id', ceIds)
    : { data: [] }

  const loadMap = Object.fromEntries((loads ?? []).map(l => [l.ce_id, l]))

  // Generate signed URLs server-side using service client — bypasses bucket RLS
  const sb = await createServiceClient()
  const signedUrlMap: Record<string, string> = {}
  if (paperwork && paperwork.length > 0) {
    await Promise.all(
      paperwork.map(async (p) => {
        const { data } = await sb.storage
          .from('paperwork')
          .createSignedUrl(p.storage_path, 3600) // 1-hour expiry
        if (data?.signedUrl) {
          signedUrlMap[p.id] = data.signedUrl
        }
      })
    )
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Paperwork</h1>

      {(!paperwork || paperwork.length === 0) ? (
        <div className="text-center py-20 text-gray-500">
          No paperwork uploaded yet. BOL PDFs from dispatch will appear here automatically.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">CE ID</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Site</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Delivery Date</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">File</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Uploaded</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paperwork.map(p => {
                const load = loadMap[p.ce_id]
                const pdfUrl = signedUrlMap[p.id]
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-gray-900">#{p.ce_id}</td>
                    <td className="px-4 py-3 text-gray-700">{load?.site_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{load?.delivery_date ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{p.file_name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(p.uploaded_at).toLocaleString('en-US', {
                        timeZone: 'America/Chicago',
                        month: 'short', day: 'numeric',
                        hour: 'numeric', minute: '2-digit', hour12: true,
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {pdfUrl ? (
                        <a
                          href={pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-red-600 hover:text-red-700 font-medium"
                        >
                          View PDF
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">Unavailable</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const storagePath = searchParams.get('path')
  const fileName = searchParams.get('name') ?? 'document.pdf'

  if (!storagePath) {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 })
  }

  // Enforce auth at the API level
  const userClient = await createClient()
  const { data: userData, error: authError } = await userClient.auth.getUser()
  if (authError || !userData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use service client for storage — bypasses bucket RLS so the download always works
  const sb = await createServiceClient()
  const { data: fileData, error: downloadError } = await sb.storage
    .from('paperwork')
    .download(storagePath)

  if (downloadError || !fileData) {
    console.error('Paperwork download error:', downloadError?.message, 'path:', storagePath)
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  const buffer = await fileData.arrayBuffer()

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Content-Length': String(buffer.byteLength),
      'Cache-Control': 'private, max-age=300',
    },
  })
}

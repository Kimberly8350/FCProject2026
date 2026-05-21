import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const storagePath = searchParams.get('path')

  if (!storagePath) {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 })
  }

  // Enforce authentication at the API level
  const userClient = await createClient()
  const { data: userData, error: authError } = await userClient.auth.getUser()
  if (authError || !userData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use service client to create signed URL — bypasses bucket RLS entirely
  const sb = await createServiceClient()
  const { data: signed, error: signErr } = await sb.storage
    .from('paperwork')
    .createSignedUrl(storagePath, 300) // 5-minute window

  if (signErr || !signed?.signedUrl) {
    console.error('Paperwork signed URL error:', signErr?.message, 'path:', storagePath)
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  return NextResponse.redirect(signed.signedUrl)
}

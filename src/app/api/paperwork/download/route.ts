import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const storagePath = searchParams.get('path')
  const fileName = searchParams.get('name') ?? 'document.pdf'

  if (!storagePath) {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from('paperwork')
    .createSignedUrl(storagePath, 60) // 60-second expiry

  if (signErr || !signed?.signedUrl) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  return NextResponse.redirect(signed.signedUrl)
}

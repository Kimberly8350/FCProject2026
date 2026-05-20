import { createClient } from '@/lib/supabase/server'
import DriversManager from '@/components/admin/DriversManager'

export default async function DriversPage() {
  const supabase = await createClient()

  const [{ data: drivers }, { data: yards }] = await Promise.all([
    supabase
      .from('drivers')
      .select('*, yard:yards(*)')
      .order('last_name'),
    supabase
      .from('yards')
      .select('*')
      .order('yard_name'),
  ])

  return <DriversManager drivers={drivers ?? []} yards={yards ?? []} />
}

import { createClient } from '@/lib/supabase/server'
import YardsManager from '@/components/admin/YardsManager'

export default async function YardsPage() {
  const supabase = await createClient()
  const { data: yards } = await supabase
    .from('yards')
    .select('*')
    .order('yard_name')

  return <YardsManager yards={yards ?? []} />
}

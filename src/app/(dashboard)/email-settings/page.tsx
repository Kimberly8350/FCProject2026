import { createClient } from '@/lib/supabase/server'
import EmailSettingsClient from './EmailSettingsClient'

export default async function EmailSettingsPage() {
  const supabase = await createClient()
  const { data: emails } = await supabase
    .from('email_notifications')
    .select('*')
    .order('email_id')

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">Email Settings</h1>
      <p className="text-sm text-gray-500 mb-6">
        Manage which addresses send and receive dispatch notifications.
        <br />
        <strong>Send</strong> = this address can reply to portal notifications.
        <strong> Receive</strong> = this address gets all load change emails.
      </p>
      <EmailSettingsClient emails={emails ?? []} />
    </div>
  )
}

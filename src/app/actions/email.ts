'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'

export async function updateEmailNotification(input: {
  emailId: number
  field: 'send' | 'receive' | 'active'
  value: boolean
}) {
  const sb = await createServiceClient()
  await sb.from('email_notifications')
    .update({ [input.field]: input.value })
    .eq('email_id', input.emailId)
  revalidatePath('/email-settings')
}

export async function addEmailNotification(input: {
  name: string
  email: string
  send: boolean
  receive: boolean
}) {
  const sb = await createServiceClient()

  const { data, error } = await sb.from('email_notifications').insert({
    name: input.name,
    email: input.email,
    send: input.send,
    receive: input.receive,
    active: true,
  }).select().single()

  if (error) {
    if (error.code === '23505') return { error: 'That email address already exists.' }
    return { error: error.message }
  }

  revalidatePath('/email-settings')
  return { record: data }
}

export async function deleteEmailNotification(input: { emailId: number }) {
  const sb = await createServiceClient()
  await sb.from('email_notifications').delete().eq('email_id', input.emailId)
  revalidatePath('/email-settings')
}

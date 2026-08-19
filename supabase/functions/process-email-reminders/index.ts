import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const MAX_ATTEMPTS = 3

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(url, serviceKey)

  // Atomically claim due reminders (FOR UPDATE SKIP LOCKED) — no double processing
  const { data: claimed, error } = await supabase.rpc('claim_due_email_reminders', { batch_size: 25 })
  if (error) {
    console.error('claim failed', error)
    return new Response(JSON.stringify({ error: 'claim_failed', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let sent = 0
  let failed = 0

  for (const reminder of claimed ?? []) {
    try {
      const res = await fetch(`${url}/functions/v1/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({
          templateName: reminder.email_type,
          emailType: reminder.email_type,
          companyId: reminder.company_id,
          recipientEmail: reminder.recipient_email,
          idempotencyKey: `reminder-${reminder.id}`,
          templateData: reminder.payload ?? {},
        }),
      })
      const bodyText = await res.text()
      if (!res.ok) throw new Error(`[${res.status}] ${bodyText}`)

      await supabase
        .from('scheduled_email_reminders')
        .update({ status: 'sent', sent_at: new Date().toISOString(), error_message: null })
        .eq('id', reminder.id)
      sent++
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('reminder failed', reminder.id, message)
      await supabase
        .from('scheduled_email_reminders')
        .update({
          status: reminder.attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
          error_message: message.slice(0, 2000),
        })
        .eq('id', reminder.id)
      failed++
    }
  }

  return new Response(JSON.stringify({ claimed: claimed?.length ?? 0, sent, failed }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

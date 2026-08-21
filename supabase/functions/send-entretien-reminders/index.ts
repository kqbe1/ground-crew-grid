import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

function getWeekdayProposal(value: string): string {
  const date = new Date(`${value}T12:00:00`)
  const day = date.getDay()

  if (day === 6) date.setDate(date.getDate() - 1) // samedi → vendredi
  if (day === 0) date.setDate(date.getDate() - 2) // dimanche → vendredi

  return date.toISOString().slice(0, 10)
}

const INTERVENTION_LABELS: Record<string, string> = {
  entretien_gaz: 'Entretien gaz',
  entretien_mazout: 'Entretien mazout',
  entretien_pellets: 'Entretien pellets',
  entretien_clim: 'Entretien climatisation',
  entretien_vmc: 'Entretien VMC',
  entretien_boiler: 'Entretien boiler',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(url, serviceKey)

  const { data: settingsRows } = await supabase
    .from('email_settings')
    .select('company_id, auto_reminder_enabled, reminder_days_before, subject, intro_text, footer_text, contact_phone, contact_email')
    .eq('template_key', 'rappel-entretien')

  const settingsByCompany = new Map<string, any>()
  ;(settingsRows ?? []).forEach((r: any) => settingsByCompany.set(r.company_id ?? 'global', r))

  const maxDays = Math.max(
    30,
    ...(settingsRows ?? []).map((r: any) => r.reminder_days_before ?? 30),
  )
  const horizon = new Date(Date.now() + maxDays * 86400000).toISOString().slice(0, 10)

  const { data: schedules, error } = await supabase
    .from('maintenance_schedules')
    .select('id, company_id, intervention_type, next_due_date, reminder_sent_at, reminder_sent_for_date, clients(name, email), client_equipment(name, brand, model, energy_type)')
    .eq('status', 'actif')
    .lte('next_due_date', horizon)

  if (error) {
    console.error('query failed', error)
    return new Response(JSON.stringify({ error: 'query_failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let sent = 0
  let skipped = 0

  for (const s of schedules ?? []) {
    // Idempotence par échéance : un rappel au maximum par date d'échéance.
    if (s.reminder_sent_for_date === s.next_due_date) { skipped++; continue }
    // Legacy : rappel déjà envoyé avant l'introduction de reminder_sent_for_date
    if (s.reminder_sent_at && !s.reminder_sent_for_date) { skipped++; continue }
    const settings = settingsByCompany.get(s.company_id) ?? settingsByCompany.get('global')

    const autoReminderEnabled = settings?.auto_reminder_enabled ?? true
    if (!autoReminderEnabled) { skipped++; continue }

    const days = settings?.reminder_days_before ?? 30
    const limit = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
    if (s.next_due_date > limit) { skipped++; continue }

    const client: any = s.clients
    const equipment: any = s.client_equipment ?? {}
    if (!client?.email) { skipped++; continue } // notification in-app only (alertes légales)

    const res = await fetch(`${url}/functions/v1/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({
        templateName: 'rappel-entretien',
        emailType: 'rappel-entretien',
        companyId: s.company_id,
        recipientEmail: client.email,
        idempotencyKey: `entretien-auto-${s.id}-${s.next_due_date}`,
        templateData: {
          clientName: client.name ?? '—',
          equipmentName: [equipment.name, equipment.brand, equipment.model].filter(Boolean).join(' '),
          energyType: equipment.energy_type ?? '',
          interventionType: INTERVENTION_LABELS[s.intervention_type] ?? 'Entretien',
          dueDate: getWeekdayProposal(s.next_due_date),
          contactPhone: settings?.contact_phone ?? '',
          contactEmail: settings?.contact_email ?? '',
          customSubject: settings?.subject ?? '',
          introText: settings?.intro_text ?? undefined,
          footerText: settings?.footer_text ?? undefined,
        },
      }),
    })

    if (!res.ok) {
      console.error('send failed', s.id, await res.text())
      continue
    }
    await supabase
      .from('maintenance_schedules')
      .update({ reminder_sent_at: new Date().toISOString(), reminder_sent_for_date: s.next_due_date })
      .eq('id', s.id)
      .eq('next_due_date', s.next_due_date)
    sent++
  }

  return new Response(JSON.stringify({ sent, skipped }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

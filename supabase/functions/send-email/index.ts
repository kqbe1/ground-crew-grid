import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

const RESEND_API = 'https://api.resend.com/emails'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendKey = Deno.env.get('RESEND_API_KEY')
  console.log('[send-email debug] SUPABASE_SERVICE_ROLE_KEY available:', !!serviceKey, 'length:', serviceKey?.length ?? 0)
  if (!supabaseUrl || !serviceKey) return json({ error: 'Server configuration error' }, 500)
  if (!resendKey) return json({ error: 'RESEND_API_KEY is not configured' }, 500)

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON in request body' }, 400)
  }

  const templateName: string = body.templateName || body.template_name
  const recipientEmail: string = body.recipientEmail || body.recipient_email
  const templateData: Record<string, any> =
    body.templateData && typeof body.templateData === 'object' ? body.templateData : {}
  const emailType: string = body.emailType || templateName

  if (!templateName) return json({ error: 'templateName is required' }, 400)

  const template = TEMPLATES[templateName]
  if (!template) {
    return json(
      { error: `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}` },
      404,
    )
  }

  const effectiveRecipient: string | undefined = template.to || recipientEmail
  if (!effectiveRecipient) return json({ error: 'recipientEmail is required' }, 400)

  const admin = createClient(supabaseUrl, serviceKey)

  // --- Resolve the company server-side (never trust a client-supplied company_id) ---
  const authHeader = req.headers.get('Authorization') ?? ''
  const bearer = authHeader.replace(/^Bearer\s+/i, '')
  const isServiceCall = bearer === serviceKey

  let companyId: string | null = null
  if (isServiceCall) {
    companyId = body.companyId || body.company_id || null
  } else {
    const { data: userData } = await admin.auth.getUser(bearer)
    const uid = userData?.user?.id
    if (!uid) return json({ error: 'Unauthorized' }, 401)
    const { data: profile } = await admin
      .from('profiles')
      .select('company_id')
      .eq('id', uid)
      .maybeSingle()
    companyId = profile?.company_id ?? null
  }

  // --- Company email configuration + fallback ---
  let settings: any = null
  if (companyId) {
    const { data } = await admin
      .from('company_email_settings')
      .select('sender_name, sender_email, reply_to_email, is_active')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .maybeSingle()
    settings = data
  }

  const senderEmail = settings?.sender_email || Deno.env.get('DEFAULT_FROM_EMAIL')
  const senderName = settings?.sender_name || Deno.env.get('DEFAULT_FROM_NAME') || 'Notifications'
  const replyTo = settings?.reply_to_email || Deno.env.get('DEFAULT_REPLY_TO_EMAIL') || undefined

  if (!senderEmail) {
    await admin.from('email_logs').insert({
      company_id: companyId,
      recipient_email: effectiveRecipient,
      email_type: emailType,
      status: 'failed',
      error_message: 'No email configuration for this company and no system default',
    })
    return json(
      {
        error:
          "Aucune configuration e-mail n'est définie pour cette entreprise et aucune configuration système par défaut n'est disponible.",
      },
      400,
    )
  }

  // --- Suppression list (fail closed) ---
  const normalized = effectiveRecipient.toLowerCase()
  const { data: suppressed, error: suppressionError } = await admin
    .from('suppressed_emails')
    .select('id')
    .eq('email', normalized)
    .maybeSingle()

  if (suppressionError) return json({ error: 'Failed to verify suppression status' }, 500)

  if (suppressed) {
    await admin.from('email_logs').insert({
      company_id: companyId,
      recipient_email: effectiveRecipient,
      sender_email: senderEmail,
      reply_to_email: replyTo,
      email_type: emailType,
      status: 'suppressed',
    })
    return json({ success: false, reason: 'email_suppressed' })
  }

  // --- Render ---
  const html = await renderAsync(React.createElement(template.component, templateData))
  const text = await renderAsync(React.createElement(template.component, templateData), {
    plainText: true,
  })
  const subject =
    templateData.customSubject ||
    (typeof template.subject === 'function' ? template.subject(templateData) : template.subject)

  const { data: logRow } = await admin
    .from('email_logs')
    .insert({
      company_id: companyId,
      recipient_email: effectiveRecipient,
      sender_email: senderEmail,
      reply_to_email: replyTo,
      subject,
      email_type: emailType,
      status: 'pending',
    })
    .select('id')
    .maybeSingle()

  // --- Send via Resend ---
  let res: Response
  try {
    res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendKey}`,
        ...(body.idempotencyKey ? { 'Idempotency-Key': String(body.idempotencyKey) } : {}),
      },
      body: JSON.stringify({
        from: `${senderName} <${senderEmail}>`,
        to: [effectiveRecipient],
        subject,
        html,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (logRow) {
      await admin.from('email_logs').update({ status: 'failed', error_message: message }).eq('id', logRow.id)
    }
    return json({ error: 'Email provider unreachable', details: message }, 502)
  }

  const raw = await res.text()
  if (!res.ok) {
    console.error(`Resend request failed [${res.status}]: ${raw}`)
    if (logRow) {
      await admin
        .from('email_logs')
        .update({ status: 'failed', error_message: `[${res.status}] ${raw}`.slice(0, 2000) })
        .eq('id', logRow.id)
    }
    return json({ error: 'Email provider error', status: res.status, details: raw }, res.status)
  }

  let resendId: string | null = null
  try {
    resendId = JSON.parse(raw)?.id ?? null
  } catch {
    // ignore
  }

  if (logRow) {
    await admin
      .from('email_logs')
      .update({ status: 'sent', resend_id: resendId, sent_at: new Date().toISOString() })
      .eq('id', logRow.id)
  }

  return json({ success: true, id: resendId, from: senderEmail, replyTo: replyTo ?? null })
})

import { createClient } from 'npm:@supabase/supabase-js@2'

// Resend webhook events we care about.
type SuppressionReason = 'bounce' | 'complaint' | 'unsubscribe'

interface ResendEvent {
  type: string
  created_at?: string
  data?: {
    email_id?: string
    to?: string[] | string
    subject?: string
    bounce?: Record<string, unknown>
    [key: string]: unknown
  }
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function redact(email: string): string {
  const [, domain] = email.split('@')
  return `${email[0] ?? '?'}***@${domain ?? 'unknown'}`
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/**
 * Standard Webhooks / Svix signature verification (used by Resend).
 * Signed content is `${svix-id}.${svix-timestamp}.${rawBody}` with HMAC-SHA256
 * over the base64 secret (prefixed with `whsec_`).
 */
async function verifySvixSignature(params: {
  secret: string
  rawBody: string
  svixId: string
  svixTimestamp: string
  svixSignature: string
}): Promise<boolean> {
  const { secret, rawBody, svixId, svixTimestamp, svixSignature } = params

  // Replay protection: 5 minutes tolerance
  const ts = Number(svixTimestamp)
  if (!Number.isFinite(ts)) return false
  const nowSeconds = Math.floor(Date.now() / 1000)
  if (Math.abs(nowSeconds - ts) > 300) return false

  const rawSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret
  let keyBytes: Uint8Array
  try {
    keyBytes = base64ToBytes(rawSecret)
  } catch {
    keyBytes = new TextEncoder().encode(rawSecret)
  }

  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signed = new TextEncoder().encode(`${svixId}.${svixTimestamp}.${rawBody}`)
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, signed))

  // Header format: "v1,<base64> v1,<base64> ..."
  for (const part of svixSignature.split(' ')) {
    const [version, value] = part.split(',')
    if (version !== 'v1' || !value) continue
    try {
      if (timingSafeEqual(mac, base64ToBytes(value))) return true
    } catch {
      // ignore malformed signature entry
    }
  }
  return false
}

function mapEvent(type: string): { reason: SuppressionReason; status: string; message: string } | null {
  switch (type) {
    case 'email.bounced':
      return {
        reason: 'bounce',
        status: 'bounced',
        message: 'Permanent bounce — email address is invalid or rejected',
      }
    case 'email.complained':
      return {
        reason: 'complaint',
        status: 'complained',
        message: 'Spam complaint — recipient marked email as spam',
      }
    default:
      return null
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables')
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  const rawBody = await req.text()
  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error('Missing svix signature headers')
    return jsonResponse({ error: 'Missing signature headers' }, 401)
  }

  const valid = await verifySvixSignature({
    secret: webhookSecret,
    rawBody,
    svixId,
    svixTimestamp,
    svixSignature,
  })

  if (!valid) {
    console.error('Invalid webhook signature')
    return jsonResponse({ error: 'Invalid signature' }, 401)
  }

  // Signature verified — safe to parse the payload
  let event: ResendEvent
  try {
    event = JSON.parse(rawBody) as ResendEvent
  } catch {
    console.error('Invalid JSON payload')
    return jsonResponse({ error: 'Invalid payload' }, 400)
  }

  const mapped = event?.type ? mapEvent(event.type) : null
  if (!mapped) {
    // Unhandled event: acknowledge to avoid Resend retries
    console.log('Ignored Resend event', { type: event?.type ?? 'unknown' })
    return jsonResponse({ success: true, ignored: true })
  }

  const rawRecipients = event.data?.to
  const recipients = (Array.isArray(rawRecipients) ? rawRecipients : rawRecipients ? [rawRecipients] : [])
    .filter((e): e is string => typeof e === 'string' && e.includes('@'))
    .map((e) => e.toLowerCase())

  if (recipients.length === 0) {
    console.error('No recipient in webhook payload', { type: event.type })
    return jsonResponse({ error: 'Missing recipient' }, 400)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const messageId = event.data?.email_id ?? null

  const metadata = {
    event_type: event.type,
    resend_email_id: messageId,
    created_at: event.created_at ?? null,
    subject: event.data?.subject ?? null,
    bounce: event.data?.bounce ?? null,
  }

  for (const email of recipients) {
    const { error: suppressError } = await supabase
      .from('suppressed_emails')
      .upsert(
        { email, reason: mapped.reason, metadata },
        { onConflict: 'email' },
      )

    if (suppressError) {
      console.error('Failed to upsert suppressed email', {
        error: suppressError,
        email_redacted: redact(email),
      })
      return jsonResponse({ error: 'Failed to write suppression' }, 500)
    }

    // Idempotence: skip if this exact event was already logged
    if (messageId) {
      const { data: existing, error: lookupError } = await supabase
        .from('email_send_log')
        .select('id')
        .eq('message_id', messageId)
        .eq('recipient_email', email)
        .eq('status', mapped.status)
        .limit(1)

      if (!lookupError && existing && existing.length > 0) {
        continue
      }
    }

    const { error: insertError } = await supabase
      .from('email_send_log')
      .insert({
        message_id: messageId,
        template_name: 'system',
        recipient_email: email,
        status: mapped.status,
        error_message: mapped.message,
        metadata,
      })

    if (insertError) {
      // Non-fatal — the suppression itself was recorded
      console.warn('Failed to insert email_send_log', { error: insertError })
    }
  }

  console.log('Suppression processed', {
    type: event.type,
    reason: mapped.reason,
    recipients: recipients.map(redact),
    has_message_id: !!messageId,
  })

  return jsonResponse({ success: true })
})

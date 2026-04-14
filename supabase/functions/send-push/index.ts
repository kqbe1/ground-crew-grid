const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.97.0'

interface PushPayload {
  user_ids: string[]
  title: string
  body: string
  data?: Record<string, string>
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate auth - must be admin/secretariat or service role
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Verify caller is admin/secretariat
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: caller }, error: userErr } = await supabaseUser.auth.getUser()
    if (userErr || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify caller has admin/bureau/super_admin role
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role, company_id')
      .eq('id', caller.id)
      .single()

    if (!callerProfile || !['admin', 'bureau', 'super_admin'].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload: PushPayload = await req.json()
    if (!payload.user_ids?.length || !payload.title) {
      return new Response(JSON.stringify({ error: 'Missing user_ids or title' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get FCM server key
    const fcmServerKey = Deno.env.get('FCM_SERVER_KEY')
    if (!fcmServerKey) {
      return new Response(JSON.stringify({ error: 'FCM_SERVER_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch tokens for target users
    const { data: tokens, error: tokensErr } = await supabaseAdmin
      .from('push_tokens')
      .select('token, user_id')
      .in('user_id', payload.user_ids)

    if (tokensErr) {
      return new Response(JSON.stringify({ error: tokensErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!tokens?.length) {
      return new Response(JSON.stringify({ sent: 0, message: 'No tokens found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Send via FCM legacy API
    const results = await Promise.allSettled(
      tokens.map(async (t) => {
        const res = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `key=${fcmServerKey}`,
          },
          body: JSON.stringify({
            to: t.token,
            notification: {
              title: payload.title,
              body: payload.body,
              icon: '/pwa-192x192.png',
            },
            data: payload.data ?? {},
          }),
        })
        const text = await res.text()
        if (!res.ok) throw new Error(text)

        // Clean up invalid tokens
        const parsed = JSON.parse(text)
        if (parsed.failure > 0) {
          const result = parsed.results?.[0]
          if (
            result?.error === 'InvalidRegistration' ||
            result?.error === 'NotRegistered'
          ) {
            await supabaseAdmin.from('push_tokens').delete().eq('token', t.token)
          }
        }
        return parsed
      })
    )

    const sent = results.filter((r) => r.status === 'fulfilled').length

    return new Response(JSON.stringify({ sent, total: tokens.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

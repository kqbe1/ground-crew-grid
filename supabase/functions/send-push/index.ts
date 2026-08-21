const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { importPKCS8, SignJWT } from "npm:jose@5.10.0";

interface PushPayload {
  user_ids: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

const FIREBASE_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

async function getFirebaseAccessToken() {
  const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL");
  const projectId = Deno.env.get("FIREBASE_PROJECT_ID");
  const privateKeyB64 = Deno.env.get("FIREBASE_PRIVATE_KEY_B64");

  if (!clientEmail || !projectId || !privateKeyB64) {
    throw new Error("Firebase service account secrets are not configured");
  }

  const privateKeyPem = new TextDecoder().decode(
    Uint8Array.from(atob(privateKeyB64), (c) => c.charCodeAt(0)),
  );

  const privateKey = await importPKCS8(privateKeyPem, "RS256");

  const now = Math.floor(Date.now() / 1000);

  const assertion = await new SignJWT({
    scope: FIREBASE_SCOPE,
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(clientEmail)
    .setSubject(clientEmail)
    .setAudience(GOOGLE_TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const tokenJson = await tokenResponse.json();

  if (!tokenResponse.ok || !tokenJson.access_token) {
    console.error("[send-push] OAuth token error", tokenJson);
    throw new Error("Unable to obtain Firebase access token");
  }

  return {
    accessToken: tokenJson.access_token as string,
    projectId,
  };
}

function isInvalidFcmToken(status: number, body: any) {
  if (status === 404 && body?.error?.status === "NOT_FOUND") {
    return true;
  }

  if (body?.error?.status === "UNREGISTERED") {
    return true;
  }

  const details = body?.error?.details;
  if (Array.isArray(details)) {
    return details.some(
      (detail) =>
        detail?.errorCode === "UNREGISTERED" ||
        detail?.errorCode === "INVALID_ARGUMENT",
    );
  }

  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(
        JSON.stringify({ error: "Supabase server configuration incomplete" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user: caller },
      error: userErr,
    } = await supabaseUser.auth.getUser();

    if (userErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("role, company_id, is_active")
      .eq("id", caller.id)
      .single();

    if (
      profileErr ||
      !callerProfile ||
      callerProfile.is_active === false ||
      !["admin", "bureau", "super_admin"].includes(callerProfile.role)
    ) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: PushPayload = await req.json();

    if (!payload.user_ids?.length || !payload.title) {
      return new Response(
        JSON.stringify({ error: "Missing user_ids or title" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let allowedUserIds = payload.user_ids;

    if (callerProfile.role !== "super_admin") {
      if (!callerProfile.company_id) {
        return new Response(JSON.stringify({ error: "Caller has no company" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: sameCompany, error: scopeErr } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .in("id", payload.user_ids)
        .eq("company_id", callerProfile.company_id)
        .eq("is_active", true);

      if (scopeErr) {
        return new Response(JSON.stringify({ error: scopeErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      allowedUserIds = (sameCompany ?? []).map((profile) => profile.id);
    }

    if (!allowedUserIds.length) {
      return new Response(
        JSON.stringify({
          sent: 0,
          failed: 0,
          message: "No authorized recipients",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: tokens, error: tokensErr } = await supabaseAdmin
      .from("push_tokens")
      .select("token, user_id")
      .in("user_id", allowedUserIds);

    if (tokensErr) {
      return new Response(JSON.stringify({ error: tokensErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tokens?.length) {
      return new Response(
        JSON.stringify({
          sent: 0,
          failed: 0,
          message: "No tokens found",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { accessToken, projectId } = await getFirebaseAccessToken();

    const endpoint =
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    const results = await Promise.all(
      tokens.map(async (entry) => {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: entry.token,
              notification: {
                title: payload.title,
                body: payload.body ?? "",
              },
              data: payload.data ?? {},
              android: {
                priority: "high",
                notification: {
                  channel_id: "planning_pro_notifications",
                  sound: "default",
                },
              },
            },
          }),
        });

        const responseBody = await response.json().catch(() => ({}));

        if (response.ok) {
          return {
            success: true,
            token: entry.token,
          };
        }

        console.error(
          `[send-push] FCM failed status=${response.status}`,
          responseBody,
        );

        if (isInvalidFcmToken(response.status, responseBody)) {
          await supabaseAdmin
            .from("push_tokens")
            .delete()
            .eq("token", entry.token);
        }

        return {
          success: false,
          token: entry.token,
          status: response.status,
          error: responseBody,
        };
      }),
    );

    const sent = results.filter((result) => result.success).length;
    const failed = results.length - sent;

    return new Response(
      JSON.stringify({
        sent,
        failed,
        total: results.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[send-push] Unhandled error", err);

    return new Response(
      JSON.stringify({
        error: "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

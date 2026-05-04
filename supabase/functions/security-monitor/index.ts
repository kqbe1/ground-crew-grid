import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Detect SECURITY DEFINER functions exposed in `public`
    const { data: violations, error } = await supabase
      .schema("private" as never)
      .rpc("list_security_definer_violations");

    if (error) throw error;

    const list = (violations ?? []) as Array<{
      function_name: string;
      arguments: string;
      callable_by: string;
    }>;

    // 2. Persist a snapshot in activity_logs to keep an audit trail
    if (list.length > 0) {
      await supabase.from("activity_logs").insert({
        action: "security_alert_definer_exposed",
        target_type: "security_scan",
        metadata: { count: list.length, violations: list },
      });
    } else {
      await supabase.from("activity_logs").insert({
        action: "security_scan_clean",
        target_type: "security_scan",
        metadata: { count: 0 },
      });
    }

    return new Response(
      JSON.stringify({
        ok: list.length === 0,
        count: list.length,
        violations: list,
        scanned_at: new Date().toISOString(),
      }),
      {
        status: list.length === 0 ? 200 : 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
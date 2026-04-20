import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Only super_admin can clean orphans
    const token = authHeader.replace("Bearer ", "");
    if (token !== serviceRoleKey) {
      const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user: caller } } = await callerClient.auth.getUser();
      if (!caller) {
        return new Response(JSON.stringify({ error: "Non autorisé" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: callerProfile } = await adminClient
        .from("profiles")
        .select("role")
        .eq("id", caller.id)
        .single();
      if (!callerProfile || callerProfile.role !== "super_admin") {
        return new Response(JSON.stringify({ error: "Réservé au super admin" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json().catch(() => ({}));
    const { action = "list", email, user_id } = body as {
      action?: "list" | "delete_by_email" | "delete_by_id";
      email?: string;
      user_id?: string;
    };

    // List all auth users and find ones without a profile
    const allAuthUsers: Array<{ id: string; email: string | undefined; created_at: string }> = [];
    let page = 1;
    while (true) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      for (const u of data.users) {
        allAuthUsers.push({ id: u.id, email: u.email, created_at: u.created_at });
      }
      if (data.users.length < 1000) break;
      page += 1;
    }

    const { data: profiles, error: pErr } = await adminClient.from("profiles").select("id");
    if (pErr) throw pErr;
    const profileIds = new Set((profiles ?? []).map((p) => p.id));
    const orphans = allAuthUsers.filter((u) => !profileIds.has(u.id));

    if (action === "list") {
      return new Response(JSON.stringify({ orphans }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let target: { id: string; email: string | undefined } | undefined;
    if (action === "delete_by_id" && user_id) {
      target = orphans.find((u) => u.id === user_id);
    } else if (action === "delete_by_email" && email) {
      target = orphans.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    }

    if (!target) {
      return new Response(JSON.stringify({ error: "Compte orphelin introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: delErr } = await adminClient.auth.admin.deleteUser(target.id);
    if (delErr) {
      return new Response(JSON.stringify({ error: delErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, deleted: target }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("cleanup-orphan-auth error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message || "Erreur interne" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
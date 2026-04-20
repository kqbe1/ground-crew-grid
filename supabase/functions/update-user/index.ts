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

    // Authenticate caller
    const token = authHeader.replace("Bearer ", "");
    let callerRole = "";
    let callerCompanyId: string | null = null;
    let callerId: string | null = null;

    if (token === serviceRoleKey) {
      callerRole = "super_admin";
    } else {
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
        .select("role, company_id")
        .eq("id", caller.id)
        .single();

      if (!callerProfile || !["super_admin", "admin"].includes(callerProfile.role)) {
        return new Response(JSON.stringify({ error: "Droits insuffisants" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      callerRole = callerProfile.role;
      callerCompanyId = callerProfile.company_id;
      callerId = caller.id;
    }

    const body = await req.json();
    const { user_id, action } = body;

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get target user profile
    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("role, company_id, full_name, email")
      .eq("id", user_id)
      .single();

    if (!targetProfile) {
      return new Response(JSON.stringify({ error: "Utilisateur introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Permission checks
    if (callerRole === "admin") {
      if (targetProfile.company_id !== callerCompanyId) {
        return new Response(JSON.stringify({ error: "Vous ne pouvez modifier que les utilisateurs de votre entreprise" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (targetProfile.role === "admin" || targetProfile.role === "super_admin") {
        return new Response(JSON.stringify({ error: "Vous ne pouvez pas modifier un admin ou super admin" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Cannot delete yourself
    if (action === "delete" && callerId === user_id) {
      return new Response(JSON.stringify({ error: "Vous ne pouvez pas supprimer votre propre compte" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === DELETE ===
    if (action === "delete") {
      // Delete auth user (cascade will delete profile via ON DELETE CASCADE)
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id);
      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Log activity
      await adminClient.from("activity_logs").insert({
        action: "delete_user",
        actor_id: callerId,
        target_type: "user",
        target_id: user_id,
        company_id: targetProfile.company_id,
        metadata: { full_name: targetProfile.full_name, email: targetProfile.email },
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === UPDATE ===
    const { email, password, full_name } = body;

    // Update auth user (email/password) via admin API
    const authUpdates: Record<string, string | boolean> = {};
    if (email) {
      authUpdates.email = email;
      authUpdates.email_confirm = true;
    }
    if (password) authUpdates.password = password;

    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } = await adminClient.auth.admin.updateUserById(user_id, authUpdates);
      if (authError) {
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Update profile (full_name, email)
    const profileUpdates: Record<string, string> = {};
    if (full_name) profileUpdates.full_name = full_name;
    if (email) profileUpdates.email = email;

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await adminClient
        .from("profiles")
        .update(profileUpdates)
        .eq("id", user_id);
      if (profileError) {
        return new Response(JSON.stringify({ error: profileError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Log activity
    const logMeta: Record<string, unknown> = { full_name: targetProfile.full_name || full_name };
    const changes: string[] = [];
    if (full_name) { logMeta.new_full_name = full_name; changes.push("name"); }
    if (email) { logMeta.new_email = email; changes.push("email"); }
    if (password) { changes.push("password"); }
    logMeta.changes = changes;

    if (changes.length > 0) {
      await adminClient.from("activity_logs").insert({
        action: "update_user_credentials",
        actor_id: callerId,
        target_type: "user",
        target_id: user_id,
        company_id: targetProfile.company_id,
        metadata: logMeta,
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unhandled error in update-user:", err);
    return new Response(JSON.stringify({ error: "Erreur interne du serveur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

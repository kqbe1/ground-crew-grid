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
    // Validate caller is admin/super_admin
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

    const token = authHeader.replace("Bearer ", "");
    const internalKey = req.headers.get("x-internal-key") || "";
    let callerRole = "";
    let callerCompanyId = "";

    if (token === serviceRoleKey || internalKey === serviceRoleKey) {
      callerRole = "super_admin";
      callerCompanyId = "";
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
    }

    const body = await req.json();
    const { email, password, full_name, role, company_id } = body;

    if (!email || !password || !full_name || !role) {
      return new Response(JSON.stringify({ error: "Champs requis manquants" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent creating super_admin via API
    if (role === "super_admin") {
      return new Response(JSON.stringify({ error: "Impossible de créer un super_admin" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Role hierarchy enforcement
    const allowedRoles: Record<string, string[]> = {
      super_admin: ["admin", "bureau", "secretariat", "ouvrier"],
      admin: ["bureau", "secretariat", "ouvrier"],
    };

    if (!allowedRoles[callerRole]?.includes(role)) {
      return new Response(JSON.stringify({ error: "Vous ne pouvez pas créer ce rôle" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine target company
    const targetCompanyId = callerRole === "super_admin"
      ? (company_id || callerCompanyId)
      : callerCompanyId;

    if (!targetCompanyId) {
      return new Response(JSON.stringify({ error: "Entreprise cible manquante" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check company is active
    const { data: company } = await adminClient
      .from("companies")
      .select("is_active, max_users")
      .eq("id", targetCompanyId)
      .single();

    if (!company) {
      return new Response(JSON.stringify({ error: "Entreprise introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!company.is_active) {
      return new Response(JSON.stringify({ error: "Cette entreprise est désactivée" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check max_users limit
    if (company.max_users) {
      const { count } = await adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("company_id", targetCompanyId)
        .eq("is_active", true);

      if ((count ?? 0) >= company.max_users) {
        return new Response(JSON.stringify({ error: `Limite atteinte : ${company.max_users} utilisateurs maximum pour cette entreprise` }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Create user with service role (bypasses email confirmation)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
        company_id: targetCompanyId,
      },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert into user_roles table
    await adminClient.from("user_roles").insert({
      user_id: newUser.user.id,
      role,
    });

    return new Response(JSON.stringify({ user: { id: newUser.user.id, email } }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

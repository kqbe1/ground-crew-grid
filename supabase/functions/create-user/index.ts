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
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
      super_admin: ["admin", "bureau", "ouvrier"],
      admin: ["bureau", "ouvrier"],
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
        .select("id", { count: "exact" })
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
    // NOTE: Do NOT pass role or company_id in metadata — handle_new_user ignores them
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        provider: "email",
        providers: ["email"],
      },
      user_metadata: {
        full_name,
      },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Wait for the profile trigger to materialize the row, then patch role/company.
    let profileExists = false;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { data: createdProfile } = await adminClient
        .from("profiles")
        .select("id")
        .eq("id", newUser.user.id)
        .maybeSingle();

      if (createdProfile?.id) {
        profileExists = true;
        break;
      }

      await wait(250 * (attempt + 1));
    }

    if (!profileExists) {
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      return new Response(JSON.stringify({ error: "Le profil utilisateur n'a pas pu être initialisé" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: profileError } = await adminClient
      .from("profiles")
      .update({ role, company_id: targetCompanyId, email, full_name })
      .eq("id", newUser.user.id);

    if (profileError) {
      // Rollback: delete the auth user if profile update fails
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      return new Response(JSON.stringify({ error: "Erreur lors de la configuration du profil" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert into user_roles table
    await adminClient.from("user_roles").upsert({
      user_id: newUser.user.id,
      role,
    }, { onConflict: "user_id,role" });

    return new Response(JSON.stringify({ user: { id: newUser.user.id, email } }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unhandled error in create-user:", err);
    return new Response(JSON.stringify({ error: "Erreur interne du serveur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const findAuthUserByEmail = async (
  adminClient: ReturnType<typeof createClient>,
  email: string,
) => {
  const targetEmail = normalizeEmail(email);
  let page = 1;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;

    const match = data.users.find((user) => normalizeEmail(user.email ?? "") === targetEmail);
    if (match) return match;
    if (data.users.length < 1000) return null;

    page += 1;
  }
};

const syncSingleRole = async (
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  role: string,
) => {
  const { error: deleteRolesError } = await adminClient
    .from("user_roles")
    .delete()
    .eq("user_id", userId);

  if (deleteRolesError) throw deleteRolesError;

  const { error: insertRoleError } = await adminClient
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });

  if (insertRoleError) throw insertRoleError;
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
    const normalizedEmail = typeof email === "string" ? normalizeEmail(email) : "";

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
      email: normalizedEmail,
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
      const alreadyExists = createError.message?.toLowerCase().includes("already");

      if (!alreadyExists) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const existingAuthUser = await findAuthUserByEmail(adminClient, normalizedEmail);
      const { data: existingProfile, error: existingProfileError } = await adminClient
        .from("profiles")
        .select("id, company_id")
        .ilike("email", normalizedEmail)
        .maybeSingle();

      if (existingProfileError) {
        return new Response(JSON.stringify({ error: "Impossible de vérifier le profil existant" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!existingAuthUser) {
        return new Response(JSON.stringify({ error: "Cet email est déjà utilisé par un autre utilisateur" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (existingProfile?.company_id && existingProfile.company_id !== targetCompanyId) {
        return new Response(JSON.stringify({ error: "Cet email est déjà utilisé par un autre utilisateur" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!existingProfile) {
        const { error: insertProfileError } = await adminClient
          .from("profiles")
          .insert({
            id: existingAuthUser.id,
            email: normalizedEmail,
            full_name,
            role,
            company_id: targetCompanyId,
            is_active: true,
          });

        if (insertProfileError) {
          return new Response(JSON.stringify({ error: "Impossible de réinitialiser le profil existant" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        const { error: repairProfileError } = await adminClient
          .from("profiles")
          .update({
            email: normalizedEmail,
            full_name,
            role,
            company_id: targetCompanyId,
            is_active: true,
          })
          .eq("id", existingProfile.id);

        if (repairProfileError) {
          return new Response(JSON.stringify({ error: "Impossible de réinitialiser le profil existant" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      await syncSingleRole(adminClient, existingAuthUser.id, role);

      return new Response(JSON.stringify({
        user: { id: existingAuthUser.id, email: normalizedEmail },
        repaired_existing_user: true,
      }), {
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
      .update({ role, company_id: targetCompanyId, email: normalizedEmail, full_name, is_active: true })
      .eq("id", newUser.user.id);

    if (profileError) {
      // Rollback: delete the auth user if profile update fails
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      return new Response(JSON.stringify({ error: "Erreur lors de la configuration du profil" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await syncSingleRole(adminClient, newUser.user.id, role);

    return new Response(JSON.stringify({ user: { id: newUser.user.id, email: normalizedEmail } }), {
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

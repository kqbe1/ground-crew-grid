import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Step =
  | "env"
  | "auth_caller"
  | "caller_profile"
  | "validate_role"
  | "validate_company"
  | "quota"
  | "auth_create_user"
  | "profile_wait"
  | "profile_update"
  | "sync_user_roles"
  | "repair_existing_user"
  | "unknown";

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fail = (step: Step, userMessage: string, status: number, technical?: unknown) => {
  console.error(`[create-user] step=${step} status=${status} error=`, technical ?? userMessage);
  return json({ error: userMessage, step }, status);
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const findAuthUserByEmail = async (
  adminClient: SupabaseClient,
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

// Single source of truth for user_roles: exactly one row matching profiles.role.
const syncSingleRole = async (
  adminClient: SupabaseClient,
  userId: string,
  role: string,
) => {
  const { error: insertRoleError } = await adminClient
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
  if (insertRoleError) throw insertRoleError;

  const { error: deleteRolesError } = await adminClient
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .neq("role", role);
  if (deleteRolesError) throw deleteRolesError;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let step: Step = "env";

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return fail(
        "env",
        "Configuration serveur incomplète",
        500,
        `SUPABASE_URL=${!!supabaseUrl} SUPABASE_SERVICE_ROLE_KEY=${!!serviceRoleKey}`,
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    // ---- 1. Caller authentication -------------------------------------------------
    step = "auth_caller";
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return fail(step, "Non autorisé", 401, "missing Authorization header");

    const token = authHeader.replace("Bearer ", "").trim();
    const internalKey = req.headers.get("x-internal-key") || "";
    let callerRole = "";
    let callerCompanyId: string | null = null;

    if (token === serviceRoleKey || internalKey === serviceRoleKey) {
      callerRole = "super_admin";
      callerCompanyId = null;
      console.log("[create-user] caller=service_role");
    } else {
      // Validate the JWT with the admin client (no dependency on SUPABASE_ANON_KEY).
      const { data: callerData, error: callerError } = await adminClient.auth.getUser(token);
      if (callerError || !callerData?.user) {
        return fail(step, "Non autorisé", 401, callerError?.message ?? "getUser returned no user");
      }
      const caller = callerData.user;

      step = "caller_profile";
      const { data: callerProfile, error: callerProfileError } = await adminClient
        .from("profiles")
        .select("role, company_id, is_active")
        .eq("id", caller.id)
        .maybeSingle();

      if (callerProfileError) {
        return fail(step, "Impossible de vérifier votre profil", 500, callerProfileError);
      }
      if (!callerProfile) {
        return fail(step, "Profil demandeur introuvable", 403, `no profile for ${caller.id}`);
      }
      if (callerProfile.is_active === false) {
        return fail(step, "Compte désactivé", 403, "caller inactive");
      }
      if (!["super_admin", "admin", "bureau"].includes(callerProfile.role)) {
        return fail(step, "Droits insuffisants", 403, `caller role=${callerProfile.role}`);
      }

      callerRole = callerProfile.role;
      callerCompanyId = callerProfile.company_id ?? null;

      if (callerRole !== "super_admin" && !callerCompanyId) {
        return fail(step, "Compte sans entreprise — opération refusée", 403, "missing company_id");
      }
      console.log(`[create-user] caller role=${callerRole} company=${callerCompanyId ?? "null"}`);
    }

    // ---- 2. Payload ----------------------------------------------------------------
    step = "validate_role";
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch (parseError) {
      return fail(step, "Requête invalide", 400, parseError);
    }

    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";
    const full_name = typeof body.full_name === "string" ? body.full_name.trim() : "";
    const role = typeof body.role === "string" ? body.role : "";
    const company_id = typeof body.company_id === "string" && body.company_id ? body.company_id : null;
    const worker_level = typeof body.worker_level === "string" && body.worker_level
      ? body.worker_level
      : null;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password || !full_name || !role) {
      return fail(step, "Champs requis manquants", 400, "email/password/full_name/role");
    }
    if (password.length < 6) {
      return fail(step, "Le mot de passe doit contenir au moins 6 caractères", 400, "short password");
    }
    if (role === "super_admin") {
      return fail(step, "Impossible de créer un super_admin", 403, "super_admin creation blocked");
    }

    // Unchanged hierarchy.
    const allowedRoles: Record<string, string[]> = {
      super_admin: ["admin", "bureau", "ouvrier"],
      admin: ["bureau", "ouvrier"],
      bureau: ["ouvrier"],
    };
    if (!allowedRoles[callerRole]?.includes(role)) {
      return fail(step, "Vous ne pouvez pas créer ce rôle", 403, `${callerRole} -> ${role}`);
    }

    // ---- 3. Company scoping ---------------------------------------------------------
    step = "validate_company";
    if (callerRole !== "super_admin" && company_id && company_id !== callerCompanyId) {
      return fail(step, "Création interdite pour une autre entreprise", 403, "cross-tenant attempt");
    }

    const targetCompanyId = callerRole === "super_admin"
      ? (company_id ?? callerCompanyId)
      : callerCompanyId;

    if (!targetCompanyId) {
      return fail(step, "Entreprise cible manquante", 400, "no target company_id");
    }

    const { data: company, error: companyError } = await adminClient
      .from("companies")
      .select("is_active, max_users")
      .eq("id", targetCompanyId)
      .maybeSingle();

    if (companyError) return fail(step, "Impossible de vérifier l'entreprise", 500, companyError);
    if (!company) return fail(step, "Entreprise introuvable", 404, `company ${targetCompanyId}`);
    if (!company.is_active) return fail(step, "Cette entreprise est désactivée", 403, "inactive company");

    // ---- 4. Quota --------------------------------------------------------------------
    step = "quota";
    if (company.max_users) {
      const { count, error: countError } = await adminClient
        .from("profiles")
        .select("id", { count: "exact" })
        .eq("company_id", targetCompanyId)
        .eq("is_active", true);

      if (countError) return fail(step, "Impossible de vérifier le quota utilisateurs", 500, countError);
      if ((count ?? 0) >= company.max_users) {
        return fail(
          step,
          `Limite atteinte : ${company.max_users} utilisateurs maximum pour cette entreprise`,
          403,
          `count=${count}`,
        );
      }
    }

    const profilePayload = {
      email: normalizedEmail,
      full_name,
      role,
      company_id: targetCompanyId,
      is_active: true,
      worker_level: role === "ouvrier" ? (worker_level ?? "T1") : null,
    };

    // ---- 5. Auth user creation --------------------------------------------------------
    step = "auth_create_user";
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { full_name },
    });

    if (createError) {
      const alreadyExists = createError.message?.toLowerCase().includes("already")
        || createError.message?.toLowerCase().includes("registered");

      if (!alreadyExists) {
        return fail(step, createError.message || "Création du compte impossible", 400, createError);
      }

      // ---- 5bis. Repair an existing account -------------------------------------------
      step = "repair_existing_user";
      const existingAuthUser = await findAuthUserByEmail(adminClient, normalizedEmail);
      if (!existingAuthUser) {
        return fail(step, "Cet email est déjà utilisé par un autre utilisateur", 400, "auth user not found");
      }

      const { data: existingProfile, error: existingProfileError } = await adminClient
        .from("profiles")
        .select("id, company_id")
        .eq("id", existingAuthUser.id)
        .maybeSingle();

      if (existingProfileError) {
        return fail(step, "Impossible de vérifier le profil existant", 500, existingProfileError);
      }

      if (
        existingProfile?.company_id
        && existingProfile.company_id !== targetCompanyId
        && callerRole !== "super_admin"
      ) {
        return fail(step, "Cet email est déjà utilisé par un autre utilisateur", 400, "cross-tenant repair");
      }

      const { error: upsertProfileError } = await adminClient
        .from("profiles")
        .upsert({ id: existingAuthUser.id, ...profilePayload }, { onConflict: "id" });

      if (upsertProfileError) {
        return fail(step, "Impossible de réinitialiser le profil existant", 500, upsertProfileError);
      }

      const { error: repairAuthError } = await adminClient.auth.admin.updateUserById(existingAuthUser.id, {
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });

      if (repairAuthError) {
        return fail(step, "Impossible de réinitialiser l'accès du compte existant", 500, repairAuthError);
      }

      step = "sync_user_roles";
      await syncSingleRole(adminClient, existingAuthUser.id, role);

      console.log(`[create-user] repaired user ${existingAuthUser.id} role=${role} company=${targetCompanyId}`);
      return json({
        user: { id: existingAuthUser.id, email: normalizedEmail },
        repaired_existing_user: true,
      }, 200);
    }

    const newUserId = newUser.user.id;
    console.log(`[create-user] auth user created ${newUserId}`);

    // ---- 6. Wait for handle_new_user, then patch --------------------------------------
    step = "profile_wait";
    let profileExists = false;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { data: createdProfile, error: pollError } = await adminClient
        .from("profiles")
        .select("id")
        .eq("id", newUserId)
        .maybeSingle();

      if (pollError) console.error("[create-user] profile poll error", pollError);
      if (createdProfile?.id) {
        profileExists = true;
        break;
      }
      await wait(250 * (attempt + 1));
    }

    step = "profile_update";
    // Upsert covers both cases: trigger-created row, or missing trigger.
    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert({ id: newUserId, ...profilePayload }, { onConflict: "id" });

    if (profileError) {
      await adminClient.auth.admin.deleteUser(newUserId);
      return fail(
        step,
        `Erreur lors de la configuration du profil : ${profileError.message}`,
        400,
        { profileError, profileExisted: profileExists },
      );
    }

    step = "sync_user_roles";
    try {
      await syncSingleRole(adminClient, newUserId, role);
    } catch (roleError) {
      await adminClient.auth.admin.deleteUser(newUserId);
      return fail(step, "Erreur lors de l'attribution du rôle", 500, roleError);
    }

    console.log(`[create-user] done user=${newUserId} role=${role} company=${targetCompanyId}`);
    return json({ user: { id: newUserId, email: normalizedEmail } }, 200);
  } catch (err) {
    return fail(step, "Erreur interne du serveur", 500, err instanceof Error ? err.stack ?? err.message : err);
  }
});

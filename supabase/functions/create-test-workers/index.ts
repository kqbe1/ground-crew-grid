import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const workers = [
    { name: "Jean Dupont", email: "jean.dupont@test.com", level: "T2" },
    { name: "Marc Lefevre", email: "marc.lefevre@test.com", level: "T1" },
    { name: "Pierre Martin", email: "pierre.martin@test.com", level: "T1" },
    { name: "Lucas Bernard", email: "lucas.bernard@test.com", level: "T0" },
    { name: "Thomas Moreau", email: "thomas.moreau@test.com", level: "T2" },
    { name: "Antoine Girard", email: "antoine.girard@test.com", level: "T1" },
    { name: "Nicolas Petit", email: "nicolas.petit@test.com", level: "T0" },
    { name: "Hugo Lambert", email: "hugo.lambert@test.com", level: "T1" },
    { name: "Maxime Roux", email: "maxime.roux@test.com", level: "T2" },
    { name: "Alexandre Faure", email: "alexandre.faure@test.com", level: "T1" },
  ];

  const results = [];
  for (const w of workers) {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: w.email,
      password: "Test1234!",
      email_confirm: true,
      user_metadata: { full_name: w.name },
    });

    if (authError) {
      results.push({ name: w.name, error: authError.message });
      continue;
    }

    // Update profile with worker_level
    await supabase.from("profiles").update({ worker_level: w.level }).eq("id", authData.user.id);

    // Add ouvrier role
    await supabase.from("user_roles").insert({ user_id: authData.user.id, role: "ouvrier" });

    results.push({ name: w.name, id: authData.user.id, status: "created" });
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

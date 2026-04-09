import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

async function loginAs(email: string, password: string) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
  return client;
}

Deno.test("Ouvrier cannot change own role", async () => {
  const client = await loginAs("ouvrier@pmeterrain.test", "Test1234!");
  const { data: { user } } = await client.auth.getUser();

  // Try to escalate to admin
  const { error } = await client.from("profiles").update({ role: "admin" }).eq("id", user!.id);

  // The update may "succeed" (no SQL error) but the trigger reverts the value
  const { data: profile } = await client.from("profiles").select("role").eq("id", user!.id).single();
  assertEquals(profile?.role, "ouvrier", "Ouvrier role should not have changed");
  await client.auth.signOut();
});

Deno.test("Admin cannot change own role", async () => {
  const client = await loginAs("admin-ag@pmeterrain.test", "Test1234!");
  const { data: { user } } = await client.auth.getUser();

  const { error } = await client.from("profiles").update({ role: "super_admin" }).eq("id", user!.id);

  const { data: profile } = await client.from("profiles").select("role").eq("id", user!.id).single();
  assertEquals(profile?.role, "admin", "Admin role should not have changed");
  await client.auth.signOut();
});

Deno.test("Bureau cannot change own role", async () => {
  const client = await loginAs("bureau@pmeterrain.test", "Test1234!");
  const { data: { user } } = await client.auth.getUser();

  const { error } = await client.from("profiles").update({ role: "admin" }).eq("id", user!.id);

  const { data: profile } = await client.from("profiles").select("role").eq("id", user!.id).single();
  assertEquals(profile?.role, "bureau", "Bureau role should not have changed");
  await client.auth.signOut();
});

Deno.test("Ouvrier cannot change own company_id", async () => {
  const client = await loginAs("ouvrier@pmeterrain.test", "Test1234!");
  const { data: { user } } = await client.auth.getUser();

  // Get current company_id
  const { data: before } = await client.from("profiles").select("company_id").eq("id", user!.id).single();
  const originalCompanyId = before?.company_id;

  // Try to change company
  await client.from("profiles").update({ company_id: "00000000-0000-0000-0000-000000000000" }).eq("id", user!.id);

  const { data: after } = await client.from("profiles").select("company_id").eq("id", user!.id).single();
  assertEquals(after?.company_id, originalCompanyId, "Company ID should not have changed");
  await client.auth.signOut();
});

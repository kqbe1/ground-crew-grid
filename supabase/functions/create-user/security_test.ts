import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const opts = { sanitizeResources: false, sanitizeOps: false };

const AG_ADMIN_EMAIL = Deno.env.get("TEST_AG_ADMIN_EMAIL")!;
const AG_ADMIN_PASSWORD = Deno.env.get("TEST_AG_ADMIN_PASSWORD")!;

const TEST2_OUVRIER_EMAIL = Deno.env.get("TEST_COMPANY2_OUVRIER_EMAIL")!;
const TEST2_OUVRIER_PASSWORD = Deno.env.get("TEST_COMPANY2_OUVRIER_PASSWORD")!;

async function loginAs(email: string, password: string) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
  return client;
}

Deno.test("Ouvrier cannot change own role", opts, async () => {
  const client = await loginAs(TEST2_OUVRIER_EMAIL, TEST2_OUVRIER_PASSWORD);
  const { data: { user } } = await client.auth.getUser();

  await client.from("profiles").update({ role: "admin" }).eq("id", user!.id);

  const { data } = await client
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  assertEquals(data?.role, "ouvrier");
  await client.auth.signOut();
});

Deno.test("Admin cannot change own role", opts, async () => {
  const client = await loginAs(AG_ADMIN_EMAIL, AG_ADMIN_PASSWORD);
  const { data: { user } } = await client.auth.getUser();

  await client.from("profiles").update({ role: "super_admin" }).eq("id", user!.id);

  const { data } = await client
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  assertEquals(data?.role, "admin");
  await client.auth.signOut();
});

Deno.test("Ouvrier cannot change own company_id", opts, async () => {
  const client = await loginAs(TEST2_OUVRIER_EMAIL, TEST2_OUVRIER_PASSWORD);
  const { data: { user } } = await client.auth.getUser();

  const { data: before } = await client
    .from("profiles")
    .select("company_id")
    .eq("id", user!.id)
    .single();

  await client
    .from("profiles")
    .update({ company_id: "00000000-0000-0000-0000-000000000000" })
    .eq("id", user!.id);

  const { data: after } = await client
    .from("profiles")
    .select("company_id")
    .eq("id", user!.id)
    .single();

  assertEquals(after?.company_id, before?.company_id);
  await client.auth.signOut();
});

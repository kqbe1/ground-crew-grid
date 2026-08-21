import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const opts = { sanitizeResources: false, sanitizeOps: false };

const AG_COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const TEST2_COMPANY_ID = "1896b387-3a96-4993-b004-abd5ad60daba";

const AG_ADMIN_EMAIL = Deno.env.get("TEST_AG_ADMIN_EMAIL")!;
const AG_ADMIN_PASSWORD = Deno.env.get("TEST_AG_ADMIN_PASSWORD")!;

const TEST2_BUREAU_EMAIL = Deno.env.get("TEST_COMPANY2_BUREAU_EMAIL")!;
const TEST2_BUREAU_PASSWORD = Deno.env.get("TEST_COMPANY2_BUREAU_PASSWORD")!;

const TEST2_OUVRIER_EMAIL = Deno.env.get("TEST_COMPANY2_OUVRIER_EMAIL")!;
const TEST2_OUVRIER_PASSWORD = Deno.env.get("TEST_COMPANY2_OUVRIER_PASSWORD")!;

async function loginAs(email: string, password: string) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
  return client;
}

Deno.test("AG admin cannot see Test2 clients", opts, async () => {
  const client = await loginAs(AG_ADMIN_EMAIL, AG_ADMIN_PASSWORD);
  const { data } = await client.from("clients").select("id, company_id");
  const leak = (data ?? []).filter((x: any) => x.company_id === TEST2_COMPANY_ID);
  assertEquals(leak.length, 0);
  await client.auth.signOut();
});

Deno.test("AG admin cannot see Test2 tasks", opts, async () => {
  const client = await loginAs(AG_ADMIN_EMAIL, AG_ADMIN_PASSWORD);
  const { data } = await client.from("work_tasks").select("id, company_id");
  const leak = (data ?? []).filter((x: any) => x.company_id === TEST2_COMPANY_ID);
  assertEquals(leak.length, 0);
  await client.auth.signOut();
});

Deno.test("AG admin cannot see Test2 profiles", opts, async () => {
  const client = await loginAs(AG_ADMIN_EMAIL, AG_ADMIN_PASSWORD);
  const { data } = await client.from("profiles").select("id, company_id");
  const leak = (data ?? []).filter((x: any) => x.company_id === TEST2_COMPANY_ID);
  assertEquals(leak.length, 0);
  await client.auth.signOut();
});

Deno.test("AG admin cannot see Test2 orders", opts, async () => {
  const client = await loginAs(AG_ADMIN_EMAIL, AG_ADMIN_PASSWORD);
  const { data } = await client.from("parts_orders").select("id, company_id");
  const leak = (data ?? []).filter((x: any) => x.company_id === TEST2_COMPANY_ID);
  assertEquals(leak.length, 0);
  await client.auth.signOut();
});

Deno.test("AG admin cannot see Test2 intervention sheets", opts, async () => {
  const client = await loginAs(AG_ADMIN_EMAIL, AG_ADMIN_PASSWORD);
  const { data } = await client.from("intervention_sheets").select("id, company_id");
  const leak = (data ?? []).filter((x: any) => x.company_id === TEST2_COMPANY_ID);
  assertEquals(leak.length, 0);
  await client.auth.signOut();
});

Deno.test("AG admin cannot see Test2 maintenance schedules", opts, async () => {
  const client = await loginAs(AG_ADMIN_EMAIL, AG_ADMIN_PASSWORD);
  const { data } = await client.from("maintenance_schedules").select("id, company_id");
  const leak = (data ?? []).filter((x: any) => x.company_id === TEST2_COMPANY_ID);
  assertEquals(leak.length, 0);
  await client.auth.signOut();
});

Deno.test("Test2 bureau cannot see AG clients", opts, async () => {
  const client = await loginAs(TEST2_BUREAU_EMAIL, TEST2_BUREAU_PASSWORD);
  const { data } = await client.from("clients").select("id, company_id");
  const leak = (data ?? []).filter((x: any) => x.company_id === AG_COMPANY_ID);
  assertEquals(leak.length, 0);
  await client.auth.signOut();
});

Deno.test("Test2 bureau cannot see AG tasks", opts, async () => {
  const client = await loginAs(TEST2_BUREAU_EMAIL, TEST2_BUREAU_PASSWORD);
  const { data } = await client.from("work_tasks").select("id, company_id");
  const leak = (data ?? []).filter((x: any) => x.company_id === AG_COMPANY_ID);
  assertEquals(leak.length, 0);
  await client.auth.signOut();
});

Deno.test("Test2 ouvrier cannot see AG clients", opts, async () => {
  const client = await loginAs(TEST2_OUVRIER_EMAIL, TEST2_OUVRIER_PASSWORD);
  const { data } = await client.from("clients").select("id, company_id");
  const leak = (data ?? []).filter((x: any) => x.company_id === AG_COMPANY_ID);
  assertEquals(leak.length, 0);
  await client.auth.signOut();
});

Deno.test("Test2 ouvrier cannot see AG tasks", opts, async () => {
  const client = await loginAs(TEST2_OUVRIER_EMAIL, TEST2_OUVRIER_PASSWORD);
  const { data } = await client.from("work_tasks").select("id, company_id");
  const leak = (data ?? []).filter((x: any) => x.company_id === AG_COMPANY_ID);
  assertEquals(leak.length, 0);
  await client.auth.signOut();
});

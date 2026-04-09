import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const opts = { sanitizeResources: false, sanitizeOps: false };

const AG_COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const THERMO_COMPANY_ID = "0a2da11f-f2f1-43f3-8345-c3449c2743ad";

async function loginAs(email: string, password: string) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
  return client;
}

// --- AG user cannot see Thermo Express data ---

Deno.test("AG admin cannot see Thermo clients", opts, async () => {
  const client = await loginAs("admin-ag@pmeterrain.test", "Test1234!");
  const { data } = await client.from("clients").select("id, company_id");
  const leak = (data ?? []).filter((c: any) => c.company_id === THERMO_COMPANY_ID);
  assertEquals(leak.length, 0, "AG admin should not see Thermo clients");
  await client.auth.signOut();
});

Deno.test("AG admin cannot see Thermo tasks", opts, async () => {
  const client = await loginAs("admin-ag@pmeterrain.test", "Test1234!");
  const { data } = await client.from("work_tasks").select("id, company_id");
  const leak = (data ?? []).filter((t: any) => t.company_id === THERMO_COMPANY_ID);
  assertEquals(leak.length, 0, "AG admin should not see Thermo tasks");
  await client.auth.signOut();
});

Deno.test("AG admin cannot see Thermo profiles", opts, async () => {
  const client = await loginAs("admin-ag@pmeterrain.test", "Test1234!");
  const { data } = await client.from("profiles").select("id, company_id");
  const leak = (data ?? []).filter((p: any) => p.company_id === THERMO_COMPANY_ID);
  assertEquals(leak.length, 0, "AG admin should not see Thermo profiles");
  await client.auth.signOut();
});

Deno.test("AG admin cannot see Thermo orders", opts, async () => {
  const client = await loginAs("admin-ag@pmeterrain.test", "Test1234!");
  const { data } = await client.from("parts_orders").select("id, company_id");
  const leak = (data ?? []).filter((o: any) => o.company_id === THERMO_COMPANY_ID);
  assertEquals(leak.length, 0, "AG admin should not see Thermo orders");
  await client.auth.signOut();
});

Deno.test("AG admin cannot see Thermo intervention sheets", opts, async () => {
  const client = await loginAs("admin-ag@pmeterrain.test", "Test1234!");
  const { data } = await client.from("intervention_sheets").select("id, company_id");
  const leak = (data ?? []).filter((s: any) => s.company_id === THERMO_COMPANY_ID);
  assertEquals(leak.length, 0, "AG admin should not see Thermo sheets");
  await client.auth.signOut();
});

Deno.test("AG admin cannot see Thermo maintenance schedules", opts, async () => {
  const client = await loginAs("admin-ag@pmeterrain.test", "Test1234!");
  const { data } = await client.from("maintenance_schedules").select("id, company_id");
  const leak = (data ?? []).filter((m: any) => m.company_id === THERMO_COMPANY_ID);
  assertEquals(leak.length, 0, "AG admin should not see Thermo maintenance");
  await client.auth.signOut();
});

// --- Thermo user cannot see AG data ---

Deno.test("Thermo admin cannot see AG clients", opts, async () => {
  const client = await loginAs("admin@thermoexpress.test", "ThermoAdmin2025!");
  const { data } = await client.from("clients").select("id, company_id");
  const leak = (data ?? []).filter((c: any) => c.company_id === AG_COMPANY_ID);
  assertEquals(leak.length, 0, "Thermo admin should not see AG clients");
  await client.auth.signOut();
});

Deno.test("Thermo admin cannot see AG tasks", opts, async () => {
  const client = await loginAs("admin@thermoexpress.test", "ThermoAdmin2025!");
  const { data } = await client.from("work_tasks").select("id, company_id");
  const leak = (data ?? []).filter((t: any) => t.company_id === AG_COMPANY_ID);
  assertEquals(leak.length, 0, "Thermo admin should not see AG tasks");
  await client.auth.signOut();
});

Deno.test("Thermo ouvrier cannot see AG clients", opts, async () => {
  const client = await loginAs("ouvrier@thermoexpress.test", "Test1234!");
  const { data } = await client.from("clients").select("id, company_id");
  const leak = (data ?? []).filter((c: any) => c.company_id === AG_COMPANY_ID);
  assertEquals(leak.length, 0, "Thermo ouvrier should not see AG clients");
  await client.auth.signOut();
});

Deno.test("AG ouvrier cannot see Thermo tasks", opts, async () => {
  const client = await loginAs("ouvrier@pmeterrain.test", "Test1234!");
  const { data } = await client.from("work_tasks").select("id, company_id");
  const leak = (data ?? []).filter((t: any) => t.company_id === THERMO_COMPANY_ID);
  assertEquals(leak.length, 0, "AG ouvrier should not see Thermo tasks");
  await client.auth.signOut();
});

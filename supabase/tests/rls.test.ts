import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUser,
  sampleProfile,
  type TestUser,
} from "../../tests/supabase-test-helpers";

let a: TestUser;
let b: TestUser;

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
  const { error } = await a.client.from("profiles").insert({ ...sampleProfile, display_name: "A" });
  if (error) throw error;
});

afterAll(async () => {
  await deleteTestUser(a);
  await deleteTestUser(b);
});

describe("profiles RLS", () => {
  it("Given A has a profile, When B selects it by id, Then no rows are returned", async () => {
    const { data, error } = await b.client.from("profiles").select("*").eq("user_id", a.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("Given A has a profile, When B updates it, Then nothing changes", async () => {
    await b.client.from("profiles").update({ display_name: "hacked" }).eq("user_id", a.id);
    const { data } = await a.client.from("profiles").select("display_name").single();
    expect(data?.display_name).toBe("A");
  });

  it("When B inserts a profile owned by A, Then the write is rejected", async () => {
    const { error } = await b.client.from("profiles").insert({ ...sampleProfile, user_id: a.id });
    expect(error).not.toBeNull();
  });

  it("When an anonymous client selects profiles, Then nothing is returned", async () => {
    const { data } = await anonClient().from("profiles").select("*");
    expect(data ?? []).toEqual([]);
  });

  it("rejects implausible heights at the database level", async () => {
    const { error } = await b.client.from("profiles").insert({ ...sampleProfile, height_cm: 300 });
    expect(error).not.toBeNull();
  });
});

describe("secret tables", () => {
  beforeAll(async () => {
    const { error } = await adminClient().from("user_ai_keys").insert({
      user_id: a.id,
      ciphertext: "x",
      iv: "x",
      auth_tag: "x",
      last4: "abcd",
    });
    if (error) throw error;
  });

  it("Given A has a stored key, When A queries user_ai_keys directly, Then no key material is returned", async () => {
    const { data } = await a.client.from("user_ai_keys").select("*");
    expect(data ?? []).toEqual([]);
  });

  it("When any client reads signup_allowlist, Then nothing is returned", async () => {
    await adminClient().from("signup_allowlist").insert({ pattern: "rls-probe@test.local" });
    const { data: asUser } = await a.client.from("signup_allowlist").select("*");
    const { data: asAnon } = await anonClient().from("signup_allowlist").select("*");
    await adminClient().from("signup_allowlist").delete().eq("pattern", "rls-probe@test.local");
    expect(asUser ?? []).toEqual([]);
    expect(asAnon ?? []).toEqual([]);
  });
});

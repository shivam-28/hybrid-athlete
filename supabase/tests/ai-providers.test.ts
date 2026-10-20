import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, createTestUser, deleteTestUser, type TestUser } from "../../tests/supabase-test-helpers";

let user: TestUser;
const sealed = { ciphertext: "x", iv: "x", auth_tag: "x", last4: "abcd" };
const ENDPOINT = "https://my-res.services.ai.azure.com/anthropic";

beforeAll(async () => {
  user = await createTestUser();
});
afterAll(async () => {
  await deleteTestUser(user);
});

async function insert(row: Record<string, unknown>) {
  const admin = adminClient();
  await admin.from("user_ai_keys").delete().eq("user_id", user.id);
  return admin.from("user_ai_keys").insert({ user_id: user.id, ...sealed, ...row } as never);
}

describe("user_ai_keys provider constraints", () => {
  it("defaults existing-style rows to the anthropic provider", async () => {
    expect((await insert({})).error).toBeNull();
    const { data } = await adminClient().from("user_ai_keys").select("provider").eq("user_id", user.id).single();
    expect((data as { provider: string }).provider).toBe("anthropic");
  });

  it("accepts a foundry row with an endpoint and optional deployments", async () => {
    expect((await insert({ provider: "foundry", endpoint: ENDPOINT, main_deployment: "opus-prod" })).error).toBeNull();
  });

  it("rejects a foundry row without an endpoint", async () => {
    expect((await insert({ provider: "foundry" })).error).not.toBeNull();
  });

  it("rejects an anthropic row carrying Foundry fields", async () => {
    expect((await insert({ provider: "anthropic", endpoint: ENDPOINT })).error).not.toBeNull();
    expect((await insert({ provider: "anthropic", main_deployment: "x" })).error).not.toBeNull();
  });

  it("rejects unknown providers", async () => {
    expect((await insert({ provider: "bedrock" })).error).not.toBeNull();
  });

  it("still returns nothing to the owner's own client", async () => {
    await insert({ provider: "foundry", endpoint: ENDPOINT });
    const { data } = await user.client.from("user_ai_keys").select("*");
    expect(data ?? []).toEqual([]);
  });
});

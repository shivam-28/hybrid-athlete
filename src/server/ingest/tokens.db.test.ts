import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, createTestUser, deleteTestUser, type TestUser } from "../../../tests/supabase-test-helpers";
import { generateIngestToken, getIngestTokenStatus, getLastSync, revokeIngestToken, verifyIngestToken } from "./tokens";

let user: TestUser;
beforeAll(async () => {
  user = await createTestUser();
});
afterAll(() => deleteTestUser(user));

describe("ingest token lifecycle", () => {
  let first: string;

  it("Given a generated token, Then the full token is returned once and only its SHA-256 hash is stored", async () => {
    first = await generateIngestToken(user.id);
    expect(first).toMatch(/^ha_[A-Za-z0-9_-]{43}$/);
    const { data } = await adminClient().from("ingest_tokens").select("*").eq("user_id", user.id).single();
    expect(data!.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(data)).not.toContain(first.slice(8, -4));
    expect(await getIngestTokenStatus(user.id)).toMatchObject({ prefix: first.slice(0, 8), last4: first.slice(-4) });
    expect(await getLastSync(user.id)).toBeNull();
  });

  it("verifies the token to its owner and rejects unknown or malformed tokens", async () => {
    expect(await verifyIngestToken(first)).toMatchObject({ userId: user.id });
    expect(await verifyIngestToken(`${first.slice(0, -1)}x`)).toBeNull();
    expect(await verifyIngestToken("ha_short")).toBeNull();
    expect(await verifyIngestToken("")).toBeNull();
  });

  it("Given rotation, Then the old token is rejected and the new one accepted", async () => {
    const second = await generateIngestToken(user.id);
    expect(await verifyIngestToken(first)).toBeNull();
    expect(await verifyIngestToken(second)).toMatchObject({ userId: user.id });
    const { data } = await adminClient().from("ingest_tokens").select("id").eq("user_id", user.id).is("revoked_at", null);
    expect(data).toHaveLength(1);
    first = second;
  });

  it("Given revocation, Then the token is rejected and no token is active", async () => {
    await revokeIngestToken(user.id);
    expect(await verifyIngestToken(first)).toBeNull();
    expect(await getIngestTokenStatus(user.id)).toBeNull();
  });
});

import Anthropic from "@anthropic-ai/sdk";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { adminClient, createTestUser, deleteTestUser, type TestUser } from "../../../tests/supabase-test-helpers";
import { InvalidAiKeyError, MissingAiKeyError, getAnthropicClient, withUserAnthropic } from "./client";
import { deleteAiKey, getAiKeyStatus, saveAiKey } from "./keys";

const KEY = "sk-ant-api03-test-key-ABCD";
let user: TestUser;
const logs: string[] = [];

beforeAll(async () => {
  user = await createTestUser();
  for (const level of ["log", "info", "warn", "error"] as const) {
    vi.spyOn(console, level).mockImplementation((...args) => logs.push(args.map(String).join(" ")));
  }
});
afterAll(async () => {
  vi.restoreAllMocks();
  await deleteTestUser(user);
});

describe("saveAiKey", () => {
  it("Given Anthropic rejects the key, Then nothing is stored", async () => {
    expect(await saveAiKey(user.id, KEY, async () => "rejected")).toBe("rejected");
    expect(await getAiKeyStatus(user.id)).toBeNull();
  });

  it("Given Anthropic is unreachable, Then nothing is stored", async () => {
    expect(await saveAiKey(user.id, KEY, async () => "unavailable")).toBe("unavailable");
    expect(await getAiKeyStatus(user.id)).toBeNull();
  });

  it("Given a valid key, Then it is stored encrypted and only the last 4 characters are exposed", async () => {
    expect(await saveAiKey(user.id, KEY, async () => "valid")).toBe("valid");
    const status = await getAiKeyStatus(user.id);
    expect(status).toMatchObject({ last4: "ABCD", invalid: false });
    expect(JSON.stringify(status)).not.toContain(KEY);

    const { data } = await adminClient().from("user_ai_keys").select("*").eq("user_id", user.id).single();
    expect(JSON.stringify(data)).not.toContain(KEY);
  });

  it("Given a stored key, Then getAnthropicClient returns a client using the user's own key", async () => {
    const client = await getAnthropicClient(user.id);
    expect(client.apiKey).toBe(KEY);
  });
});

describe("withUserAnthropic", () => {
  it("Given Anthropic rejects the stored key, Then the key is marked invalid and InvalidAiKeyError is thrown", async () => {
    const authError = Anthropic.APIError.generate(401, { type: "error", error: { type: "authentication_error" } }, "invalid x-api-key", new Headers());
    await expect(withUserAnthropic(user.id, async () => Promise.reject(authError))).rejects.toBeInstanceOf(InvalidAiKeyError);
    expect((await getAiKeyStatus(user.id))?.invalid).toBe(true);
  });

  it("Given an invalid key is replaced, Then the invalid flag clears", async () => {
    await saveAiKey(user.id, "sk-ant-api03-replacement-WXYZ", async () => "valid");
    expect(await getAiKeyStatus(user.id)).toMatchObject({ last4: "WXYZ", invalid: false });
  });
});

describe("deleteAiKey", () => {
  it("Given a stored key, When deleted, Then AI calls fail with MissingAiKeyError", async () => {
    await deleteAiKey(user.id);
    expect(await getAiKeyStatus(user.id)).toBeNull();
    await expect(getAnthropicClient(user.id)).rejects.toBeInstanceOf(MissingAiKeyError);
  });

  it("never logs key material", () => {
    expect(logs.join("\n")).not.toMatch(/sk-ant-api03/);
  });
});

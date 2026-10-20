import AnthropicFoundry from "@anthropic-ai/foundry-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";
import { buildExport } from "../account/export";
import { AI_MODELS, aiMetaOf, getAnthropicClient } from "./client";
import { getAiKeyStatus, saveAiKey } from "./keys";

const FOUNDRY_KEY = "FoundryKey0123456789abcdefWXYZ";
let user: TestUser;

beforeAll(async () => {
  user = await createTestUser();
  await user.client.from("profiles").insert(sampleProfile);
});
afterAll(async () => {
  await deleteTestUser(user);
});

describe("Foundry credentials", () => {
  it("Given a disallowed endpoint, Then nothing is stored and verification never runs", async () => {
    let verified = false;
    const verdict = await saveAiKey(
      user.id,
      { provider: "foundry", apiKey: FOUNDRY_KEY, endpoint: "https://evil.example/anthropic" },
      async () => {
        verified = true;
        return "valid";
      },
    );
    expect(verdict).toBe("invalid_endpoint");
    expect(verified).toBe(false);
    expect(await getAiKeyStatus(user.id)).toBeNull();
  });

  it("Given an invalid deployment name, Then nothing is stored", async () => {
    const verdict = await saveAiKey(
      user.id,
      { provider: "foundry", apiKey: FOUNDRY_KEY, endpoint: "https://my-res.services.ai.azure.com/anthropic", mainDeployment: "bad name" },
      async () => "valid",
    );
    expect(verdict).toBe("invalid_deployment");
    expect(await getAiKeyStatus(user.id)).toBeNull();
  });

  it("Given verification fails with deployment_not_found, Then nothing is stored", async () => {
    const verdict = await saveAiKey(
      user.id,
      { provider: "foundry", apiKey: FOUNDRY_KEY, endpoint: "https://my-res.services.ai.azure.com/anthropic" },
      async () => "deployment_not_found",
    );
    expect(verdict).toBe("deployment_not_found");
    expect(await getAiKeyStatus(user.id)).toBeNull();
  });

  it("Given valid credentials without deployments, Then status shows provider, host and last4, and the client uses default models", async () => {
    let checkedDeployment = "";
    const verdict = await saveAiKey(
      user.id,
      { provider: "foundry", apiKey: ` ${FOUNDRY_KEY} `, endpoint: "https://My-Res.services.ai.azure.com/anthropic/" },
      async (c) => {
        checkedDeployment = c.provider === "foundry" ? c.mainDeployment : "";
        return "valid";
      },
    );
    expect(verdict).toBe("valid");
    expect(checkedDeployment).toBe(AI_MODELS.main);
    expect(await getAiKeyStatus(user.id)).toMatchObject({ provider: "foundry", endpointHost: "my-res.services.ai.azure.com", last4: "WXYZ", invalid: false });

    const client = await getAnthropicClient(user.id);
    expect(client).toBeInstanceOf(AnthropicFoundry);
    expect(client.baseURL).toBe("https://my-res.services.ai.azure.com/anthropic/");
    expect(client.apiKey).toBe(FOUNDRY_KEY);
    expect(aiMetaOf(client)).toEqual({ provider: "foundry", models: AI_MODELS });
  });

  it("Given custom deployment names, Then the client resolves to them", async () => {
    await saveAiKey(
      user.id,
      { provider: "foundry", apiKey: FOUNDRY_KEY, endpoint: "https://my-res.services.ai.azure.com/anthropic", mainDeployment: "opus-prod", fastDeployment: "haiku-prod" },
      async () => "valid",
    );
    expect(aiMetaOf(await getAnthropicClient(user.id)).models).toEqual({ main: "opus-prod", fast: "haiku-prod" });
  });

  it("never exports the key or the endpoint", async () => {
    const json = JSON.stringify(await buildExport(user.client, user.id, []));
    expect(json).not.toContain(FOUNDRY_KEY);
    expect(json).not.toContain("services.ai.azure.com");
  });

  it("Given a Foundry user saves an Anthropic key, Then the row switches provider and clears Foundry fields", async () => {
    await saveAiKey(user.id, { provider: "anthropic", apiKey: "sk-ant-api03-switch-key-ABCD" }, async () => "valid");
    expect(await getAiKeyStatus(user.id)).toMatchObject({ provider: "anthropic", endpointHost: null, last4: "ABCD" });
    const { data } = await adminClient().from("user_ai_keys").select("endpoint, main_deployment, fast_deployment").eq("user_id", user.id).single();
    expect(data).toEqual({ endpoint: null, main_deployment: null, fast_deployment: null });
    const client = await getAnthropicClient(user.id);
    expect(client).not.toBeInstanceOf(AnthropicFoundry);
    expect(aiMetaOf(client)).toEqual({ provider: "anthropic", models: AI_MODELS });
  });
});

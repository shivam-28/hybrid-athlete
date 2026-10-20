import { describe, expect, it } from "vitest";
import { isValidDeploymentName, parseFoundryEndpoint } from "./foundry-endpoint";

describe("parseFoundryEndpoint", () => {
  it.each([
    ["https://my-res.services.ai.azure.com/anthropic", "my-res"],
    ["https://my-res.services.ai.azure.com/anthropic/", "my-res"],
    ["  https://My-Res.services.ai.azure.com/anthropic  ", "my-res"],
    ["https://admss-mmkdoxwn-swedencentral.services.ai.azure.com/anthropic", "admss-mmkdoxwn-swedencentral"],
  ])("accepts %s", (input, resource) => {
    expect(parseFoundryEndpoint(input)).toEqual({ resource, endpoint: `https://${resource}.services.ai.azure.com/anthropic` });
  });

  it.each([
    ["http (not https)", "http://my-res.services.ai.azure.com/anthropic"],
    ["another host", "https://my-res.openai.azure.com/anthropic"],
    ["look-alike suffix", "https://my-res.services.ai.azure.com.evil.com/anthropic"],
    ["nested subdomain", "https://a.b.services.ai.azure.com/anthropic"],
    ["IPv4 literal", "https://10.0.0.1/anthropic"],
    ["IPv6 literal", "https://[::1]/anthropic"],
    ["explicit port", "https://my-res.services.ai.azure.com:8443/anthropic"],
    ["userinfo", "https://user:pw@my-res.services.ai.azure.com/anthropic"],
    ["@ trick", "https://my-res.services.ai.azure.com@evil.com/anthropic"],
    ["query string", "https://my-res.services.ai.azure.com/anthropic?x=1"],
    ["fragment", "https://my-res.services.ai.azure.com/anthropic#x"],
    ["extra path", "https://my-res.services.ai.azure.com/anthropic/v1/messages"],
    ["missing path", "https://my-res.services.ai.azure.com/"],
    ["underscore in resource", "https://my_res.services.ai.azure.com/anthropic"],
    ["not a URL", "my-res"],
    ["empty", ""],
  ])("rejects %s", (_label, input) => {
    expect(parseFoundryEndpoint(input)).toBeNull();
  });
});

describe("isValidDeploymentName", () => {
  it.each(["claude-opus-5-5", "opus_prod.v2", "A1"])("accepts %s", (name) => {
    expect(isValidDeploymentName(name)).toBe(true);
  });
  it.each(["", "-leading", "has space", "slash/name", "x".repeat(65), "q?x"])("rejects %j", (name) => {
    expect(isValidDeploymentName(name)).toBe(false);
  });
});

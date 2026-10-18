import { describe, expect, it } from "vitest";
import { EXAMPLE_PAYLOAD, curlTestCommand } from "./example";
import { parseIngestPayload } from "./payload";

describe("setup guide example", () => {
  it("validates against the ingest schema", () => {
    expect(parseIngestPayload(EXAMPLE_PAYLOAD).success).toBe(true);
  });

  it("builds a curl command for the instance URL whose body is the example payload", () => {
    const command = curlTestCommand("https://ha.example.com/api/ingest/health");
    expect(command).toContain("curl -X POST 'https://ha.example.com/api/ingest/health'");
    const body = command.match(/-d '(.+)'$/)![1]!;
    expect(parseIngestPayload(JSON.parse(body)).success).toBe(true);
  });
});

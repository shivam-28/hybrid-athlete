import { describe, expect, it, vi } from "vitest";
import { AiRefusalError } from "@/server/ai/client";
import { extractBodyComposition, type ExtractionClient, type RawExtraction } from "./extract";

const NULLS: RawExtraction = {
  is_body_composition_report: true,
  test_date: null,
  method: null,
  mass_unit: null,
  weight: null,
  body_fat_pct: null,
  fat_mass: null,
  lean_mass: null,
  skeletal_muscle: null,
  visceral_fat_level: null,
  bmr_kcal: null,
  total_body_water: null,
  segmental_lean: null,
};
const doc = { mediaType: "image/jpeg" as const, base64: "AAAA" };

function client(result: { parsed_output: unknown; stop_reason?: string } | Error) {
  const parse = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return { stop_reason: "end_turn", ...result };
  });
  return { client: { beta: { messages: { parse } } } as unknown as ExtractionClient, parse };
}

describe("extractBodyComposition", () => {
  it("Given an InBody printout, Then a draft with values, method, date and 'not found' fields is returned", async () => {
    const { client: c, parse } = client({
      parsed_output: { ...NULLS, test_date: "2026-10-01", method: "inbody", mass_unit: "kg", weight: 79.2, body_fat_pct: 18.4, skeletal_muscle: 36.1 },
    });
    const result = await extractBodyComposition(c, doc);
    expect(result).toEqual({
      kind: "draft",
      draft: expect.objectContaining({ method: "inbody", test_date: "2026-10-01", unit: "kg", weight: 79.2, body_fat_pct: 18.4, skeletal_muscle: 36.1, fat_mass: null }),
      notFound: expect.arrayContaining(["fat_mass", "lean_mass", "visceral_fat_level", "bmr_kcal", "total_body_water"]),
    });

    const [body] = parse.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(body).toMatchObject({ model: "claude-opus-5-5", fallbacks: "default", betas: ["server-side-fallback-2026-07-01"] });
    expect(body).not.toHaveProperty("tool_choice");
    expect(body).not.toHaveProperty("thinking");
    expect(JSON.stringify(body.messages)).toContain('"type":"image"');
  });

  it("Given a report printed in lb, Then masses are converted to kg", async () => {
    const { client: c } = client({ parsed_output: { ...NULLS, mass_unit: "lb", weight: 172.8, fat_mass: 32, segmental_lean: { left_arm: 8, right_arm: null, trunk: 60, left_leg: null, right_leg: null } } });
    const result = await extractBodyComposition(c, doc);
    expect(result.kind === "draft" && result.draft).toMatchObject({ unit: "kg", weight: 78.38, fat_mass: 14.51, segmental_lean: { left_arm: 3.63, trunk: 27.22 } });
  });

  it("sends PDFs as native document blocks", async () => {
    const { client: c, parse } = client({ parsed_output: { ...NULLS, body_fat_pct: 20 } });
    await extractBodyComposition(c, { mediaType: "application/pdf", base64: "JVBERi0=" });
    expect(JSON.stringify((parse.mock.calls[0] as unknown as [Record<string, unknown>])[0].messages)).toContain('"type":"document"');
  });

  it("Given an image with no body composition data, Then 'empty'", async () => {
    expect(await extractBodyComposition(client({ parsed_output: { ...NULLS, is_body_composition_report: false } }).client, doc)).toEqual({ kind: "empty" });
    expect(await extractBodyComposition(client({ parsed_output: NULLS }).client, doc)).toEqual({ kind: "empty" });
  });

  it("Given an invalid date string, Then the date is treated as not found", async () => {
    const { client: c } = client({ parsed_output: { ...NULLS, test_date: "01/10/2026", body_fat_pct: 20 } });
    const result = await extractBodyComposition(c, doc);
    expect(result.kind === "draft" && result.draft.test_date).toBeNull();
    expect(result.kind === "draft" && result.notFound).toContain("test_date");
  });

  it("Given unparseable output, Then 'unreadable'", async () => {
    expect(await extractBodyComposition(client({ parsed_output: null }).client, doc)).toEqual({ kind: "unreadable" });
  });

  it("Given a refusal, Then AiRefusalError propagates (shown as 'Claude declined')", async () => {
    await expect(extractBodyComposition(client({ parsed_output: NULLS, stop_reason: "refusal" }).client, doc)).rejects.toBeInstanceOf(AiRefusalError);
  });

  it("Given a provider error, Then it propagates", async () => {
    await expect(extractBodyComposition(client(new Error("overloaded")).client, doc)).rejects.toThrow("overloaded");
  });
});

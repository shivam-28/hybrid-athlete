import { describe, expect, it, vi } from "vitest";
import { analyzePhotoPair, type AnalysisClient } from "./photo-analysis";

const img = { base64: "AAAA", date: "2026-08-01" };
const img2 = { base64: "BBBB", date: "2026-10-01" };

function client(parsed_output: unknown, stop_reason = "end_turn") {
  const parse = vi.fn(async () => ({ stop_reason, parsed_output }));
  return { c: { beta: { messages: { parse } } } as unknown as AnalysisClient, parse };
}

describe("analyzePhotoPair", () => {
  it("sends both photos to Opus 5.5 with refusal fallbacks and returns qualitative observations", async () => {
    const { c, parse } = client({ observations: ["Shoulders look broader.", "Waist appears narrower."], visual_impression: null });
    expect(await analyzePhotoPair(c, img, img2, "front")).toEqual({
      observations: ["Shoulders look broader.", "Waist appears narrower."],
      visualImpression: null,
    });
    const [body] = parse.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(body).toMatchObject({ model: "claude-opus-5-5", fallbacks: "default" });
    expect(JSON.stringify(body.messages).match(/"type":"image"/g)).toHaveLength(2);
  });

  it("never keeps a body-fat figure in observations; numbers only survive as the labelled visual impression", async () => {
    const { c } = client({
      observations: ["Abs more visible, around 14% body fat.", "Posture is more upright."],
      visual_impression: "Roughly 13–15 % body fat",
    });
    const result = await analyzePhotoPair(c, img, img2, "front");
    expect(result!.observations).toEqual(["Posture is more upright."]);
    expect(result!.visualImpression).toBe("Roughly 13–15 % body fat");
  });

  it("Given a refusal, unparseable output or no observations left, Then null", async () => {
    expect(await analyzePhotoPair(client(null).c, img, img2, "front")).toBeNull();
    expect(await analyzePhotoPair(client({ observations: ["x"], visual_impression: null }, "refusal").c, img, img2, "front")).toBeNull();
    expect(await analyzePhotoPair(client({ observations: ["About 12 % body fat"], visual_impression: null }).c, img, img2, "front")).toBeNull();
  });
});

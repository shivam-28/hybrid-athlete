import { describe, expect, it, vi } from "vitest";
import { aiParseUtterance, type AiCandidate, type AiClient } from "./ai-parse";

const candidates: [AiCandidate, AiCandidate] = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Dumbbell Shoulder Press", tracking_mode: "weight_reps" as const },
  { id: "22222222-2222-4222-8222-222222222222", name: "Barbell Shoulder Press", tracking_mode: "weight_reps" as const },
];
const input = { transcript: "did twelve on the overhead dumbbell thing with the twelves, fifteen of them", candidates, activeExerciseName: null, unit: "kg" as const };

function client(result: { parsed_output: unknown; stop_reason?: string } | Error): AiClient & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  return {
    calls,
    messages: {
      parse: vi.fn(async (...args: unknown[]) => {
        calls.push(args);
        if (result instanceof Error) throw result;
        return { stop_reason: "end_turn", ...result };
      }),
    } as never,
  };
}

describe("aiParseUtterance", () => {
  it("Given valid output naming a candidate, Then it returns the exercise and sets", async () => {
    const c = client({ parsed_output: { exercise_id: candidates[0].id, sets: [{ weight_kg: 12, reps: 15, duration_s: null, distance_m: null }] } });
    expect(await aiParseUtterance(c, input)).toEqual({
      exerciseId: candidates[0].id,
      sets: [{ weight_kg: 12, reps: 15, duration_s: null, distance_m: null }],
    });
    const [body, options] = c.calls[0] as [Record<string, unknown>, Record<string, unknown>];
    expect(body.model).toBe("claude-haiku-4-5");
    expect(body).not.toHaveProperty("thinking");
    expect(options).toMatchObject({ timeout: 8000, maxRetries: 0 });
  });

  it("Given an exercise id outside the candidates, Then the output is discarded", async () => {
    const c = client({ parsed_output: { exercise_id: "33333333-3333-4333-8333-333333333333", sets: [{ weight_kg: 12, reps: 15, duration_s: null, distance_m: null }] } });
    expect(await aiParseUtterance(c, input)).toBeNull();
  });

  it("Given reps of 0, Then the output is discarded", async () => {
    const c = client({ parsed_output: { exercise_id: candidates[0].id, sets: [{ weight_kg: 12, reps: 0, duration_s: null, distance_m: null }] } });
    expect(await aiParseUtterance(c, input)).toBeNull();
  });

  it("Given unparseable output or a refusal, Then null", async () => {
    expect(await aiParseUtterance(client({ parsed_output: null }), input)).toBeNull();
    expect(await aiParseUtterance(client({ parsed_output: { exercise_id: candidates[0].id, sets: [] }, stop_reason: "refusal" }), input)).toBeNull();
  });

  it("Given a timeout or provider error, Then the error propagates for the caller to report", async () => {
    await expect(aiParseUtterance(client(new Error("Request timed out.")), input)).rejects.toThrow(/timed out/);
  });
});

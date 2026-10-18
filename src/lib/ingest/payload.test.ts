import { describe, expect, it } from "vitest";
import { SPORTS, ingestJsonSchema, parseIngestPayload } from "./payload";

const workout = {
  sport: "running",
  start: "2026-06-14T07:00:00+02:00",
  end: "2026-06-14T07:45:00+02:00",
  duration_s: 2700,
  distance_m: 8000,
};

describe("parseIngestPayload", () => {
  it("Given a daily entry with only date and steps, Then it is accepted", () => {
    const result = parseIngestPayload({ daily: [{ date: "2026-06-14", steps: 8234 }] });
    expect(result.success).toBe(true);
    expect(result.success && result.data.daily?.[0]).toEqual({ date: "2026-06-14", steps: 8234 });
  });

  it("accepts an empty payload and rounds integer metrics sent as decimals by Shortcuts", () => {
    expect(parseIngestPayload({}).success).toBe(true);
    const result = parseIngestPayload({ daily: [{ date: "2026-06-14", steps: 8234.6, resting_hr_bpm: 51.4 }] });
    expect(result.success && result.data.daily?.[0]).toMatchObject({ steps: 8235, resting_hr_bpm: 51 });
  });

  it("Given a workout with end before start among valid ones, Then the payload is rejected naming the entry", () => {
    const result = parseIngestPayload({ workouts: [workout, workout, workout, { ...workout, end: "2026-06-14T06:00:00+02:00" }] });
    expect(result.success).toBe(false);
    expect(!result.success && result.issues.map((i) => i.path)).toContain("workouts.3.end");
  });

  it.each([
    [{ steps: -1 }, "daily.0.steps"],
    [{ resting_hr_bpm: 19 }, "daily.0.resting_hr_bpm"],
    [{ resting_hr_bpm: 251 }, "daily.0.resting_hr_bpm"],
  ])("Given out-of-range daily %o, Then it is rejected", (extra, path) => {
    const result = parseIngestPayload({ daily: [{ date: "2026-06-14", ...extra }] });
    expect(!result.success && result.issues.map((i) => i.path)).toContain(path);
  });

  it("Given an unknown sport, Then the error names the allowed values", () => {
    const result = parseIngestPayload({ workouts: [{ ...workout, sport: "yoga" }] });
    expect(result.success).toBe(false);
    const message = !result.success ? result.issues.find((i) => i.path === "workouts.0.sport")?.message : "";
    for (const sport of SPORTS) expect(message).toContain(sport);
  });

  it("rejects a user_id anywhere in the payload, so ownership only comes from the token", () => {
    expect(parseIngestPayload({ user_id: "x", daily: [] }).success).toBe(false);
    expect(parseIngestPayload({ daily: [{ date: "2026-06-14", user_id: "x" }] }).success).toBe(false);
    expect(parseIngestPayload({ workouts: [{ ...workout, user_id: "x" }] }).success).toBe(false);
  });

  it("requires ISO 8601 times with an offset", () => {
    expect(parseIngestPayload({ workouts: [{ ...workout, start: "2026-06-14 07:00" }] }).success).toBe(false);
  });
});

describe("ingestJsonSchema", () => {
  it("publishes daily and workouts with the allowed sports", () => {
    const schema = JSON.stringify(ingestJsonSchema());
    expect(schema).toContain('"daily"');
    expect(schema).toContain('"workouts"');
    for (const sport of SPORTS) expect(schema).toContain(`"${sport}"`);
  });
});

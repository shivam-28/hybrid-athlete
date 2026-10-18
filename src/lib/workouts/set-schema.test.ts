import { describe, expect, it } from "vitest";
import { validateSetForMode } from "./set-schema";

describe("validateSetForMode", () => {
  it("Given weight × reps, Then 12 kg × 15 is a working set", () => {
    const r = validateSetForMode("weight_reps", { weight_kg: 12, reps: 15 });
    expect(r).toEqual({ success: true, data: { weight_kg: 12, reps: 15, duration_s: null, distance_m: null, rpe: null, set_type: "working" } });
  });

  it.each([
    ["weight_reps", { reps: 10 }, "weight_kg", /weight is required/i],
    ["weight_reps", { weight_kg: 10 }, "reps", /reps are required/i],
    ["bodyweight_reps", { weight_kg: 5 }, "reps", /reps are required/i],
    ["duration", { reps: 10 }, "duration_s", /duration is required/i],
    ["distance_duration", { weight_kg: 20 }, "distance_m", /distance or duration is required/i],
  ] as const)("Given %s without required fields, Then %s has an error", (mode, values, field, message) => {
    const r = validateSetForMode(mode, values);
    expect(r.success).toBe(false);
    expect(!r.success && r.errors[field]?.[0]).toMatch(message);
  });

  it.each([
    [{ weight_kg: -5, reps: 5 }, "weight_kg"],
    [{ weight_kg: 501, reps: 5 }, "weight_kg"],
    [{ weight_kg: 10, reps: 250 }, "reps"],
    [{ weight_kg: 10, reps: 0 }, "reps"],
    [{ weight_kg: 10, reps: 5.5 }, "reps"],
    [{ weight_kg: 10, reps: 5, rpe: 7.3 }, "rpe"],
    [{ weight_kg: 10, reps: 5, rpe: 11 }, "rpe"],
  ])("rejects impossible values %j", (values, field) => {
    const r = validateSetForMode("weight_reps", values);
    expect(!r.success && r.errors[field as keyof typeof r.errors]).toBeTruthy();
  });

  it("accepts RPE in 0.5 steps and boundary values", () => {
    expect(validateSetForMode("weight_reps", { weight_kg: 0, reps: 100, rpe: 7.5 }).success).toBe(true);
    expect(validateSetForMode("duration", { duration_s: 7200 }).success).toBe(true);
    expect(validateSetForMode("distance_duration", { distance_m: 50000 }).success).toBe(true);
    expect(validateSetForMode("duration", { duration_s: 7201 }).success).toBe(false);
  });

  it("Given bodyweight reps, Then added weight is optional and kept when given", () => {
    expect(validateSetForMode("bodyweight_reps", { reps: 8 })).toMatchObject({ success: true, data: { weight_kg: null, reps: 8 } });
    expect(validateSetForMode("bodyweight_reps", { reps: 8, weight_kg: 2.5 })).toMatchObject({ success: true, data: { weight_kg: 2.5 } });
  });

  it("drops fields that the tracking mode does not use", () => {
    const r = validateSetForMode("weight_reps", { weight_kg: 50, reps: 8, duration_s: 30, distance_m: 100 });
    expect(r).toMatchObject({ success: true, data: { duration_s: null, distance_m: null } });
  });
});

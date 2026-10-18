import { describe, expect, it } from "vitest";
import { progressionDefaults, suggestNext, type ProgressionExercise, type SessionSets } from "./progression";

const press: ProgressionExercise = { tracking_mode: "weight_reps", mechanic: "compound", equipment: "dumbbell" };
const squat: ProgressionExercise = { tracking_mode: "weight_reps", mechanic: "compound", equipment: "barbell" };
const raise: ProgressionExercise = { tracking_mode: "weight_reps", mechanic: "isolation", equipment: "dumbbell" };
const pullup: ProgressionExercise = { tracking_mode: "bodyweight_reps", mechanic: "compound", equipment: "body only" };
const plank: ProgressionExercise = { tracking_mode: "duration", mechanic: "isolation", equipment: "body only" };

const wr = (weight: number, ...reps: number[]): SessionSets => reps.map((r) => ({ weight_kg: weight, reps: r, duration_s: null }));

describe("progressionDefaults", () => {
  it.each([
    [squat, { repMin: 6, repMax: 10, incrementKg: 2.5 }],
    [raise, { repMin: 10, repMax: 15, incrementKg: 2 }],
    [pullup, { repMin: 8, repMax: 15, incrementKg: 2.5 }],
    [{ tracking_mode: "weight_reps", mechanic: "compound", equipment: "kettlebells" } as const, { incrementKg: 4 }],
    [{ tracking_mode: "weight_reps", mechanic: "isolation", equipment: "cable" } as const, { incrementKg: 2.5 }],
    [{ tracking_mode: "weight_reps", mechanic: null, equipment: "machine" } as const, { repMin: 6, repMax: 10, incrementKg: 2.5 }],
  ])("defaults for %j", (exercise, expected) => {
    expect(progressionDefaults(exercise)).toMatchObject(expected);
  });

  it("uses +5 s for holds", () => {
    expect(progressionDefaults(plank).durationIncrementS).toBe(5);
  });
});

describe("suggestNext", () => {
  it("Given no previous session, Then baseline guidance with the rep range and no weight", () => {
    expect(suggestNext(squat, null, [])).toEqual({ kind: "baseline", repMin: 6, repMax: 10 });
  });

  it("Given 12 kg × 15, 15, 15 with range 10–15 and 2 kg steps, Then 14 kg × 10", () => {
    const settings = { rep_min: 10, rep_max: 15, increment_kg: null, duration_increment_s: null };
    expect(suggestNext(press, settings, [wr(12, 15, 15, 15)])).toEqual({ kind: "increase", weightKg: 14, reps: [10, 10, 10] });
  });

  it("Given 50 kg × 10, 9, 8 with range 6–10, Then 50 kg aiming 10, 9, 9", () => {
    expect(suggestNext(squat, null, [wr(50, 10, 9, 8)])).toEqual({ kind: "add_rep", weightKg: 50, reps: [10, 9, 9] });
  });

  it("Given a user increment override of 1 kg, Then steps use 1 kg", () => {
    const settings = { rep_min: null, rep_max: null, increment_kg: 1, duration_increment_s: null };
    expect(suggestNext(raise, settings, [wr(6, 15, 15)])).toMatchObject({ kind: "increase", weightKg: 7 });
  });

  it("Given bodyweight × 15, 15, 15 with range 8–15, Then +2.5 kg added weight for 8 reps", () => {
    const sets = [15, 15, 15].map((r) => ({ weight_kg: null, reps: r, duration_s: null }));
    expect(suggestNext(pullup, null, [sets])).toEqual({ kind: "increase", weightKg: 2.5, reps: [8, 8, 8] });
  });

  it("Given bodyweight reps below the top, Then one more rep on the lowest set", () => {
    const sets = [10, 9, 9].map((r) => ({ weight_kg: null, reps: r, duration_s: null }));
    expect(suggestNext(pullup, null, [sets])).toEqual({ kind: "add_rep", weightKg: null, reps: [10, 10, 9] });
  });

  it("Given a 60 s plank, Then a 65 s hold", () => {
    expect(suggestNext(plank, null, [[{ weight_kg: null, reps: null, duration_s: 45 }, { weight_kg: null, reps: null, duration_s: 60 }]])).toEqual({
      kind: "hold",
      durationS: 65,
    });
  });

  it("Given best e1RM 90 → 87 → 84 over three sessions, Then deload 10% from the latest top weight, rounded to the increment", () => {
    const sessions = [wr(70, 6, 6, 5), wr(70, 7, 7, 7), wr(72.5, 7, 7, 7)]; // newest first: e1RM ≈ 84, 86.3, 89.4
    expect(suggestNext(squat, null, sessions)).toEqual({ kind: "deload", weightKg: 62.5, reps: [6, 6, 6] });
  });

  it("Given only the latest session dropped, Then normal double progression", () => {
    const sessions = [wr(70, 6, 6, 5), wr(70, 7, 7, 7), wr(70, 6, 6, 6)];
    expect(suggestNext(squat, null, sessions)).toEqual({ kind: "add_rep", weightKg: 70, reps: [6, 6, 6] });
  });

  it("Given mixed weights last session, Then it keeps the top working weight", () => {
    expect(suggestNext(squat, null, [[...wr(60, 10), ...wr(62.5, 8, 7)]])).toEqual({ kind: "add_rep", weightKg: 62.5, reps: [10, 8, 8] });
  });
});

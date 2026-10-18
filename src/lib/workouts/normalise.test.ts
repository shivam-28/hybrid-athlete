import { describe, expect, it } from "vitest";
import { normaliseExerciseText } from "./normalise";

describe("normaliseExerciseText", () => {
  it.each([
    ["Dumbbell Shoulder Press", "dumbbell shoulder press"],
    ["  SHOULDER   press!! ", "shoulder press"],
    ["Barbell Bench Press - Medium Grip", "barbell bench press medium grip"],
    ["Farmer's Walk", "farmer walk"],
    ["Pullups", "pullup"],
    ["pull ups", "pullup"],
    ["pull-up", "pullup"],
    ["Push-Ups", "pushup"],
    ["press ups", "pushup"],
    ["chin ups", "chinup"],
    ["sit-ups", "situp"],
    ["db curls", "dumbbell curl"],
    ["bb squats", "barbell squat"],
    ["kb swings", "kettlebell swing"],
    ["ohp", "overhead press"],
    ["Dumbbell Lunges", "dumbbell lunge"],
    ["lateral raises", "lateral raise"],
    ["abs", "abs"],
    ["Dumbbell Bicep Curl", "dumbbell bicep curl"],
    ["biceps curls", "bicep curl"],
    ["Dips - Triceps Version", "dip tricep version"],
    ["3/4 Sit-Up", "3 4 situp"],
  ])("%s → %s", (input, expected) => {
    expect(normaliseExerciseText(input)).toBe(expected);
  });

  it("keeps words ending in ss or us", () => {
    expect(normaliseExerciseText("press")).toBe("press");
    expect(normaliseExerciseText("gluteus")).toBe("gluteus");
  });

  it("is idempotent", () => {
    for (const s of ["Push-Ups", "db curls", "Barbell Bench Press - Medium Grip"]) {
      expect(normaliseExerciseText(normaliseExerciseText(s))).toBe(normaliseExerciseText(s));
    }
  });
});

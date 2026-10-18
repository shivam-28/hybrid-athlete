import { describe, expect, it } from "vitest";
import { bestSet, estimatedOneRepMax, formatSetValues, formatSetsSummary } from "./history";

describe("estimatedOneRepMax (Epley)", () => {
  it("computes w × (1 + reps/30)", () => {
    expect(estimatedOneRepMax(50, 10)).toBeCloseTo(66.67, 2);
    expect(estimatedOneRepMax(55, 6)).toBeCloseTo(66.0, 2);
  });
});

describe("bestSet", () => {
  it("Given 50 kg × 10 and 55 kg × 6, Then 50 × 10 is best", () => {
    const sets = [
      { id: "a", weight_kg: 50, reps: 10 },
      { id: "b", weight_kg: 55, reps: 6 },
    ];
    expect(bestSet(sets)?.id).toBe("a");
  });

  it("ignores sets without weight or reps and returns null when none qualify", () => {
    expect(bestSet([{ id: "a", weight_kg: null, reps: 10 }])).toBeNull();
    expect(bestSet([])).toBeNull();
  });
});

describe("formatting", () => {
  it("Given 3 × 8 at 50 kg, Then 'Last time' reads 50 kg × 8, 8, 8", () => {
    const sets = [8, 8, 8].map((reps) => ({ weight_kg: 50, reps, duration_s: null, distance_m: null }));
    expect(formatSetsSummary(sets, "metric")).toBe("50 kg × 8, 8, 8");
  });

  it("lists each set when weights differ", () => {
    const sets = [
      { weight_kg: 50, reps: 8, duration_s: null, distance_m: null },
      { weight_kg: 52.5, reps: 6, duration_s: null, distance_m: null },
    ];
    expect(formatSetsSummary(sets, "metric")).toBe("50 kg × 8, 52.5 kg × 6");
  });

  it("formats bodyweight, holds and distances", () => {
    expect(formatSetValues({ weight_kg: null, reps: 8, duration_s: null, distance_m: null }, "metric")).toBe("BW × 8");
    expect(formatSetValues({ weight_kg: 10, reps: 8, duration_s: null, distance_m: null }, "metric", "bodyweight_reps")).toBe("BW +10 kg × 8");
    expect(formatSetValues({ weight_kg: null, reps: null, duration_s: 65, distance_m: null }, "metric")).toBe("1:05");
    expect(formatSetValues({ weight_kg: 32, reps: null, duration_s: 60, distance_m: 40 }, "metric")).toBe("32 kg · 40 m · 1:00");
  });
});

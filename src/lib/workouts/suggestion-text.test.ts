import { describe, expect, it } from "vitest";
import { describeSuggestion } from "./suggestion-text";

describe("describeSuggestion", () => {
  it("reads 'Today: 52.5 kg × 6'", () => {
    expect(describeSuggestion({ kind: "increase", weightKg: 52.5, reps: [6, 6, 6] }, "metric")).toEqual({ label: "Today", text: "52.5 kg × 6" });
  });
  it("lists differing reps and bodyweight", () => {
    expect(describeSuggestion({ kind: "add_rep", weightKg: null, reps: [10, 10, 9] }, "metric").text).toBe("BW × 10, 10, 9");
  });
  it("labels baselines, holds and deloads", () => {
    expect(describeSuggestion({ kind: "baseline", repMin: 6, repMax: 10 }, "metric").label).toBe("Baseline");
    expect(describeSuggestion({ kind: "hold", durationS: 65 }, "metric").text).toBe("Hold 1:05");
    expect(describeSuggestion({ kind: "deload", weightKg: 62.5, reps: [6, 6] }, "imperial").label).toBe("Deload");
  });
});

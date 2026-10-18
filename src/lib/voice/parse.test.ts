import { describe, expect, it } from "vitest";
import { parseUtterance } from "./parse";
import { FIXTURES } from "./parse.fixtures";

/** Share of the corpus the grammar parses exactly. Raise it as the grammar improves; never lower it. */
const COVERAGE_BASELINE = 0.98; // 63/64 on 2026-10-18

function matches(fixture: (typeof FIXTURES)[number]) {
  const result = parseUtterance(fixture.say, { defaultUnit: fixture.defaultUnit ?? "kg" });
  const e = fixture.expect;
  if ("repeat" in e) return result.kind === "repeat";
  if (result.kind !== "sets") return false;
  return (
    result.exerciseText === e.exercise &&
    JSON.stringify(result.sets) === JSON.stringify(e.sets) &&
    result.bodyweight === (e.bodyweight ?? false) &&
    (e.complete === undefined || result.complete === e.complete)
  );
}

describe("parseUtterance corpus", () => {
  it("has at least 50 utterances", () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(50);
  });

  for (const fixture of FIXTURES.filter((f) => !f.gap)) {
    it(`parses "${fixture.say}"`, () => {
      const result = parseUtterance(fixture.say, { defaultUnit: fixture.defaultUnit ?? "kg" });
      const e = fixture.expect;
      if ("repeat" in e) {
        expect(result.kind).toBe("repeat");
        return;
      }
      expect(result).toMatchObject({
        kind: "sets",
        exerciseText: e.exercise,
        sets: e.sets,
        bodyweight: e.bodyweight ?? false,
        ...(e.complete !== undefined && { complete: e.complete }),
      });
    });
  }

  it(`keeps deterministic coverage at or above ${COVERAGE_BASELINE * 100}%`, () => {
    const covered = FIXTURES.filter(matches).length / FIXTURES.length;
    expect(covered).toBeGreaterThanOrEqual(COVERAGE_BASELINE);
  });
});

describe("parseUtterance completeness", () => {
  it("marks a parse with values and no stray numbers as complete", () => {
    expect(parseUtterance("squat 60 kg 8 reps", { defaultUnit: "kg" })).toMatchObject({ complete: true });
  });

  it("marks conflicting values as incomplete", () => {
    expect(parseUtterance("squat 60 kg 8 reps 9 reps", { defaultUnit: "kg" })).toMatchObject({ complete: false });
  });

  it("marks a parse with no values as incomplete", () => {
    expect(parseUtterance("hello there", { defaultUnit: "kg" })).toMatchObject({ complete: false });
  });
});

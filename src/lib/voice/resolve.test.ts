import { describe, expect, it } from "vitest";
import { MATCH_CONFIDENCE, isConfidentMatch } from "./resolve";

const c = (score: number, id = String(score)) => ({ id, name: id, score });

describe("isConfidentMatch", () => {
  it("uses the documented thresholds", () => {
    expect(MATCH_CONFIDENCE).toEqual({ minScore: 0.55, minLead: 0.1 });
  });

  it("Given a top score ≥ 0.55 leading the runner-up by ≥ 0.10, Then confident", () => {
    expect(isConfidentMatch([c(1), c(0.65)])).toBe(true);
    expect(isConfidentMatch([c(0.92), c(0.69)])).toBe(true);
  });

  it("Given a single candidate above the threshold, Then confident", () => {
    expect(isConfidentMatch([c(0.7)])).toBe(true);
  });

  it("Given close candidates (shoulder press), Then not confident", () => {
    expect(isConfidentMatch([c(0.86), c(0.83), c(0.81)])).toBe(false);
  });

  it("Given a low top score, Then not confident", () => {
    expect(isConfidentMatch([c(0.5), c(0.2)])).toBe(false);
    expect(isConfidentMatch([])).toBe(false);
  });
});

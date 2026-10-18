import { describe, expect, it } from "vitest";
import { derivePhase, weeksToRace } from "./phase";

const WEEK = "2026-10-19"; // Monday
const inWeeks = (n: number) => new Date(Date.parse(`${WEEK}T00:00:00Z`) + n * 7 * 86_400_000).toISOString().slice(0, 10);

describe("derivePhase", () => {
  it("Given no race, Then the phase is base", () => {
    expect(derivePhase(null, WEEK)).toBe("base");
  });

  it.each([
    [17, "base"],
    [16, "build"],
    [10, "build"],
    [7, "build"],
    [6, "peak"],
    [3, "peak"],
    [2, "taper"],
    [0, "taper"],
  ])("Given a race %i weeks after the week start, Then the phase is %s", (weeks, phase) => {
    expect(derivePhase(inWeeks(weeks), WEEK)).toBe(phase);
  });

  it("Given a race a few days into a week, Then whole weeks are counted", () => {
    expect(weeksToRace("2026-10-29", WEEK)).toBe(1);
  });

  it("Given a race date already before the week, Then it is treated as no race", () => {
    expect(derivePhase("2026-10-10", WEEK)).toBe("base");
  });
});

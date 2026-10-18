import { describe, expect, it } from "vitest";
import { remainingOrOver } from "./day-totals";

describe("remainingOrOver", () => {
  it("Given 2800 kcal / 144 g targets and 1900 kcal / 100 g logged, Then 900 kcal and 44 g remain", () => {
    expect(remainingOrOver(2800, 1900)).toEqual({ kind: "remaining", amount: 900 });
    expect(remainingOrOver(144, 100)).toEqual({ kind: "remaining", amount: 44 });
  });

  it("Given logged kcal above target, Then the overage is a positive 'over' amount", () => {
    expect(remainingOrOver(2000, 2350)).toEqual({ kind: "over", amount: 350 });
  });

  it("rounds to whole units", () => {
    expect(remainingOrOver(144, 99.6)).toEqual({ kind: "remaining", amount: 44 });
  });
});

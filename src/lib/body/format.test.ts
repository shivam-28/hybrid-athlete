import { describe, expect, it } from "vitest";
import { displayWeight, formatRate, formatSignedLength } from "./format";

describe("body formatting", () => {
  it("formats weekly rates in the user's unit", () => {
    expect(formatRate(-0.4, -0.5, "metric")).toBe("−0.40 kg/week (−0.50 %/week)");
    expect(formatRate(0.2, 0.25, "imperial")).toBe("+0.44 lb/week (+0.25 %/week)");
  });

  it("displays weights and lengths in the user's unit", () => {
    expect(displayWeight(78.38, "imperial")).toBe(172.8);
    expect(formatSignedLength(-2.54, "imperial")).toBe("−1.0 in");
  });
});

import { describe, expect, it } from "vitest";
import {
  cmToFeetInches,
  feetInchesToCm,
  formatHeight,
  formatWeight,
  kgToLb,
  kmToMiles,
  lbToKg,
  milesToKm,
} from "./units";

describe("height conversion", () => {
  it("Given 5 ft 10 in, Then 177.8 cm is stored", () => {
    expect(feetInchesToCm(5, 10)).toBe(177.8);
  });

  it("Given 177.8 cm, Then it displays as 5 ft 10 in", () => {
    expect(cmToFeetInches(177.8)).toEqual({ feet: 5, inches: 10 });
  });

  it("Given a value that rounds to 12 inches, Then it carries into feet", () => {
    expect(cmToFeetInches(182.6)).toEqual({ feet: 6, inches: 0 });
  });
});

describe("weight conversion", () => {
  it("Given 35 lb, Then 15.88 kg is stored", () => {
    expect(lbToKg(35)).toBe(15.88);
  });

  it("round-trips kg → lb → kg within 0.01 kg", () => {
    for (const kg of [0, 1.25, 12, 80.4, 142.5]) {
      expect(Math.abs(lbToKg(kgToLb(kg)) - kg)).toBeLessThanOrEqual(0.01);
    }
  });
});

describe("distance conversion", () => {
  it("converts marathon distance", () => {
    expect(kmToMiles(42.195)).toBeCloseTo(26.22, 2);
    expect(milesToKm(26.2188)).toBeCloseTo(42.195, 2);
  });
});

describe("formatting by unit system", () => {
  it("Given the same stored value, Then switching unit system changes only the display", () => {
    const storedKg = 80;
    expect(formatWeight(storedKg, "metric")).toBe("80 kg");
    expect(formatWeight(storedKg, "imperial")).toBe("176.4 lb");
    expect(storedKg).toBe(80);
    expect(formatHeight(177.8, "metric")).toBe("177.8 cm");
    expect(formatHeight(177.8, "imperial")).toBe("5 ft 10 in");
  });
});

describe("set weight display", () => {
  it("Given 15.88 kg, Then a metric user sees 16 kg and an imperial user sees 35 lb", async () => {
    const { formatSetWeight } = await import("./units");
    expect(formatSetWeight(15.88, "metric")).toBe("16 kg");
    expect(formatSetWeight(15.88, "imperial")).toBe("35 lb");
    expect(formatSetWeight(52.4, "metric")).toBe("52.5 kg");
    expect(formatSetWeight(12, "metric")).toBe("12 kg");
  });

  it("converts entered weights to stored kilograms", async () => {
    const { weightInputToKg } = await import("./units");
    expect(weightInputToKg(35, "imperial")).toBe(15.88);
    expect(weightInputToKg(12.5, "metric")).toBe(12.5);
  });
});

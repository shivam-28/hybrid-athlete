import { describe, expect, it } from "vitest";
import { weeklyRate } from "./rate";
import type { TrendPoint } from "./trend";

/** A 15-day series ending today whose trend moves linearly from `from` to `to`. */
function linear(from: number, to: number, weighedDays: number, today = "2026-10-15"): TrendPoint[] {
  const end = new Date(`${today}T00:00:00Z`);
  return Array.from({ length: 15 }, (_, i) => {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - (14 - i));
    const trend = from + ((to - from) * i) / 14;
    return { date: d.toISOString().slice(0, 10), weightKg: i >= 15 - weighedDays ? trend : null, trendKg: trend };
  });
}

describe("weeklyRate", () => {
  it("Given the trend moved 80.0 → 79.2 over 14 days, Then −0.40 kg/week and −0.50 %/week", () => {
    const rate = weeklyRate(linear(80, 79.2, 14), "2026-10-15");
    expect(rate).not.toBeNull();
    expect(rate!.kgPerWeek).toBeCloseTo(-0.4, 6);
    expect(rate!.pctPerWeek).toBeCloseTo(-0.5, 6);
  });

  it("Given only 5 daily weights in the last 14 days, Then there is not enough data", () => {
    expect(weeklyRate(linear(80, 79.2, 5), "2026-10-15")).toBeNull();
  });

  it("Given exactly 7 daily weights, Then a rate is reported", () => {
    expect(weeklyRate(linear(80, 79.2, 7), "2026-10-15")).not.toBeNull();
  });

  it("Given the series starts less than 14 days ago, Then the rate uses the available span", () => {
    const series = linear(80, 79.2, 14).slice(4); // starts 10 days before today
    const rate = weeklyRate(series, "2026-10-15");
    expect(rate!.kgPerWeek).toBeCloseTo(((79.2 - (80 - 0.8 * (4 / 14))) / 10) * 7, 6);
  });

  it("Given an empty series, Then not enough data", () => {
    expect(weeklyRate([], "2026-10-15")).toBeNull();
  });
});

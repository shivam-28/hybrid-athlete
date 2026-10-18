import { describe, expect, it } from "vitest";
import { trendSeries } from "./trend";

describe("trendSeries", () => {
  it("Given no weights, Then the series is empty", () => {
    expect(trendSeries([])).toEqual([]);
  });

  it("seeds the trend with the first daily weight", () => {
    expect(trendSeries([{ date: "2026-10-01", weightKg: 78 }])).toEqual([{ date: "2026-10-01", weightKg: 78, trendKg: 78 }]);
  });

  it("Given trend 78.0 and a next weight of 80.0, Then the new trend is 78.2", () => {
    const series = trendSeries([
      { date: "2026-10-01", weightKg: 78 },
      { date: "2026-10-02", weightKg: 80 },
    ]);
    expect(series[1]!.trendKg).toBeCloseTo(78.2, 6);
  });

  it("Given three missing days, Then they carry the last trend forward with no gaps", () => {
    const series = trendSeries([
      { date: "2026-10-01", weightKg: 78 },
      { date: "2026-10-02", weightKg: 80 },
      { date: "2026-10-06", weightKg: 78.2 },
    ]);
    expect(series.map((p) => p.date)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06"]);
    expect(series.slice(2, 5).map((p) => p.weightKg)).toEqual([null, null, null]);
    for (const p of series.slice(2, 5)) expect(p.trendKg).toBeCloseTo(78.2, 6);
  });

  it("extends the series to an end date by carrying the trend forward", () => {
    const series = trendSeries([{ date: "2026-10-01", weightKg: 78 }], "2026-10-03");
    expect(series.map((p) => [p.date, p.trendKg])).toEqual([
      ["2026-10-01", 78],
      ["2026-10-02", 78],
      ["2026-10-03", 78],
    ]);
  });

  it("sorts unordered input by date", () => {
    const series = trendSeries([
      { date: "2026-10-02", weightKg: 80 },
      { date: "2026-10-01", weightKg: 78 },
    ]);
    expect(series[0]!.trendKg).toBe(78);
  });
});

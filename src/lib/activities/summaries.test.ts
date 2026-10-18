import { describe, expect, it } from "vitest";
import { localDate } from "@/lib/time";
import { sevenDayAverage, weeklySummaries } from "./summaries";

describe("weeklySummaries", () => {
  it("Given 5 km Tue, 8 km Thu and 16 km Sun in one week, Then 29 km, 3 runs, longest 16 km", () => {
    const weeks = weeklySummaries(
      [
        { local_date: "2026-06-09", sport: "running", distance_m: 5000, moving_s: 1500 },
        { local_date: "2026-06-11", sport: "running", distance_m: 8000, moving_s: 2400 },
        { local_date: "2026-06-14", sport: "running", distance_m: 16000, moving_s: 5400 },
        { local_date: "2026-06-12", sport: "strength", distance_m: null, moving_s: 3000 },
      ],
      "2026-06-14",
    );
    const current = weeks.at(-1)!;
    expect(current).toEqual({ weekStart: "2026-06-08", runKm: 29, runs: 3, longestRunKm: 16, movingS: 12300 });
  });

  it("returns the current week plus the previous 8, oldest first, with empty weeks as zero", () => {
    const weeks = weeklySummaries([], "2026-06-14");
    expect(weeks).toHaveLength(9);
    expect(weeks[0]!.weekStart).toBe("2026-04-13");
    expect(weeks.at(-1)).toEqual({ weekStart: "2026-06-08", runKm: 0, runs: 0, longestRunKm: 0, movingS: 0 });
  });

  it("Given a run at 23:30 Copenhagen on a Sunday, Then it counts toward the week ending that Sunday", () => {
    const day = localDate(new Date("2026-06-14T21:30:00Z"), "Europe/Copenhagen");
    expect(day).toBe("2026-06-14");
    const weeks = weeklySummaries([{ local_date: day, sport: "running", distance_m: 10000, moving_s: 3000 }], "2026-06-15");
    expect(weeks.at(-2)).toMatchObject({ weekStart: "2026-06-08", runKm: 10, runs: 1 });
    expect(weeks.at(-1)).toMatchObject({ weekStart: "2026-06-15", runKm: 0 });
  });
});

describe("sevenDayAverage", () => {
  const today = "2026-06-14";

  it("Given resting HR on 5 of the last 7 days (50, 52, 51, 49, 53), Then the average is 51", () => {
    const rows = [
      ["2026-06-08", 50], ["2026-06-09", null], ["2026-06-10", 52], ["2026-06-11", 51],
      ["2026-06-12", null], ["2026-06-13", 49], ["2026-06-14", 53], ["2026-06-07", 99],
    ].map(([local_date, value]) => ({ local_date: local_date as string, value: value as number | null }));
    expect(sevenDayAverage(rows, today)).toBe(51);
  });

  it("Given values on only 2 of the last 7 days, Then the average is not available", () => {
    expect(sevenDayAverage([{ local_date: "2026-06-14", value: 40 }, { local_date: "2026-06-12", value: 42 }], today)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { activityLoad, trainingLoad } from "./load";

describe("activityLoad", () => {
  it("Given a 60-minute run with average HR in zone 2, Then load is 120", () => {
    expect(activityLoad({ sport: "running", movingS: 3600, elapsedS: 3700, avgHr: 120 }, 190)).toBe(120);
  });

  it("Given a 30-minute walk without HR, Then load is 30", () => {
    expect(activityLoad({ sport: "walking", movingS: 1800, elapsedS: null, avgHr: null }, 190)).toBe(30);
  });

  it("uses sport default 2 for non-walking activities without HR, and elapsed time when moving time is missing", () => {
    expect(activityLoad({ sport: "cycling", movingS: null, elapsedS: 1200, avgHr: null }, 190)).toBe(40);
  });

  it("treats an average HR below zone 1 as intensity 1", () => {
    expect(activityLoad({ sport: "walking", movingS: 600, elapsedS: null, avgHr: 80 }, 190)).toBe(10);
  });

  it("returns null when no duration is known", () => {
    expect(activityLoad({ sport: "running", movingS: null, elapsedS: null, avgHr: 150 }, 190)).toBeNull();
  });
});

describe("trainingLoad", () => {
  const today = "2026-06-28";

  it("Given 28 days with 600 load in the last 7 and 2000 in the last 28, Then chronic 500 and ratio 1.2", () => {
    const rows = [
      { local_date: "2026-06-01", load: 1400 },
      { local_date: "2026-06-22", load: 300 },
      { local_date: "2026-06-28", load: 300 },
    ];
    expect(trainingLoad(rows, today)).toEqual({ acute: 600, chronic: 500, ratio: 1.2, baselineReady: true });
  });

  it("Given the first activity was 10 days ago, Then the ratio is withheld while building baseline", () => {
    const result = trainingLoad([{ local_date: "2026-06-18", load: 100 }], today);
    expect(result.acute).toBe(0);
    expect(result.baselineReady).toBe(false);
    expect(result.ratio).toBeNull();
  });

  it("excludes activities older than 28 days and ignores null loads", () => {
    const result = trainingLoad(
      [
        { local_date: "2026-05-01", load: 999 },
        { local_date: "2026-06-27", load: null },
        { local_date: "2026-06-27", load: 50 },
      ],
      today,
    );
    expect(result).toMatchObject({ acute: 50, chronic: 12.5, baselineReady: true });
  });

  it("returns an empty state without activities", () => {
    expect(trainingLoad([], today)).toEqual({ acute: 0, chronic: 0, ratio: null, baselineReady: false });
  });
});

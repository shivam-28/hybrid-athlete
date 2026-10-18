import { describe, expect, it } from "vitest";
import { estimateMaxHr, resolveMaxHr, zoneBounds, zoneOf, zoneSeconds } from "./heart-rate";

describe("max heart rate", () => {
  it("Given age 30 and no profile value, Then 208 − 0.7 × 30 = 187 is estimated", () => {
    expect(estimateMaxHr(30)).toBe(187);
    expect(resolveMaxHr({ profileMaxHr: null, birthDate: "1996-01-01", onDate: "2026-06-14" })).toEqual({ bpm: 187, source: "estimated" });
  });

  it("Given a profile max HR, Then it is used and labelled as from the profile", () => {
    expect(resolveMaxHr({ profileMaxHr: 190, birthDate: "1996-01-01", onDate: "2026-06-14" })).toEqual({ bpm: 190, source: "profile" });
  });

  it("uses the age on the activity date, not today", () => {
    expect(resolveMaxHr({ profileMaxHr: null, birthDate: "1996-06-15", onDate: "2026-06-14" }).bpm).toBe(estimateMaxHr(29));
  });
});

describe("zones", () => {
  it("Given max HR 190, Then zone 2 is 114–133 bpm", () => {
    expect(zoneBounds(190)[1]).toEqual({ zone: 2, min: 114, max: 133 });
    expect(zoneBounds(190).map((z) => z.min)).toEqual([95, 114, 133, 152, 171]);
  });

  it("assigns heart rates to zones on exact percentage boundaries", () => {
    expect(zoneOf(94, 190)).toBe(0);
    expect(zoneOf(95, 190)).toBe(1);
    expect(zoneOf(114, 190)).toBe(2);
    expect(zoneOf(132, 190)).toBe(2);
    expect(zoneOf(133, 190)).toBe(3);
    expect(zoneOf(190, 190)).toBe(5);
    expect(zoneOf(205, 190)).toBe(5);
  });

  it("sums histogram seconds into zones 1–5, ignoring time below 50%", () => {
    expect(zoneSeconds({ "80": 600, "100": 60, "120": 120, "140": 30, "160": 10, "180": 5 }, 190)).toEqual([60, 120, 30, 10, 5]);
  });
});

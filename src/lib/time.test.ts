import { describe, expect, it } from "vitest";
import { DEFAULT_TIMEZONE, ageOn, isValidTimezone, localDate, startOfLocalDay } from "./time";

describe("localDate", () => {
  it("Given 23:30 Copenhagen time (21:30 UTC, CEST), Then the record belongs to the same local day", () => {
    expect(localDate(new Date("2026-10-18T21:30:00Z"), "Europe/Copenhagen")).toBe("2026-10-18");
  });

  it("Given 00:30 Copenhagen time (22:30 UTC previous day), Then it belongs to the local next day", () => {
    expect(localDate(new Date("2026-10-18T22:30:00Z"), "Europe/Copenhagen")).toBe("2026-10-19");
  });

  it("Given the autumn DST transition night (CET, UTC+1), Then 23:30 UTC is 00:30 local next day", () => {
    expect(localDate(new Date("2026-10-25T23:30:00Z"), "Europe/Copenhagen")).toBe("2026-10-26");
  });

  it("Given the night before spring DST (CET, UTC+1), Then 23:30 UTC on 28 March is 00:30 local on 29 March", () => {
    expect(localDate(new Date("2026-03-28T23:30:00Z"), "Europe/Copenhagen")).toBe("2026-03-29");
  });

  it("Given a timezone west of UTC, Then the earlier local day is used", () => {
    expect(localDate(new Date("2026-10-18T03:00:00Z"), "America/New_York")).toBe("2026-10-17");
  });

  it("Given an invalid or missing timezone, Then it falls back to Europe/Copenhagen", () => {
    expect(DEFAULT_TIMEZONE).toBe("Europe/Copenhagen");
    expect(localDate(new Date("2026-10-18T22:30:00Z"), "Not/AZone")).toBe("2026-10-19");
    expect(localDate(new Date("2026-10-18T22:30:00Z"), null)).toBe("2026-10-19");
  });
});

describe("isValidTimezone", () => {
  it("accepts IANA zones and rejects junk", () => {
    expect(isValidTimezone("Europe/Copenhagen")).toBe(true);
    expect(isValidTimezone("Asia/Kolkata")).toBe(true);
    expect(isValidTimezone("Mars/Olympus")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
  });
});

describe("ageOn", () => {
  it("Given the day before the birthday, Then age is not yet incremented", () => {
    expect(ageOn("1995-10-19", "2026-10-18")).toBe(30);
  });

  it("Given the birthday itself, Then age is incremented", () => {
    expect(ageOn("1995-10-18", "2026-10-18")).toBe(31);
  });

  it("Given a leap-day birthday in a non-leap year, Then the birthday counts from 1 March", () => {
    expect(ageOn("2004-02-29", "2026-02-28")).toBe(21);
    expect(ageOn("2004-02-29", "2026-03-01")).toBe(22);
  });
});

describe("isoWeekStart", () => {
  it("returns the Monday of the ISO week", async () => {
    const { isoWeekStart } = await import("./time");
    expect(isoWeekStart("2026-10-18")).toBe("2026-10-12"); // Sunday
    expect(isoWeekStart("2026-10-12")).toBe("2026-10-12"); // Monday
    expect(isoWeekStart("2026-10-14")).toBe("2026-10-12");
    expect(isoWeekStart("2027-01-01")).toBe("2026-12-28");
  });
});

describe("startOfLocalDay", () => {
  it("Given a summer date in Copenhagen (CEST), Then midnight local is 22:00 UTC the day before", () => {
    expect(startOfLocalDay("2026-10-01", "Europe/Copenhagen").toISOString()).toBe("2026-09-30T22:00:00.000Z");
  });

  it("Given a winter date in Copenhagen (CET), Then midnight local is 23:00 UTC the day before", () => {
    expect(startOfLocalDay("2026-01-15", "Europe/Copenhagen").toISOString()).toBe("2026-01-14T23:00:00.000Z");
  });

  it("Given New York, Then midnight local is 04:00 UTC in summer", () => {
    expect(startOfLocalDay("2026-10-01", "America/New_York").toISOString()).toBe("2026-10-01T04:00:00.000Z");
  });

  it("round-trips through localDate", () => {
    for (const d of ["2026-03-29", "2026-10-25", "2026-06-01"]) {
      expect(localDate(startOfLocalDay(d, "Europe/Copenhagen"), "Europe/Copenhagen")).toBe(d);
    }
  });
});

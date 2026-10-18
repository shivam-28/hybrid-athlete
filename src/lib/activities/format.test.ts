import { describe, expect, it } from "vitest";
import { formatDuration, formatLocalDateTime, formatPaceOrSpeed } from "./format";

describe("activity formatting", () => {
  it("Given 10.00 km in 52:30, Then pace is 5:15 /km", () => {
    expect(formatDuration(3150)).toBe("52:30");
    expect(formatPaceOrSpeed("running", 10000, 3150, "metric")).toBe("5:15 /km");
  });

  it("shows speed for rides and hours for long durations", () => {
    expect(formatPaceOrSpeed("cycling", 30000, 3600, "metric")).toBe("30.0 km/h");
    expect(formatDuration(3725)).toBe("1:02:05");
  });

  it("Given an activity at 23:30 UTC on 14 June, Then Copenhagen shows 15 June 01:30", () => {
    expect(formatLocalDateTime("2026-06-14T23:30:00Z", "Europe/Copenhagen")).toBe("Mon 15 Jun, 01:30");
  });
});

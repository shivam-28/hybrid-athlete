import { describe, expect, it } from "vitest";
import { inferMealType, localClock, remainingSlots } from "./meal-time";

describe("inferMealType", () => {
  it.each([
    ["06:00", "breakfast"],
    ["10:29", "breakfast"],
    ["10:30", "lunch"],
    ["12:40", "lunch"],
    ["14:59", "lunch"],
    ["15:00", "snack"],
    ["16:59", "snack"],
    ["17:00", "dinner"],
    ["21:29", "dinner"],
    ["21:30", "snack"],
    ["23:50", "snack"],
  ])("%s → %s", (clock, type) => {
    expect(inferMealType(clock)).toBe(type);
  });

  it("uses the user's timezone: 10:30 UTC is 12:30 in Copenhagen (lunch)", () => {
    expect(inferMealType(localClock(new Date("2026-10-18T10:30:00Z"), "Europe/Copenhagen"))).toBe("lunch");
    expect(localClock(new Date("2026-10-18T08:29:00Z"), "Europe/Copenhagen")).toBe("10:29");
  });
});

describe("remainingSlots", () => {
  it("Given 15:30, Then a snack and dinner remain", () => {
    expect(remainingSlots("15:30", [])).toEqual(["snack", "dinner"]);
  });

  it("Given 08:00, Then breakfast, lunch, snack and dinner remain", () => {
    expect(remainingSlots("08:00", [])).toEqual(["breakfast", "lunch", "snack", "dinner"]);
  });

  it("drops main meals that are already logged but keeps snacks", () => {
    expect(remainingSlots("12:00", ["breakfast", "lunch", "snack"])).toEqual(["snack", "dinner"]);
  });

  it("Given 22:00, Then only a snack remains", () => {
    expect(remainingSlots("22:00", [])).toEqual(["snack"]);
  });
});

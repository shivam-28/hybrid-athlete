import { describe, expect, it } from "vitest";
import { parsePreferences } from "./preferences";

const TODAY = "2026-10-18";
const base = { days_per_week: "5", max_session_min: "75", long_run_weekday: "7", equipment: "gym", race_distance: "none" };

describe("parsePreferences", () => {
  it("Given 5 days, 75 min, Sunday long run, gym and no race, Then it parses with no race fields", () => {
    const r = parsePreferences(base, TODAY);
    expect(r).toEqual({
      success: true,
      data: { days_per_week: 5, max_session_min: 75, long_run_weekday: 7, equipment: "gym", race_distance_km: null, race_date: null, race_goal_time: null },
    });
  });

  it.each([["0"], ["8"]])("Given %s days per week, Then it is rejected", (days) => {
    const r = parsePreferences({ ...base, days_per_week: days }, TODAY);
    expect(!r.success && r.fieldErrors.days_per_week).toBeTruthy();
  });

  it.each([["10"], ["300"]])("Given a %s-minute max session, Then it is rejected", (min) => {
    const r = parsePreferences({ ...base, max_session_min: min }, TODAY);
    expect(!r.success && r.fieldErrors.max_session_min).toBeTruthy();
  });

  it("Given a marathon on a future date with a goal time, Then distance is 42.195 km and the time is normalised", () => {
    const r = parsePreferences({ ...base, race_distance: "marathon", race_date: "2027-04-25", race_goal_time: "3:45" }, TODAY);
    expect(r.success && r.data).toMatchObject({ race_distance_km: 42.195, race_date: "2027-04-25", race_goal_time: "03:45:00" });
  });

  it("Given a custom race distance, Then the custom km is used", () => {
    const r = parsePreferences({ ...base, race_distance: "custom", race_distance_custom_km: "30", race_date: "2027-01-10" }, TODAY);
    expect(r.success && r.data.race_distance_km).toBe(30);
  });

  it("Given a custom race without a distance, Then it is rejected", () => {
    const r = parsePreferences({ ...base, race_distance: "custom", race_date: "2027-01-10" }, TODAY);
    expect(!r.success && r.fieldErrors.race_distance_custom_km).toBeTruthy();
  });

  it("Given a race date before today in the user's timezone, Then it is rejected", () => {
    const r = parsePreferences({ ...base, race_distance: "10k", race_date: "2026-10-17" }, TODAY);
    expect(!r.success && r.fieldErrors.race_date?.[0]).toMatch(/past/i);
  });

  it("Given a race today, Then it is accepted", () => {
    expect(parsePreferences({ ...base, race_distance: "5k", race_date: TODAY }, TODAY).success).toBe(true);
  });

  it("Given a race without a date, Then it is rejected", () => {
    const r = parsePreferences({ ...base, race_distance: "half" }, TODAY);
    expect(!r.success && r.fieldErrors.race_date).toBeTruthy();
  });

  it("Given a malformed goal time, Then it is rejected", () => {
    const r = parsePreferences({ ...base, race_distance: "half", race_date: "2027-01-10", race_goal_time: "fast" }, TODAY);
    expect(!r.success && r.fieldErrors.race_goal_time).toBeTruthy();
  });
});

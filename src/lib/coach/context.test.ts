import { describe, expect, it } from "vitest";
import { buildPlanContext, guardrailContextFrom, type HistoryActivity, type HistorySet } from "./context";
import type { TrainingPreferences } from "./preferences";

const WEEK = "2026-10-19"; // plan week (Monday); history = 2026-09-21 … 2026-10-18
const prefs: TrainingPreferences = {
  days_per_week: 5,
  max_session_min: 75,
  long_run_weekday: 7,
  equipment: "gym",
  race_distance_km: 42.195,
  race_date: "2026-12-28",
  race_goal_time: "04:00:00",
};

const runAct = (date: string, km: number, paceMin: number): HistoryActivity => ({
  id: `run-${date}`,
  local_date: date,
  sport: "running",
  distance_m: km * 1000,
  moving_s: Math.round(km * paceMin * 60),
  elapsed_s: null,
});
const activities: HistoryActivity[] = [
  runAct("2026-09-22", 5, 6.5), // week 1: 5 km
  runAct("2026-09-29", 6, 6.2), // week 2: 6 + 10
  runAct("2026-10-04", 10, 6.8),
  runAct("2026-10-06", 5, 6.0), // week 3: 5
  runAct("2026-10-13", 7, 6.4), // week 4: 7 + 3 (outside window ignored below)
  runAct("2026-10-15", 3, 5.5),
  runAct("2026-10-19", 12, 6.0), // in the plan week: ignored
  { id: "ride", local_date: "2026-10-01", sport: "cycling", distance_m: 30000, moving_s: 3600, elapsed_s: 3600 },
];
const set = (date: string, session: string, muscles: [string, "primary" | "secondary"][], type = "working"): HistorySet => ({
  local_date: date,
  session_id: session,
  set_type: type,
  muscles: muscles.map(([muscle_group, role]) => ({ muscle_group, role })),
});
const sets: HistorySet[] = [
  set("2026-09-23", "s1", [["quads", "primary"], ["glutes", "secondary"]]),
  set("2026-09-23", "s1", [["quads", "primary"], ["glutes", "secondary"]]),
  set("2026-09-23", "s1", [["quads", "primary"]], "warmup"),
  set("2026-10-07", "s2", [["chest", "primary"]]),
];

describe("buildPlanContext", () => {
  const ctx = buildPlanContext({
    weekStart: WEEK,
    preferences: prefs,
    experience: { strength: "beginner", running: "intermediate" },
    goalPhase: "cut",
    activities,
    sets,
  });

  it("summarises weekly run km for the 4 weeks before the plan week and their average", () => {
    expect(ctx.history.weeklyRunKm).toEqual([5, 16, 5, 10]);
    expect(ctx.history.avgWeeklyRunKm).toBe(9);
    expect(ctx.history.longestRunKm).toBe(10);
    expect(ctx.history.runsPerWeek).toBe(1.5);
  });

  it("derives a typical easy pace (median min/km of recent runs)", () => {
    expect(ctx.history.easyPaceMinPerKm).toBeCloseTo(6.3);
  });

  it("averages working sets per muscle group per week (primary 1, secondary 0.5, no warm-ups)", () => {
    expect(ctx.history.workingSetsPerMuscleWeek).toEqual({ quads: 0.5, glutes: 0.25, chest: 0.25 });
    expect(ctx.history.strengthSessionsPerWeek).toBe(0.5);
  });

  it("includes phase, weeks to race and experience", () => {
    expect(ctx.phase).toBe("build");
    expect(ctx.weeksToRace).toBe(10);
    expect(ctx.experience).toEqual({ strength: "beginner", running: "intermediate" });
    expect(ctx.goalPhase).toBe("cut");
  });

  it("never contains raw rows", () => {
    const json = JSON.stringify(ctx);
    expect(json).not.toMatch(/run-2026|s1|2026-09-22|session_id|local_date/);
  });

  it("Given no history, Then volume is 0 km and the easy pace is unknown", () => {
    const empty = buildPlanContext({ weekStart: WEEK, preferences: { ...prefs, race_date: null, race_distance_km: null, race_goal_time: null }, experience: { strength: "beginner", running: "none" }, goalPhase: null, activities: [], sets: [] });
    expect(empty.history.avgWeeklyRunKm).toBe(0);
    expect(empty.history.easyPaceMinPerKm).toBeNull();
    expect(empty.phase).toBe("base");
    expect(empty.weeksToRace).toBeNull();
  });

  it("guardrailContextFrom uses the same 4-week average and falls back to a 6:30 easy pace", () => {
    const g = guardrailContextFrom(ctx, {});
    expect(g.prevAvgWeeklyKm).toBe(9);
    expect(g.easyPaceMinPerKm).toBeCloseTo(6.3);
    expect(g.maxSessionMin).toBe(75);
    const none = buildPlanContext({ weekStart: WEEK, preferences: prefs, experience: { strength: "beginner", running: "none" }, goalPhase: null, activities: [], sets: [] });
    expect(guardrailContextFrom(none, {}).easyPaceMinPerKm).toBe(6.5);
  });
});

import { describe, expect, it } from "vitest";
import { buildWeeklyReview, type ReviewInput } from "./review";

const WEEK = "2026-10-19";
const s = (type: string, status: string, details: Record<string, unknown> = {}) => ({ type, status, details: { type, ...details } });
const base = (patch: Partial<ReviewInput> = {}): ReviewInput => ({
  weekStart: WEEK,
  sessions: [],
  runs: [],
  muscleSets: [],
  trend: [],
  goalPhase: null,
  easyPaceMinPerKm: 6,
  ...patch,
});

describe("buildWeeklyReview", () => {
  it("Given 9 planned non-rest sessions with 7 completed, Then adherence is 78%", () => {
    const sessions = [
      ...Array.from({ length: 7 }, () => s("strength", "completed")),
      s("run", "skipped", { distance_km: 5 }),
      s("core", "planned"),
      s("rest", "planned"),
      s("rest", "planned"),
    ];
    const r = buildWeeklyReview(base({ sessions }));
    expect(r.plannedSessions).toBe(9);
    expect(r.completedSessions).toBe(7);
    expect(r.skippedSessions).toBe(1);
    expect(r.missedSessions).toBe(1);
    expect(r.adherencePct).toBe(78);
  });

  it("Given no plan, Then adherence is null", () => {
    expect(buildWeeklyReview(base()).adherencePct).toBeNull();
  });

  it("compares run km against planned run km (duration-only runs at the easy pace)", () => {
    const r = buildWeeklyReview(
      base({
        sessions: [s("run", "completed", { distance_km: 8 }), s("run", "planned", { duration_min: 30 })],
        runs: [{ local_date: "2026-10-20", distance_m: 8200 }, { local_date: "2026-10-27", distance_m: 9000 }],
      }),
    );
    expect(r.plannedRunKm).toBe(13);
    expect(r.runKm).toBe(8.2);
  });

  it("lists working sets for every major muscle group (0 when untrained)", () => {
    const r = buildWeeklyReview(base({ muscleSets: [{ muscle_group: "quads", sets: 9 }, { muscle_group: "biceps", sets: 4 }] }));
    expect(r.setsPerMuscle).toEqual({ chest: 0, back: 0, shoulders: 0, quads: 9, hamstrings: 0, glutes: 0, core: 0 });
  });

  it("Given a cut and a falling 7-day trend, Then the weight trend is on track", () => {
    const trend = [
      { date: "2026-10-18", trendKg: 81 },
      { date: "2026-10-22", trendKg: 80.7 },
      { date: "2026-10-25", trendKg: 80.4 },
    ];
    const r = buildWeeklyReview(base({ trend, goalPhase: "cut" }));
    expect(r.weight).toEqual({ startKg: 81, endKg: 80.4, changeKg: -0.6, direction: "down", goalDirection: "down", onTrack: true });
  });

  it("Given a lean gain and a falling trend, Then the weight trend is off track", () => {
    const trend = [
      { date: "2026-10-18", trendKg: 70 },
      { date: "2026-10-25", trendKg: 69.5 },
    ];
    expect(buildWeeklyReview(base({ trend, goalPhase: "lean_gain" })).weight?.onTrack).toBe(false);
  });

  it("Given no weight data, Then the weight figure is null", () => {
    expect(buildWeeklyReview(base()).weight).toBeNull();
  });
});

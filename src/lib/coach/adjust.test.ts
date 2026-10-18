import { describe, expect, it } from "vitest";
import { adjustSession } from "./adjust";
import type { PlanSession } from "./plan-schema";

const intervals: PlanSession = { type: "run", title: "6 × 800 m", run_type: "intervals", duration_min: 45, distance_km: null, hr_zone: 4, pace: null, notes: null };
const tempoByDistance: PlanSession = { type: "run", title: "Tempo", run_type: "tempo", duration_min: null, distance_km: 8, hr_zone: null, pace: "5:00", notes: null };
const long: PlanSession = { type: "run", title: "Long run", run_type: "long", duration_min: 100, distance_km: 16, hr_zone: 2, pace: null, notes: null };
const lower: PlanSession = {
  type: "strength",
  title: "Lower body",
  focus: "lower",
  duration_min: 60,
  exercises: [
    { exercise_id: "00000000-0000-4000-8000-000000000001", name: "Squat", sets: 4, rep_min: 5, rep_max: 8 },
    { exercise_id: "00000000-0000-4000-8000-000000000002", name: "Lunge", sets: 1, rep_min: 10, rep_max: 12 },
  ],
  notes: null,
};
const core: PlanSession = { type: "core", title: "Core", duration_min: 20, exercises: [], notes: null };
const mobility: PlanSession = { type: "mobility", title: "Mobility", duration_min: 25, notes: null };

describe("adjustSession", () => {
  it("Given green, Then every session is unchanged", () => {
    for (const s of [intervals, long, lower, core]) expect(adjustSession(s, "green", 6.5)).toBeNull();
  });

  it("Given amber and a 45-minute interval run, Then it becomes a 45-minute easy run", () => {
    expect(adjustSession(intervals, "amber", 6.5)).toMatchObject({ type: "run", run_type: "easy", duration_min: 45, hr_zone: 2, pace: null });
  });

  it("Given amber and a tempo run by distance, Then the easy run keeps the same duration at the planned pace", () => {
    expect(adjustSession(tempoByDistance, "amber", 6.5)).toMatchObject({ run_type: "easy", duration_min: 40, distance_km: null });
  });

  it("Given amber and a long run, Then it is 25% shorter at easy intensity", () => {
    expect(adjustSession(long, "amber", 6.5)).toMatchObject({ run_type: "long", duration_min: 75, distance_km: 12, hr_zone: 2 });
  });

  it("Given amber and strength, Then one set less per exercise (min 1) with RPE capped at 8", () => {
    const adjusted = adjustSession(lower, "amber", 6.5);
    expect(adjusted).toMatchObject({ type: "strength" });
    expect((adjusted as Extract<PlanSession, { type: "strength" }>).exercises.map((e) => [e.sets, e.rpe_cap])).toEqual([
      [3, 8],
      [1, 8],
    ]);
  });

  it("Given amber, Then core and mobility are unchanged", () => {
    expect(adjustSession(core, "amber", 6.5)).toBeNull();
    expect(adjustSession(mobility, "amber", 6.5)).toBeNull();
  });

  it("Given red and a lower-body session, Then it becomes mobility or an easy walk of at most 30 minutes", () => {
    const adjusted = adjustSession(lower, "red", 6.5);
    expect(adjusted).toMatchObject({ type: "mobility" });
    expect((adjusted as Extract<PlanSession, { type: "mobility" }>).duration_min).toBeLessThanOrEqual(30);
  });

  it("Given red, Then runs are replaced too, rest stays rest", () => {
    expect(adjustSession(long, "red", 6.5)).toMatchObject({ type: "mobility" });
    expect(adjustSession({ type: "rest" }, "red", 6.5)).toBeNull();
  });
});

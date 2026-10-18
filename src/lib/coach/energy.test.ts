import { describe, expect, it } from "vitest";
import { estimatePlannedEnergy, plannedEnergyInput } from "./energy";
import type { PlanSession } from "./plan-schema";

const run = (patch: Partial<Extract<PlanSession, { type: "run" }>>): PlanSession => ({
  type: "run",
  title: "Run",
  run_type: "easy",
  duration_min: null,
  distance_km: null,
  hr_zone: 2,
  pace: null,
  notes: null,
  ...patch,
});

describe("estimatePlannedEnergy", () => {
  it("Given a run by distance, Then kcal = km × kg × 1.0", () => {
    expect(estimatePlannedEnergy(run({ distance_km: 18, run_type: "long" }), 80, 6)).toEqual({ kcal: 1440, runMinutes: 108 });
  });

  it("Given a duration-only run, Then distance comes from the recent easy pace", () => {
    expect(estimatePlannedEnergy(run({ duration_min: 60 }), 80, 6)).toEqual({ kcal: 800, runMinutes: 60 });
  });

  it("Given a duration-only run and no recent pace, Then the 6:30 min/km fallback is used", () => {
    expect(estimatePlannedEnergy(run({ duration_min: 65 }), 70, null).kcal).toBeCloseTo(700);
  });

  it("Given strength, Then 5 MET × kg × hours", () => {
    const strength: PlanSession = { type: "strength", title: "S", focus: "full", duration_min: 60, exercises: [{ exercise_id: "00000000-0000-4000-8000-000000000001", name: "x", sets: 3, rep_min: 5, rep_max: 8 }], notes: null };
    expect(estimatePlannedEnergy(strength, 80, 6)).toEqual({ kcal: 400, runMinutes: 0 });
  });

  it("Given core or mobility, Then 3 MET × kg × hours", () => {
    expect(estimatePlannedEnergy({ type: "core", title: "C", duration_min: 20, exercises: [], notes: null }, 90, 6).kcal).toBe(90);
    expect(estimatePlannedEnergy({ type: "mobility", title: "M", duration_min: 30, notes: null }, 80, 6).kcal).toBe(120);
  });

  it("Given rest, Then 0", () => {
    expect(estimatePlannedEnergy({ type: "rest" }, 80, 6)).toEqual({ kcal: 0, runMinutes: 0 });
  });
});

describe("plannedEnergyInput", () => {
  const long = run({ distance_km: 16, run_type: "long", title: "Long run" });
  const adjusted = run({ distance_km: 12, run_type: "long", title: "Long run (shortened)" });

  it("uses adjusted details when an adjustment was accepted", () => {
    expect(plannedEnergyInput({ id: "p", status: "planned", details: long, adjusted_details: adjusted }, 80, 6)).toMatchObject({ kcal: 960, label: "Planned: Long run (shortened) 12 km" });
  });

  it("is null for completed, skipped or linked sessions", () => {
    expect(plannedEnergyInput({ id: "p", status: "completed", details: long, adjusted_details: null }, 80, 6)).toBeNull();
    expect(plannedEnergyInput({ id: "p", status: "skipped", details: long, adjusted_details: null }, 80, 6)).toBeNull();
  });
});

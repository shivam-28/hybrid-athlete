import { describe, expect, it } from "vitest";
import {
  adaptiveBaseline,
  applyEnergyFloors,
  bmrFor,
  computeDailyTargets,
  dayClassFor,
  exerciseEnergy,
  goalAdjustment,
  macroTargets,
  type TargetInputs,
} from "./targets";

const DATE = "2026-10-18";
const male = { sex: "male" as const, birthDate: "1995-06-01", heightCm: 180, lifestyle: "sedentary" as const };

const base: TargetInputs = {
  date: DATE,
  profile: male,
  trendWeightKg: 80,
  bodyFat: null,
  goal: null,
  activities: [],
  strengthSessions: [],
  adaptive: { completeDays: 0, weighIns: 0, meanIntakeKcal: null, trendChangeKgPerDay: null, meanExerciseKcal: 0 },
};

describe("bmrFor", () => {
  it("Given body fat 20% measured 30 days ago at 80 kg, Then Katch-McArdle gives 1752 kcal", () => {
    const r = bmrFor({ ...base, bodyFat: { pct: 20, measuredOn: "2026-09-18" } });
    expect(r.ok && Math.round(r.bmr)).toBe(1752);
    expect(r.ok && r.method).toBe("Katch-McArdle");
    expect(r.ok && r.leanMassKg).toBe(64);
  });

  it("Given body fat measured 120 days ago, Then Mifflin-St Jeor is used and the staleness is explained", () => {
    const r = bmrFor({ ...base, bodyFat: { pct: 20, measuredOn: "2026-06-20" } });
    expect(r.ok && r.method).toBe("Mifflin-St Jeor");
    // 10×80 + 6.25×180 − 5×31 + 5
    expect(r.ok && r.bmr).toBe(1775);
    expect(r.ok && r.note).toMatch(/older than 90 days/);
    expect(r.ok && r.leanMassKg).toBeNull();
  });

  it.each([
    ["male", 1775],
    ["female", 1609],
  ] as const)("Mifflin-St Jeor for a %s without body fat data", (sex, expected) => {
    const r = bmrFor({ ...base, profile: { ...male, sex } });
    expect(r.ok && r.bmr).toBe(expected);
  });

  it("Given exactly 90 days, Then Katch-McArdle still applies", () => {
    const r = bmrFor({ ...base, bodyFat: { pct: 20, measuredOn: "2026-07-20" } });
    expect(r.ok && r.method).toBe("Katch-McArdle");
  });

  it.each([
    [{ trendWeightKg: null }, ["weight"]],
    [{ profile: { ...male, heightCm: null } }, ["height"]],
    [{ profile: { ...male, sex: null, birthDate: null } }, ["sex", "birth_date"]],
  ] as const)("Given missing inputs %j, Then no BMR and the missing inputs are named", (patch, missing) => {
    const r = bmrFor({ ...base, ...patch } as TargetInputs);
    expect(r).toEqual({ ok: false, missing });
  });
});

describe("exerciseEnergy", () => {
  const run = { id: "r1", sport: "running", label: "Run", startedAt: "2026-10-18T06:00:00Z", durationS: 3600, activeKcal: 850 };

  it("Given a synced run and a non-overlapping 60-min strength session at 80 kg, Then 850 + 400 = 1250 kcal", () => {
    const r = exerciseEnergy([run], [{ id: "s1", startedAt: "2026-10-18T15:00:00Z", endedAt: "2026-10-18T16:00:00Z" }], 80);
    expect(r.totalKcal).toBe(1250);
    expect(r.items.map((i) => i.kind)).toEqual(["activity", "strength_estimate"]);
  });

  it("Given a strength session overlapping a watch strength activity with 320 kcal, Then only 320 kcal counts", () => {
    const watch = { id: "w1", sport: "strength", label: "Strength", startedAt: "2026-10-18T15:05:00Z", durationS: 3300, activeKcal: 320 };
    const r = exerciseEnergy([watch], [{ id: "s1", startedAt: "2026-10-18T15:00:00Z", endedAt: "2026-10-18T16:00:00Z" }], 80);
    expect(r.totalKcal).toBe(320);
    expect(r.items).toHaveLength(1);
  });

  it("Given an overlapping activity without active kcal, Then the session is still estimated", () => {
    const watch = { id: "w1", sport: "strength", label: "Strength", startedAt: "2026-10-18T15:05:00Z", durationS: 3300, activeKcal: null };
    const r = exerciseEnergy([watch], [{ id: "s1", startedAt: "2026-10-18T15:00:00Z", endedAt: "2026-10-18T16:00:00Z" }], 80);
    expect(r.totalKcal).toBe(400);
  });

  it("caps a forgotten open session at 3 hours", () => {
    const r = exerciseEnergy([], [{ id: "s1", startedAt: "2026-10-18T06:00:00Z", endedAt: "2026-10-18T20:00:00Z" }], 80);
    expect(r.totalKcal).toBe(1200);
  });

  it("Given two runs on the local day in Europe/Copenhagen, one at 00:30 local (22:30 UTC the day before), Then both count", () => {
    const early = { ...run, id: "r0", startedAt: "2026-10-17T22:30:00Z", activeKcal: 300 };
    const late = { ...run, id: "r2", startedAt: "2026-10-18T21:30:00Z", activeKcal: 200 };
    expect(exerciseEnergy([early, late], [], 80).totalKcal).toBe(500);
  });
});

describe("adaptiveBaseline", () => {
  it("Given 9 complete days, Then the formula baseline is used and 5 more complete days are needed", () => {
    const r = adaptiveBaseline({ completeDays: 9, weighIns: 20, meanIntakeKcal: 2500, trendChangeKgPerDay: 0, meanExerciseKcal: 300 }, 2100);
    expect(r.method).toBe("formula");
    expect(r.baseline).toBe(2100);
    expect(r.completeDaysNeeded).toBe(5);
  });

  it("Given 28 complete days, mean intake 2600 kcal and trend −1.0 kg over 28 days, Then expenditure is 2875 kcal", () => {
    const r = adaptiveBaseline({ completeDays: 28, weighIns: 20, meanIntakeKcal: 2600, trendChangeKgPerDay: -1 / 28, meanExerciseKcal: 400 }, 2100);
    expect(r.method).toBe("adaptive");
    expect(r.observedTdee).toBeCloseTo(2875, 6);
    expect(r.weight).toBe(1);
    expect(r.baseline).toBeCloseTo(2475, 6);
  });

  it("Given 14 complete days, Then observed and formula baselines are blended with w = 14/28", () => {
    const r = adaptiveBaseline({ completeDays: 14, weighIns: 10, meanIntakeKcal: 2600, trendChangeKgPerDay: 0, meanExerciseKcal: 600 }, 2200);
    expect(r.weight).toBe(0.5);
    expect(r.baseline).toBe(0.5 * 2000 + 0.5 * 2200);
  });

  it("Given enough days but only 9 weigh-ins, Then it is not eligible", () => {
    const r = adaptiveBaseline({ completeDays: 20, weighIns: 9, meanIntakeKcal: 2600, trendChangeKgPerDay: 0, meanExerciseKcal: 0 }, 2200);
    expect(r.method).toBe("formula");
    expect(r.weighInsNeeded).toBe(1);
  });
});

describe("goalAdjustment", () => {
  it("Given an 80 kg cut with no explicit rate and 2800 kcal maintenance, Then the deficit is 440 kcal", () => {
    const r = goalAdjustment(2800, { phase: "cut", rateKgPerWeek: null, goalWeightKg: 75 }, 80);
    expect(r.kcal).toBeCloseTo(-440, 6);
    expect(r.capped).toBe(false);
  });

  it("Given a rate whose deficit exceeds 25% of maintenance, Then it is capped and explained", () => {
    const r = goalAdjustment(2000, { phase: "cut", rateKgPerWeek: -1, goalWeightKg: 70 }, 80);
    expect(r.kcal).toBe(-500);
    expect(r.capped).toBe(true);
  });

  it.each([
    ["lean_gain", 250],
    ["recomposition", -140],
    ["maintain", 0],
  ] as const)("%s adjusts 2800 kcal by %i", (phase, expected) => {
    expect(goalAdjustment(2800, { phase, rateKgPerWeek: 0, goalWeightKg: 80 }, 80).kcal).toBeCloseTo(expected, 6);
  });

  it("Given no goal, Then maintenance applies and the user is prompted", () => {
    const r = goalAdjustment(2800, null, 80);
    expect(r.kcal).toBe(0);
    expect(r.phase).toBe("maintain");
    expect(r.promptToSetGoal).toBe(true);
  });
});

describe("applyEnergyFloors", () => {
  it("Given a 1500 kcal target and 1650 kcal BMR, Then the target is 1650 with a BMR-floor warning", () => {
    const r = applyEnergyFloors({ targetKcal: 1500, bmr: 1650, exerciseKcal: 0, ffmKg: null });
    expect(r.targetKcal).toBe(1650);
    expect(r.raises.map((x) => x.code)).toEqual(["bmr_floor"]);
  });

  it("Given FFM 60 kg, 1200 kcal exercise and a 2700 kcal target, Then it is raised to 3000 with a low-energy-availability warning", () => {
    const r = applyEnergyFloors({ targetKcal: 2700, bmr: 1700, exerciseKcal: 1200, ffmKg: 60 });
    expect(r.targetKcal).toBe(3000);
    expect(r.raises).toEqual([{ code: "energy_availability_floor", kcal: 300 }]);
  });

  it("Given unknown FFM, Then only the BMR floor applies", () => {
    expect(applyEnergyFloors({ targetKcal: 2000, bmr: 1700, exerciseKcal: 1200, ffmKg: null }).raises).toEqual([]);
  });
});

describe("dayClassFor", () => {
  it.each([
    [[], "rest"],
    [[{ sport: "running", durationS: 59 * 60 }], "rest"],
    [[{ sport: "running", durationS: 60 * 60 }], "run"],
    [[{ sport: "cycling", durationS: 120 * 60 }], "rest"],
    [[{ sport: "running", durationS: 45 * 60 }, { sport: "running", durationS: 100 * 60 }], "long_run"],
  ] as const)("classifies %j as %s", (acts, expected) => {
    expect(dayClassFor(acts.map((a, i) => ({ id: `${i}`, label: "", startedAt: "", activeKcal: null, ...a })))).toBe(expected);
  });
});

describe("macroTargets", () => {
  it("Given 80 kg at 18% in maintenance on 2800 kcal, Then 144 g protein, 78 g fat, 381 g carbs, 39 g fiber", () => {
    const m = macroTargets({ targetKcal: 2800, weightKg: 80, refWeightKg: 80, phase: "maintain", dayClass: "rest" });
    expect(Math.round(m.protein_g)).toBe(144);
    expect(Math.round(m.fat_g)).toBe(78);
    expect(Math.round(m.carb_g)).toBe(381);
    expect(Math.round(m.fiber_g)).toBe(39);
    expect(m.carbFloorRaiseKcal).toBe(0);
  });

  it("Given a 100 kg cut with goal weight as reference (85 kg), Then protein is 170 g", () => {
    const m = macroTargets({ targetKcal: 2600, weightKg: 100, refWeightKg: 85, phase: "cut", dayClass: "rest" });
    expect(m.protein_g).toBe(170);
  });

  it("Given a low target, Then fat never drops below 0.6 g/kg", () => {
    const m = macroTargets({ targetKcal: 1600, weightKg: 100, refWeightKg: 100, phase: "cut", dayClass: "rest" });
    expect(m.fat_g).toBe(60);
  });

  it("Given an 80 kg cut with a 100-min run and 300 g computed carbs, Then carbs rise to 480 g and kcal by 720", () => {
    // T − 4×160 − 0.25T = 1200  →  T = 2453.33 gives exactly 300 g carbs before the floor
    const m = macroTargets({ targetKcal: 7360 / 3, weightKg: 80, refWeightKg: 80, phase: "cut", dayClass: "long_run" });
    expect(m.carb_g).toBe(480);
    expect(m.carbFloorRaiseKcal).toBeCloseTo(720, 6);
    expect(m.kcal).toBeCloseTo(7360 / 3 + 720, 6);
  });

  it("Given a rest day with carbs above 3 g/kg, Then the floor changes nothing", () => {
    const m = macroTargets({ targetKcal: 2800, weightKg: 80, refWeightKg: 80, phase: "maintain", dayClass: "rest" });
    expect(m.kcal).toBe(2800);
  });
});

describe("computeDailyTargets", () => {
  it("Given missing weight, Then no targets and the missing input is named", () => {
    expect(computeDailyTargets({ ...base, trendWeightKg: null })).toEqual({ ok: false, missing: ["weight"] });
  });

  it("uses sedentary (1.2) by default and explains it", () => {
    const r = computeDailyTargets(base);
    if (!r.ok) throw new Error("expected targets");
    expect(r.info.neatFactor).toBe(1.2);
    expect(r.info.lifestyleLabel).toBe("sedentary (1.2)");
    // Mifflin 1775 × 1.2 = 2130, maintenance, rounded to 10
    expect(r.targets.kcal).toBe(2130);
    expect(r.info.promptToSetGoal).toBe(true);
  });

  it("uses 1.5 for an active lifestyle", () => {
    const r = computeDailyTargets({ ...base, profile: { ...male, lifestyle: "active" } });
    expect(r.ok && r.targets.kcal).toBe(Math.round((1775 * 1.5) / 10) * 10);
  });

  it("Given a goal-adjusted target below BMR, Then it is raised to BMR with a warning (then the rest-day carb floor applies)", () => {
    // BMR 1775, sedentary maintenance 2130, cut capped at 25% → 1597.5 < 1775
    const r = computeDailyTargets({ ...base, goal: { phase: "cut", rateKgPerWeek: -1.5, goalWeightKg: 70 } });
    if (!r.ok) throw new Error("expected targets");
    expect(r.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(["bmr_floor", "carb_floor"]));
    expect(r.components.find((c) => c.key === "bmr_floor")?.kcal).toBe(178);
    expect(r.targets.kcal).toBeGreaterThanOrEqual(1775);
  });

  it("Given FFM 60 kg, 1200 kcal exercise and a 2700 kcal goal-adjusted target, Then the RED-S floor raises it to 3000", () => {
    // 75 kg at 20% bf → FFM 60; KM BMR = 370 + 21.6×60 = 1666; 1666×1.2 = 1999.2 + 1200 = 3199.2 maintenance; cut −25% cap → 2399.4
    const r = computeDailyTargets({
      ...base,
      trendWeightKg: 75,
      bodyFat: { pct: 20, measuredOn: "2026-10-01" },
      goal: { phase: "cut", rateKgPerWeek: -2, goalWeightKg: 68 },
      activities: [{ id: "r", sport: "running", label: "Run", startedAt: "2026-10-18T06:00:00Z", durationS: 50 * 60, activeKcal: 1200 }],
    });
    if (!r.ok) throw new Error("expected targets");
    expect(r.warnings.map((w) => w.code)).toContain("energy_availability_floor");
    expect(r.targets.kcal).toBe(3000);
  });

  it("explanation components sum exactly to the displayed kcal target", () => {
    const r = computeDailyTargets({
      ...base,
      bodyFat: { pct: 18, measuredOn: "2026-10-01" },
      goal: { phase: "cut", rateKgPerWeek: null, goalWeightKg: 75 },
      activities: [{ id: "r", sport: "running", label: "Run 18 km", startedAt: "2026-10-18T06:00:00Z", durationS: 100 * 60, activeKcal: 1013.7 }],
      strengthSessions: [{ id: "s", startedAt: "2026-10-18T16:00:00Z", endedAt: "2026-10-18T16:47:00Z" }],
    });
    if (!r.ok) throw new Error("expected targets");
    const sum = r.components.reduce((s, c) => s + c.kcal, 0);
    expect(sum).toBe(r.targets.kcal);
    expect(r.targets.kcal % 10).toBe(0);
    expect(r.components.map((c) => c.key)).toEqual(
      expect.arrayContaining(["baseline", "exercise:r", "exercise:s", "goal"]),
    );
    expect(r.info.dayClass).toBe("long_run");
  });

  it("Given a long-run cut day where the carb floor binds, Then the explanation names the long-run day carb floor", () => {
    const r = computeDailyTargets({
      ...base,
      goal: { phase: "cut", rateKgPerWeek: -1, goalWeightKg: 70 },
      activities: [{ id: "r", sport: "running", label: "Run", startedAt: "2026-10-18T06:00:00Z", durationS: 100 * 60, activeKcal: 300 }],
    });
    if (!r.ok) throw new Error("expected targets");
    expect(r.targets.carb_g).toBe(480);
    expect(r.components.find((c) => c.key === "carb_floor")?.label).toMatch(/long-run day carb floor/i);
    expect(r.components.reduce((s, c) => s + c.kcal, 0)).toBe(r.targets.kcal);
  });

  it("labels the adaptive method when eligible", () => {
    const r = computeDailyTargets({
      ...base,
      adaptive: { completeDays: 28, weighIns: 20, meanIntakeKcal: 2600, trendChangeKgPerDay: -1 / 28, meanExerciseKcal: 0 },
    });
    expect(r.ok && r.info.expenditureLabel).toBe("Adaptive (based on your data)");
    expect(r.ok && r.targets.kcal).toBe(2880);
  });
});

describe("planned sessions (add-coach: planned session energy)", () => {
  const longRun = { id: "p1", label: "Planned: Long run 18 km", kcal: 1440, runMinutes: 108 };

  it("Given an incomplete planned 18 km long run, Then kcal and carbs rise and the long-run carb floor applies", () => {
    const without = computeDailyTargets(base);
    const withRun = computeDailyTargets({ ...base, plannedSessions: [longRun] });
    expect(without.ok && withRun.ok).toBe(true);
    if (!without.ok || !withRun.ok) return;
    expect(withRun.info.dayClass).toBe("long_run");
    expect(withRun.info.exerciseKcal).toBe(1440);
    expect(withRun.targets.kcal).toBeGreaterThan(without.targets.kcal + 1000);
    expect(withRun.targets.carb_g).toBeGreaterThanOrEqual(6 * 80);
    expect(withRun.components.find((c) => c.key === "planned:p1")).toMatchObject({ label: "Planned: Long run 18 km", kcal: 1440 });
  });

  it("Given a planned 70-minute run, Then the day is classified as a run day", () => {
    const r = computeDailyTargets({ ...base, plannedSessions: [{ id: "p2", label: "Planned: Easy run", kcal: 700, runMinutes: 70 }] });
    expect(r.ok && r.info.dayClass).toBe("run");
  });

  it("Given no planned sessions, Then targets are unchanged", () => {
    expect(computeDailyTargets({ ...base, plannedSessions: [] })).toEqual(computeDailyTargets(base));
  });
});

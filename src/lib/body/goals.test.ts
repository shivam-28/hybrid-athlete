import { describe, expect, it } from "vitest";
import { evaluateGoal, type Baseline, type GoalProfile } from "./goals";

const TODAY = "2026-10-18";
const male: GoalProfile = { sex: "male", heightCm: 180, strengthExperience: "beginner" };
const base = (trendWeightKg: number | null, bodyFatPct: number | null = null, leanMassKg: number | null = null): Baseline => ({
  trendWeightKg,
  bodyFatPct,
  leanMassKg,
  currentRateKgPerWeek: null,
});
const goal = (goalWeightKg: number | null, goalBodyFatPct: number | null = null, targetDate: string | null = null) => ({
  goalWeightKg,
  goalBodyFatPct,
  targetDate,
});
const codes = (e: ReturnType<typeof evaluateGoal>) => e.warnings.map((w) => w.code);

describe("phase derivation", () => {
  it("Given 80 kg → 74 kg, Then cut", () => {
    expect(evaluateGoal(goal(74), base(80), male, TODAY).phase).toBe("cut");
  });

  it("Given 68 kg → 72 kg, Then lean gain", () => {
    expect(evaluateGoal(goal(72), base(68), male, TODAY).phase).toBe("lean_gain");
  });

  it("Given 78 kg at 22 % → 78 kg at 16 %, Then recomposition", () => {
    expect(evaluateGoal(goal(78, 16), base(78, 22, 60.8), male, TODAY).phase).toBe("recomposition");
  });

  it("Given 78 kg → 79 kg with no body fat goal, Then maintain", () => {
    expect(evaluateGoal(goal(79), base(78), male, TODAY).phase).toBe("maintain");
  });

  it.each([
    [78, 76, "maintain"],
    [78, 75.99, "cut"],
    [78, 80, "maintain"],
    [78, 80.01, "lean_gain"],
  ] as const)("Given the ±2 kg band edge %s → %s, Then %s", (from, to, phase) => {
    expect(evaluateGoal(goal(to), base(from), male, TODAY).phase).toBe(phase);
  });

  it("Given a goal BF only 0.5 points below current within the band, Then maintain", () => {
    expect(evaluateGoal(goal(78, 21.5), base(78, 22, 60.8), male, TODAY).phase).toBe("maintain");
  });

  it("Given only a body fat goal and no body composition test, Then no phase and a request for a test or goal weight", () => {
    const e = evaluateGoal(goal(null, 15), base(80), male, TODAY);
    expect(e.status).toBe("needs_body_comp");
    expect(e.phase).toBeNull();
  });

  it("Given no trend weight, Then no phase and a request to log a weight", () => {
    const e = evaluateGoal(goal(74), base(null), male, TODAY);
    expect(e.status).toBe("needs_weight");
    expect(e.phase).toBeNull();
  });
});

describe("projections", () => {
  it("Given lean mass 64 kg and a 15 % goal with no goal weight, Then the implied goal weight is 75.3 kg", () => {
    const e = evaluateGoal(goal(null, 15), base(80, 20, 64), male, TODAY);
    expect(e.projection?.impliedGoalWeightKg).toBeCloseTo(75.29, 2);
    expect(e.phase).toBe("cut");
  });

  it("Given lean mass 64 kg and goal weight 74 kg, Then the projected goal body fat is 13.5 %", () => {
    const e = evaluateGoal(goal(74), base(80, 20, 64), male, TODAY);
    expect(e.projection?.projectedBodyFatPct).toBeCloseTo(13.51, 2);
  });

  it("Given goal weight and goal body fat, Then goal fat and lean mass are projected", () => {
    const e = evaluateGoal(goal(76, 14), base(80, 20, 64), male, TODAY);
    expect(e.projection?.goalFatMassKg).toBeCloseTo(10.64, 2);
    expect(e.projection?.goalLeanMassKg).toBeCloseTo(65.36, 2);
  });

  it("Given a goal weight below current lean mass, Then a lean-mass warning is shown", () => {
    expect(codes(evaluateGoal(goal(62), base(80, 20, 64), male, TODAY))).toContain("below_lean_mass");
  });
});

describe("rates and timeline", () => {
  it("Given a cut 80 → 76 kg with no date, Then −0.40 kg/week and 10 weeks", () => {
    const e = evaluateGoal(goal(76), base(80), male, TODAY);
    expect(e.targetRateKgPerWeek).toBeCloseTo(-0.4, 6);
    expect(e.weeksToGoal).toBeCloseTo(10, 6);
  });

  it("Given a beginner lean gain 68 → 70 kg, Then +0.5 kg/month and about 4 months", () => {
    const e = evaluateGoal(goal(70.01), base(68), male, TODAY);
    expect(e.targetRateKgPerMonth).toBeCloseTo(0.5, 6);
    expect(e.monthsToGoal).toBeCloseTo(4, 1);
  });

  it.each([
    ["intermediate", 0.25],
    ["advanced", 0.125],
  ] as const)("Given an %s lifter, Then lean gain is %s kg/month", (strengthExperience, rate) => {
    const e = evaluateGoal(goal(72), base(68), { ...male, strengthExperience }, TODAY);
    expect(e.targetRateKgPerMonth).toBeCloseTo(rate, 6);
  });

  it("Given maintain or recomposition, Then the target rate is 0 and there is no timeline", () => {
    const e = evaluateGoal(goal(78, 16), base(78, 22, 60.8), male, TODAY);
    expect(e.targetRateKgPerWeek).toBe(0);
    expect(e.weeksToGoal).toBeNull();
  });
});

describe("target date validation", () => {
  it("Given a cut 80 → 72 kg in 6 weeks, Then a warning and an earliest safe date 10 weeks away", () => {
    const e = evaluateGoal(goal(72, null, "2026-11-29"), base(80), male, TODAY);
    expect(e.targetDate?.requiredPctPerWeek).toBeCloseTo(1.67, 2);
    expect(codes(e)).toContain("target_date_too_soon");
    expect(e.targetDate?.earliestSafeDate).toBe("2026-12-27");
    expect(e.targetRateKgPerWeek).toBeCloseTo(-0.8, 6);
  });

  it("Given a cut 80 → 76 kg in 7 weeks, Then no warning and −0.57 kg/week", () => {
    const e = evaluateGoal(goal(76, null, "2026-12-06"), base(80), male, TODAY);
    expect(e.targetDate?.requiredPctPerWeek).toBeCloseTo(0.71, 2);
    expect(codes(e)).not.toContain("target_date_too_soon");
    expect(e.targetRateKgPerWeek).toBeCloseTo(-0.571, 3);
  });

  it("Given a distant target date, Then the default rate is used", () => {
    const e = evaluateGoal(goal(76, null, "2027-06-01"), base(80), male, TODAY);
    expect(e.targetRateKgPerWeek).toBeCloseTo(-0.4, 6);
  });

  it("Given a beginner lean gain needing more than 0.5 kg/month, Then a warning and an earliest safe date", () => {
    const e = evaluateGoal(goal(72, null, "2026-12-18"), base(68), male, TODAY);
    expect(codes(e)).toContain("target_date_too_soon");
    expect(e.targetDate?.earliestSafeDate).toBe("2027-06-18");
  });
});

describe("unrealistic goal warnings", () => {
  it("Given a male goal of 6 % body fat, Then a low body fat warning", () => {
    expect(codes(evaluateGoal(goal(72, 6), base(80, 20, 64), male, TODAY))).toContain("very_low_body_fat");
  });

  it("Given a female goal of 14 % body fat, Then a low body fat warning", () => {
    const female: GoalProfile = { ...male, sex: "female" };
    expect(codes(evaluateGoal(goal(60, 14), base(65, 28, 46.8), female, TODAY))).toContain("very_low_body_fat");
  });

  it("Given a projected body fat below the threshold, Then the warning also applies", () => {
    expect(codes(evaluateGoal(goal(68), base(80, 20, 64), male, TODAY))).toContain("very_low_body_fat");
  });

  it("Given a 180 cm user with goal 58 kg, Then a BMI 17.9 warning", () => {
    const e = evaluateGoal(goal(58), base(70), male, TODAY);
    const w = e.warnings.find((x) => x.code === "low_bmi");
    expect(w?.message).toContain("17.9");
  });
});

describe("progress", () => {
  it("Given 78.0 → 76.0 at −0.5 kg/week, Then toward goal with an ETA of 4 weeks", () => {
    const e = evaluateGoal(goal(76), { ...base(78), currentRateKgPerWeek: -0.5 }, male, TODAY);
    expect(e.progress).toEqual({ direction: "toward", etaWeeks: 4 });
  });

  it("Given a cut and +0.3 kg/week, Then away from goal and not converging", () => {
    const e = evaluateGoal(goal(74), { ...base(80), currentRateKgPerWeek: 0.3 }, male, TODAY);
    expect(e.progress).toEqual({ direction: "away", etaWeeks: null });
  });

  it("Given |rate| < 0.1 kg/week, Then flat and not converging", () => {
    const e = evaluateGoal(goal(74), { ...base(80), currentRateKgPerWeek: -0.05 }, male, TODAY);
    expect(e.progress).toEqual({ direction: "flat", etaWeeks: null });
  });

  it("Given no rate yet, Then progress is unknown", () => {
    expect(evaluateGoal(goal(74), base(80), male, TODAY).progress).toBeNull();
  });
});

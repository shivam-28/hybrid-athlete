import { addDays, daysBetween } from "@/lib/activities/dates";

export type GoalPhase = "cut" | "lean_gain" | "recomposition" | "maintain";
export type GoalProfile = { sex: "male" | "female"; heightCm: number; strengthExperience: "beginner" | "intermediate" | "advanced" };
export type GoalInput = { goalWeightKg: number | null; goalBodyFatPct: number | null; targetDate: string | null };
export type Baseline = {
  trendWeightKg: number | null;
  bodyFatPct: number | null;
  leanMassKg: number | null;
  /** Current 14-day trend rate; null when there isn't enough data. */
  currentRateKgPerWeek: number | null;
};

export type GoalWarning = {
  code: "below_lean_mass" | "very_low_body_fat" | "low_bmi" | "target_date_too_soon";
  message: string;
};

export type GoalEvaluation = {
  status: "ok" | "needs_weight" | "needs_body_comp";
  phase: GoalPhase | null;
  /** Stated goal weight, or the weight implied by a body-fat-only goal. */
  effectiveGoalWeightKg: number | null;
  deltaKg: number | null;
  projection: {
    impliedGoalWeightKg: number | null;
    projectedBodyFatPct: number | null;
    goalFatMassKg: number | null;
    goalLeanMassKg: number | null;
  } | null;
  /** Signed: negative for a cut. */
  targetRateKgPerWeek: number | null;
  targetRateKgPerMonth: number | null;
  weeksToGoal: number | null;
  monthsToGoal: number | null;
  targetDate: { requiredKgPerWeek: number; requiredPctPerWeek: number; earliestSafeDate: string | null } | null;
  warnings: GoalWarning[];
  progress: { direction: "toward" | "away" | "flat"; etaWeeks: number | null } | null;
};

/** ±2 kg absorbs water noise so a 1 kg gap never flips someone into a cut. */
export const PHASE_BAND_KG = 2;
export const CUT_DEFAULT_PCT_PER_WEEK = 0.5;
export const CUT_MAX_PCT_PER_WEEK = 1.0;
export const LEAN_GAIN_KG_PER_MONTH = { beginner: 0.5, intermediate: 0.25, advanced: 0.125 } as const;
const MIN_BODY_FAT = { male: 8, female: 15 } as const;
const FLAT_KG_PER_WEEK = 0.1;
const WEEKS_PER_MONTH = 52 / 12;

const tidy = (n: number) => Math.round(n * 1e6) / 1e6;

function deriveProjection(goal: GoalInput, lean: number | null, phase: GoalPhase, goalWeight: number, implied: number | null) {
  const goalFat = goal.goalWeightKg !== null && goal.goalBodyFatPct !== null ? (goal.goalWeightKg * goal.goalBodyFatPct) / 100 : null;
  const projectedBf =
    goal.goalBodyFatPct === null && phase === "cut" && lean !== null ? ((goalWeight - lean) / goalWeight) * 100 : null;
  return {
    impliedGoalWeightKg: implied,
    projectedBodyFatPct: projectedBf,
    goalFatMassKg: goalFat,
    goalLeanMassKg: goalFat !== null ? goal.goalWeightKg! - goalFat : null,
  };
}

function classify(delta: number, goal: GoalInput, baseline: Baseline): GoalPhase {
  if (delta < -PHASE_BAND_KG) return "cut";
  if (delta > PHASE_BAND_KG) return "lean_gain";
  if (goal.goalBodyFatPct !== null && baseline.bodyFatPct !== null && goal.goalBodyFatPct <= baseline.bodyFatPct - 1) {
    return "recomposition";
  }
  return "maintain";
}

/** Deterministic goal phase, safe rate, timeline, warnings and progress. `today` is YYYY-MM-DD local. */
export function evaluateGoal(goal: GoalInput, baseline: Baseline, profile: GoalProfile, today: string): GoalEvaluation {
  const warnings: GoalWarning[] = [];
  const empty: GoalEvaluation = {
    status: "ok",
    phase: null,
    effectiveGoalWeightKg: goal.goalWeightKg,
    deltaKg: null,
    projection: null,
    targetRateKgPerWeek: null,
    targetRateKgPerMonth: null,
    weeksToGoal: null,
    monthsToGoal: null,
    targetDate: null,
    warnings,
    progress: null,
  };

  const lowBodyFat = (bf: number | null) => {
    if (bf !== null && bf < MIN_BODY_FAT[profile.sex]) {
      warnings.push({
        code: "very_low_body_fat",
        message: `${bf.toFixed(1)} % body fat is hard to sustain and may impair health, hormones and performance.`,
      });
    }
  };
  lowBodyFat(goal.goalBodyFatPct);

  if (baseline.trendWeightKg === null) return { ...empty, status: "needs_weight" };
  const current = baseline.trendWeightKg;

  const implied =
    goal.goalWeightKg === null && goal.goalBodyFatPct !== null && baseline.leanMassKg !== null
      ? baseline.leanMassKg / (1 - goal.goalBodyFatPct / 100)
      : null;
  const goalWeight = goal.goalWeightKg ?? implied;
  if (goalWeight === null) return { ...empty, status: "needs_body_comp" };

  const delta = goalWeight - current;
  const phase = classify(delta, goal, baseline);
  const projection = deriveProjection(goal, baseline.leanMassKg, phase, goalWeight, implied);
  lowBodyFat(projection.projectedBodyFatPct);

  if (baseline.leanMassKg !== null && goalWeight < baseline.leanMassKg) {
    warnings.push({
      code: "below_lean_mass",
      message: `A goal of ${goalWeight.toFixed(1)} kg is below your current lean mass (${baseline.leanMassKg.toFixed(1)} kg) and would require losing muscle.`,
    });
  }
  const bmi = goalWeight / (profile.heightCm / 100) ** 2;
  if (bmi < 18.5) {
    warnings.push({
      code: "low_bmi",
      message: `This goal implies a BMI of ${bmi.toFixed(1)}, below the healthy minimum of 18.5.`,
    });
  }

  let targetKgPerWeek = 0;
  let targetDate: GoalEvaluation["targetDate"] = null;
  if (phase === "cut" || phase === "lean_gain") {
    const sign = phase === "cut" ? -1 : 1;
    const defaultRate =
      phase === "cut" ? (current * CUT_DEFAULT_PCT_PER_WEEK) / 100 : LEAN_GAIN_KG_PER_MONTH[profile.strengthExperience] / WEEKS_PER_MONTH;
    const maxRate = phase === "cut" ? (current * CUT_MAX_PCT_PER_WEEK) / 100 : defaultRate;
    let rate = defaultRate;

    const days = goal.targetDate ? daysBetween(today, goal.targetDate) : 0;
    if (goal.targetDate && days > 0) {
      const required = Math.abs(delta) / (days / 7);
      let earliestSafeDate: string | null = null;
      if (tidy(required) > tidy(maxRate)) {
        earliestSafeDate = addDays(today, Math.ceil(tidy((Math.abs(delta) / maxRate) * 7)));
        rate = maxRate;
        warnings.push({
          code: "target_date_too_soon",
          message: `Reaching this goal by ${goal.targetDate} needs a faster rate than is safe. The earliest safe date is ${earliestSafeDate}.`,
        });
      } else if (required > defaultRate) {
        rate = required;
      }
      targetDate = { requiredKgPerWeek: required, requiredPctPerWeek: (required / current) * 100, earliestSafeDate };
    }
    targetKgPerWeek = sign * rate;
  }

  const weeksToGoal = targetKgPerWeek !== 0 ? Math.abs(delta) / Math.abs(targetKgPerWeek) : null;
  return {
    status: "ok",
    phase,
    effectiveGoalWeightKg: goalWeight,
    deltaKg: delta,
    projection,
    targetRateKgPerWeek: targetKgPerWeek,
    targetRateKgPerMonth: targetKgPerWeek * WEEKS_PER_MONTH,
    weeksToGoal,
    monthsToGoal: weeksToGoal !== null ? weeksToGoal / WEEKS_PER_MONTH : null,
    targetDate,
    warnings,
    progress: progressToward(delta, baseline.currentRateKgPerWeek),
  };
}

function progressToward(delta: number, rate: number | null): GoalEvaluation["progress"] {
  if (rate === null) return null;
  if (Math.abs(rate) < FLAT_KG_PER_WEEK) return { direction: "flat", etaWeeks: null };
  if (Math.sign(rate) === Math.sign(delta)) return { direction: "toward", etaWeeks: Math.abs(delta) / Math.abs(rate) };
  return { direction: "away", etaWeeks: null };
}

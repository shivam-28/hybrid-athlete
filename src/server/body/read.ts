import "server-only";
import { evaluateGoal, type GoalEvaluation, type GoalPhase, type GoalProfile } from "@/lib/body/goals";
import type { CompMethod } from "@/lib/body/schemas";
import { localDate } from "@/lib/time";
import type { Profile } from "@/server/auth";
import { getActiveGoal } from "./goals";
import { loadWeightOverview } from "./views";
import type { Db } from "./weights";

export type LatestBodyComposition = { testedOn: string; method: CompMethod; bodyFatPct: number; leanMassKg: number | null };

/**
 * The most recent confirmed test that has a body fat %, for nutrition and coaching.
 * Reads body_composition_tests only: photo analyses are never a measurement.
 */
export async function getLatestBodyComposition(db: Db): Promise<LatestBodyComposition | null> {
  const { data } = await db
    .from("body_composition_tests")
    .select("local_date, method, body_fat_pct, lean_mass_kg")
    .not("body_fat_pct", "is", null)
    .order("local_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    testedOn: data.local_date,
    method: data.method,
    bodyFatPct: Number(data.body_fat_pct),
    leanMassKg: data.lean_mass_kg === null ? null : Number(data.lean_mass_kg),
  };
}

export type GoalState = {
  phase: GoalPhase;
  /** Signed kg/week: negative for a cut, 0 for maintain/recomposition. */
  targetRateKgPerWeek: number;
  goalWeightKg: number;
  goalBodyFatPct: number | null;
  targetDate: string | null;
};
export type GoalStateResult = { state: GoalState; evaluation: GoalEvaluation } | { state: null; reason: "no_goal" | "needs_weight" | "needs_body_comp" };

/** Active goal phase and target rate, derived on read from trend weight, latest test and profile. */
export async function getGoalState(db: Db, profile: Profile, today = localDate(new Date(), profile.timezone)): Promise<GoalStateResult> {
  const goal = await getActiveGoal(db);
  if (!goal) return { state: null, reason: "no_goal" };
  const [weight, composition] = await Promise.all([loadWeightOverview(db, today), getLatestBodyComposition(db)]);
  const evaluation = evaluateGoal(
    {
      goalWeightKg: goal.goal_weight_kg === null ? null : Number(goal.goal_weight_kg),
      goalBodyFatPct: goal.goal_body_fat_pct === null ? null : Number(goal.goal_body_fat_pct),
      targetDate: goal.target_date,
    },
    {
      trendWeightKg: weight.latestTrendKg,
      bodyFatPct: composition?.bodyFatPct ?? null,
      leanMassKg: composition?.leanMassKg ?? null,
      currentRateKgPerWeek: weight.rate?.kgPerWeek ?? null,
    },
    { sex: profile.sex as GoalProfile["sex"], heightCm: Number(profile.height_cm), strengthExperience: profile.strength_experience as GoalProfile["strengthExperience"] },
    today,
  );
  if (evaluation.status !== "ok" || evaluation.phase === null) {
    return { state: null, reason: evaluation.status === "needs_body_comp" ? "needs_body_comp" : "needs_weight" };
  }
  return {
    state: {
      phase: evaluation.phase,
      targetRateKgPerWeek: evaluation.targetRateKgPerWeek ?? 0,
      goalWeightKg: evaluation.effectiveGoalWeightKg!,
      goalBodyFatPct: goal.goal_body_fat_pct === null ? null : Number(goal.goal_body_fat_pct),
      targetDate: goal.target_date,
    },
    evaluation,
  };
}

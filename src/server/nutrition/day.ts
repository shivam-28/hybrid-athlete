import "server-only";
import type { MealType } from "@/lib/nutrition/draft";
import { NUTRIENT_KEYS, sumNutrients, type NutrientKey, type Nutrients } from "@/lib/nutrition/nutrients";
import { localClock } from "@/lib/nutrition/meal-time";
import { localDate } from "@/lib/time";
import type { Profile } from "@/server/auth";
import { withUserAnthropic } from "@/server/ai/client";
import { loadWeightOverview } from "@/server/body/views";
import type { Db } from "@/server/body/weights";
import { NutritionError } from "./errors";
import { defaultMatcherDeps } from "./lookup-cache";
import type { MatcherDeps } from "./matcher";
import { listDayMeals, type MealItemRow, type MealWithItems } from "./meals";
import { listPlanned, type PlannedMealRow } from "./planned";
import type { RunAi } from "./recognize";
import { buildRecommendationContext, mapAiError, recommendMeals, type RecommendMode, type RecommendResult, type RunInfo } from "./recommend";
import { getTargetsForDate, isLogDayComplete, type DayTargets } from "./targets";

export type DayView = {
  date: string;
  targets: DayTargets;
  meals: MealWithItems[];
  totals: Record<NutrientKey, number>;
  incomplete: NutrientKey[];
  isComplete: boolean;
  planned: PlannedMealRow[];
};

const itemNutrients = (i: MealItemRow): Nutrients =>
  Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, i[k] === null ? null : Number(i[k])])) as Nutrients;

/** Everything the Eat tab shows for one local day. Planned meals are listed but never counted. */
export async function loadDay(db: Db, profile: Profile, date: string, now = new Date()): Promise<DayView> {
  const [targets, meals, isComplete, planned] = await Promise.all([
    getTargetsForDate(db, profile, date, now),
    listDayMeals(db, date),
    isLogDayComplete(db, date),
    listPlanned(db, date),
  ]);
  const { totals, incomplete } = sumNutrients(meals.flatMap((m) => m.items.map(itemNutrients)));
  return { date, targets, meals, totals, incomplete, isComplete, planned };
}

/** Today's remaining targets + preferences + training → AI options (design D7). */
export async function recommendForUser(
  db: Db,
  profile: Profile,
  mode: RecommendMode,
  runAi: RunAi = (call) => withUserAnthropic(profile.user_id, call),
  deps?: MatcherDeps,
  now = new Date(),
): Promise<RecommendResult> {
  const today = localDate(now, profile.timezone);
  const [day, weight, activities] = await Promise.all([
    loadDay(db, profile, today, now),
    loadWeightOverview(db, today),
    db.from("activities").select("sport, occurred_at, moving_s, elapsed_s").eq("local_date", today).eq("sport", "running"),
  ]);
  if (!day.targets.result.ok) throw new NutritionError("invalid", "Log your weight first so today's targets can be calculated.");
  const runs: RunInfo[] = (activities.data ?? []).map((a) => ({
    startClock: localClock(new Date(a.occurred_at), profile.timezone),
    durationMin: Math.round((a.moving_s ?? a.elapsed_s ?? 0) / 60),
    status: "done",
  }));
  const ctx = buildRecommendationContext({
    now,
    timezone: profile.timezone,
    targets: day.targets.result.targets,
    eaten: day.totals,
    loggedMealTypes: day.meals.map((m) => m.meal_type as MealType),
    weightKg: weight.latestTrendKg ?? 70,
    preferences: profile,
    runs,
  });
  try {
    return await runAi((client) => recommendMeals(client, ctx, deps ?? defaultMatcherDeps(), mode));
  } catch (error) {
    return mapAiError(error);
  }
}

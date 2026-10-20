import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { dietViolations, findAllergenHits, type DietType } from "@/lib/nutrition/allergens";
import { MEAL_TYPES, type MealType, type NutrientSource } from "@/lib/nutrition/draft";
import { localClock, remainingSlots } from "@/lib/nutrition/meal-time";
import { emptyNutrients, scaleNutrients, type Nutrients } from "@/lib/nutrition/nutrients";
import type { Targets } from "@/lib/nutrition/targets";
import { AI_DECLINED_MESSAGE, AiRefusalError, InvalidAiKeyError, MissingAiKeyError } from "@/server/ai/client";
import { parseStructured, type StructuredClient } from "@/server/ai/structured";
import { NutritionError } from "./errors";
import { matchItem, type MatcherDeps } from "./matcher";

export type Macros = { kcal: number; protein_g: number; carb_g: number; fat_g: number };
export type RunInfo = { startClock: string; durationMin: number; status: "done" | "planned" };

export type RecommendationContext = {
  remaining: Macros;
  slots: MealType[];
  clock: string;
  weightKg: number;
  diet: DietType;
  allergies: string[];
  dislikes: string[];
  cuisines: string[];
  runs: RunInfo[];
};

export type RecommendedFood = { name: string; grams: number; nutrient_source: NutrientSource; source_ref: string | null; matched_name: string | null; per100g: Nutrients };
export type RecommendedMeal = { slot: MealType; name: string; foods: RecommendedFood[]; totals: Macros };
export type RecommendedOption = { title: string; meals: RecommendedMeal[]; totals: Macros };
export type RecommendResult = { kind: "target_met" } | { kind: "options"; options: RecommendedOption[] } | { kind: "none"; reasons: string[] };
export type RecommendMode = "rest_of_day" | "light_snack";

const KCAL_TOLERANCE = 0.15;
const LIGHT_SNACK_MAX_KCAL = 250;
const MAX_OPTIONS = 3;
const LONG_RUN_MIN = 90;
const NOMINAL_SLOT_TIME: Record<MealType, string> = { breakfast: "07:30", lunch: "12:30", snack: "15:30", dinner: "19:00" };

const optionsSchema = z.object({
  options: z.array(
    z.object({
      title: z.string(),
      meals: z.array(
        z.object({
          slot: z.enum(MEAL_TYPES),
          name: z.string(),
          foods: z.array(
            z.object({
              name: z.string(),
              grams: z.number(),
              search_query: z.string(),
              per100g: z.object({ kcal: z.number(), protein_g: z.number(), carb_g: z.number(), fat_g: z.number() }),
            }),
          ),
        }),
      ),
    }),
  ),
});
export type RawOptions = z.infer<typeof optionsSchema>;

const SYSTEM = `You are a sports nutritionist planning the rest of today's meals for a hybrid athlete (strength + running).
Return 2–3 distinct options. Each option has exactly one meal per requested slot, built from everyday foods with gram portions (as eaten) and per-100 g macros.
Hit the remaining kcal and protein closely across the whole option. Strictly respect the diet type, never use allergens or disliked foods, and prefer the listed cuisines.
Follow slot_guidance: a pre_long_run meal is carbohydrate-focused and low in fiber and fat; a post-run meal includes the stated protein.
Spread protein across meals at the given grams per meal.`;

/** Assigns training-aware guidance to slots by their nominal times. */
function slotGuidance(ctx: RecommendationContext): Partial<Record<MealType, string>> {
  const guidance: Partial<Record<MealType, string>> = {};
  const timeOf = (slot: MealType) => (NOMINAL_SLOT_TIME[slot] < ctx.clock ? ctx.clock : NOMINAL_SLOT_TIME[slot]);
  const postRunProtein = Math.round(0.3 * ctx.weightKg);
  for (const run of ctx.runs) {
    if (run.status === "planned" && run.durationMin >= LONG_RUN_MIN && run.startClock > ctx.clock) {
      const before = ctx.slots.filter((s) => timeOf(s) < run.startClock).at(-1);
      if (before) guidance[before] = "pre_long_run: carbohydrate-focused, low fiber and low fat, eaten 2–3 h before the run";
    }
    const after = ctx.slots.find((s) => timeOf(s) >= (run.status === "done" ? ctx.clock : run.startClock));
    if (after && !guidance[after]) guidance[after] = `post-run: include at least ${postRunProtein} g protein and carbohydrate to refuel`;
  }
  return guidance;
}

function promptFor(ctx: RecommendationContext, mode: RecommendMode, rejected: string[]): string {
  const request =
    mode === "light_snack"
      ? { task: "The day's kcal target is already met. Suggest light, high-protein snacks.", max_kcal: 200, meal_slots: ["snack"] }
      : { task: "Plan the rest of today's meals.", remaining_targets: ctx.remaining, meal_slots: ctx.slots, slot_guidance: slotGuidance(ctx) };
  const body = {
    ...request,
    local_time: ctx.clock,
    diet_type: ctx.diet,
    allergies_never_use: ctx.allergies,
    dislikes_avoid: ctx.dislikes,
    preferred_cuisines: ctx.cuisines,
    body_weight_kg: Math.round(ctx.weightKg),
    protein_per_meal_g: [Math.round(0.3 * ctx.weightKg), Math.round(0.4 * ctx.weightKg)],
    training_today: ctx.runs.map((r) => ({ start: r.startClock, duration_min: r.durationMin, status: r.status })),
  };
  const retry = rejected.length > 0 ? `\nYour previous options were rejected for these reasons, fix them: ${rejected.join("; ")}` : "";
  return JSON.stringify(body) + retry;
}

const macrosOf = (n: Nutrients): Macros => ({ kcal: n.kcal ?? 0, protein_g: n.protein_g ?? 0, carb_g: n.carb_g ?? 0, fat_g: n.fat_g ?? 0 });
const add = (a: Macros, b: Macros): Macros => ({ kcal: a.kcal + b.kcal, protein_g: a.protein_g + b.protein_g, carb_g: a.carb_g + b.carb_g, fat_g: a.fat_g + b.fat_g });
const ZERO: Macros = { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 };

/** Recomputes macros from database matches (model numbers as labelled fallback). */
async function recompute(option: RawOptions["options"][number], deps: MatcherDeps): Promise<RecommendedOption> {
  const meals = await Promise.all(
    option.meals.map(async (meal) => {
      const foods = await Promise.all(
        meal.foods
          .filter((f) => f.grams > 0 && f.grams <= 2000)
          .map(async (f) => {
            const estimate = { ...emptyNutrients(), ...f.per100g };
            const match = await matchItem({ query: f.search_query || f.name, packaged: false, estimate }, deps);
            return { name: f.name, grams: Math.round(f.grams), nutrient_source: match.nutrient_source, source_ref: match.source_ref, matched_name: match.matched_name, per100g: match.per100g };
          }),
      );
      const totals = foods.reduce((sum, f) => add(sum, macrosOf(scaleNutrients(f.per100g, f.grams))), ZERO);
      return { slot: meal.slot, name: meal.name, foods, totals };
    }),
  );
  return { title: option.title, meals, totals: meals.reduce((sum, m) => add(sum, m.totals), ZERO) };
}

function rejectionReason(option: RecommendedOption, ctx: RecommendationContext, mode: RecommendMode): string | null {
  const texts = option.meals.flatMap((m) => [m.name, ...m.foods.map((f) => f.name)]);
  const allergen = findAllergenHits(texts, ctx.allergies)[0];
  if (allergen) return `"${option.title}" contains ${allergen.term} (allergy: ${allergen.allergy})`;
  const diet = dietViolations(texts, ctx.diet)[0];
  if (diet) return `"${option.title}" contains ${diet}, which is not ${ctx.diet}`;
  if (mode === "light_snack") {
    return option.totals.kcal > LIGHT_SNACK_MAX_KCAL ? `"${option.title}" has ${Math.round(option.totals.kcal)} kcal, above ${LIGHT_SNACK_MAX_KCAL}` : null;
  }
  const off = Math.abs(option.totals.kcal - ctx.remaining.kcal) / ctx.remaining.kcal;
  return off > KCAL_TOLERANCE ? `"${option.title}" totals ${Math.round(option.totals.kcal)} kcal vs ${Math.round(ctx.remaining.kcal)} remaining` : null;
}

/**
 * Design D7: generate → recompute via nutrient data → drop allergen/diet/kcal misfits
 * (server-side, independent of the model) → regenerate once with reasons → give up.
 */
export async function recommendMeals(
  client: StructuredClient,
  ctx: RecommendationContext,
  deps: MatcherDeps,
  mode: RecommendMode = "rest_of_day",
): Promise<RecommendResult> {
  if (mode === "rest_of_day" && (ctx.remaining.kcal <= 0 || ctx.slots.length === 0)) return { kind: "target_met" };
  let reasons: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: RawOptions | null;
    try {
      raw = await parseStructured(client, { system: SYSTEM, schema: optionsSchema, maxTokens: 8192, content: [{ type: "text", text: promptFor(ctx, mode, reasons) }] });
    } catch (error) {
      if (error instanceof Anthropic.APIError || error instanceof AiRefusalError) throw error;
      raw = null;
    }
    const options = raw ? await Promise.all(raw.options.slice(0, 5).map((o) => recompute(o, deps))) : [];
    const attemptReasons: string[] = raw ? [] : ["the response could not be read"];
    const kept = options.filter((o) => {
      const reason = rejectionReason(o, ctx, mode);
      if (reason) attemptReasons.push(reason);
      return reason === null && o.meals.length > 0;
    });
    if (kept.length > 0) return { kind: "options", options: kept.slice(0, MAX_OPTIONS) };
    reasons = attemptReasons;
  }
  return { kind: "none", reasons };
}

export function buildRecommendationContext(input: {
  now: Date;
  timezone: string;
  targets: Targets;
  eaten: Macros;
  loggedMealTypes: MealType[];
  weightKg: number;
  preferences: { diet_type: string; allergies: string[]; dislikes: string[]; cuisines: string[] };
  runs: RunInfo[];
}): RecommendationContext {
  const clock = localClock(input.now, input.timezone);
  const left = (k: keyof Macros) => Math.max(0, Math.round(input.targets[k] - input.eaten[k]));
  return {
    remaining: { kcal: left("kcal"), protein_g: left("protein_g"), carb_g: left("carb_g"), fat_g: left("fat_g") },
    slots: remainingSlots(clock, input.loggedMealTypes),
    clock,
    weightKg: input.weightKg,
    diet: input.preferences.diet_type as DietType,
    allergies: input.preferences.allergies,
    dislikes: input.preferences.dislikes,
    cuisines: input.preferences.cuisines,
    runs: input.runs,
  };
}

export function mapAiError(error: unknown): never {
  if (error instanceof MissingAiKeyError) throw new NutritionError("missing_ai_key", "Meal suggestions need your AI key. Add it in Settings.");
  if (error instanceof InvalidAiKeyError) throw new NutritionError("ai_key_invalid", "Your AI provider no longer accepts your key. Update it in Settings.");
  if (error instanceof AiRefusalError) throw new NutritionError("ai_declined", AI_DECLINED_MESSAGE);
  if (error instanceof Anthropic.APIError) throw new NutritionError("ai_unavailable", "Suggestions aren't available right now. Please try again shortly.");
  throw error;
}

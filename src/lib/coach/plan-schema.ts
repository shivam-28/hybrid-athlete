import { z } from "zod";

export const SESSION_TYPES = ["strength", "run", "core", "mobility", "rest"] as const;
export const RUN_TYPES = ["easy", "long", "tempo", "intervals", "recovery"] as const;
export const STRENGTH_FOCUS = ["upper", "lower", "full", "push", "pull", "legs"] as const;
export type SessionType = (typeof SESSION_TYPES)[number];
export type RunType = (typeof RUN_TYPES)[number];
export type StrengthFocus = (typeof STRENGTH_FOCUS)[number];

const PACE = /^\d{1,2}:[0-5]\d$/;
const minutes = z.number().int().min(5).max(480);

const exerciseSchema = z
  .object({
    exercise_id: z.uuid(),
    name: z.string().min(1),
    sets: z.number().int().min(1).max(10),
    rep_min: z.number().int().min(1).max(100),
    rep_max: z.number().int().min(1).max(100),
    rpe_cap: z.number().min(1).max(10).nullish(),
  })
  .refine((e) => e.rep_min <= e.rep_max, "rep_min must not exceed rep_max");
export type PlanExercise = z.infer<typeof exerciseSchema>;

const id = z.string().min(1).optional();

const strengthSchema = z.object({
  id,
  type: z.literal("strength"),
  title: z.string().min(1),
  focus: z.enum(STRENGTH_FOCUS),
  duration_min: minutes,
  exercises: z.array(exerciseSchema).min(1, "A strength session needs at least one exercise"),
  notes: z.string().nullish(),
});

const runSchema = z
  .object({
    id,
    type: z.literal("run"),
    title: z.string().min(1),
    run_type: z.enum(RUN_TYPES),
    duration_min: minutes.nullish(),
    distance_km: z.number().positive().max(100).nullish(),
    hr_zone: z.number().int().min(1).max(5).nullish(),
    pace: z.string().regex(PACE, "Pace looks like 5:30 (min/km)").nullish(),
    notes: z.string().nullish(),
  })
  .refine((r) => r.duration_min != null || r.distance_km != null, "A run needs a distance or a duration")
  .refine((r) => r.hr_zone != null || r.pace != null, "A run needs an HR zone or a pace");

const coreSchema = z.object({
  id,
  type: z.literal("core"),
  title: z.string().min(1),
  duration_min: minutes,
  exercises: z.array(exerciseSchema).default([]),
  notes: z.string().nullish(),
});

const mobilitySchema = z.object({ id, type: z.literal("mobility"), title: z.string().min(1), duration_min: minutes, notes: z.string().nullish() });
const restSchema = z.object({ id, type: z.literal("rest"), title: z.string().nullish() });

export const PlanSessionSchema = z.discriminatedUnion("type", [strengthSchema, runSchema, coreSchema, mobilitySchema, restSchema]);
export type PlanSession = z.infer<typeof PlanSessionSchema>;

/** The validated plan (Monday first). Session ids are planned_sessions ids once stored. */
export const WeekPlanSchema = z.object({
  days: z.array(z.object({ sessions: z.array(PlanSessionSchema) })).length(7, "A plan has exactly 7 days"),
});
export type WeekPlan = z.infer<typeof WeekPlanSchema>;

// What the model fills in -------------------------------------------------------
// Loose on purpose (structured outputs support few constraints); everything is
// re-checked by WeekPlanSchema and the guardrails. Exercises are short refs from a
// closed list ("e12"), mapped back to library ids server-side.

const modelExercise = z.object({ ref: z.string(), sets: z.number(), rep_min: z.number(), rep_max: z.number() });
const modelSession = z.discriminatedUnion("type", [
  z.object({ type: z.literal("strength"), title: z.string(), focus: z.enum(STRENGTH_FOCUS), duration_min: z.number(), exercises: z.array(modelExercise), notes: z.string().nullable() }),
  z.object({
    type: z.literal("run"),
    title: z.string(),
    run_type: z.enum(RUN_TYPES),
    duration_min: z.number().nullable(),
    distance_km: z.number().nullable(),
    hr_zone: z.number().nullable(),
    pace: z.string().nullable(),
    notes: z.string().nullable(),
  }),
  z.object({ type: z.literal("core"), title: z.string(), duration_min: z.number(), exercises: z.array(modelExercise), notes: z.string().nullable() }),
  z.object({ type: z.literal("mobility"), title: z.string(), duration_min: z.number(), notes: z.string().nullable() }),
  z.object({ type: z.literal("rest") }),
]);

export const ModelWeekPlanSchema = z.object({
  days: z.array(z.object({ sessions: z.array(modelSession) })),
});
export type ModelWeekPlan = z.infer<typeof ModelWeekPlanSchema>;

export type ExerciseRefs = Record<string, { id: string; name: string }>;

/** Maps model refs to library exercises and applies the strict schema. Unknown refs are structural errors. */
export function modelPlanToWeekPlan(model: ModelWeekPlan, refs: ExerciseRefs): { ok: true; plan: WeekPlan } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const mapExercises = (list: z.infer<typeof modelExercise>[]) =>
    list.map((e) => {
      const known = refs[e.ref];
      if (!known) errors.push(`Exercise ${e.ref} is not in the provided exercise list`);
      return { exercise_id: known?.id ?? "", name: known?.name ?? e.ref, sets: e.sets, rep_min: e.rep_min, rep_max: e.rep_max };
    });
  const mapped = {
    days: model.days.map((day) => ({
      sessions: day.sessions.map((s) => (s.type === "strength" || s.type === "core" ? { ...s, exercises: mapExercises(s.exercises) } : s)),
    })),
  };
  if (errors.length > 0) return { ok: false, errors };
  const parsed = WeekPlanSchema.safeParse(mapped);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".") || "plan"}: ${i.message}`) };
  }
  return { ok: true, plan: parsed.data };
}

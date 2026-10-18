import { z } from "zod";
import { lbToKg } from "@/lib/units";

const CM_PER_INCH = 2.54;
const num = z.coerce.number<unknown>();
const blank = (v: unknown) => (v === "" || v === null ? undefined : v);
const optionalNum = z.preprocess(blank, num.optional());

export const weightInputSchema = z
  .object({
    weight: num,
    unit: z.enum(["kg", "lb"]),
    occurred_at: z.preprocess(blank, z.iso.datetime({ offset: true }).optional()),
  })
  .transform((v) => ({ weightKg: v.unit === "lb" ? lbToKg(v.weight) : Math.round(v.weight * 100) / 100, occurredAt: v.occurred_at }))
  .refine((v) => v.weightKg >= 20 && v.weightKg <= 400, {
    message: "Weight must be between 20 and 400 kg (44–882 lb).",
    path: ["weight"],
  });

export const MEASUREMENT_FIELDS = ["waist", "hips", "chest", "arm", "thigh"] as const;
export type MeasurementField = (typeof MEASUREMENT_FIELDS)[number];

export const measurementInputSchema = z
  .object({
    unit: z.enum(["cm", "in"]),
    date: z.preprocess(blank, z.iso.date().optional()),
    waist: optionalNum,
    hips: optionalNum,
    chest: optionalNum,
    arm: optionalNum,
    thigh: optionalNum,
  })
  .transform((v) => {
    const toCm = (x: number | undefined) =>
      x === undefined ? null : Math.round((v.unit === "in" ? x * CM_PER_INCH : x) * 10) / 10;
    return {
      date: v.date,
      values: Object.fromEntries(MEASUREMENT_FIELDS.map((f) => [`${f}_cm`, toCm(v[f])])) as Record<`${MeasurementField}_cm`, number | null>,
    };
  })
  .superRefine((v, ctx) => {
    const provided = Object.entries(v.values).filter(([, x]) => x !== null);
    if (provided.length === 0) ctx.addIssue({ code: "custom", message: "Enter at least one measurement.", path: ["waist"] });
    for (const [key, x] of provided) {
      if (x! < 10 || x! > 250) {
        ctx.addIssue({ code: "custom", message: "Measurements must be between 10 and 250 cm (4–98 in).", path: [key.replace("_cm", "")] });
      }
    }
  });

export function fieldErrorsOf(error: z.ZodError): Record<string, string[] | undefined> {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

export const COMP_METHODS = ["inbody", "tanita", "dexa", "withings", "other_bia", "skinfold", "other"] as const;
export type CompMethod = (typeof COMP_METHODS)[number];
export const METHOD_LABELS: Record<CompMethod, string> = {
  inbody: "InBody",
  tanita: "Tanita",
  dexa: "DEXA",
  withings: "Withings",
  other_bia: "Other bioimpedance",
  skinfold: "Skinfold",
  other: "Other",
};

export const SEGMENTS = ["left_arm", "right_arm", "trunk", "left_leg", "right_leg"] as const;

const nullableNum = z.preprocess((v) => (v === "" || v === undefined ? null : v), num.nullable());
const MASS_FIELDS = ["weight", "fat_mass", "lean_mass", "skeletal_muscle", "total_body_water"] as const;

/** A body composition test as entered/confirmed in the form; masses in `unit`. */
export const compositionInputSchema = z
  .object({
    method: z.enum(COMP_METHODS, "Choose how the test was measured."),
    test_date: z.iso.date("Enter the test date."),
    unit: z.enum(["kg", "lb"]),
    weight: nullableNum,
    body_fat_pct: nullableNum,
    fat_mass: nullableNum,
    lean_mass: nullableNum,
    skeletal_muscle: nullableNum,
    visceral_fat_level: nullableNum,
    bmr_kcal: nullableNum,
    total_body_water: nullableNum,
    segmental_lean: z.record(z.enum(SEGMENTS), nullableNum).nullish(),
  })
  .transform((v) => {
    const kg = (x: number | null) => (x === null ? null : v.unit === "lb" ? lbToKg(x) : Math.round(x * 100) / 100);
    const segments = Object.fromEntries(
      Object.entries(v.segmental_lean ?? {}).flatMap(([k, x]) => (x === null || x === undefined ? [] : [[k, kg(x)]])),
    );
    return {
      method: v.method,
      test_date: v.test_date,
      weight_kg: kg(v.weight),
      body_fat_pct: v.body_fat_pct === null ? null : Math.round(v.body_fat_pct * 10) / 10,
      fat_mass_kg: kg(v.fat_mass),
      lean_mass_kg: kg(v.lean_mass),
      skeletal_muscle_kg: kg(v.skeletal_muscle),
      visceral_fat_level: v.visceral_fat_level,
      bmr_kcal: v.bmr_kcal === null ? null : Math.round(v.bmr_kcal),
      total_body_water_kg: kg(v.total_body_water),
      segmental_lean: Object.keys(segments).length > 0 ? segments : null,
    };
  })
  .superRefine((v, ctx) => {
    const range = (field: string, x: number | null, lo: number, hi: number, label: string) => {
      if (x !== null && (x < lo || x > hi)) ctx.addIssue({ code: "custom", path: [field], message: `${label} must be between ${lo} and ${hi}.` });
    };
    range("weight", v.weight_kg, 20, 400, "Weight (kg)");
    range("body_fat_pct", v.body_fat_pct, 0, 100, "Body fat %");
    for (const f of MASS_FIELDS.slice(1)) range(f, v[`${f}_kg` as "fat_mass_kg"], 0, 400, "Mass (kg)");
    range("visceral_fat_level", v.visceral_fat_level, 0, 60, "Visceral fat level");
    range("bmr_kcal", v.bmr_kcal, 500, 6000, "BMR");
  });

export type CompositionRecord = z.output<typeof compositionInputSchema>;

export const goalInputSchema = z
  .object({
    unit: z.enum(["kg", "lb"]),
    goal_weight: z.preprocess(blank, num.optional()),
    goal_body_fat_pct: z.preprocess(blank, num.optional()),
    target_date: z.preprocess(blank, z.iso.date().optional()),
  })
  .transform((v) => ({
    goalWeightKg: v.goal_weight === undefined ? null : v.unit === "lb" ? lbToKg(v.goal_weight) : Math.round(v.goal_weight * 100) / 100,
    goalBodyFatPct: v.goal_body_fat_pct === undefined ? null : Math.round(v.goal_body_fat_pct * 10) / 10,
    targetDate: v.target_date ?? null,
  }))
  .superRefine((v, ctx) => {
    if (v.goalWeightKg === null && v.goalBodyFatPct === null) {
      ctx.addIssue({ code: "custom", path: ["goal_weight"], message: "Set a goal weight, a goal body fat %, or both." });
    }
    if (v.goalWeightKg !== null && (v.goalWeightKg < 20 || v.goalWeightKg > 400)) {
      ctx.addIssue({ code: "custom", path: ["goal_weight"], message: "Goal weight must be between 20 and 400 kg." });
    }
    if (v.goalBodyFatPct !== null && (v.goalBodyFatPct < 2 || v.goalBodyFatPct > 60)) {
      ctx.addIssue({ code: "custom", path: ["goal_body_fat_pct"], message: "Goal body fat must be between 2 and 60 %." });
    }
  });

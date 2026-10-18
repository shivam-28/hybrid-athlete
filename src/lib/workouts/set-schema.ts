import { z } from "zod";
import type { SetType, TrackingMode } from "./types";

export const SET_TYPES: readonly SetType[] = ["warmup", "working", "drop", "failure"];

const optionalNumber = (schema: z.ZodNumber) => schema.nullable().optional();

export const setValuesSchema = z.object({
  weight_kg: optionalNumber(z.number().min(0, "Weight can't be negative").max(500, "Weight must be at most 500 kg")),
  reps: optionalNumber(z.number().int("Reps must be a whole number").min(1, "Reps must be at least 1").max(100, "Reps must be at most 100")),
  duration_s: optionalNumber(z.number().int().min(1, "Duration must be at least 1 second").max(7200, "Duration must be at most 2 hours")),
  distance_m: optionalNumber(z.number().min(1, "Distance must be at least 1 m").max(50000, "Distance must be at most 50 km")),
  rpe: optionalNumber(
    z.number().min(1, "RPE is 1–10").max(10, "RPE is 1–10").refine((v) => Number.isInteger(v * 2), "RPE goes in steps of 0.5"),
  ),
  set_type: z.enum(SET_TYPES as [SetType, ...SetType[]]).optional(),
});

export type SetValuesInput = z.input<typeof setValuesSchema>;
export type SetValues = {
  weight_kg: number | null;
  reps: number | null;
  duration_s: number | null;
  distance_m: number | null;
  rpe: number | null;
  set_type: SetType;
};
type Field = keyof SetValues;
export type SetValidation = { success: true; data: SetValues } | { success: false; errors: Partial<Record<Field, string[]>> };

/** Fields each tracking mode stores; anything else is dropped. */
const FIELDS: Record<TrackingMode, Field[]> = {
  weight_reps: ["weight_kg", "reps"],
  bodyweight_reps: ["weight_kg", "reps"],
  duration: ["duration_s", "weight_kg"],
  distance_duration: ["distance_m", "duration_s", "weight_kg"],
};

function missingRequired(mode: TrackingMode, v: SetValues): Partial<Record<Field, string[]>> {
  switch (mode) {
    case "weight_reps":
      return {
        ...(v.weight_kg === null && { weight_kg: ["Weight is required (use 0 for an empty bar or machine)"] }),
        ...(v.reps === null && { reps: ["Reps are required"] }),
      };
    case "bodyweight_reps":
      return v.reps === null ? { reps: ["Reps are required"] } : {};
    case "duration":
      return v.duration_s === null ? { duration_s: ["Duration is required"] } : {};
    case "distance_duration":
      return v.distance_m === null && v.duration_s === null ? { distance_m: ["Distance or duration is required"] } : {};
  }
}

export function validateSetForMode(mode: TrackingMode, input: SetValuesInput): SetValidation {
  const parsed = setValuesSchema.safeParse(input);
  if (!parsed.success) return { success: false, errors: z.flattenError(parsed.error).fieldErrors as Partial<Record<Field, string[]>> };
  const keep = FIELDS[mode];
  const pick = (f: Field) => (keep.includes(f) ? ((parsed.data[f as keyof typeof parsed.data] as number | null | undefined) ?? null) : null);
  const data: SetValues = {
    weight_kg: pick("weight_kg"),
    reps: pick("reps"),
    duration_s: pick("duration_s"),
    distance_m: pick("distance_m"),
    rpe: parsed.data.rpe ?? null,
    set_type: parsed.data.set_type ?? "working",
  };
  const errors = missingRequired(mode, data);
  return Object.keys(errors).length > 0 ? { success: false, errors } : { success: true, data };
}

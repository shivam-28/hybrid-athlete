import { z } from "zod";
import { EQUIPMENT, MUSCLE_GROUPS, type MuscleGroup, type TrackingMode } from "./types";

const muscle = z.enum(MUSCLE_GROUPS as [MuscleGroup, ...MuscleGroup[]]);

export const customExerciseSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(100),
  equipment: z.enum(EQUIPMENT).nullable(),
  tracking_mode: z.enum(["weight_reps", "bodyweight_reps", "duration", "distance_duration"] satisfies TrackingMode[]),
  primary: z.array(muscle).min(1, "Choose at least one primary muscle group"),
  secondary: z.array(muscle).default([]),
});

export type CustomExerciseInput = z.input<typeof customExerciseSchema>;

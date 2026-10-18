import { z } from "zod";
import { setValuesSchema } from "@/lib/workouts/set-schema";

export const newSetBody = setValuesSchema.extend({ exercise_id: z.uuid() });

const draftSet = z.object({
  weight_kg: z.number().nullable(),
  reps: z.number().nullable(),
  duration_s: z.number().nullable(),
  distance_m: z.number().nullable(),
});

export const voiceBody = z.object({
  transcript: z.string().trim().min(1).max(500),
  source: z.enum(["voice", "text"]),
  activeExerciseId: z.uuid().nullable().optional(),
});

export const confirmBody = z.object({
  phrase: z.string().max(100).nullable(),
  exerciseId: z.uuid(),
  sets: z.array(draftSet).min(1).max(10),
  source: z.enum(["voice", "text"]),
  transcript: z.string().max(500),
});

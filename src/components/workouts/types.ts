import type { TrackingMode, SetType, SetSource } from "@/lib/workouts/types";

export type LoggedSet = {
  id: string;
  exercise_id: string;
  set_number: number;
  set_type: SetType;
  weight_kg: number | null;
  reps: number | null;
  duration_s: number | null;
  distance_m: number | null;
  rpe: number | null;
  source: SetSource;
  transcript: string | null;
};

export type ExerciseRef = { id: string; name: string; tracking_mode: TrackingMode };
export type SessionBlock = { exercise: ExerciseRef; sets: LoggedSet[] };

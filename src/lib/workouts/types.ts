import type { Database } from "@/lib/database.types";

export type MuscleGroup = Database["public"]["Enums"]["muscle_group"];
export type MuscleRole = Database["public"]["Enums"]["muscle_role"];
export type TrackingMode = Database["public"]["Enums"]["tracking_mode"];
export type SetType = Database["public"]["Enums"]["set_type"];
export type SetSource = Database["public"]["Enums"]["set_source"];

export const MUSCLE_GROUPS: readonly MuscleGroup[] = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "core",
  "glutes",
  "quads",
  "hamstrings",
  "calves",
  "full_body",
  "cardio",
];

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  core: "Core",
  glutes: "Glutes",
  quads: "Quads",
  hamstrings: "Hamstrings",
  calves: "Calves",
  full_body: "Full body",
  cardio: "Cardio",
};

export const TRACKING_MODE_LABELS: Record<TrackingMode, string> = {
  weight_reps: "Weight × reps",
  bodyweight_reps: "Bodyweight reps (optional added weight)",
  duration: "Time held",
  distance_duration: "Distance / time",
};

/** Equipment values used by the seeded library; custom exercises pick from the same list. */
export const EQUIPMENT = [
  "barbell",
  "dumbbell",
  "kettlebells",
  "cable",
  "machine",
  "body only",
  "bands",
  "e-z curl bar",
  "medicine ball",
  "exercise ball",
  "foam roll",
  "other",
] as const;

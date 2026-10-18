import { normaliseExerciseText } from "@/lib/workouts/normalise";
import type { MuscleGroup, MuscleRole, TrackingMode } from "@/lib/workouts/types";

/** One record of free-exercise-db's dist/exercises.json. */
export type SourceExercise = {
  id: string;
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
};

export type SeedMuscle = { group: MuscleGroup; role: MuscleRole };

export type SeedRow = {
  source_id: string;
  name: string;
  search_name: string;
  category: string;
  equipment: string | null;
  level: string;
  mechanic: string | null;
  force: string | null;
  tracking_mode: TrackingMode;
  instructions: string[];
  image_paths: string[];
  muscles: SeedMuscle[];
};

const SOURCE_TO_GROUP: Record<string, MuscleGroup> = {
  abdominals: "core",
  "lower back": "back",
  "middle back": "back",
  lats: "back",
  traps: "back",
  chest: "chest",
  shoulders: "shoulders",
  neck: "shoulders",
  biceps: "biceps",
  triceps: "triceps",
  forearms: "forearms",
  calves: "calves",
  hamstrings: "hamstrings",
  glutes: "glutes",
  quadriceps: "quads",
  adductors: "quads",
  abductors: "glutes",
};

const REGION: Partial<Record<MuscleGroup, "upper" | "core" | "lower">> = {
  chest: "upper",
  back: "upper",
  shoulders: "upper",
  biceps: "upper",
  triceps: "upper",
  forearms: "upper",
  core: "core",
  glutes: "lower",
  quads: "lower",
  hamstrings: "lower",
  calves: "lower",
};

/** Known exceptions to the rule-based tracking mode, keyed by source id. */
const TRACKING_OVERRIDES: Record<string, TrackingMode> = {
  Farmers_Walk: "distance_duration",
  Yoke_Walk: "distance_duration",
  Rickshaw_Carry: "distance_duration",
  Sled_Push: "distance_duration",
  Weighted_Pull_Ups: "bodyweight_reps",
  Push_Up_to_Side_Plank: "bodyweight_reps",
};

const HOLD = /\b(plank|hold|wall sit|l-sit|hollow)\b/i;

const unique = (groups: (MuscleGroup | undefined)[]) => [...new Set(groups.filter((g): g is MuscleGroup => !!g))];

export function mapMuscles(source: SourceExercise): SeedMuscle[] {
  const primary = unique(source.primaryMuscles.map((m) => SOURCE_TO_GROUP[m]));
  const regions = new Set(primary.map((g) => REGION[g]).filter(Boolean));
  if (source.category === "olympic weightlifting" || regions.size >= 3 || primary.length === 0) primary.push("full_body");
  if (source.category === "cardio") primary.push("cardio");
  const secondary = unique(source.secondaryMuscles.map((m) => SOURCE_TO_GROUP[m])).filter((g) => !primary.includes(g));
  return [
    ...primary.map((group) => ({ group, role: "primary" as const })),
    ...secondary.map((group) => ({ group, role: "secondary" as const })),
  ];
}

export function trackingModeFor(source: SourceExercise): TrackingMode {
  const override = TRACKING_OVERRIDES[source.id];
  if (override) return override;
  if (HOLD.test(source.name)) return "duration";
  if (source.category === "cardio") return "distance_duration";
  if (source.category === "stretching") return "duration";
  if (source.equipment === "body only") return "bodyweight_reps";
  return "weight_reps";
}

export function toSeedRow(source: SourceExercise): SeedRow {
  return {
    source_id: source.id,
    name: source.name,
    search_name: normaliseExerciseText(source.name),
    category: source.category,
    equipment: source.equipment,
    level: source.level,
    mechanic: source.mechanic,
    force: source.force,
    tracking_mode: trackingModeFor(source),
    instructions: source.instructions,
    image_paths: source.images,
    muscles: mapMuscles(source),
  };
}

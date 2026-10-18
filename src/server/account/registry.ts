import type { Database } from "@/lib/database.types";

type PublicTable = keyof Database["public"]["Tables"];

export type RegisteredTable = {
  table: PublicTable;
  export: boolean;
  /** PostgREST select for export (default "*"), e.g. to nest child rows. */
  select?: string;
  /** Export only rows whose user_id is set; for tables that also hold shared rows (user_id null). */
  ownRowsOnly?: boolean;
};

/**
 * Every user-owned table and storage bucket. Export reads these; account deletion
 * removes the buckets' files (rows go via ON DELETE CASCADE from auth.users).
 * Secret tables are export: false. A DB test fails if a user_id table is missing here.
 */
export const USER_TABLES: readonly RegisteredTable[] = [
  { table: "profiles", export: true },
  { table: "user_ai_keys", export: false },
  { table: "exercises", export: true, select: "*, exercise_muscles(*)", ownRowsOnly: true },
  { table: "exercise_aliases", export: true },
  { table: "exercise_settings", export: true },
  { table: "workout_sessions", export: true },
  { table: "workout_sets", export: true },
  { table: "daily_metrics", export: true },
  { table: "activities", export: true },
  { table: "activity_splits", export: true },
  { table: "ingest_tokens", export: false },
  { table: "body_weights", export: true },
  { table: "body_measurements", export: true },
  { table: "body_composition_tests", export: true },
  { table: "progress_photos", export: true },
  { table: "progress_photo_analyses", export: true },
  { table: "body_goals", export: true },
  { table: "meals", export: true },
  { table: "meal_items", export: true },
  { table: "food_log_days", export: true },
  { table: "daily_nutrition_targets", export: true },
  { table: "planned_meals", export: true },
  { table: "training_preferences", export: true },
  { table: "training_plans", export: true },
  { table: "planned_sessions", export: true },
  { table: "readiness_checkins", export: true },
  // food_lookup_cache is instance-wide (no user_id, no user data) and deliberately not registered.
];

export const USER_BUCKETS: readonly string[] = ["activity-files", "body-comp-docs", "progress-photos", "meal-photos"];

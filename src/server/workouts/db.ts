import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/database.types";

/** A Supabase client acting as the signed-in user: every query is RLS-scoped. */
export type Db = SupabaseClient<Database>;
export type ExerciseRow = Tables<"exercises">;
export type SessionRow = Tables<"workout_sessions">;
export type SetRow = Tables<"workout_sets">;

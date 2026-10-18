import "server-only";
import { parsePreferences, type TrainingPreferences } from "@/lib/coach/preferences";
import { localDate } from "@/lib/time";
import type { Profile } from "@/server/auth";
import type { Db } from "@/server/body/weights";
import { CoachError } from "./errors";

export async function getPreferences(db: Db): Promise<TrainingPreferences | null> {
  const { data, error } = await db.from("training_preferences").select("*").maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    days_per_week: data.days_per_week,
    max_session_min: data.max_session_min,
    long_run_weekday: data.long_run_weekday,
    equipment: data.equipment as TrainingPreferences["equipment"],
    race_distance_km: data.race_distance_km === null ? null : Number(data.race_distance_km),
    race_date: data.race_date,
    race_goal_time: data.race_goal_time,
  };
}

/** Validates against the user's local today (race dates can't be in the past) and upserts the single row. */
export async function savePreferences(db: Db, profile: Profile, input: Record<string, unknown>, now = new Date()): Promise<TrainingPreferences> {
  const parsed = parsePreferences(input, localDate(now, profile.timezone));
  if (!parsed.success) throw new CoachError("invalid", "Check the highlighted fields.", parsed.fieldErrors);
  const { error } = await db.from("training_preferences").upsert(parsed.data, { onConflict: "user_id" });
  if (error) throw error;
  return parsed.data;
}

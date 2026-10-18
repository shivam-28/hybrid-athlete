import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { resolveMaxHr, zoneSeconds, type HrHistogram } from "@/lib/activities/heart-rate";
import { activityLoad } from "@/lib/activities/load";
import type { Profile } from "@/server/auth";
import { ACTIVITY_FILES_BUCKET } from "./fit-import";

type Client = SupabaseClient<Database>;

/** Deletes an activity (splits cascade) and its stored original file. */
export async function deleteActivity(supabase: Client, activityId: string): Promise<void> {
  const { data, error } = await supabase.from("activities").delete().eq("id", activityId).select("fit_file_path");
  if (error) throw new Error("Failed to delete the activity");
  const paths = (data ?? []).map((row) => row.fit_file_path).filter((p): p is string => p !== null);
  if (paths.length > 0) await supabase.storage.from(ACTIVITY_FILES_BUCKET).remove(paths);
}

/** Re-derives HR zones and load for all of a user's activities after their max HR changed. */
export async function recomputeActivityZones(supabase: Client, profile: Profile): Promise<void> {
  const { data, error } = await supabase
    .from("activities")
    .select("id, sport, local_date, moving_s, elapsed_s, avg_hr, hr_histogram");
  if (error) throw new Error("Failed to load activities");

  const updates = data.map((a) => {
    const maxHr = resolveMaxHr({ profileMaxHr: profile.max_hr_bpm, birthDate: profile.birth_date, onDate: a.local_date });
    const histogram = a.hr_histogram as HrHistogram | null;
    return supabase
      .from("activities")
      .update({
        max_hr_used: maxHr.bpm,
        max_hr_source: maxHr.source,
        hr_zone_s: histogram ? zoneSeconds(histogram, maxHr.bpm) : null,
        load: activityLoad({ sport: a.sport, movingS: a.moving_s, elapsedS: a.elapsed_s, avgHr: a.avg_hr }, maxHr.bpm),
      })
      .eq("id", a.id);
  });
  const results = await Promise.all(updates);
  if (results.some((r) => r.error)) throw new Error("Failed to update activities");
}

import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { resolveMaxHr, zoneSeconds } from "@/lib/activities/heart-rate";
import { activityLoad } from "@/lib/activities/load";
import { FitImportError, extractFit, parseFit } from "@/lib/fit/parse";
import { localDate } from "@/lib/time";
import type { Profile } from "@/server/auth";
import { completePlannedSessionsAfterWrite } from "@/server/coach/completion";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const ACTIVITY_FILES_BUCKET = "activity-files";

export type FitImportResult = { status: "created" | "merged" | "duplicate"; activityId: string };

/**
 * Parses first (so a bad file leaves no trace), then stores the original and imports it,
 * both as the signed-in user (RLS applies). The stored file is removed if the import doesn't use it.
 */
export async function importFitUpload(
  supabase: SupabaseClient<Database>,
  profile: Profile,
  upload: Uint8Array,
): Promise<FitImportResult> {
  if (upload.byteLength > MAX_UPLOAD_BYTES) throw new FitImportError("too_large");
  const fitBytes = extractFit(upload);
  const fit = parseFit(fitBytes);

  const maxHr = resolveMaxHr({
    profileMaxHr: profile.max_hr_bpm,
    birthDate: profile.birth_date,
    onDate: localDate(fit.startedAt, profile.timezone),
  });
  const id = randomUUID();
  const path = `${profile.user_id}/${id}.fit`;

  const stored = await supabase.storage
    .from(ACTIVITY_FILES_BUCKET)
    .upload(path, fitBytes, { contentType: "application/octet-stream" });
  if (stored.error) throw new Error("Failed to store the activity file");

  const { data, error } = await supabase.rpc("import_fit_activity", {
    p_activity: {
      id,
      occurred_at: fit.startedAt.toISOString(),
      sport: fit.sport,
      sub_sport: fit.subSport,
      elapsed_s: fit.elapsedS,
      moving_s: fit.movingS,
      distance_m: fit.distanceM,
      avg_hr: fit.avgHr,
      max_hr: fit.maxHr,
      elevation_gain_m: fit.elevationGainM,
      calories_kcal: fit.caloriesKcal,
      hr_histogram: fit.hrHistogram,
      hr_zone_s: fit.hrHistogram ? zoneSeconds(fit.hrHistogram, maxHr.bpm) : null,
      max_hr_used: maxHr.bpm,
      max_hr_source: maxHr.source,
      load: activityLoad({ sport: fit.sport, movingS: fit.movingS, elapsedS: fit.elapsedS, avgHr: fit.avgHr }, maxHr.bpm),
      fit_file_path: path,
    },
    p_splits: fit.splits.map((s) => ({
      idx: s.idx,
      distance_m: s.distanceM,
      duration_s: s.durationS,
      avg_hr: s.avgHr,
      elev_delta_m: s.elevDeltaM,
    })),
  });

  const result = data as { status: FitImportResult["status"]; activity_id: string } | null;
  if (error || !result || result.status === "duplicate") {
    await supabase.storage.from(ACTIVITY_FILES_BUCKET).remove([path]);
    if (error || !result) throw new Error("Failed to import the activity");
  }
  const day = localDate(fit.startedAt, profile.timezone);
  await completePlannedSessionsAfterWrite(supabase, profile.user_id, day, day);
  return { status: result.status, activityId: result.activity_id };
}

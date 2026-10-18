import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/database.types";
import { addDays } from "@/lib/activities/dates";
import { trainingLoad, type TrainingLoad } from "@/lib/activities/load";
import { weeklySummaries, type WeekSummary } from "@/lib/activities/summaries";
import { SPORTS, type Sport } from "@/lib/ingest/payload";
import { isoWeekStart } from "@/lib/time";

type Client = SupabaseClient<Database>;
export type ActivityRow = Tables<"activities">;
export type SplitRow = Tables<"activity_splits">;
export type DailyMetricsRow = Tables<"daily_metrics">;

export const isSport = (value: unknown): value is Sport => SPORTS.includes(value as Sport);

export async function listActivities(supabase: Client, filter: { sport?: Sport; limit?: number } = {}): Promise<ActivityRow[]> {
  let query = supabase.from("activities").select("*").order("occurred_at", { ascending: false }).limit(filter.limit ?? 100);
  if (filter.sport) query = query.eq("sport", filter.sport);
  const { data, error } = await query;
  if (error) throw new Error("Failed to load activities");
  return data;
}

export async function getActivity(supabase: Client, id: string): Promise<{ activity: ActivityRow; splits: SplitRow[] } | null> {
  const { data: activity } = await supabase.from("activities").select("*").eq("id", id).maybeSingle();
  if (!activity) return null;
  const { data: splits } = await supabase.from("activity_splits").select("*").eq("activity_id", id).order("idx");
  return { activity, splits: splits ?? [] };
}

/** Weekly summaries (current + 8 weeks) and acute/chronic training load as of `today`. */
export async function trainingOverview(supabase: Client, today: string): Promise<{ weeks: WeekSummary[]; load: TrainingLoad }> {
  const from = addDays(isoWeekStart(today), -8 * 7);
  const [{ data: recent }, { data: first }] = await Promise.all([
    supabase.from("activities").select("local_date, sport, distance_m, moving_s, load").gte("local_date", from),
    supabase.from("activities").select("local_date").order("local_date").limit(1).maybeSingle(),
  ]);
  const rows = recent ?? [];
  return { weeks: weeklySummaries(rows, today), load: trainingLoad(rows, today, first?.local_date) };
}

export async function recentDailyMetrics(supabase: Client, today: string, days = 14): Promise<DailyMetricsRow[]> {
  const { data } = await supabase
    .from("daily_metrics")
    .select("*")
    .gte("local_date", addDays(today, -(days - 1)))
    .lte("local_date", today)
    .order("local_date");
  return data ?? [];
}

/** Activities and synced daily metrics for one local day (Today card). */
export async function dayActivitySummary(supabase: Client, day: string) {
  const [{ data: activities }, { data: metrics }] = await Promise.all([
    supabase.from("activities").select("sport, distance_m, moving_s, elapsed_s").eq("local_date", day),
    supabase.from("daily_metrics").select("steps").eq("local_date", day).maybeSingle(),
  ]);
  return { activities: activities ?? [], steps: metrics?.steps ?? null };
}

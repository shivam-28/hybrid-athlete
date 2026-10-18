import "server-only";
import type { SessionSets } from "@/lib/workouts/progression";
import type { Db } from "./db";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

type HistorySet = { id: string; session_id: string; set_number: number; set_type: string; weight_kg: number | null; reps: number | null; duration_s: number | null; distance_m: number | null; rpe: number | null };

/** Sets for an exercise, newest session first, excluding the given session. */
async function setsBySession(db: Db, exerciseId: string, excludeSessionId: string | null, sessionLimit: number) {
  const { data: sessions } = await db
    .from("workout_sessions")
    .select("id, local_date, occurred_at, workout_sets!inner(exercise_id)")
    .eq("workout_sets.exercise_id", exerciseId)
    .neq("id", excludeSessionId ?? NIL_UUID)
    .order("occurred_at", { ascending: false })
    .limit(sessionLimit);
  if (!sessions?.length) return [];
  const { data: sets } = await db
    .from("workout_sets")
    .select("id, session_id, set_number, set_type, weight_kg, reps, duration_s, distance_m, rpe")
    .eq("exercise_id", exerciseId)
    .in("session_id", sessions.map((s) => s.id))
    .order("set_number");
  return sessions.map((s) => ({
    sessionId: s.id,
    localDate: s.local_date,
    sets: (sets ?? []).filter((x) => x.session_id === s.id) as HistorySet[],
  }));
}

/** The exercise's sets from the most recent previous session that included it. */
export async function previousPerformance(db: Db, exerciseId: string, currentSessionId: string | null) {
  const [latest] = await setsBySession(db, exerciseId, currentSessionId, 1);
  return latest ?? null;
}

/** Working sets of the last `n` previous sessions, newest first, for progression. */
export async function recentWorkingSets(db: Db, exerciseId: string, currentSessionId: string | null, n: number): Promise<SessionSets[]> {
  const sessions = await setsBySession(db, exerciseId, currentSessionId, n);
  return sessions
    .map((s) => s.sets.filter((x) => x.set_type !== "warmup"))
    .filter((sets) => sets.length > 0);
}

export async function exerciseHistory(db: Db, exerciseId: string, limit = 30) {
  return setsBySession(db, exerciseId, null, limit);
}

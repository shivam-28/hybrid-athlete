import "server-only";
import type { SessionBlock } from "@/components/workouts/types";
import type { Db } from "./db";

const SET_COLUMNS = "id, exercise_id, set_number, set_type, weight_kg, reps, duration_s, distance_m, rpe, source, transcript, exercises(id, name, tracking_mode)";

async function blocksFor(db: Db, sessionId: string): Promise<SessionBlock[]> {
  const { data } = await db.from("workout_sets").select(SET_COLUMNS).eq("session_id", sessionId).order("occurred_at").order("set_number");
  const blocks = new Map<string, SessionBlock>();
  for (const { exercises, ...set } of data ?? []) {
    const block = blocks.get(set.exercise_id) ?? { exercise: exercises, sets: [] };
    block.sets.push(set);
    blocks.set(set.exercise_id, block);
  }
  for (const block of blocks.values()) block.sets.sort((a, b) => a.set_number - b.set_number);
  return [...blocks.values()];
}

export async function activeSessionView(db: Db) {
  const { data: session } = await db.from("workout_sessions").select("id, local_date, occurred_at").is("finished_at", null).maybeSingle();
  return session ? { session, blocks: await blocksFor(db, session.id) } : null;
}

export async function sessionView(db: Db, id: string) {
  const { data: session } = await db.from("workout_sessions").select("id, local_date, occurred_at, finished_at").eq("id", id).maybeSingle();
  return session ? { session, blocks: await blocksFor(db, session.id) } : null;
}

export function sessionDurationMinutes(session: { occurred_at: string; finished_at: string | null }, now = new Date()) {
  const end = session.finished_at ? new Date(session.finished_at) : now;
  return Math.max(0, Math.round((end.getTime() - new Date(session.occurred_at).getTime()) / 60000));
}

/** Sessions newest first with exercise and working-set counts. */
export async function listSessions(db: Db, options: { limit?: number; localDate?: string } = {}) {
  let query = db
    .from("workout_sessions")
    .select("id, local_date, occurred_at, finished_at, workout_sets(exercise_id, set_type)")
    .order("occurred_at", { ascending: false })
    .limit(options.limit ?? 50);
  if (options.localDate) query = query.eq("local_date", options.localDate);
  const { data } = await query;
  return (data ?? []).map(({ workout_sets, ...s }) => ({
    ...s,
    exerciseCount: new Set(workout_sets.map((w) => w.exercise_id)).size,
    workingSets: workout_sets.filter((w) => w.set_type !== "warmup").length,
    durationMinutes: sessionDurationMinutes(s),
  }));
}

export async function weeklyVolume(db: Db, weekStart: string) {
  const { data } = await db.rpc("weekly_muscle_volume", { p_week_start: weekStart });
  return (data ?? []).map((r) => ({ muscle_group: r.muscle_group, sets: Number(r.sets) }));
}

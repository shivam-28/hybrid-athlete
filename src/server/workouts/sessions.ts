import "server-only";
import { z } from "zod";
import { validateSetForMode, type SetValuesInput } from "@/lib/workouts/set-schema";
import type { SetSource } from "@/lib/workouts/types";
import { localDate } from "@/lib/time";
import type { Profile } from "@/server/auth";
import { completePlannedSessionsAfterWrite } from "@/server/coach/completion";
import type { Db, SessionRow, SetRow } from "./db";
import { WorkoutError, fromDbError } from "./errors";

export type NewSet = SetValuesInput & { exercise_id: string; source?: SetSource; transcript?: string | null };

const isUuid = (id: string) => z.uuid().safeParse(id).success;

export async function getActiveSession(db: Db): Promise<SessionRow | null> {
  const { data } = await db.from("workout_sessions").select("*").is("finished_at", null).maybeSingle();
  return data;
}

async function createSession(db: Db, profile: Profile, now: Date): Promise<SessionRow> {
  const { data, error } = await db
    .from("workout_sessions")
    .insert({ local_date: localDate(now, profile.timezone) })
    .select()
    .single();
  if (error) throw fromDbError(error);
  await completePlannedSessionsAfterWrite(db, profile.user_id, data.local_date, data.local_date);
  return data;
}

/** Starts a session; refuses while another is active unless finishActive is set. */
export async function startSession(
  db: Db,
  profile: Profile,
  options: { finishActive?: boolean },
  now = new Date(),
): Promise<{ session: SessionRow }> {
  const active = await getActiveSession(db);
  if (active) {
    if (!options.finishActive) {
      throw new WorkoutError("active_session_exists", "Finish your current session first.", { activeSessionId: active.id });
    }
    await finishSession(db, active.id);
  }
  return { session: await createSession(db, profile, now) };
}

export async function ensureActiveSession(db: Db, profile: Profile, now = new Date()): Promise<SessionRow> {
  return (await getActiveSession(db)) ?? (await createSession(db, profile, now));
}

async function requireSession(db: Db, id: string): Promise<SessionRow> {
  const { data } = isUuid(id) ? await db.from("workout_sessions").select("*").eq("id", id).maybeSingle() : { data: null };
  if (!data) throw new WorkoutError("not_found", "Session not found");
  return data;
}

export async function finishSession(db: Db, id: string): Promise<void> {
  await requireSession(db, id);
  const { error } = await db.rpc("finish_session", { p_session_id: id });
  if (error) throw fromDbError(error);
}

export async function reopenSession(db: Db, id: string): Promise<void> {
  await requireSession(db, id);
  const { error } = await db.from("workout_sessions").update({ finished_at: null }).eq("id", id);
  if (error) throw fromDbError(error);
}

async function trackingModeOf(db: Db, exerciseId: string) {
  const { data } = isUuid(exerciseId)
    ? await db.from("exercises").select("tracking_mode").eq("id", exerciseId).is("archived_at", null).maybeSingle()
    : { data: null };
  if (!data) throw new WorkoutError("not_found", "Exercise not found");
  return data.tracking_mode;
}

/** Adds a set to the active session, starting one for today when none is active. */
export async function addSet(db: Db, profile: Profile, input: NewSet, now = new Date()): Promise<SetRow> {
  const mode = await trackingModeOf(db, input.exercise_id);
  const valid = validateSetForMode(mode, input);
  if (!valid.success) throw new WorkoutError("invalid", "Check the set values.", valid.errors);
  const session = await ensureActiveSession(db, profile, now);
  const { data, error } = await db
    .from("workout_sets")
    .insert({
      ...valid.data,
      session_id: session.id,
      exercise_id: input.exercise_id,
      source: input.source ?? "manual",
      transcript: input.transcript?.slice(0, 500) ?? null,
    })
    .select()
    .single();
  if (error) throw fromDbError(error);
  return data;
}

/** Copies the latest set (of an exercise, or of any exercise) in the active session. */
export async function repeatLastSet(db: Db, profile: Profile, exerciseId: string | null, source: SetSource = "manual", transcript?: string): Promise<SetRow> {
  const active = await getActiveSession(db);
  let query = db.from("workout_sets").select("*").eq("session_id", active?.id ?? "00000000-0000-0000-0000-000000000000");
  if (exerciseId) query = query.eq("exercise_id", exerciseId);
  const { data: last } = await query.order("occurred_at", { ascending: false }).order("set_number", { ascending: false }).limit(1).maybeSingle();
  if (!active || !last) throw new WorkoutError("nothing_to_repeat", "There's no previous set to repeat in this session.");
  return addSet(db, profile, {
    exercise_id: last.exercise_id,
    weight_kg: last.weight_kg,
    reps: last.reps,
    duration_s: last.duration_s,
    distance_m: last.distance_m,
    rpe: last.rpe,
    set_type: last.set_type,
    source,
    transcript,
  });
}

export async function updateSet(db: Db, setId: string, patch: SetValuesInput): Promise<SetRow> {
  const { data: current } = isUuid(setId)
    ? await db.from("workout_sets").select("*, exercises(tracking_mode)").eq("id", setId).maybeSingle()
    : { data: null };
  if (!current) throw new WorkoutError("not_found", "Set not found");
  const { exercises, ...set } = current;
  const valid = validateSetForMode(exercises.tracking_mode, { ...set, ...patch });
  if (!valid.success) throw new WorkoutError("invalid", "Check the set values.", valid.errors);
  const { data, error } = await db.from("workout_sets").update(valid.data).eq("id", setId).select().single();
  if (error) throw fromDbError(error);
  return data;
}

export async function deleteSet(db: Db, setId: string): Promise<void> {
  if (!isUuid(setId)) throw new WorkoutError("not_found", "Set not found");
  const { error } = await db.rpc("delete_set", { p_set_id: setId });
  if (error) throw fromDbError(error);
}

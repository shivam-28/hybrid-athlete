import "server-only";
import { matchCompletions, type CompletionItem, type OpenSession } from "@/lib/coach/matching";
import type { Db } from "@/server/body/weights";
import { CoachError } from "./errors";

/**
 * Links logged workouts and recorded runs to the active plan's open sessions (design D6).
 * Filters by user_id explicitly so the ingest path can call it with the service-role client.
 * Idempotent: linked items and manually set sessions are skipped.
 */
export async function syncPlannedCompletions(db: Db, userId: string, from: string, to: string, now = new Date()): Promise<number> {
  const [open, linked, workouts, runs] = await Promise.all([
    db
      .from("planned_sessions")
      .select("id, local_date, type, day_index, position, training_plans!inner(status)")
      .eq("user_id", userId)
      .eq("training_plans.status", "active")
      .eq("status", "planned")
      .eq("manual", false)
      .gte("local_date", from)
      .lte("local_date", to),
    db
      .from("planned_sessions")
      .select("workout_session_id, activity_id")
      .eq("user_id", userId)
      .gte("local_date", from)
      .lte("local_date", to)
      .or("workout_session_id.not.is.null,activity_id.not.is.null"),
    db.from("workout_sessions").select("id, local_date, occurred_at").eq("user_id", userId).gte("local_date", from).lte("local_date", to),
    db.from("activities").select("id, local_date, occurred_at").eq("user_id", userId).eq("sport", "running").gte("local_date", from).lte("local_date", to),
  ]);
  for (const r of [open, linked, workouts, runs]) if (r.error) throw r.error;

  const used = new Set((linked.data ?? []).flatMap((l) => [l.workout_session_id, l.activity_id]).filter(Boolean));
  const items: CompletionItem[] = [
    ...(workouts.data ?? []).filter((w) => !used.has(w.id)).map((w) => ({ id: w.id, kind: "workout" as const, local_date: w.local_date, occurred_at: w.occurred_at })),
    ...(runs.data ?? []).filter((a) => !used.has(a.id)).map((a) => ({ id: a.id, kind: "run" as const, local_date: a.local_date, occurred_at: a.occurred_at })),
  ];
  const matches = matchCompletions((open.data ?? []) as OpenSession[], items);

  let completed = 0;
  for (const { sessionId, item } of matches) {
    const { error, count } = await db
      .from("planned_sessions")
      .update(
        {
          status: "completed",
          auto_completed: true,
          completed_at: now.toISOString(),
          ...(item.kind === "workout" ? { workout_session_id: item.id } : { activity_id: item.id }),
        },
        { count: "exact" },
      )
      .eq("id", sessionId)
      .eq("status", "planned");
    // A concurrent sync may have linked the same item (unique index): the other write wins.
    if (!error) completed += count ?? 0;
  }
  return completed;
}

/** Manual complete / skip / undo. Manual changes take precedence over auto-completion. */
export async function setSessionStatus(db: Db, sessionId: string, status: "planned" | "completed" | "skipped", now = new Date()): Promise<void> {
  const { data, error } = await db
    .from("planned_sessions")
    .update({
      status,
      manual: true,
      auto_completed: false,
      workout_session_id: null,
      activity_id: null,
      completed_at: status === "completed" ? now.toISOString() : null,
    })
    .eq("id", sessionId)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new CoachError("not_found", "Session not found.");
}

/** Auto-completion after a write path stored new items; never fails the write that triggered it. */
export async function completePlannedSessionsAfterWrite(db: Db, userId: string, from: string, to: string): Promise<void> {
  try {
    await syncPlannedCompletions(db, userId, from, to);
  } catch (error) {
    console.error("Planned-session auto-completion failed", error);
  }
}

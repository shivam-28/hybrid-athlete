import { NextResponse } from "next/server";

export type WorkoutErrorCode = "not_found" | "invalid" | "active_session_exists" | "session_finished" | "nothing_to_repeat";

const STATUS: Record<WorkoutErrorCode, number> = {
  not_found: 404,
  invalid: 422,
  active_session_exists: 409,
  session_finished: 409,
  nothing_to_repeat: 409,
};

export class WorkoutError extends Error {
  constructor(
    readonly code: WorkoutErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "WorkoutError";
  }
}

/** Maps Postgres/PostgREST errors raised by workout tables and functions. */
export function fromDbError(error: { code?: string; hint?: string; message: string }): WorkoutError {
  if (error.hint === "session_finished") return new WorkoutError("session_finished", "This session is finished. Reopen it to add sets.");
  if (error.code === "23505") return new WorkoutError("active_session_exists", "You already have an active session.");
  if (error.code === "P0002" || error.code === "42501" || error.code === "PGRST116") {
    return new WorkoutError("not_found", "Not found");
  }
  if (error.code === "23514") return new WorkoutError("invalid", "Some values are out of range.");
  return new WorkoutError("invalid", error.message);
}

/** Route-handler helper: WorkoutError → JSON error response; anything else is rethrown. */
export function workoutErrorResponse(error: unknown): NextResponse {
  if (error instanceof WorkoutError) {
    return NextResponse.json({ error: error.code, message: error.message, details: error.details }, { status: STATUS[error.code] });
  }
  throw error;
}

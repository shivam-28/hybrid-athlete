import { NextResponse } from "next/server";

export type CoachErrorCode =
  | "invalid"
  | "not_found"
  | "no_preferences"
  | "missing_ai_key"
  | "ai_key_invalid"
  | "ai_unavailable"
  | "ai_declined"
  | "plan_invalid"
  | "warnings_unacknowledged";

const STATUS: Record<CoachErrorCode, number> = {
  invalid: 422,
  not_found: 404,
  no_preferences: 409,
  missing_ai_key: 409,
  ai_key_invalid: 409,
  ai_unavailable: 502,
  ai_declined: 422,
  plan_invalid: 502,
  warnings_unacknowledged: 409,
};

export class CoachError extends Error {
  constructor(
    readonly code: CoachErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "CoachError";
  }
}

export function coachErrorResponse(error: unknown): NextResponse {
  if (error instanceof CoachError) {
    return NextResponse.json({ error: error.code, message: error.message, details: error.details }, { status: STATUS[error.code] });
  }
  throw error;
}

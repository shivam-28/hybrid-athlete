import { NextResponse } from "next/server";

export type BodyErrorCode = "invalid" | "not_found" | "no_ai_key" | "ai_key_invalid" | "ai_unavailable" | "ai_declined" | "consent_required";

const STATUS: Record<BodyErrorCode, number> = {
  invalid: 422,
  not_found: 404,
  no_ai_key: 409,
  ai_key_invalid: 409,
  ai_unavailable: 502,
  ai_declined: 422,
  consent_required: 403,
};

export class BodyError extends Error {
  constructor(
    readonly code: BodyErrorCode,
    message: string,
    readonly fieldErrors?: Record<string, string[] | undefined>,
  ) {
    super(message);
    this.name = "BodyError";
  }
}

export function bodyErrorResponse(error: unknown): NextResponse {
  if (error instanceof BodyError) {
    return NextResponse.json({ error: error.code, message: error.message, details: error.fieldErrors }, { status: STATUS[error.code] });
  }
  throw error;
}

/** Throws BodyError("not_found") when an RLS-scoped write touched no row. */
export function requireRow<T>(data: T | null, what: string): T {
  if (!data) throw new BodyError("not_found", `${what} not found`);
  return data;
}

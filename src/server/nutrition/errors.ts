import { NextResponse } from "next/server";

export type NutritionErrorCode = "invalid" | "not_found" | "missing_ai_key" | "ai_key_invalid" | "ai_unavailable" | "ai_declined";

const STATUS: Record<NutritionErrorCode, number> = {
  invalid: 422,
  not_found: 404,
  missing_ai_key: 409,
  ai_key_invalid: 409,
  ai_unavailable: 502,
  ai_declined: 422,
};

export class NutritionError extends Error {
  constructor(
    readonly code: NutritionErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "NutritionError";
  }
}

export function nutritionErrorResponse(error: unknown): NextResponse {
  if (error instanceof NutritionError) {
    return NextResponse.json({ error: error.code, message: error.message, details: error.details }, { status: STATUS[error.code] });
  }
  throw error;
}

import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/server/auth";
import { NutritionError, nutritionErrorResponse } from "./errors";

export type ApiSession = Exclude<Awaited<ReturnType<typeof requireApiUser>>, { error: NextResponse }>;

/** Authenticates (401/403), runs the handler, and maps NutritionError to JSON. */
export async function withNutritionUser(handler: (session: ApiSession) => Promise<Response>): Promise<Response> {
  const session = await requireApiUser();
  if (session.error) return session.error;
  try {
    return await handler(session);
  } catch (error) {
    return nutritionErrorResponse(error);
  }
}

export async function readBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  const parsed = schema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) throw new NutritionError("invalid", "Invalid request body.", z.flattenError(parsed.error).fieldErrors);
  return parsed.data;
}

export const isoDate = z.iso.date();

export function parseDate(value: string | null): string {
  const parsed = isoDate.safeParse(value);
  if (!parsed.success) throw new NutritionError("invalid", "Use a date like 2026-10-18.");
  return parsed.data;
}

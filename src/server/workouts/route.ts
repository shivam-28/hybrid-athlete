import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/server/auth";
import { WorkoutError, workoutErrorResponse } from "./errors";

type ApiSession = Exclude<Awaited<ReturnType<typeof requireApiUser>>, { error: NextResponse }>;

/** Authenticates (401/403), runs the handler, and maps WorkoutError to JSON. */
export async function withWorkoutUser(handler: (session: ApiSession) => Promise<Response>): Promise<Response> {
  const session = await requireApiUser();
  if (session.error) return session.error;
  try {
    return await handler(session);
  } catch (error) {
    return workoutErrorResponse(error);
  }
}

export async function readJson<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  const body: unknown = await request.json().catch(() => undefined);
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new WorkoutError("invalid", "Invalid request body.", z.flattenError(parsed.error).fieldErrors);
  return parsed.data;
}

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

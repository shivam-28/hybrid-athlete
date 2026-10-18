import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/server/auth";
import { BodyError, bodyErrorResponse } from "./errors";

export type ApiSession = Exclude<Awaited<ReturnType<typeof requireApiUser>>, { error: NextResponse }>;

/** Authenticates (401/403), runs the handler, and maps BodyError to JSON. */
export async function withBodyUser(handler: (session: ApiSession) => Promise<Response>): Promise<Response> {
  const session = await requireApiUser();
  if (session.error) return session.error;
  try {
    return await handler(session);
  } catch (error) {
    return bodyErrorResponse(error);
  }
}

export async function readBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  const parsed = schema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) throw new BodyError("invalid", "Invalid request body.", z.flattenError(parsed.error).fieldErrors as Record<string, string[]>);
  return parsed.data;
}

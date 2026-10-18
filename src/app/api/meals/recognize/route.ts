import { NextResponse } from "next/server";
import { z } from "zod";
import { recognizeForUser } from "@/server/nutrition/recognize";
import { readBody, withNutritionUser } from "@/server/nutrition/route";

/** Photo and/or description → unsaved draft for the confirmation screen. 409 missing_ai_key without a key. */
export function POST(request: Request) {
  return withNutritionUser(async ({ supabase, user }) => {
    const body = await readBody(request, z.object({ photoPath: z.string().optional(), description: z.string().optional() }));
    return NextResponse.json(await recognizeForUser(supabase, user.id, body));
  });
}

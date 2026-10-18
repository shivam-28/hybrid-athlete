import { NextResponse } from "next/server";
import { z } from "zod";
import { summarizeWeek } from "@/server/coach/review";
import { readBody, withCoachUser } from "@/server/coach/route";

/** One-paragraph AI summary of a week's figures (409 missing_ai_key without a key). */
export function POST(request: Request) {
  return withCoachUser(async ({ supabase, profile }) => {
    const { week_start } = await readBody(request, z.object({ week_start: z.iso.date() }));
    return NextResponse.json(await summarizeWeek(supabase, profile, week_start));
  });
}

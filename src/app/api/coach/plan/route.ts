import { NextResponse } from "next/server";
import { z } from "zod";
import { generatePlan } from "@/server/coach/generate";
import { readBody, withCoachUser } from "@/server/coach/route";

/** Generates a draft plan for a week (409 no_preferences / missing_ai_key, 502 plan_invalid). */
export function POST(request: Request) {
  return withCoachUser(async ({ supabase, profile }) => {
    const { week_start } = await readBody(request, z.object({ week_start: z.iso.date() }));
    const result = await generatePlan(supabase, profile, week_start);
    return NextResponse.json({ planId: result.planId, warnings: result.warnings });
  });
}

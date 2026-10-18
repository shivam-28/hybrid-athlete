import { NextResponse } from "next/server";
import { submitCheckin } from "@/server/coach/readiness";
import { withCoachUser } from "@/server/coach/route";

/** Upserts today's check-in and returns readiness with proposed session adjustments. */
export function POST(request: Request) {
  return withCoachUser(async ({ supabase, profile }) => {
    const coach = await submitCheckin(supabase, profile, await request.json().catch(() => ({})));
    return NextResponse.json(coach);
  });
}

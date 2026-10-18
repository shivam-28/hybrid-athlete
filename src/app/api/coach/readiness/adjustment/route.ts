import { NextResponse } from "next/server";
import { z } from "zod";
import { chooseAdjustment } from "@/server/coach/readiness";
import { readBody, withCoachUser } from "@/server/coach/route";

export function POST(request: Request) {
  return withCoachUser(async ({ supabase, profile }) => {
    const { choice } = await readBody(request, z.object({ choice: z.enum(["accepted", "overridden"]) }));
    return NextResponse.json(await chooseAdjustment(supabase, profile, choice));
  });
}

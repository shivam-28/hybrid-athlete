import { NextResponse } from "next/server";
import { savePreferences } from "@/server/coach/preferences";
import { withCoachUser } from "@/server/coach/route";

export function PUT(request: Request) {
  return withCoachUser(async ({ supabase, profile }) => {
    const preferences = await savePreferences(supabase, profile, await request.json().catch(() => ({})));
    return NextResponse.json({ preferences });
  });
}

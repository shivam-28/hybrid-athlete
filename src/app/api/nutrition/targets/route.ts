import { NextResponse, type NextRequest } from "next/server";
import { localDate } from "@/lib/time";
import { parseDate, withNutritionUser } from "@/server/nutrition/route";
import { getTargetsForDate } from "@/server/nutrition/targets";

/** GET ?date=YYYY-MM-DD (default today): live for today, frozen for past days. */
export function GET(request: NextRequest) {
  return withNutritionUser(async ({ supabase, profile }) => {
    const raw = request.nextUrl.searchParams.get("date");
    const date = raw === null ? localDate(new Date(), profile.timezone) : parseDate(raw);
    return NextResponse.json(await getTargetsForDate(supabase, profile, date));
  });
}

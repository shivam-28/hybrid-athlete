import { NextResponse } from "next/server";
import { plannedDraft } from "@/server/nutrition/planned";
import { withNutritionUser } from "@/server/nutrition/route";

type Ctx = { params: Promise<{ id: string }> };

/** "Ate this": the planned items as a draft for the confirmation screen. */
export function GET(_: Request, { params }: Ctx) {
  return withNutritionUser(async ({ supabase }) => NextResponse.json({ draft: await plannedDraft(supabase, (await params).id) }));
}

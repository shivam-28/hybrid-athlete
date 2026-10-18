import { NextResponse } from "next/server";
import { deletePlanned } from "@/server/nutrition/planned";
import { withNutritionUser } from "@/server/nutrition/route";

type Ctx = { params: Promise<{ id: string }> };

export function DELETE(_: Request, { params }: Ctx) {
  return withNutritionUser(async ({ supabase }) => {
    await deletePlanned(supabase, (await params).id);
    return NextResponse.json({ ok: true });
  });
}

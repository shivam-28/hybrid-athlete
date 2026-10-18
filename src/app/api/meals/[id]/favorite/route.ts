import { NextResponse } from "next/server";
import { z } from "zod";
import { setFavorite } from "@/server/nutrition/meals";
import { readBody, withNutritionUser } from "@/server/nutrition/route";

type Ctx = { params: Promise<{ id: string }> };

export function PUT(request: Request, { params }: Ctx) {
  return withNutritionUser(async ({ supabase }) => {
    const { isFavorite } = await readBody(request, z.object({ isFavorite: z.boolean() }));
    await setFavorite(supabase, (await params).id, isFavorite);
    return NextResponse.json({ isFavorite });
  });
}

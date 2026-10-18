import { NextResponse } from "next/server";
import { z } from "zod";
import { parseDate, readBody, withNutritionUser } from "@/server/nutrition/route";
import { setLogDayComplete } from "@/server/nutrition/targets";

type Ctx = { params: Promise<{ date: string }> };

export function PUT(request: Request, { params }: Ctx) {
  return withNutritionUser(async ({ supabase }) => {
    const date = parseDate((await params).date);
    const { isComplete } = await readBody(request, z.object({ isComplete: z.boolean() }));
    await setLogDayComplete(supabase, date, isComplete);
    return NextResponse.json({ date, isComplete });
  });
}

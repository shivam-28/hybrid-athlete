import { NextResponse } from "next/server";
import { z } from "zod";
import { acceptPlan } from "@/server/coach/plans";
import { readBody, withCoachUser } from "@/server/coach/route";

type Ctx = { params: Promise<{ id: string }> };

export function POST(request: Request, { params }: Ctx) {
  return withCoachUser(async ({ supabase }) => {
    const { acknowledged } = await readBody(request, z.object({ acknowledged: z.boolean().default(false) }));
    const result = await acceptPlan(supabase, (await params).id, acknowledged);
    return NextResponse.json({ status: result.plan.status, warnings: result.warnings });
  });
}

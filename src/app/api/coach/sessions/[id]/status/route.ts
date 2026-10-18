import { NextResponse } from "next/server";
import { z } from "zod";
import { setSessionStatus } from "@/server/coach/completion";
import { readBody, withCoachUser } from "@/server/coach/route";

type Ctx = { params: Promise<{ id: string }> };

/** Manual complete / skip / undo (back to planned). */
export function POST(request: Request, { params }: Ctx) {
  return withCoachUser(async ({ supabase }) => {
    const { status } = await readBody(request, z.object({ status: z.enum(["planned", "completed", "skipped"]) }));
    await setSessionStatus(supabase, (await params).id, status);
    return NextResponse.json({ status });
  });
}

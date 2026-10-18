import { NextResponse } from "next/server";
import { deleteSession, editSession } from "@/server/coach/plans";
import { withCoachUser } from "@/server/coach/route";

type Ctx = { params: Promise<{ id: string }> };

export function PATCH(request: Request, { params }: Ctx) {
  return withCoachUser(async ({ supabase }) => {
    const result = await editSession(supabase, (await params).id, await request.json().catch(() => ({})));
    return NextResponse.json({ warnings: result.warnings });
  });
}

export function DELETE(_: Request, { params }: Ctx) {
  return withCoachUser(async ({ supabase }) => {
    const result = await deleteSession(supabase, (await params).id);
    return NextResponse.json({ warnings: result.warnings });
  });
}

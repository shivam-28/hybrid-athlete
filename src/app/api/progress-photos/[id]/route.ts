import { NextResponse } from "next/server";
import { deletePhoto } from "@/server/body/photos";
import { withBodyUser } from "@/server/body/route";

export function DELETE(_: Request, ctx: RouteContext<"/api/progress-photos/[id]">) {
  return withBodyUser(async ({ supabase }) => {
    const { id } = await ctx.params;
    await deletePhoto(supabase, id);
    return NextResponse.json({ ok: true });
  });
}

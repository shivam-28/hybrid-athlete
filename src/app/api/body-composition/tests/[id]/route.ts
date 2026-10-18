import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteTest, updateTest } from "@/server/body/composition";
import { readBody, withBodyUser } from "@/server/body/route";

export function PATCH(request: Request, ctx: RouteContext<"/api/body-composition/tests/[id]">) {
  return withBodyUser(async ({ supabase, profile }) => {
    const { id } = await ctx.params;
    const { test } = await readBody(request, z.object({ test: z.record(z.string(), z.unknown()) }));
    await updateTest(supabase, profile, id, test);
    return NextResponse.json({ ok: true });
  });
}

export function DELETE(_: Request, ctx: RouteContext<"/api/body-composition/tests/[id]">) {
  return withBodyUser(async ({ supabase }) => {
    const { id } = await ctx.params;
    await deleteTest(supabase, id);
    return NextResponse.json({ ok: true });
  });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { saveTest } from "@/server/body/composition";
import { readBody, withBodyUser } from "@/server/body/route";

const body = z.object({ test: z.record(z.string(), z.unknown()), documentPath: z.string().nullish() });

/** Saves a manual entry, or confirms an extracted draft (with its report file). */
export function POST(request: Request) {
  return withBodyUser(async ({ supabase, profile }) => {
    const { test, documentPath } = await readBody(request, body);
    const row = await saveTest(supabase, profile, test, { documentPath, source: documentPath ? "extracted" : "manual" });
    return NextResponse.json({ id: row.id }, { status: 201 });
  });
}

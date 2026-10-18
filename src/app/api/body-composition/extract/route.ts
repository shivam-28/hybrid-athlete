import { NextResponse } from "next/server";
import { z } from "zod";
import { extractFromUpload } from "@/server/body/extraction-flow";
import { readBody, withBodyUser } from "@/server/body/route";

export function POST(request: Request) {
  return withBodyUser(async ({ supabase, user }) => {
    const { documentPath } = await readBody(request, z.object({ documentPath: z.string() }));
    const result = await extractFromUpload(supabase, user.id, documentPath);
    if (result.kind === "unreadable") {
      return NextResponse.json(
        { error: "unreadable", message: "The report couldn't be read reliably. Enter the values by hand below." },
        { status: 422 },
      );
    }
    return NextResponse.json(result);
  });
}

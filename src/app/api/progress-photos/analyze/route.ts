import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzePhotos } from "@/server/body/photos";
import { readBody, withBodyUser } from "@/server/body/route";

export function POST(request: Request) {
  return withBodyUser(async ({ supabase, profile }) => {
    const { photoAId, photoBId } = await readBody(request, z.object({ photoAId: z.uuid(), photoBId: z.uuid() }));
    return NextResponse.json(await analyzePhotos(supabase, profile, photoAId, photoBId));
  });
}

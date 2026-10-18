import { NextResponse } from "next/server";
import { NutritionError } from "@/server/nutrition/errors";
import { storeMealPhoto } from "@/server/nutrition/photos";
import { withNutritionUser } from "@/server/nutrition/route";

/** Multipart field `file`, already resized and re-encoded in the browser. Re-encoded again server-side. */
export function POST(request: Request) {
  return withNutritionUser(async ({ supabase, user }) => {
    const file = (await request.formData().catch(() => null))?.get("file");
    if (!(file instanceof File) || !file.type.startsWith("image/")) throw new NutritionError("invalid", "Upload a JPEG, PNG or HEIC photo.");
    const photoPath = await storeMealPhoto(supabase, user.id, new Uint8Array(await file.arrayBuffer()));
    return NextResponse.json({ photoPath });
  });
}

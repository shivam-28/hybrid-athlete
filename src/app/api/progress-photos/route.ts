import { NextResponse } from "next/server";
import { BodyError } from "@/server/body/errors";
import { uploadPhoto } from "@/server/body/photos";
import { withBodyUser } from "@/server/body/route";

/** Multipart: file (re-encoded JPEG from the browser), pose, optional date. */
export function POST(request: Request) {
  return withBodyUser(async ({ supabase, profile }) => {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new BodyError("invalid", "Choose a photo to upload.");
    const row = await uploadPhoto(supabase, profile, {
      bytes: new Uint8Array(await file.arrayBuffer()),
      pose: form!.get("pose") ?? "",
      date: form!.get("date") ?? "",
    });
    return NextResponse.json({ id: row.id }, { status: 201 });
  });
}

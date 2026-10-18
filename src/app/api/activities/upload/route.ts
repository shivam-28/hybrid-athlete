import { NextResponse } from "next/server";
import { FitImportError } from "@/lib/fit/parse";
import { MAX_UPLOAD_BYTES, importFitUpload } from "@/server/activities/fit-import";
import { requireApiUser } from "@/server/auth";

/** Multipart upload of a .fit file or Garmin "Export Original" .zip (field name: file). */
export async function POST(request: Request) {
  const session = await requireApiUser();
  if (session.error) return session.error;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "unsupported", message: "Choose a .fit or Garmin export .zip file." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "too_large", message: "Files must be 25 MB or smaller." }, { status: 413 });
  }

  try {
    const result = await importFitUpload(session.supabase, session.profile, new Uint8Array(await file.arrayBuffer()));
    if (result.status === "duplicate") {
      return NextResponse.json(
        { error: "duplicate", message: "This activity has already been imported.", activity_id: result.activityId },
        { status: 409 },
      );
    }
    return NextResponse.json({ status: result.status, activity_id: result.activityId });
  } catch (error) {
    if (error instanceof FitImportError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.code === "too_large" ? 413 : 400 });
    }
    return NextResponse.json({ error: "import_failed", message: "The activity could not be saved. Please try again." }, { status: 500 });
  }
}

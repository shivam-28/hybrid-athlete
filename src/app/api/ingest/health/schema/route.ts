import { NextResponse } from "next/server";
import { ingestJsonSchema } from "@/lib/ingest/payload";

/** Public: the payload contract for the Apple Health Shortcut (no user data). */
export function GET() {
  return NextResponse.json(ingestJsonSchema(), { headers: { "cache-control": "public, max-age=3600" } });
}

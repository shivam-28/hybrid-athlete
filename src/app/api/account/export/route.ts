import { NextResponse } from "next/server";
import { buildExport } from "@/server/account/export";
import { requireApiUser } from "@/server/auth";

export async function GET() {
  const session = await requireApiUser();
  if (session.error) return session.error;
  const data = await buildExport(session.supabase, session.user.id);
  const date = data.exported_at.slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="hybrid-athlete-export-${date}.json"`,
      "cache-control": "no-store",
    },
  });
}

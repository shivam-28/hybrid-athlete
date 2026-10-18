import { NextResponse } from "next/server";
import { z } from "zod";
import { BodyError } from "@/server/body/errors";
import { discardUpload, prepareReportPdfUpload, uploadReportImage } from "@/server/body/extraction-flow";
import { readBody, withBodyUser } from "@/server/body/route";

/**
 * Images: multipart field `file`, already re-encoded in the browser (≤ 4 MB).
 * PDFs: JSON { kind: "pdf" } returns a signed upload token; the browser uploads directly.
 */
export function POST(request: Request) {
  return withBodyUser(async ({ supabase, user }) => {
    if (request.headers.get("content-type")?.includes("application/json")) {
      await readBody(request, z.object({ kind: z.literal("pdf") }));
      const { path, token } = await prepareReportPdfUpload(supabase, user.id);
      return NextResponse.json({ documentPath: path, token });
    }
    const file = (await request.formData().catch(() => null))?.get("file");
    if (!(file instanceof File) || !file.type.startsWith("image/")) {
      throw new BodyError("invalid", "Upload a JPEG, PNG or HEIC image, or a PDF, up to 10 MB.");
    }
    const { path } = await uploadReportImage(supabase, user.id, new Uint8Array(await file.arrayBuffer()));
    return NextResponse.json({ documentPath: path });
  });
}

export function DELETE(request: Request) {
  return withBodyUser(async ({ supabase, user }) => {
    const { documentPath } = await readBody(request, z.object({ documentPath: z.string() }));
    await discardUpload(supabase, user.id, documentPath);
    return NextResponse.json({ ok: true });
  });
}

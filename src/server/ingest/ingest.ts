import "server-only";
import { NextResponse } from "next/server";
import { resolveMaxHr } from "@/lib/activities/heart-rate";
import { activityLoad } from "@/lib/activities/load";
import { parseIngestPayload, type IngestPayload } from "@/lib/ingest/payload";
import { addDays } from "@/lib/activities/dates";
import { localDate } from "@/lib/time";
import { completePlannedSessionsAfterWrite } from "@/server/coach/completion";
import { createAdminClient } from "@/server/supabase-admin";
import { bumpIngestRate, recordIngestSuccess, verifyIngestToken, type IngestCounts } from "./tokens";

export const MAX_BODY_BYTES = 1_000_000;
export const MAX_REQUESTS_PER_HOUR = 30;

const error = (status: number, body: Record<string, unknown>, headers?: HeadersInit) =>
  NextResponse.json(body, { status, headers });

/** Reads the body, giving up as soon as it exceeds the limit (also when Content-Length lies). */
async function readBody(request: Request): Promise<string | null> {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const secondsUntilNextHour = () => 3600 - Math.floor((Date.now() / 1000) % 3600);

/** Server-computed per-workout load and the max HR it was based on (never accepted from the client). */
async function withDerivedLoad(userId: string, payload: IngestPayload) {
  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("birth_date, max_hr_bpm, timezone")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    ...payload,
    workouts: payload.workouts?.map((w) => {
      if (!profile) return w;
      const maxHr = resolveMaxHr({
        profileMaxHr: profile.max_hr_bpm,
        birthDate: profile.birth_date,
        onDate: localDate(new Date(w.start), profile.timezone),
      });
      const elapsedS = Math.round((Date.parse(w.end) - Date.parse(w.start)) / 1000);
      const load = activityLoad({ sport: w.sport, movingS: w.duration_s, elapsedS, avgHr: w.avg_hr ?? null }, maxHr.bpm);
      return { ...w, load, max_hr_used: maxHr.bpm, max_hr_source: maxHr.source };
    }),
  };
}

/**
 * POST /api/ingest/health. Authenticated only by the bearer ingest token; cookies are ignored.
 * Order: size → token → rate limit → schema → one-transaction upsert as the token's owner.
 */
export async function handleHealthIngest(request: Request): Promise<Response> {
  const raw = await readBody(request);
  if (raw === null) return error(413, { error: "payload_too_large", message: "Request body must be at most 1 MB." });

  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? "";
  const owner = await verifyIngestToken(token);
  if (!owner) return error(401, { error: "unauthorized", message: "Missing, unknown or revoked ingest token." });

  if ((await bumpIngestRate(owner.tokenId)) > MAX_REQUESTS_PER_HOUR) {
    return error(429, { error: "rate_limited", message: `At most ${MAX_REQUESTS_PER_HOUR} requests per hour.` }, {
      "retry-after": String(secondsUntilNextHour()),
    });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return error(400, { error: "invalid_json", message: "Body must be JSON." });
  }
  const parsed = parseIngestPayload(body);
  if (!parsed.success) return error(400, { error: "invalid_payload", issues: parsed.issues });

  const { data, error: dbError } = await createAdminClient().rpc("ingest_health", {
    p_user_id: owner.userId,
    p_payload: (await withDerivedLoad(owner.userId, parsed.data)) as never,
  });
  if (dbError) return error(500, { error: "ingest_failed", message: "Could not store the data. Nothing was saved." });

  const counts = data as IngestCounts;
  await recordIngestSuccess(owner.tokenId, counts);
  const starts = (parsed.data.workouts ?? []).map((w) => w.start.slice(0, 10)).sort();
  if (starts.length > 0) {
    // UTC dates ±1 day cover every local date the workouts can fall on.
    await completePlannedSessionsAfterWrite(createAdminClient(), owner.userId, addDays(starts[0]!, -1), addDays(starts.at(-1)!, 1));
  }
  return NextResponse.json(counts);
}

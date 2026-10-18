import { Decoder, Stream } from "@garmin/fitsdk";
import { unzipSync } from "fflate";
import type { Sport } from "@/lib/ingest/payload";
import type { HrHistogram } from "@/lib/activities/heart-rate";

export const MAX_UNZIPPED_BYTES = 50 * 1024 * 1024;
/** Gaps longer than this (auto-pause, stopped watch) don't count toward heart-rate time. */
const MAX_RECORD_GAP_S = 30;
/** Ignore GPS jitter leftovers shorter than this as a final split. */
const MIN_PARTIAL_SPLIT_M = 10;

export type FitErrorCode = "unsupported" | "corrupt" | "too_large";

const MESSAGES: Record<FitErrorCode, string> = {
  unsupported: "Only .fit or Garmin export .zip files are supported.",
  corrupt: "This file could not be read as a FIT activity",
  too_large: "This file is too large to import.",
};

export class FitImportError extends Error {
  constructor(readonly code: FitErrorCode) {
    super(MESSAGES[code]);
    this.name = "FitImportError";
  }
}

export type FitSplit = { idx: number; distanceM: number; durationS: number; avgHr: number | null; elevDeltaM: number | null };

export type ParsedFit = {
  sport: Sport;
  subSport: string | null;
  startedAt: Date;
  elapsedS: number | null;
  movingS: number | null;
  distanceM: number | null;
  avgHr: number | null;
  maxHr: number | null;
  elevationGainM: number | null;
  caloriesKcal: number | null;
  splits: FitSplit[];
  hrHistogram: HrHistogram | null;
};

const isZip = (bytes: Uint8Array) => bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;

/** Returns the FIT bytes of an upload: the file itself, or the single .fit inside a Garmin export zip. */
export function extractFit(bytes: Uint8Array): Uint8Array {
  if (!isZip(bytes)) {
    if (!Decoder.isFIT(Stream.fromByteArray(bytes))) throw new FitImportError("unsupported");
    return bytes;
  }

  const entries: { name: string; originalSize: number }[] = [];
  try {
    unzipSync(bytes, {
      filter: (file) => {
        entries.push({ name: file.name, originalSize: file.originalSize });
        return false;
      },
    });
  } catch {
    throw new FitImportError("unsupported");
  }
  if (entries.reduce((sum, e) => sum + e.originalSize, 0) > MAX_UNZIPPED_BYTES) throw new FitImportError("too_large");
  const fits = entries.filter((e) => e.name.toLowerCase().endsWith(".fit"));
  if (fits.length !== 1) throw new FitImportError("unsupported");

  const fitName = fits[0]!.name;
  const content = unzipSync(bytes, { filter: (file) => file.name === fitName })[fitName];
  if (!content || !Decoder.isFIT(Stream.fromByteArray(content))) throw new FitImportError("unsupported");
  return content;
}

const SPORT_MAP: Record<string, Sport> = {
  running: "running",
  walking: "walking",
  hiking: "walking",
  cycling: "cycling",
  eBiking: "cycling",
  training: "strength",
  fitnessEquipment: "strength",
  swimming: "swimming",
};

type RecordPoint = { t: number; distance?: number; hr?: number; altitude?: number };

const known = (n: unknown): number | null => (typeof n === "number" && Number.isFinite(n) ? n : null);

/** Decodes a FIT activity. Throws FitImportError("corrupt") unless the file is intact and has a session. */
export function parseFit(bytes: Uint8Array): ParsedFit {
  const decoder = new Decoder(Stream.fromByteArray(bytes));
  if (!decoder.isFIT() || !decoder.checkIntegrity()) throw new FitImportError("corrupt");
  const { messages, errors } = decoder.read();
  const session = messages.sessionMesgs?.[0];
  if (errors.length > 0 || !session?.startTime) throw new FitImportError("corrupt");

  const records: RecordPoint[] = (messages.recordMesgs ?? [])
    .filter((r) => r.timestamp instanceof Date)
    .map((r) => ({
      t: (r.timestamp as Date).getTime() / 1000,
      distance: known(r.distance) ?? undefined,
      hr: known(r.heartRate) ?? undefined,
      altitude: known(r.enhancedAltitude) ?? known(r.altitude) ?? undefined,
    }))
    .sort((a, b) => a.t - b.t);

  const sport = SPORT_MAP[String(session.sport)] ?? "other";
  const distanceM = known(session.totalDistance) ?? records.findLast((r) => r.distance !== undefined)?.distance ?? null;
  const hasHr = records.some((r) => r.hr !== undefined);

  return {
    sport,
    subSport: session.subSport === undefined ? null : String(session.subSport),
    startedAt: session.startTime as Date,
    elapsedS: roundOrNull(known(session.totalElapsedTime)),
    movingS: roundOrNull(known(session.totalTimerTime)),
    distanceM: distanceM && distanceM > 0 ? Math.round(distanceM * 10) / 10 : null,
    avgHr: hasHr ? known(session.avgHeartRate) : null,
    maxHr: hasHr ? known(session.maxHeartRate) : null,
    elevationGainM: known(session.totalAscent),
    caloriesKcal: known(session.totalCalories),
    splits: sport === "running" || sport === "walking" ? computeSplits(records) : [],
    hrHistogram: hasHr ? hrHistogram(records) : null,
  };
}

const roundOrNull = (n: number | null) => (n === null ? null : Math.round(n));

function hrHistogram(records: RecordPoint[]): HrHistogram {
  const histogram: HrHistogram = {};
  for (let i = 0; i < records.length - 1; i++) {
    const { hr, t } = records[i]!;
    const dt = records[i + 1]!.t - t;
    if (hr === undefined || dt <= 0 || dt > MAX_RECORD_GAP_S) continue;
    histogram[String(hr)] = (histogram[String(hr)] ?? 0) + dt;
  }
  return histogram;
}

/** Per-km splits: boundary times are interpolated between the records that bracket each 1000 m mark. */
function computeSplits(records: RecordPoint[]): FitSplit[] {
  const points = records.filter((r) => r.distance !== undefined) as (RecordPoint & { distance: number })[];
  if (points.length < 2) return [];
  const total = points.at(-1)!.distance;

  const timeAt = (meters: number) => {
    const i = points.findIndex((p) => p.distance >= meters);
    if (i <= 0) return points[Math.max(i, 0)]!.t;
    const a = points[i - 1]!;
    const b = points[i]!;
    return a.t + ((meters - a.distance) / (b.distance - a.distance)) * (b.t - a.t);
  };
  const altitudeNear = (t: number) => points.reduce((best, p) => (Math.abs(p.t - t) < Math.abs(best.t - t) ? p : best)).altitude;

  const marks = [0];
  for (let m = 1000; m <= total; m += 1000) marks.push(m);
  if (total - marks.at(-1)! >= MIN_PARTIAL_SPLIT_M) marks.push(total);

  return marks.slice(1).map((end, idx) => {
    const start = marks[idx]!;
    const t0 = timeAt(start);
    const t1 = timeAt(end);
    const hrs = records.filter((r) => r.t > t0 && r.t <= t1 && r.hr !== undefined).map((r) => r.hr!);
    const alt0 = altitudeNear(t0);
    const alt1 = altitudeNear(t1);
    return {
      idx,
      distanceM: Math.round((end - start) * 10) / 10,
      durationS: Math.round((t1 - t0) * 10) / 10,
      avgHr: hrs.length ? Math.round(hrs.reduce((s, h) => s + h, 0) / hrs.length) : null,
      elevDeltaM: alt0 !== undefined && alt1 !== undefined ? Math.round((alt1 - alt0) * 10) / 10 : null,
    };
  });
}

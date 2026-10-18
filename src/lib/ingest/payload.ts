import { z } from "zod";

export const SPORTS = ["running", "walking", "cycling", "strength", "swimming", "other"] as const;
export type Sport = (typeof SPORTS)[number];

const MAX_DAILY_ENTRIES = 62;
const MAX_WORKOUTS = 200;

const timestamp = z.iso.datetime({ offset: true, message: "Use ISO 8601 with a UTC offset, e.g. 2026-06-14T07:00:00+02:00" });
const range = (min: number, max: number) => z.number().min(min).max(max);
/** Shortcuts often sends whole-number metrics as decimals (8234.0); accept and round them. */
const wholeNumber = (min: number, max: number) => range(min, max).transform(Math.round);

const dailySchema = z.strictObject({
  date: z.iso.date("Use YYYY-MM-DD"),
  steps: wholeNumber(0, 200_000).optional(),
  active_energy_kcal: range(0, 20_000).optional(),
  resting_hr_bpm: wholeNumber(20, 250).optional(),
  hrv_sdnn_ms: range(1, 500).optional(),
  sleep_minutes: wholeNumber(0, 1440).optional(),
  sleep_start: timestamp.optional(),
  sleep_end: timestamp.optional(),
  vo2max: range(10, 100).optional(),
  weight_kg: range(20, 400).optional(),
});

const workoutSchema = z
  .strictObject({
    external_id: z.string().min(1).max(200).optional(),
    sport: z.enum(SPORTS, { error: `sport must be one of: ${SPORTS.join(", ")}` }),
    start: timestamp,
    end: timestamp,
    duration_s: wholeNumber(1, 86_400),
    distance_m: range(0, 1_000_000).optional(),
    active_energy_kcal: range(0, 20_000).optional(),
    avg_hr: wholeNumber(20, 250).optional(),
    max_hr: wholeNumber(20, 250).optional(),
    source_name: z.string().max(100).optional(),
  })
  .refine((w) => Date.parse(w.end) > Date.parse(w.start), { path: ["end"], message: "end must be after start" });

export const ingestPayloadSchema = z.strictObject({
  daily: z.array(dailySchema).max(MAX_DAILY_ENTRIES).optional(),
  workouts: z.array(workoutSchema).max(MAX_WORKOUTS).optional(),
});

export type IngestPayload = z.output<typeof ingestPayloadSchema>;
export type IngestWorkout = NonNullable<IngestPayload["workouts"]>[number];
export type IngestIssue = { path: string; message: string };

export function parseIngestPayload(
  input: unknown,
): { success: true; data: IngestPayload } | { success: false; issues: IngestIssue[] } {
  const parsed = ingestPayloadSchema.safeParse(input);
  if (parsed.success) return { success: true, data: parsed.data };
  return {
    success: false,
    issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
  };
}

/** JSON Schema of what the Shortcut sends, published at GET /api/ingest/health/schema. */
export function ingestJsonSchema() {
  return z.toJSONSchema(ingestPayloadSchema, { io: "input", unrepresentable: "any" });
}

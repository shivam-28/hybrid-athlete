import { z } from "zod";
import { addDays } from "@/lib/activities/dates";

// Thresholds (spec "Objective recovery signals", "Deterministic readiness score").
export const BASELINE_DAYS = 28;
export const MIN_BASELINE_VALUES = 14;
const SLEEP_FRACTION = 0.85;
const SLEEP_MIN_MINUTES = 6 * 60;
const RHR_DELTA_BPM = 5;
const ACWR_HIGH = 1.5;
const ACWR_LOW = 0.8;

export type ReadinessScore = "green" | "amber" | "red";

const item = z.coerce.number<unknown>().int("Choose 1–5").min(1, "Choose 1–5").max(5, "Choose 1–5");
const checkinSchema = z.object({
  sleep_quality: item,
  soreness: item,
  energy: item,
  stress: item,
  pain_flag: z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean()).default(false),
  pain_note: z.string().trim().max(500).nullish().transform((v) => v || null),
});
export type Checkin = z.infer<typeof checkinSchema>;

export function parseCheckin(input: unknown): { success: true; data: Checkin } | { success: false; fieldErrors: Record<string, string[]> } {
  const parsed = checkinSchema.safeParse(input);
  return parsed.success ? { success: true, data: parsed.data } : { success: false, fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
}

export type Baseline = { available: true; mean: number; sd: number; days: number } | { available: false; days: number };

/** Mean and population SD over the 28 local days ending yesterday; unavailable below 14 values. */
export function computeBaseline(rows: { local_date: string; value: number | null }[], today: string): Baseline {
  const from = addDays(today, -BASELINE_DAYS);
  const values = rows.filter((r) => r.local_date >= from && r.local_date < today && r.value !== null).map((r) => r.value!);
  if (values.length < MIN_BASELINE_VALUES) return { available: false, days: values.length };
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
  return { available: true, mean: round2(mean), sd: round2(sd), days: values.length };
}

export type DailySignalsRow = { local_date: string; sleep_minutes: number | null; resting_hr_bpm: number | null; hrv_sdnn_ms: number | null };
export type SignalStatus = "negative" | "ok" | "note" | "unavailable";
export type Signal = { key: string; label: string; status: SignalStatus; reason: string };

const round2 = (n: number) => Math.round(n * 100) / 100;
const hours = (min: number) => `${Math.floor(min / 60)} h ${Math.round(min % 60)} min`;

function baselineSignal(
  rows: DailySignalsRow[],
  today: string,
  field: "sleep_minutes" | "resting_hr_bpm" | "hrv_sdnn_ms",
  label: string,
  judge: (value: number, b: Extract<Baseline, { available: true }>) => { negative: boolean; reason: string },
): Signal {
  const baseline = computeBaseline(rows.map((r) => ({ local_date: r.local_date, value: r[field] === null ? null : Number(r[field]) })), today);
  const raw = rows.find((r) => r.local_date === today)?.[field];
  if (!baseline.available) return { key: "", label, status: "unavailable", reason: `${label}: needs ${MIN_BASELINE_VALUES} days of data in the last 4 weeks (has ${baseline.days})` };
  if (raw === null || raw === undefined) return { key: "", label, status: "unavailable", reason: `${label}: no reading today` };
  const { negative, reason } = judge(Number(raw), baseline);
  return { key: "", label, status: negative ? "negative" : "ok", reason };
}

/** Objective signals vs the personal baseline. `acwr` comes from activity-history (null = not shown there yet). */
export function evaluateSignals(rows: DailySignalsRow[], today: string, acwr: number | null): Signal[] {
  const sleep = baselineSignal(rows, today, "sleep_minutes", "Sleep", (v, b) => {
    const short = v < b.mean * SLEEP_FRACTION || v < SLEEP_MIN_MINUTES;
    return { negative: short, reason: short ? `Short sleep (${hours(v)} vs your usual ${hours(b.mean)})` : `Sleep ${hours(v)} (usual ${hours(b.mean)})` };
  });
  const rhr = baselineSignal(rows, today, "resting_hr_bpm", "Resting HR", (v, b) => {
    const delta = Math.round(v - b.mean);
    const high = v >= b.mean + RHR_DELTA_BPM;
    return { negative: high, reason: high ? `Resting HR above baseline (+${delta} bpm)` : `Resting HR ${v} bpm (baseline ${Math.round(b.mean)})` };
  });
  const hrv = baselineSignal(rows, today, "hrv_sdnn_ms", "HRV", (v, b) => {
    const low = v < b.mean - b.sd;
    return { negative: low, reason: low ? `HRV below your normal range (${Math.round(v)} vs ${Math.round(b.mean)} ms)` : `HRV ${Math.round(v)} ms (baseline ${Math.round(b.mean)})` };
  });
  const load: Signal =
    acwr === null
      ? { key: "load", label: "Training load", status: "unavailable", reason: "Training load: needs 3 weeks of activity history" }
      : acwr > ACWR_HIGH
        ? { key: "load", label: "Training load", status: "negative", reason: `Training load spike (7-day load ${acwr}× your 4-week average)` }
        : acwr < ACWR_LOW
          ? { key: "load", label: "Training load", status: "note", reason: `Training load is low (ratio ${acwr}): fitness may be slipping` }
          : { key: "load", label: "Training load", status: "ok", reason: `Training load steady (ratio ${acwr})` };
  return [
    { ...sleep, key: "sleep" },
    { ...rhr, key: "resting_hr" },
    { ...hrv, key: "hrv" },
    load,
  ];
}

export type ReadinessResult = { score: ReadinessScore; reasons: string[]; notes: string[]; referral: string | null; mean: number };

const ITEM_LABELS: Record<"sleep_quality" | "soreness" | "energy" | "stress", [string, string]> = {
  sleep_quality: ["Sleep quality", "Poor sleep quality"],
  soreness: ["Soreness", "High muscle soreness"],
  energy: ["Energy", "Low energy"],
  stress: ["Stress", "High stress"],
};
export const PAIN_REFERRAL =
  "You reported pain or an injury. Rest it today and see a qualified professional (doctor or physiotherapist) if it persists. This app can't diagnose injuries.";

/** Spec: red / amber / green from the check-in and available negative signals, with every reason listed. */
export function scoreReadiness(checkin: Checkin, signals: Signal[]): ReadinessResult {
  const items = [checkin.sleep_quality, checkin.soreness, checkin.energy, checkin.stress];
  const mean = items.reduce((s, v) => s + v, 0) / items.length;
  const negatives = signals.filter((s) => s.status === "negative");
  const n = negatives.length;

  const reasons: string[] = [];
  if (checkin.pain_flag) reasons.push(checkin.pain_note ? `Pain or injury reported: ${checkin.pain_note}` : "Pain or injury reported");
  for (const key of Object.keys(ITEM_LABELS) as (keyof typeof ITEM_LABELS)[]) {
    if (checkin[key] <= 2) reasons.push(`${ITEM_LABELS[key][1]} (${checkin[key]}/5)`);
  }
  if (mean < 3) reasons.push(`Check-in average ${round2(mean)}/5`);
  reasons.push(...negatives.map((s) => s.reason));

  const score: ReadinessScore =
    checkin.pain_flag || mean <= 2 || n >= 3 || (n >= 2 && mean < 3) ? "red" : mean < 3 || items.includes(1) || n >= 1 ? "amber" : "green";
  if (score === "green" && reasons.length === 0) reasons.push("Check-in and recovery signals look good");

  return {
    score,
    reasons,
    notes: signals.filter((s) => s.status === "note").map((s) => s.reason),
    referral: checkin.pain_flag ? PAIN_REFERRAL : null,
    mean: round2(mean),
  };
}

import { ageOn } from "@/lib/time";

export type MaxHrSource = "profile" | "estimated";
export type HrHistogram = Record<string, number>;

/** Tanaka: 208 − 0.7 × age. */
export const estimateMaxHr = (age: number) => Math.round(208 - 0.7 * age);

export function resolveMaxHr(input: { profileMaxHr: number | null; birthDate: string; onDate: string }): {
  bpm: number;
  source: MaxHrSource;
} {
  if (input.profileMaxHr) return { bpm: input.profileMaxHr, source: "profile" };
  return { bpm: estimateMaxHr(ageOn(input.birthDate, input.onDate)), source: "estimated" };
}

/** Zones 1–5 start at 50/60/70/80/90 % of max HR. */
export function zoneBounds(maxHr: number): { zone: number; min: number; max: number }[] {
  return [1, 2, 3, 4, 5].map((zone) => ({
    zone,
    min: Math.round(((zone + 4) / 10) * maxHr),
    max: zone === 5 ? maxHr : Math.round(((zone + 5) / 10) * maxHr),
  }));
}

/** Zone 1–5 of a heart rate, or 0 below 50 % of max. Integer maths avoids float edge cases on boundaries. */
export function zoneOf(hr: number, maxHr: number): number {
  let zone = 0;
  for (let k = 5; k <= 9; k++) if (hr * 10 >= k * maxHr) zone = k - 4;
  return zone;
}

/** Seconds per zone (index 0 = zone 1) from a seconds-at-bpm histogram. */
export function zoneSeconds(histogram: HrHistogram, maxHr: number): number[] {
  const zones = [0, 0, 0, 0, 0];
  for (const [bpm, seconds] of Object.entries(histogram)) {
    const zone = zoneOf(Number(bpm), maxHr);
    if (zone > 0) zones[zone - 1]! += seconds;
  }
  return zones.map(Math.round);
}

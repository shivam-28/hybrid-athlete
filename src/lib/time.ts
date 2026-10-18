export const DEFAULT_TIMEZONE = "Europe/Copenhagen";

export function isValidTimezone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function resolveTimezone(tz: string | null | undefined): string {
  return tz && isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
}

/** Calendar day (YYYY-MM-DD) of an instant in the given timezone. */
export function localDate(instant: Date, tz: string | null | undefined): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: resolveTimezone(tz),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Whole years between a birth date and a date, both YYYY-MM-DD. Leap-day birthdays count from 1 March. */
export function ageOn(birthDate: string, onDate: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number) as [number, number, number];
  const [y, m, d] = onDate.split("-").map(Number) as [number, number, number];
  const hadBirthday = m > bm || (m === bm && d >= bd);
  return y - by - (hadBirthday ? 0 : 1);
}

/** Monday (YYYY-MM-DD) of the ISO week containing a local date. */
export function isoWeekStart(localDay: string): string {
  const d = new Date(`${localDay}T00:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)!.value);
  const wallClockAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return wallClockAsUtc - Math.floor(instant / 1000) * 1000;
}

/** The UTC instant at which a local calendar day (YYYY-MM-DD) starts in the given timezone. */
export function startOfLocalDay(isoDate: string, tz: string | null | undefined): Date {
  const zone = resolveTimezone(tz);
  const utcMidnight = Date.parse(`${isoDate}T00:00:00Z`);
  const guess = utcMidnight - zoneOffsetMs(utcMidnight, zone);
  // Re-read the offset at the guess so days that start right after a DST switch land correctly.
  return new Date(utcMidnight - zoneOffsetMs(guess, zone));
}

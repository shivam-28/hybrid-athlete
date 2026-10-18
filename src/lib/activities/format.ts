import { kmToMiles, type UnitSystem } from "@/lib/units";

export const SPORT_LABELS: Record<string, string> = {
  running: "Run",
  walking: "Walk",
  cycling: "Ride",
  strength: "Strength",
  swimming: "Swim",
  other: "Other",
};

/** 52:30 or 1:02:05 */
export function formatDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Pace for running/walking ("5:15 /km"), speed for everything else ("24.0 km/h"). */
export function formatPaceOrSpeed(sport: string, distanceM: number | null, seconds: number | null, units: UnitSystem): string | null {
  if (!distanceM || !seconds) return null;
  const km = distanceM / 1000;
  const dist = units === "metric" ? km : kmToMiles(km);
  const unit = units === "metric" ? "km" : "mi";
  if (sport === "running" || sport === "walking") return `${formatDuration(seconds / dist)} /${unit}`;
  return `${(dist / (seconds / 3600)).toFixed(1)} ${unit}/h`;
}

export function formatKm(km: number, units: UnitSystem): string {
  return units === "metric" ? `${km.toFixed(1)} km` : `${kmToMiles(km).toFixed(1)} mi`;
}

/** Date + time of an instant in the user's timezone, e.g. "Mon 15 Jun, 01:30". */
export function formatLocalDateTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** "15 Jun" for a YYYY-MM-DD calendar date. */
export function formatShortDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${isoDate}T00:00:00Z`));
}

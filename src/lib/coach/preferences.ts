import { z } from "zod";

export const RACE_DISTANCES = {
  "5k": { label: "5 km", km: 5 },
  "10k": { label: "10 km", km: 10 },
  half: { label: "Half marathon", km: 21.0975 },
  marathon: { label: "Marathon", km: 42.195 },
} as const;
export type RaceDistanceKey = keyof typeof RACE_DISTANCES | "custom" | "none";

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export type TrainingPreferences = {
  days_per_week: number;
  max_session_min: number;
  /** ISO weekday, 1 = Monday … 7 = Sunday. */
  long_run_weekday: number;
  equipment: "gym" | "home";
  race_distance_km: number | null;
  race_date: string | null;
  /** HH:MM:SS */
  race_goal_time: string | null;
};

type FieldErrors = Partial<Record<keyof TrainingPreferences | "race_distance" | "race_distance_custom_km", string[]>>;
export type PreferencesResult = { success: true; data: TrainingPreferences } | { success: false; fieldErrors: FieldErrors };

const intIn = (min: number, max: number, message: string) => z.coerce.number<unknown>().int(message).min(min, message).max(max, message);

const schema = z.object({
  days_per_week: intIn(1, 7, "Choose between 1 and 7 days"),
  max_session_min: intIn(20, 240, "Sessions must be 20–240 minutes"),
  long_run_weekday: intIn(1, 7, "Choose a weekday"),
  equipment: z.enum(["gym", "home"], "Choose gym or home"),
  race_distance: z.enum(["none", "5k", "10k", "half", "marathon", "custom"]).default("none"),
  race_distance_custom_km: z.coerce.number<unknown>().positive("Enter a distance in km").max(250, "At most 250 km").optional(),
  race_date: z.iso.date("Enter a valid date").optional(),
  race_goal_time: z.string().optional(),
});

/** "3:45" or "3:45:30" → "03:45:00" / "03:45:30"; null when not a valid h:mm[:ss]. */
export function normaliseGoalTime(value: string): string | null {
  const m = value.trim().match(/^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/);
  if (!m) return null;
  const [, h, min, s] = m;
  if (Number(h) === 0 && Number(min) === 0 && Number(s ?? 0) === 0) return null;
  return `${h!.padStart(2, "0")}:${min}:${s ?? "00"}`;
}

const blankToUndefined = (input: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v === "" || v === null ? undefined : v]));

/** Validates the preferences form. `today` is the user's local date (YYYY-MM-DD). */
export function parsePreferences(input: Record<string, unknown>, today: string): PreferencesResult {
  const parsed = schema.safeParse(blankToUndefined(input));
  if (!parsed.success) return { success: false, fieldErrors: z.flattenError(parsed.error).fieldErrors as FieldErrors };
  const d = parsed.data;
  const base = {
    days_per_week: d.days_per_week,
    max_session_min: d.max_session_min,
    long_run_weekday: d.long_run_weekday,
    equipment: d.equipment,
  };
  if (d.race_distance === "none") {
    return { success: true, data: { ...base, race_distance_km: null, race_date: null, race_goal_time: null } };
  }

  const errors: FieldErrors = {};
  const km = d.race_distance === "custom" ? d.race_distance_custom_km : RACE_DISTANCES[d.race_distance].km;
  if (km === undefined) errors.race_distance_custom_km = ["Enter the race distance in km"];
  if (!d.race_date) errors.race_date = ["Enter the race date"];
  else if (d.race_date < today) errors.race_date = ["The race date is in the past"];
  const goalTime = d.race_goal_time ? normaliseGoalTime(d.race_goal_time) : null;
  if (d.race_goal_time && !goalTime) errors.race_goal_time = ["Use h:mm or h:mm:ss, e.g. 3:45"];
  if (Object.keys(errors).length > 0) return { success: false, fieldErrors: errors };

  return { success: true, data: { ...base, race_distance_km: km!, race_date: d.race_date!, race_goal_time: goalTime } };
}

/** Maps a stored distance back to the form's choice. */
export function raceDistanceKey(km: number | null): RaceDistanceKey {
  if (km === null) return "none";
  const match = Object.entries(RACE_DISTANCES).find(([, v]) => Math.abs(v.km - km) < 0.01);
  return (match?.[0] as RaceDistanceKey | undefined) ?? "custom";
}

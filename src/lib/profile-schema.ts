import { z } from "zod";
import { ageOn, isValidTimezone } from "./time";
import { feetInchesToCm } from "./units";

export const SEXES = ["male", "female"] as const;
export const STRENGTH_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export const RUNNING_LEVELS = ["none", "beginner", "intermediate", "advanced"] as const;

const formNumber = z.coerce.number<unknown>();
const MAX_HR_MESSAGE = "Max heart rate must be a whole number between 100 and 230 bpm";

const rawSchema = z.object({
  display_name: z.string().trim().min(1, "Enter a name").max(60),
  sex: z.enum(SEXES, "Choose male or female"),
  birth_date: z.iso.date("Enter a valid date"),
  unit_system: z.enum(["metric", "imperial"]),
  height_cm: formNumber.optional(),
  height_ft: formNumber.optional(),
  height_in: formNumber.optional(),
  timezone: z.string().refine(isValidTimezone, "Choose a valid timezone"),
  strength_experience: z.enum(STRENGTH_LEVELS),
  running_experience: z.enum(RUNNING_LEVELS),
  max_hr_bpm: formNumber.pipe(z.number().int().min(100, MAX_HR_MESSAGE).max(230, MAX_HR_MESSAGE)).optional(),
});

export type ProfileInput = {
  display_name: string;
  sex: (typeof SEXES)[number];
  birth_date: string;
  unit_system: "metric" | "imperial";
  height_cm: number;
  timezone: string;
  strength_experience: (typeof STRENGTH_LEVELS)[number];
  running_experience: (typeof RUNNING_LEVELS)[number];
  max_hr_bpm?: number;
};

export type ParseResult =
  | { success: true; data: ProfileInput }
  | { success: false; fieldErrors: Partial<Record<keyof ProfileInput, string[]>> };

const blankToUndefined = (input: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v === "" ? undefined : v]));

/** Validates onboarding/profile form input, converting imperial height to cm. `today` is YYYY-MM-DD. */
export function parseProfileInput(input: Record<string, unknown>, today: string): ParseResult {
  const parsed = rawSchema.safeParse(blankToUndefined(input));
  if (!parsed.success) {
    return { success: false, fieldErrors: z.flattenError(parsed.error).fieldErrors as never };
  }
  const { height_ft, height_in, height_cm, ...rest } = parsed.data;
  const fieldErrors: Partial<Record<keyof ProfileInput, string[]>> = {};

  const heightCm =
    rest.unit_system === "imperial" && height_ft !== undefined
      ? feetInchesToCm(height_ft, height_in ?? 0)
      : height_cm;
  if (heightCm === undefined || heightCm < 100 || heightCm > 250) {
    fieldErrors.height_cm = ["Height must be between 100 and 250 cm (3 ft 3 in – 8 ft 2 in)"];
  }

  const age = ageOn(rest.birth_date, today);
  if (age < 13) fieldErrors.birth_date = ["You must be at least 13 years old to use this app"];
  else if (age > 100) fieldErrors.birth_date = ["Enter a valid date of birth"];

  if (Object.keys(fieldErrors).length > 0) return { success: false, fieldErrors };
  return { success: true, data: { ...rest, height_cm: heightCm! } };
}

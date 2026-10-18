import { z } from "zod";

export const LIFESTYLE_LEVELS = ["sedentary", "lightly_active", "active"] as const;
export const DIET_TYPES = ["omnivore", "vegetarian", "vegan", "pescatarian"] as const;

export type NutritionPreferences = {
  lifestyle_level: (typeof LIFESTYLE_LEVELS)[number];
  diet_type: (typeof DIET_TYPES)[number];
  allergies: string[];
  dislikes: string[];
  cuisines: string[];
};

const list = (max: number) =>
  z
    .string()
    .default("")
    .transform((s) => [...new Set(s.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean))])
    .pipe(z.array(z.string().max(80, "Keep each entry under 80 characters")).max(max, `Up to ${max} entries`));

const schema = z.object({
  lifestyle_level: z.enum(LIFESTYLE_LEVELS, "Choose an activity level"),
  diet_type: z.enum(DIET_TYPES, "Choose a diet type"),
  allergies: list(30),
  dislikes: list(50),
  cuisines: list(20),
});

export type PreferencesResult =
  | { success: true; data: NutritionPreferences }
  | { success: false; fieldErrors: Partial<Record<keyof NutritionPreferences, string[]>> };

/** Form input → canonical preferences (lists are comma-separated in the form). */
export function parsePreferences(input: Record<string, unknown>): PreferencesResult {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, fieldErrors: z.flattenError(parsed.error).fieldErrors as never };
  return { success: true, data: parsed.data };
}

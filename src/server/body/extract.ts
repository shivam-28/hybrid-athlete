import "server-only";
import { z } from "zod";
import { COMP_METHODS, SEGMENTS } from "@/lib/body/schemas";
import { lbToKg } from "@/lib/units";
import { parseStructured, type StructuredClient } from "@/server/ai/structured";

export type ExtractionClient = StructuredClient;
export type ReportDocument = { mediaType: "image/jpeg" | "application/pdf"; base64: string };

const n = z.number().nullable();
const rawSchema = z.object({
  is_body_composition_report: z.boolean(),
  test_date: z.string().nullable(),
  method: z.enum(COMP_METHODS).nullable(),
  mass_unit: z.enum(["kg", "lb"]).nullable(),
  weight: n,
  body_fat_pct: n,
  fat_mass: n,
  lean_mass: n,
  skeletal_muscle: n,
  visceral_fat_level: n,
  bmr_kcal: n,
  total_body_water: n,
  segmental_lean: z.object({ left_arm: n, right_arm: n, trunk: n, left_leg: n, right_leg: n }).nullable(),
});
export type RawExtraction = z.infer<typeof rawSchema>;

const VALUE_FIELDS = ["weight", "body_fat_pct", "fat_mass", "lean_mass", "skeletal_muscle", "visceral_fat_level", "bmr_kcal", "total_body_water"] as const;
const MASS_FIELDS = new Set(["weight", "fat_mass", "lean_mass", "skeletal_muscle", "total_body_water"]);

export type ExtractionDraft = {
  method: RawExtraction["method"];
  test_date: string | null;
  unit: "kg";
  segmental_lean: Partial<Record<(typeof SEGMENTS)[number], number>> | null;
} & Record<(typeof VALUE_FIELDS)[number], number | null>;

export type ExtractionResult =
  | { kind: "draft"; draft: ExtractionDraft; notFound: string[] }
  | { kind: "empty" }
  | { kind: "unreadable" };

const SYSTEM = `You read body composition test reports (InBody, Tanita, DEXA, Withings, other bioimpedance scales, skinfold sheets).
Copy values exactly as printed. Never estimate, calculate or guess a value that is not printed; use null when a value is absent or unreadable.
- test_date: the measurement date printed on the report as YYYY-MM-DD, else null.
- method: the device or method brand; other_bia for other bioimpedance devices.
- mass_unit: the unit the masses are printed in (kg or lb).
- weight, fat_mass (body fat mass), lean_mass (lean / fat-free mass), skeletal_muscle (skeletal muscle mass), total_body_water: masses in mass_unit.
- body_fat_pct: percent body fat. visceral_fat_level: the device's visceral fat level/rating. bmr_kcal: basal metabolic rate in kcal.
- segmental_lean: segmental lean mass per limb and trunk in mass_unit, or null if the report has no segmental analysis.
Set is_body_composition_report to false if the document is not a body composition report.`;

const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/**
 * Reads a report into an unsaved draft. Nothing is persisted here: the user
 * confirms (and may correct) the draft before it becomes a test.
 */
export async function extractBodyComposition(client: ExtractionClient, doc: ReportDocument): Promise<ExtractionResult> {
  const source = { type: "base64" as const, media_type: doc.mediaType, data: doc.base64 };
  const raw = await parseStructured(client, {
    system: SYSTEM,
    schema: rawSchema,
    maxTokens: 4096,
    content: [
      doc.mediaType === "application/pdf" ? { type: "document", source: { ...source, media_type: "application/pdf" } } : { type: "image", source: { ...source, media_type: "image/jpeg" } },
      { type: "text", text: "Extract the body composition values from this report." },
    ],
  });
  if (!raw) return { kind: "unreadable" };

  const toKg = (field: string, v: number | null) => (v !== null && MASS_FIELDS.has(field) && raw.mass_unit === "lb" ? lbToKg(v) : v);
  const values = Object.fromEntries(VALUE_FIELDS.map((f) => [f, toKg(f, raw[f])])) as Record<(typeof VALUE_FIELDS)[number], number | null>;
  const segments = Object.fromEntries(
    SEGMENTS.flatMap((s) => {
      const v = raw.segmental_lean?.[s] ?? null;
      return v === null ? [] : [[s, raw.mass_unit === "lb" ? lbToKg(v) : v]];
    }),
  );
  const hasAnyValue = Object.values(values).some((v) => v !== null) || Object.keys(segments).length > 0;
  if (!raw.is_body_composition_report || !hasAnyValue) return { kind: "empty" };

  const draft: ExtractionDraft = {
    ...values,
    method: raw.method,
    test_date: raw.test_date && isIsoDate(raw.test_date) ? raw.test_date : null,
    unit: "kg",
    segmental_lean: Object.keys(segments).length > 0 ? segments : null,
  };
  const notFound = [
    ...VALUE_FIELDS.filter((f) => draft[f] === null),
    ...(draft.method === null ? ["method"] : []),
    ...(draft.test_date === null ? ["test_date"] : []),
  ];
  return { kind: "draft", draft, notFound };
}

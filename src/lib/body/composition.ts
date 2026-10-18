export type CompositionValues = {
  weight_kg: number | null;
  body_fat_pct: number | null;
  fat_mass_kg: number | null;
  lean_mass_kg: number | null;
};

type MassField = keyof CompositionValues;

// Relative nudge so values like 14.615 (stored as 14.6149999…) round half-up as written.
const round = (value: number, decimals: number) => Math.round(value * 10 ** decimals * (1 + 1e-12)) / 10 ** decimals;

/**
 * Fills fat mass, lean mass and body fat % from the values that are present,
 * never overwriting provided values. `derived` lists the filled fields.
 */
export function deriveComposition<T extends CompositionValues>(input: T): { values: T; derived: MassField[] } {
  const v = { ...input };
  const derived: MassField[] = [];
  const set = (field: MassField, value: number, decimals: number) => {
    v[field] = round(value, decimals) as T[MassField];
    derived.push(field);
  };

  if (v.weight_kg !== null) {
    if (v.fat_mass_kg === null && v.body_fat_pct !== null) set("fat_mass_kg", (v.weight_kg * v.body_fat_pct) / 100, 2);
    if (v.fat_mass_kg === null && v.lean_mass_kg !== null) set("fat_mass_kg", v.weight_kg - v.lean_mass_kg, 2);
    if (v.lean_mass_kg === null && v.fat_mass_kg !== null) set("lean_mass_kg", v.weight_kg - v.fat_mass_kg, 2);
    if (v.body_fat_pct === null && v.fat_mass_kg !== null) set("body_fat_pct", (v.fat_mass_kg / v.weight_kg) * 100, 1);
  }
  return { values: v, derived };
}

export type ConsistencyWarning = {
  code: "body_fat_range" | "mass_sum" | "body_fat_mismatch";
  fields: MassField[];
  message: string;
};

/** Flags values that are probably misread or mistyped; the user can still confirm them. */
export function checkConsistency(v: CompositionValues): ConsistencyWarning[] {
  const warnings: ConsistencyWarning[] = [];
  if (v.body_fat_pct !== null && (v.body_fat_pct < 3 || v.body_fat_pct > 60)) {
    warnings.push({
      code: "body_fat_range",
      fields: ["body_fat_pct"],
      message: `Body fat ${v.body_fat_pct} % is outside the usual 3–60 % range. Check for a misread digit.`,
    });
  }
  if (v.weight_kg !== null && v.fat_mass_kg !== null && v.lean_mass_kg !== null) {
    const sum = v.fat_mass_kg + v.lean_mass_kg;
    if (Math.abs(sum - v.weight_kg) / v.weight_kg > 0.02) {
      warnings.push({
        code: "mass_sum",
        fields: ["fat_mass_kg", "lean_mass_kg", "weight_kg"],
        message: `Fat mass plus lean mass (${sum.toFixed(1)} kg) differs from weight (${v.weight_kg.toFixed(1)} kg) by more than 2 %.`,
      });
    }
  }
  if (v.weight_kg !== null && v.fat_mass_kg !== null && v.body_fat_pct !== null) {
    const fromMasses = (v.fat_mass_kg / v.weight_kg) * 100;
    if (Math.abs(fromMasses - v.body_fat_pct) > 1 + 1e-9) {
      warnings.push({
        code: "body_fat_mismatch",
        fields: ["body_fat_pct", "fat_mass_kg"],
        message: `Body fat ${v.body_fat_pct} % doesn't match fat mass ÷ weight (${fromMasses.toFixed(1)} %).`,
      });
    }
  }
  return warnings;
}

import { describe, expect, it } from "vitest";
import { checkConsistency, deriveComposition, type CompositionValues } from "./composition";

const empty: CompositionValues = { weight_kg: null, body_fat_pct: null, fat_mass_kg: null, lean_mass_kg: null };

describe("deriveComposition", () => {
  it("Given weight 80.0 and body fat 20.0 %, Then fat 16.0 and lean 64.0 are derived and marked", () => {
    const { values, derived } = deriveComposition({ ...empty, weight_kg: 80, body_fat_pct: 20 });
    expect(values).toMatchObject({ fat_mass_kg: 16, lean_mass_kg: 64 });
    expect(derived.sort()).toEqual(["fat_mass_kg", "lean_mass_kg"]);
  });

  it("Given weight and fat mass, Then lean mass and body fat % are derived", () => {
    const { values, derived } = deriveComposition({ ...empty, weight_kg: 80, fat_mass_kg: 15.2 });
    expect(values).toMatchObject({ lean_mass_kg: 64.8, body_fat_pct: 19 });
    expect(derived.sort()).toEqual(["body_fat_pct", "lean_mass_kg"]);
  });

  it("Given weight and lean mass, Then fat mass and body fat % are derived", () => {
    const { values } = deriveComposition({ ...empty, weight_kg: 80, lean_mass_kg: 64 });
    expect(values).toMatchObject({ fat_mass_kg: 16, body_fat_pct: 20 });
  });

  it("Given body fat % without weight, Then nothing is derived", () => {
    expect(deriveComposition({ ...empty, body_fat_pct: 20 }).derived).toEqual([]);
  });

  it("never overwrites provided values", () => {
    const input = { weight_kg: 80, body_fat_pct: 20, fat_mass_kg: 15, lean_mass_kg: 60 };
    expect(deriveComposition(input)).toEqual({ values: input, derived: [] });
  });
});

describe("checkConsistency", () => {
  it("Given weight 80.0, fat 15.0 and lean 60.0, Then fat + lean (75.0 kg) is flagged", () => {
    const warnings = checkConsistency({ weight_kg: 80, fat_mass_kg: 15, lean_mass_kg: 60, body_fat_pct: null });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain("75.0 kg");
    expect(warnings[0]!.fields).toEqual(["fat_mass_kg", "lean_mass_kg", "weight_kg"]);
  });

  it("Given a consistent test, Then there are no warnings", () => {
    expect(checkConsistency({ weight_kg: 80, fat_mass_kg: 16, lean_mass_kg: 64, body_fat_pct: 20 })).toEqual([]);
  });

  it.each([2.5, 81.5])("Given body fat %s %, Then it is flagged as outside 3–60 %", (bf) => {
    const warnings = checkConsistency({ ...empty, body_fat_pct: bf });
    expect(warnings.map((w) => w.code)).toContain("body_fat_range");
  });

  it("Given body fat % that disagrees with fat mass / weight by more than 1 point, Then it is flagged", () => {
    const warnings = checkConsistency({ weight_kg: 80, fat_mass_kg: 16, lean_mass_kg: 64, body_fat_pct: 18.5 });
    expect(warnings.map((w) => w.code)).toEqual(["body_fat_mismatch"]);
  });

  it("Given a 0.9-point difference, Then it is not flagged", () => {
    expect(checkConsistency({ weight_kg: 80, fat_mass_kg: 16, lean_mass_kg: 64, body_fat_pct: 19.1 })).toEqual([]);
  });
});

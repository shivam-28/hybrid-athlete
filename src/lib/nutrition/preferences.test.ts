import { describe, expect, it } from "vitest";
import { parsePreferences } from "./preferences";

describe("parsePreferences", () => {
  it("Given comma-separated lists, Then they are trimmed, lower-cased and de-duplicated", () => {
    const r = parsePreferences({
      lifestyle_level: "active",
      diet_type: "vegetarian",
      allergies: " Peanuts, milk ,peanuts,, ",
      dislikes: "Olives",
      cuisines: "Indian, Nordic",
    });
    expect(r).toEqual({
      success: true,
      data: { lifestyle_level: "active", diet_type: "vegetarian", allergies: ["peanuts", "milk"], dislikes: ["olives"], cuisines: ["indian", "nordic"] },
    });
  });

  it("Given empty lists, Then empty arrays are stored", () => {
    const r = parsePreferences({ lifestyle_level: "sedentary", diet_type: "omnivore", allergies: "", dislikes: "", cuisines: "" });
    expect(r.success && r.data.allergies).toEqual([]);
  });

  it.each([
    [{ lifestyle_level: "very_active" }, "lifestyle_level"],
    [{ diet_type: "carnivore" }, "diet_type"],
    [{ allergies: "x".repeat(81) }, "allergies"],
  ])("rejects %j", (patch, field) => {
    const r = parsePreferences({ lifestyle_level: "sedentary", diet_type: "omnivore", allergies: "", dislikes: "", cuisines: "", ...patch });
    expect(r.success).toBe(false);
    expect(!r.success && r.fieldErrors[field as keyof typeof r.fieldErrors]).toBeDefined();
  });
});

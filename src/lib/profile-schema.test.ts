import { describe, expect, it } from "vitest";
import { parseProfileInput } from "./profile-schema";

const TODAY = "2026-10-18";
const valid = {
  display_name: "Shivam",
  sex: "male",
  birth_date: "1995-06-01",
  unit_system: "metric",
  height_cm: "180",
  timezone: "Europe/Copenhagen",
  strength_experience: "beginner",
  running_experience: "none",
};

describe("parseProfileInput", () => {
  it("Given valid metric input, Then it returns a metric profile", () => {
    const result = parseProfileInput(valid, TODAY);
    expect(result.success).toBe(true);
    expect(result.success && result.data.height_cm).toBe(180);
  });

  it("Given imperial height 5 ft 10 in, Then 177.8 cm is stored", () => {
    const result = parseProfileInput(
      { ...valid, unit_system: "imperial", height_cm: undefined, height_ft: "5", height_in: "10" },
      TODAY,
    );
    expect(result.success && result.data.height_cm).toBe(177.8);
  });

  it("Given a height of 300 cm, Then the height field has an error", () => {
    const result = parseProfileInput({ ...valid, height_cm: "300" }, TODAY);
    expect(result.success).toBe(false);
    expect(!result.success && result.fieldErrors.height_cm).toBeDefined();
  });

  it("Given an age under 13, Then onboarding is rejected with a minimum-age message", () => {
    const result = parseProfileInput({ ...valid, birth_date: "2014-01-01" }, TODAY);
    expect(!result.success && result.fieldErrors.birth_date?.[0]).toMatch(/13/);
  });

  it("Given an age over 100, Then it is rejected", () => {
    expect(parseProfileInput({ ...valid, birth_date: "1920-01-01" }, TODAY).success).toBe(false);
  });

  it("Given an invalid timezone, Then the timezone field has an error", () => {
    const result = parseProfileInput({ ...valid, timezone: "Mars/Olympus" }, TODAY);
    expect(!result.success && result.fieldErrors.timezone).toBeDefined();
  });

  it("Given an unknown sex value, Then it is rejected", () => {
    expect(parseProfileInput({ ...valid, sex: "other" }, TODAY).success).toBe(false);
  });
});

describe("optional max heart rate", () => {
  it.each(["99", "231"])("Given %s bpm, Then it is rejected", (value) => {
    const result = parseProfileInput({ ...valid, max_hr_bpm: value }, TODAY);
    expect(!result.success && result.fieldErrors.max_hr_bpm?.[0]).toMatch(/100.*230/);
  });

  it("accepts a value in 100–230 and leaves it unset when blank", () => {
    expect(parseProfileInput({ ...valid, max_hr_bpm: "185" }, TODAY)).toMatchObject({ success: true, data: { max_hr_bpm: 185 } });
    const blank = parseProfileInput({ ...valid, max_hr_bpm: "" }, TODAY);
    expect(blank.success && blank.data.max_hr_bpm).toBeUndefined();
  });
});

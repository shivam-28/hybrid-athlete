import { describe, expect, it } from "vitest";
import { methodSeries, mixedMethodNotice } from "./composition-trends";

const t = (date: string, method: string, bf: number | null) => ({ local_date: date, method, body_fat_pct: bf, lean_mass_kg: null, skeletal_muscle_kg: null });

describe("methodSeries", () => {
  it("groups points by method so lines only connect tests of the same method", () => {
    const series = methodSeries([t("2026-01-01", "inbody", 22), t("2026-03-01", "dexa", 24), t("2026-05-01", "inbody", 21)], "body_fat_pct");
    expect(series).toEqual([
      { method: "inbody", points: [{ date: "2026-01-01", value: 22 }, { date: "2026-05-01", value: 21 }] },
      { method: "dexa", points: [{ date: "2026-03-01", value: 24 }] },
    ]);
  });

  it("skips tests without the metric", () => {
    expect(methodSeries([t("2026-01-01", "inbody", null)], "body_fat_pct")).toEqual([]);
  });
});

describe("mixedMethodNotice", () => {
  it("Given the last two tests are InBody (21 %) and DEXA (24 %), Then a not-comparable notice is shown", () => {
    expect(mixedMethodNotice([t("2026-05-01", "inbody", 21), t("2026-06-01", "dexa", 24)])).toMatch(/InBody.*DEXA.*not directly comparable/);
  });

  it("Given the same method, Then no notice", () => {
    expect(mixedMethodNotice([t("2026-05-01", "dexa", 21), t("2026-06-01", "dexa", 24)])).toBeNull();
  });
});

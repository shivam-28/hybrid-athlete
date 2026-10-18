import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { computeDailyTargets, type TargetInputs } from "@/lib/nutrition/targets";
import { TargetsCard } from "./targets-card";
import { WhyList } from "./why-list";

const inputs: TargetInputs = {
  date: "2026-10-18",
  profile: { sex: "male", birthDate: "1995-06-01", heightCm: 180, lifestyle: "sedentary" },
  trendWeightKg: 80,
  bodyFat: null,
  goal: { phase: "cut", rateKgPerWeek: null, goalWeightKg: 75 },
  activities: [{ id: "r", sport: "running", label: "Run 10.0 km", startedAt: "2026-10-18T06:00:00Z", durationS: 3600, activeKcal: 850 }],
  strengthSessions: [],
  adaptive: { completeDays: 0, weighIns: 0, meanIntakeKcal: null, trendChangeKgPerDay: null, meanExerciseKcal: 0 },
};
const result = computeDailyTargets(inputs);
if (!result.ok) throw new Error("fixture must produce targets");

const fixed = { ...result, targets: { kcal: 2800, protein_g: 144, carb_g: 381, fat_g: 78, fiber_g: 39 } };

describe("WhyList", () => {
  it("lists every component and they sum to the displayed target", () => {
    const html = renderToStaticMarkup(<WhyList result={result} />);
    const rows = html.match(/data-testid="why-component"/g) ?? [];
    expect(rows).toHaveLength(result.components.length);
    for (const c of result.components) expect(html).toContain(c.label);
    expect(result.components.reduce((s, c) => s + c.kcal, 0)).toBe(result.targets.kcal);
    expect(html).toContain(`data-testid="why-total">${result.targets.kcal.toLocaleString("en-GB")} kcal`);
    expect(html).toContain("Mifflin-St Jeor");
    expect(html).toContain("sedentary (1.2)");
  });
});

describe("TargetsCard", () => {
  it("Given 2800 kcal / 144 g targets and 1900 kcal / 100 g logged, Then 900 kcal and 44 g protein remain", () => {
    const html = renderToStaticMarkup(<TargetsCard result={fixed} eaten={{ kcal: 1900, protein_g: 100, carb_g: 200, fat_g: 60, fiber_g: 20 }} />);
    expect(html).toContain('data-testid="left-kcal">900 kcal left');
    expect(html).toContain("44 g left");
  });

  it("Given more kcal than the target, Then the overage is shown as 'over', never negative", () => {
    const html = renderToStaticMarkup(<TargetsCard result={fixed} eaten={{ kcal: 3150, protein_g: 150, carb_g: 400, fat_g: 90, fiber_g: 40 }} />);
    expect(html).toContain('data-testid="left-kcal">350 kcal over');
    expect(html).toContain("6 g over");
    expect(html).not.toMatch(/-\d+ kcal/);
  });
});

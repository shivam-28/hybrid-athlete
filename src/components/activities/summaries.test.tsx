import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { trainingLoad } from "@/lib/activities/load";
import { weeklySummaries } from "@/lib/activities/summaries";
import type { DailyMetricsRow } from "@/server/activities/views";
import { DailyTrends } from "./daily-trends";
import { TrainingLoadPanel } from "./training-load-panel";
import { WeeklySummary } from "./weekly-summary";

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("WeeklySummary and TrainingLoadPanel", () => {
  const activities = [
    { local_date: "2026-06-09", sport: "running", distance_m: 5000, moving_s: 1500, load: 50 },
    { local_date: "2026-06-11", sport: "running", distance_m: 8000, moving_s: 2400, load: 80 },
    { local_date: "2026-06-14", sport: "running", distance_m: 16000, moving_s: 5400, load: 180 },
  ];

  it("Given seeded runs, Then the current week shows 29 km in 3 runs with a 16 km longest run", () => {
    const html = text(renderToStaticMarkup(<WeeklySummary weeks={weeklySummaries(activities, "2026-06-14")} units="metric" />));
    expect(html).toContain("This week: 29.0 km in 3 runs · longest 16.0 km");
    expect(html).toContain("8 Jun 29.0 km 3 16.0 km 2:35:00");
  });

  it("Given less than 21 days of history, Then the ratio says building baseline", () => {
    const html = text(renderToStaticMarkup(<TrainingLoadPanel load={trainingLoad(activities, "2026-06-14")} />));
    expect(html).toContain("Acute (7 d) 310");
    expect(html).toContain("building baseline");
  });

  it("Given enough history, Then the ratio is shown", () => {
    const html = text(renderToStaticMarkup(<TrainingLoadPanel load={{ acute: 600, chronic: 500, ratio: 1.2, baselineReady: true }} />));
    expect(html).toContain("Ratio 1.2");
    expect(html).not.toContain("building baseline");
  });
});

describe("DailyTrends", () => {
  const day = (local_date: string, values: Partial<DailyMetricsRow>) =>
    ({ local_date, steps: null, active_energy_kcal: null, resting_hr_bpm: null, hrv_sdnn_ms: null, sleep_minutes: null, vo2max: null, weight_kg: null, ...values }) as DailyMetricsRow;

  it("Given HRV is missing, Then HRV shows not available and never 0, while known metrics are averaged", () => {
    const rows = [
      day("2026-06-10", { resting_hr_bpm: 50, steps: 8000 }),
      day("2026-06-11", { resting_hr_bpm: 52, steps: 9000 }),
      day("2026-06-12", { resting_hr_bpm: 51 }),
      day("2026-06-13", { resting_hr_bpm: 49, hrv_sdnn_ms: 60 }),
      day("2026-06-14", { resting_hr_bpm: 53, steps: 10000 }),
    ];
    const html = text(renderToStaticMarkup(<DailyTrends rows={rows} today="2026-06-14" units="metric" />));
    expect(html).toContain("Resting heart rate 53 bpm 14 Jun 51 bpm");
    expect(html).toContain("HRV (SDNN) 60 ms 13 Jun not available");
    expect(html).toContain("VO₂ max not available not available");
    expect(html).toContain("Steps 10,000 14 Jun 9,000");
    expect(html).not.toMatch(/HRV \(SDNN\) 0/);
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SetFields, emptySetFields } from "./set-fields";
import { SuggestionPanel } from "./suggestion-panel";

describe("SuggestionPanel", () => {
  it("Given a suggestion, Then it is shown as text and the set form starts empty (nothing pre-filled or saved)", () => {
    const html = renderToStaticMarkup(
      <>
        <SuggestionPanel
          previous={{ localDate: "2026-10-15", summary: "50 kg × 8, 8, 8" }}
          suggestion={{ kind: "increase", weightKg: 52.5, reps: [6, 6, 6] }}
          units="metric"
        />
        <SetFields idPrefix="t" mode="weight_reps" units="metric" values={emptySetFields} onChange={() => {}} />
      </>,
    );
    expect(html).toContain("Last time (2026-10-15):</span> 50 kg × 8, 8, 8");
    expect(html).toContain("Today:</span> 52.5 kg × 6");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<button");
    const values = [...html.matchAll(/<input[^>]*value="([^"]*)"/g)].map((m) => m[1]);
    expect(values.every((v) => v === "")).toBe(true);
  });

  it("Given a never-done exercise, Then it shows baseline guidance without error", () => {
    const html = renderToStaticMarkup(<SuggestionPanel previous={null} suggestion={{ kind: "baseline", repMin: 6, repMax: 10 }} units="metric" />);
    expect(html).toContain("No previous sessions");
    expect(html).toContain("Baseline:");
  });
});

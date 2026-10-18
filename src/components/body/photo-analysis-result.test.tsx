import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PhotoAnalysisResult } from "./photo-analysis-result";

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("PhotoAnalysisResult", () => {
  it("renders observations", () => {
    const html = text(renderToStaticMarkup(<PhotoAnalysisResult observations={["Waist looks narrower."]} visualImpression={null} />));
    expect(html).toContain("Waist looks narrower.");
    expect(html).not.toContain("visual impression");
  });

  it("Given a body fat range, Then it is shown only with the 'visual impression, not a measurement' label", () => {
    const html = text(renderToStaticMarkup(<PhotoAnalysisResult observations={["Posture is more upright."]} visualImpression="Roughly 15–17 %" />));
    expect(html).toMatch(/Visual impression, not a measurement:? Roughly 15–17 %/i);
  });
});

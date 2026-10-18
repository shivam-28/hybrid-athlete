import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WeeklyVolume } from "./weekly-volume";

describe("WeeklyVolume", () => {
  it("renders weekly_muscle_volume rows (chest 3, triceps 1.5, shoulders 1.5)", () => {
    const html = renderToStaticMarkup(
      <WeeklyVolume rows={[{ muscle_group: "chest", sets: 3 }, { muscle_group: "triceps", sets: 1.5 }, { muscle_group: "shoulders", sets: 1.5 }]} />,
    );
    const text = html.replace(/<[^>]+>/g, "|").split("|").filter(Boolean);
    expect(text).toEqual(["Chest", "3", "Triceps", "1.5", "Shoulders", "1.5"]);
  });

  it("shows an empty state when nothing is logged", () => {
    expect(renderToStaticMarkup(<WeeklyVolume rows={[]} />)).toContain("No working sets logged this week");
  });
});

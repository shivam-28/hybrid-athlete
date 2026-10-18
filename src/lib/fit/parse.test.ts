import { readFileSync } from "node:fs";
import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { FitImportError, extractFit, parseFit } from "./parse";

const fixture = (name: string) => new Uint8Array(readFileSync(`tests/fixtures/fit/${name}`));
const importFile = (name: string) => parseFit(extractFit(fixture(name)));

describe("parseFit", () => {
  it("Given a 10.0 km run in 52:30, Then the summary fields are extracted", () => {
    const run = importFile("run-10k-hr.fit");
    expect(run).toMatchObject({
      sport: "running",
      subSport: "generic",
      startedAt: new Date("2026-06-14T05:00:00Z"),
      elapsedS: 3150,
      movingS: 3150,
      distanceM: 10000,
      maxHr: 165,
      elevationGainM: 18,
    });
    expect(run.avgHr).toBeGreaterThan(150);
    expect(run.movingS! / (run.distanceM! / 1000)).toBe(315); // 5:15 /km
  });

  it("Given a 5.4 km run, Then five 1 km splits and one 0.4 km split are produced", () => {
    const { splits } = importFile("run-5_4k.fit");
    expect(splits.map((s) => s.distanceM)).toEqual([1000, 1000, 1000, 1000, 1000, 400]);
    for (const split of splits.slice(0, 5)) expect(split.durationS).toBeCloseTo(350, 0);
    expect(splits[5]!.durationS).toBeCloseTo(140, 0);
    expect(splits[0]!.avgHr).toBe(145);
    expect(splits.map((s) => s.idx)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("builds a time-weighted heart-rate histogram", () => {
    const { hrHistogram } = importFile("run-10k-hr.fit");
    expect(hrHistogram!["140"]).toBeCloseTo(1575, -1);
    expect(hrHistogram!["165"]).toBeCloseTo(1575, -1);
  });

  it("Given a file without heart rate, Then HR fields are unknown and the import still succeeds", () => {
    const run = importFile("run-no-hr.fit");
    expect(run).toMatchObject({ avgHr: null, maxHr: null, hrHistogram: null, distanceM: 4000 });
    expect(run.splits.every((s) => s.avgHr === null)).toBe(true);
  });

  it("maps a training activity to strength without splits", () => {
    const strength = importFile("strength.fit");
    expect(strength).toMatchObject({ sport: "strength", distanceM: null, splits: [] });
  });

  it("Given a truncated file, Then a corrupt-file error is raised", () => {
    expect(() => importFile("corrupt.fit")).toThrow(FitImportError);
    try {
      importFile("corrupt.fit");
    } catch (error) {
      expect((error as FitImportError).code).toBe("corrupt");
      expect((error as Error).message).toBe("This file could not be read as a FIT activity");
    }
  });
});

describe("extractFit", () => {
  it("extracts the single .fit from a Garmin export zip", () => {
    expect(parseFit(extractFit(fixture("garmin-export.zip"))).distanceM).toBe(5400);
  });

  it.each(["no-fit.zip", "two-fit.zip"])("rejects %s as unsupported", (name) => {
    expect(() => extractFit(fixture(name))).toThrow(expect.objectContaining({ code: "unsupported" }));
  });

  it("rejects GPX and images as unsupported", () => {
    const gpx = new TextEncoder().encode('<?xml version="1.0"?><gpx version="1.1"></gpx>');
    expect(() => extractFit(gpx)).toThrow(expect.objectContaining({ code: "unsupported" }));
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(() => extractFit(png)).toThrow(/only \.fit or Garmin export \.zip/i);
  });

  it("refuses zips that expand beyond the size cap", () => {
    const bomb = zipSync({ "big.fit": new Uint8Array(51 * 1024 * 1024) }, { level: 9 });
    expect(bomb.length).toBeLessThan(1_000_000);
    expect(() => extractFit(bomb)).toThrow(expect.objectContaining({ code: "too_large" }));
  });
});

import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/activities/dates";
import { computeBaseline, evaluateSignals, parseCheckin, scoreReadiness, type Checkin, type DailySignalsRow } from "./readiness";

const TODAY = "2026-10-18";
const checkin = (sleep: number, soreness: number, energy: number, stress: number, pain = false): Checkin => ({
  sleep_quality: sleep,
  soreness,
  energy,
  stress,
  pain_flag: pain,
  pain_note: null,
});

describe("parseCheckin", () => {
  it("accepts 1–5 values and an optional pain note", () => {
    expect(parseCheckin({ sleep_quality: 4, soreness: 3, energy: 4, stress: 3 }).success).toBe(true);
    expect(parseCheckin({ sleep_quality: 4, soreness: 3, energy: 4, stress: 3, pain_flag: true, pain_note: "left knee" }).success).toBe(true);
  });

  it.each([0, 6, 2.5])("rejects an item value of %s", (v) => {
    expect(parseCheckin({ sleep_quality: v, soreness: 3, energy: 4, stress: 3 }).success).toBe(false);
  });
});

describe("computeBaseline", () => {
  const series = (n: number, value: (i: number) => number | null, from = addDays(TODAY, -1)) =>
    Array.from({ length: n }, (_, i) => ({ local_date: addDays(from, -i), value: value(i) }));

  it("uses the 28 days ending yesterday (today and older days excluded)", () => {
    const rows = [...series(28, () => 50), { local_date: TODAY, value: 90 }, { local_date: addDays(TODAY, -29), value: 90 }];
    expect(computeBaseline(rows, TODAY)).toEqual({ available: true, mean: 50, sd: 0, days: 28 });
  });

  it("computes mean and population SD over days with a value", () => {
    const rows = series(14, (i) => (i % 2 ? 60 : 40));
    expect(computeBaseline(rows, TODAY)).toEqual({ available: true, mean: 50, sd: 10, days: 14 });
  });

  it("is unavailable with fewer than 14 values in the window", () => {
    expect(computeBaseline(series(28, (i) => (i < 9 ? 50 : null)), TODAY)).toEqual({ available: false, days: 9 });
  });
});

describe("evaluateSignals", () => {
  const history = (field: keyof DailySignalsRow, value: number, days = 20): DailySignalsRow[] =>
    Array.from({ length: days }, (_, i) => ({ local_date: addDays(TODAY, -1 - i), sleep_minutes: null, resting_hr_bpm: null, hrv_sdnn_ms: null, [field]: value }));
  const today = (patch: Partial<DailySignalsRow>): DailySignalsRow => ({ local_date: TODAY, sleep_minutes: null, resting_hr_bpm: null, hrv_sdnn_ms: null, ...patch });
  const find = (signals: ReturnType<typeof evaluateSignals>, key: string) => signals.find((s) => s.key === key)!;

  it("Given baseline RHR 52 and today 58, Then resting HR is negative", () => {
    const s = evaluateSignals([...history("resting_hr_bpm", 52), today({ resting_hr_bpm: 58 })], TODAY, null);
    expect(find(s, "resting_hr")).toMatchObject({ status: "negative" });
    expect(find(s, "resting_hr").reason).toMatch(/\+6 bpm/);
  });

  it("Given RHR only 4 bpm above baseline, Then it is not negative", () => {
    expect(find(evaluateSignals([...history("resting_hr_bpm", 52), today({ resting_hr_bpm: 56 })], TODAY, null), "resting_hr").status).toBe("ok");
  });

  it("Given 9 days of HRV data, Then HRV is unavailable", () => {
    expect(find(evaluateSignals([...history("hrv_sdnn_ms", 60, 9), today({ hrv_sdnn_ms: 20 })], TODAY, null), "hrv").status).toBe("unavailable");
  });

  it("Given HRV more than 1 SD below the mean, Then HRV is negative", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ local_date: addDays(TODAY, -1 - i), sleep_minutes: null, resting_hr_bpm: null, hrv_sdnn_ms: i % 2 ? 70 : 50 }));
    expect(find(evaluateSignals([...rows, today({ hrv_sdnn_ms: 49 })], TODAY, null), "hrv").status).toBe("negative");
    expect(find(evaluateSignals([...rows, today({ hrv_sdnn_ms: 51 })], TODAY, null), "hrv").status).toBe("ok");
  });

  it("Given sleep below 85% of baseline or under 6 h, Then sleep is negative", () => {
    expect(find(evaluateSignals([...history("sleep_minutes", 480), today({ sleep_minutes: 400 })], TODAY, null), "sleep").status).toBe("negative");
    expect(find(evaluateSignals([...history("sleep_minutes", 400), today({ sleep_minutes: 350 })], TODAY, null), "sleep").status).toBe("negative");
    expect(find(evaluateSignals([...history("sleep_minutes", 480), today({ sleep_minutes: 420 })], TODAY, null), "sleep").status).toBe("ok");
  });

  it("Given no value today, Then the signal is unavailable", () => {
    expect(find(evaluateSignals(history("sleep_minutes", 480), TODAY, null), "sleep").status).toBe("unavailable");
  });

  it("Given an acute:chronic ratio of 1.6, Then load is negative", () => {
    expect(find(evaluateSignals([], TODAY, 1.6), "load")).toMatchObject({ status: "negative" });
  });

  it("Given a ratio below 0.8, Then load carries a non-negative detraining note", () => {
    expect(find(evaluateSignals([], TODAY, 0.7), "load")).toMatchObject({ status: "note" });
  });

  it("Given activity-history shows no ratio yet, Then load is unavailable", () => {
    expect(find(evaluateSignals([], TODAY, null), "load").status).toBe("unavailable");
  });
});

describe("scoreReadiness", () => {
  const signal = (key: string, status: "negative" | "ok" | "unavailable" | "note", reason = `${key} reason`) => ({ key, label: key, status, reason });
  const none = [signal("sleep", "unavailable"), signal("resting_hr", "unavailable"), signal("hrv", "unavailable"), signal("load", "unavailable")];

  it("Given no wearable data and 4, 4, 4, 4, Then readiness is green", () => {
    expect(scoreReadiness(checkin(4, 4, 4, 4), none).score).toBe("green");
  });

  it("Given mean 3.5 and a negative resting HR, Then readiness is amber with the resting HR reason", () => {
    const r = scoreReadiness(checkin(4, 3, 4, 3), [signal("resting_hr", "negative", "Resting HR above baseline (+6 bpm)")]);
    expect(r.score).toBe("amber");
    expect(r.reasons).toContain("Resting HR above baseline (+6 bpm)");
  });

  it("Given the pain flag with any scores, Then readiness is red and refers to a professional", () => {
    const r = scoreReadiness(checkin(5, 5, 5, 5, true), none);
    expect(r.score).toBe("red");
    expect(r.referral).toMatch(/qualified professional/i);
  });

  it("Given mean 2.75 with negative sleep and HRV, Then readiness is red", () => {
    expect(scoreReadiness(checkin(3, 3, 3, 2), [signal("sleep", "negative"), signal("hrv", "negative")]).score).toBe("red");
  });

  it("Given mean ≤ 2.0, Then readiness is red", () => {
    expect(scoreReadiness(checkin(2, 2, 2, 2), none).score).toBe("red");
  });

  it("Given three negative signals, Then readiness is red even with a good check-in", () => {
    expect(scoreReadiness(checkin(5, 5, 5, 5), [signal("sleep", "negative"), signal("hrv", "negative"), signal("resting_hr", "negative")]).score).toBe("red");
  });

  it("Given any item at 1, Then readiness is at least amber", () => {
    const r = scoreReadiness(checkin(5, 1, 5, 5), none);
    expect(r.score).toBe("amber");
    expect(r.reasons.join(" ")).toMatch(/soreness/i);
  });

  it("Given a mean below 3.0 alone, Then readiness is amber", () => {
    expect(scoreReadiness(checkin(3, 3, 3, 2), none).score).toBe("amber");
  });

  it("Given a detraining note only, Then readiness stays green and the note is listed", () => {
    const r = scoreReadiness(checkin(4, 4, 4, 4), [signal("load", "note", "Training load is low (ratio 0.7)")]);
    expect(r.score).toBe("green");
    expect(r.notes).toContain("Training load is low (ratio 0.7)");
  });
});

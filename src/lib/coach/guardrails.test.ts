import { describe, expect, it } from "vitest";
import type { GuardrailContext } from "./guardrails";
import { planRunKm, validatePlan } from "./guardrails";
import type { PlanSession, WeekPlan } from "./plan-schema";

// Exercise ids → primary muscle groups
const EX = {
  squat: { id: "00000000-0000-4000-8000-000000000001", muscles: ["quads", "glutes"] },
  rdl: { id: "00000000-0000-4000-8000-000000000002", muscles: ["hamstrings", "glutes"] },
  bench: { id: "00000000-0000-4000-8000-000000000003", muscles: ["chest"] },
  row: { id: "00000000-0000-4000-8000-000000000004", muscles: ["back"] },
  press: { id: "00000000-0000-4000-8000-000000000005", muscles: ["shoulders"] },
  plank: { id: "00000000-0000-4000-8000-000000000006", muscles: ["core"] },
};

const ctx = (patch: Partial<GuardrailContext> = {}): GuardrailContext => ({
  prevAvgWeeklyKm: 20,
  easyPaceMinPerKm: 6,
  experience: { strength: "intermediate", running: "intermediate" },
  maxSessionMin: 90,
  daysPerWeek: 6,
  exerciseMuscles: Object.fromEntries(Object.values(EX).map((e) => [e.id, e.muscles])),
  ...patch,
});

const ex = (e: { id: string }) => ({ exercise_id: e.id, name: "x", sets: 3, rep_min: 6, rep_max: 10 });
const full = (id: string): PlanSession => ({
  id,
  type: "strength",
  title: "Full body",
  focus: "full",
  duration_min: 60,
  exercises: [ex(EX.squat), ex(EX.rdl), ex(EX.bench), ex(EX.row), ex(EX.press), ex(EX.plank)],
  notes: null,
});
const upper = (id: string): PlanSession => ({ ...(full(id) as Extract<PlanSession, { type: "strength" }>), focus: "upper", exercises: [ex(EX.bench), ex(EX.row), ex(EX.press)] });
const run = (id: string, run_type: "easy" | "long" | "tempo" | "intervals" | "recovery", km: number | null, minutes: number | null = null, zone: number | null = 2): PlanSession => ({
  id,
  type: "run",
  title: `${run_type} run`,
  run_type,
  distance_km: km,
  duration_min: minutes,
  hr_zone: run_type === "tempo" || run_type === "intervals" ? 4 : zone,
  pace: null,
  notes: null,
});
const core = (id: string): PlanSession => ({ id, type: "core", title: "Core", duration_min: 20, exercises: [ex(EX.plank)], notes: null });
const rest = (id: string): PlanSession => ({ id, type: "rest" });

/** Mon full · Tue easy 6 · Wed core · Thu full · Fri easy 6 · Sat rest · Sun long 6 → 18 km, compliant. */
function compliant(): WeekPlan {
  return {
    days: [
      { sessions: [full("mon")] },
      { sessions: [run("tue", "easy", 6)] },
      { sessions: [core("wed")] },
      { sessions: [full("thu")] },
      { sessions: [run("fri", "easy", 6)] },
      { sessions: [rest("sat")] },
      { sessions: [run("sun", "long", 6)] },
    ],
  };
}
const rules = (plan: WeekPlan, c = ctx()) => validatePlan(plan, c).map((v) => v.rule);

describe("validatePlan", () => {
  it("Given a plan that satisfies all seven rules, Then no violations are reported", () => {
    expect(validatePlan(compliant(), ctx())).toEqual([]);
  });

  describe("rule 1: weekly run volume", () => {
    const withKm = (km: number) => {
      const plan = compliant();
      plan.days[1]!.sessions = [run("tue", "easy", km - 12)];
      return plan;
    };

    it("Given 30 km planned on a 20 km/week base, Then a volume violation with a 23 km limit is reported", () => {
      const v = validatePlan(withKm(30), ctx()).find((x) => x.rule === "volume");
      expect(v?.message).toMatch(/23 km/);
    });

    it("Given 8 km planned on a 5 km/week base, Then no volume violation (limit 5 + 3 = 8 km)", () => {
      const plan: WeekPlan = { days: compliant().days.map((d) => ({ sessions: d.sessions.filter((s) => s.type !== "run") })) };
      plan.days[1]!.sessions = [run("tue", "easy", 4)];
      plan.days[6]!.sessions = [run("sun", "long", 2.8)];
      plan.days[4]!.sessions = [run("fri", "easy", 1.2)];
      expect(rules(plan, ctx({ prevAvgWeeklyKm: 5 }))).not.toContain("volume");
      plan.days[1]!.sessions = [run("tue", "easy", 4.5)];
      expect(rules(plan, ctx({ prevAvgWeeklyKm: 5 }))).toContain("volume");
    });

    it("Given no history (0 km), Then the limit is the 3 km minimum allowance", () => {
      const plan: WeekPlan = { days: compliant().days.map((d) => ({ sessions: d.sessions.filter((s) => s.type !== "run") })) };
      plan.days[1]!.sessions = [run("tue", "easy", 3)];
      expect(rules(plan, ctx({ prevAvgWeeklyKm: 0 }))).not.toContain("volume");
      plan.days[4]!.sessions = [run("fri", "easy", 1)];
      expect(validatePlan(plan, ctx({ prevAvgWeeklyKm: 0 })).find((v) => v.rule === "volume")?.message).toMatch(/3 km/);
    });

    it("Given duration-only runs, Then they are converted at the recent easy pace", () => {
      const plan = compliant();
      plan.days[1]!.sessions = [run("tue", "easy", null, 60)]; // 60 min at 6 min/km = 10 km
      expect(planRunKm(plan, ctx())).toBeCloseTo(22);
      expect(planRunKm(plan, ctx({ easyPaceMinPerKm: 6.5 }))).toBeCloseTo(12 + 60 / 6.5);
    });
  });

  it("rule 2: Given no full rest day, Then a rest-day violation is reported", () => {
    const plan = compliant();
    plan.days[5]!.sessions = [{ id: "sat", type: "mobility", title: "Mobility", duration_min: 20, notes: null }];
    expect(rules(plan)).toContain("rest_day");
  });

  it("rule 3: Given less than 80% easy run time, Then an easy-share violation is reported", () => {
    const plan = compliant();
    plan.days[1]!.sessions = [run("tue", "tempo", 5)];
    expect(rules(plan)).toContain("easy_share");
    plan.days[1]!.sessions = [run("tue", "tempo", 2)];
    plan.days[4]!.sessions = [run("fri", "easy", 8)];
    expect(rules(plan)).not.toContain("easy_share");
  });

  it("rule 4: Given a long run over 35% of weekly run distance, Then a long-run share violation is reported", () => {
    const plan = compliant();
    plan.days[1]!.sessions = [run("tue", "easy", 5)];
    plan.days[4]!.sessions = [run("fri", "easy", 5)];
    plan.days[6]!.sessions = [run("sun", "long", 10)]; // 10 of 20 km = 50%
    const v = validatePlan(plan, ctx()).find((x) => x.rule === "long_run_share");
    expect(v?.message).toMatch(/50%/);
    expect(v?.sessionIds).toEqual(["sun"]);
  });

  it("rule 5: Given a lower-body session on Saturday and the long run on Sunday, Then a scheduling violation names both", () => {
    const plan = compliant();
    plan.days[5]!.sessions = [{ ...(full("sat") as Extract<PlanSession, { type: "strength" }>), focus: "lower", title: "Lower body" }];
    plan.days[2]!.sessions = [rest("wed")];
    const v = validatePlan(plan, ctx()).find((x) => x.rule === "legs_before_quality");
    expect(v?.sessionIds).toEqual(["sat", "sun"]);
    expect(v?.dayIndexes).toEqual([5, 6]);
    expect(v?.message).toMatch(/Lower body/);
    expect(v?.message).toMatch(/long run/i);
  });

  it("rule 5: Given upper-body lifting before a long run, Then no scheduling violation", () => {
    const plan = compliant();
    plan.days[5]!.sessions = [upper("sat")];
    plan.days[2]!.sessions = [rest("wed")];
    expect(rules(plan)).not.toContain("legs_before_quality");
  });

  it("rule 6: Given a muscle group trained on only one day, Then a frequency violation names it", () => {
    const plan = compliant();
    plan.days[3]!.sessions = [upper("thu")];
    const v = validatePlan(plan, ctx()).find((x) => x.rule === "muscle_frequency");
    expect(v?.message).toMatch(/quads/);
    expect(v?.message).toMatch(/hamstrings/);
    expect(v?.message).not.toMatch(/chest/);
  });

  describe("rule 7: beginner consecutive days", () => {
    const streak = (): WeekPlan => ({
      days: [
        { sessions: [full("mon")] },
        { sessions: [run("tue", "tempo", 2)] },
        { sessions: [full("wed")] },
        { sessions: [run("thu", "intervals", 1)] },
        { sessions: [rest("fri")] },
        { sessions: [run("sat", "easy", 6)] },
        { sessions: [run("sun", "long", 4)] },
      ],
    });

    it("Given a beginner with 4 consecutive hard days, Then a violation is reported", () => {
      expect(rules(streak(), ctx({ experience: { strength: "beginner", running: "intermediate" } }))).toContain("beginner_streak");
    });

    it("Given an intermediate athlete, Then the same plan has no streak violation", () => {
      expect(rules(streak(), ctx())).not.toContain("beginner_streak");
    });
  });

  it("flags sessions longer than the maximum session length", () => {
    const plan = compliant();
    plan.days[0]!.sessions = [{ ...(full("mon") as Extract<PlanSession, { type: "strength" }>), duration_min: 120 }];
    expect(validatePlan(plan, ctx()).find((v) => v.rule === "session_length")?.sessionIds).toEqual(["mon"]);
  });

  it("flags more training days than the user has available", () => {
    expect(rules(compliant(), ctx({ daysPerWeek: 4 }))).toContain("training_days");
  });
});

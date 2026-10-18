import { describe, expect, it } from "vitest";
import { WeekPlanSchema, modelPlanToWeekPlan, type ModelWeekPlan } from "./plan-schema";

const rest = { type: "rest" as const };
const easyRun = { type: "run" as const, title: "Easy run", run_type: "easy" as const, duration_min: 40, distance_km: null, hr_zone: 2, pace: null, notes: null };
const strength = {
  type: "strength" as const,
  title: "Full body",
  focus: "full" as const,
  duration_min: 60,
  exercises: [{ exercise_id: "11111111-1111-4111-8111-111111111111", name: "Squat", sets: 3, rep_min: 6, rep_max: 10 }],
  notes: null,
};
const week = (sessions: unknown[][]) => ({ days: sessions.map((s) => ({ sessions: s })) });
const sevenDays = () => week([[strength], [easyRun], [rest], [strength], [easyRun], [rest], [easyRun]]);

describe("WeekPlanSchema", () => {
  it("accepts a 7-day plan with discriminated sessions", () => {
    expect(WeekPlanSchema.safeParse(sevenDays()).success).toBe(true);
  });

  it("rejects a plan without exactly 7 days", () => {
    expect(WeekPlanSchema.safeParse(week([[rest], [rest]])).success).toBe(false);
  });

  it("rejects a strength session without exercises or with rep_min > rep_max", () => {
    const noExercises = sevenDays();
    noExercises.days[0]!.sessions = [{ ...strength, exercises: [] }];
    expect(WeekPlanSchema.safeParse(noExercises).success).toBe(false);
    const badRange = sevenDays();
    badRange.days[0]!.sessions = [{ ...strength, exercises: [{ ...strength.exercises[0]!, rep_min: 12, rep_max: 8 }] }];
    expect(WeekPlanSchema.safeParse(badRange).success).toBe(false);
  });

  it("rejects a run with neither distance nor duration, or neither HR zone nor pace", () => {
    const noTarget = sevenDays();
    noTarget.days[1]!.sessions = [{ ...easyRun, duration_min: null }];
    expect(WeekPlanSchema.safeParse(noTarget).success).toBe(false);
    const noIntensity = sevenDays();
    noIntensity.days[1]!.sessions = [{ ...easyRun, hr_zone: null }];
    expect(WeekPlanSchema.safeParse(noIntensity).success).toBe(false);
  });

  it("accepts a run with distance and pace only", () => {
    const plan = sevenDays();
    plan.days[1]!.sessions = [{ ...easyRun, duration_min: null, distance_km: 8, hr_zone: null, pace: "6:00" }];
    expect(WeekPlanSchema.safeParse(plan).success).toBe(true);
  });

  it("rejects unknown session types", () => {
    const plan = sevenDays();
    plan.days[2]!.sessions = [{ type: "yoga", title: "Flow", duration_min: 30 }];
    expect(WeekPlanSchema.safeParse(plan).success).toBe(false);
  });
});

describe("modelPlanToWeekPlan (closed exercise set)", () => {
  const refs = { e1: { id: "11111111-1111-4111-8111-111111111111", name: "Barbell Squat" } };
  const model = (ref: string): ModelWeekPlan => ({
    days: Array.from({ length: 7 }, (_, i) =>
      i === 0
        ? { sessions: [{ ...strength, exercises: [{ ref, sets: 3, rep_min: 6, rep_max: 10 }] }] }
        : { sessions: [rest] },
    ),
  });

  it("maps exercise refs to library ids and names", () => {
    const result = modelPlanToWeekPlan(model("e1"), refs);
    expect(result.ok).toBe(true);
    expect(result.ok && result.plan.days[0]!.sessions[0]).toMatchObject({ exercises: [{ exercise_id: refs.e1.id, name: "Barbell Squat" }] });
  });

  it("Given an exercise not in the user's library, Then the plan is structurally invalid", () => {
    const result = modelPlanToWeekPlan(model("e99"), refs);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.join(" ")).toMatch(/e99/);
  });
});

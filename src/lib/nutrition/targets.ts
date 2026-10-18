import { daysBetween } from "@/lib/activities/dates";
import type { GoalPhase } from "@/lib/body/goals";
import { ageOn } from "@/lib/time";

/**
 * Deterministic daily energy and macro targets (design D2). Pure: the loader in
 * src/server/nutrition/targets.ts assembles the inputs. The LLM never sets targets.
 */

export type Lifestyle = "sedentary" | "lightly_active" | "active";
export const NEAT_FACTORS: Record<Lifestyle, number> = { sedentary: 1.2, lightly_active: 1.35, active: 1.5 };
export const LIFESTYLE_LABELS: Record<Lifestyle, string> = { sedentary: "sedentary", lightly_active: "lightly active", active: "active" };

export type ActivityInput = { id: string; sport: string; label: string; startedAt: string; durationS: number; activeKcal: number | null };
/** Open sessions of today's active training plan, estimated by add-coach until recorded. */
export type PlannedSessionInput = { id: string; label: string; kcal: number; runMinutes: number };
export type StrengthSessionInput = { id: string; startedAt: string; endedAt: string };
export type AdaptiveStats = {
  completeDays: number;
  weighIns: number;
  meanIntakeKcal: number | null;
  /** Trend-weight change per day across the window (negative = losing). */
  trendChangeKgPerDay: number | null;
  meanExerciseKcal: number;
};
export type GoalInput = { phase: GoalPhase; rateKgPerWeek: number | null; goalWeightKg: number | null };

export type TargetInputs = {
  date: string;
  profile: { sex: "male" | "female" | null; birthDate: string | null; heightCm: number | null; lifestyle: Lifestyle };
  trendWeightKg: number | null;
  bodyFat: { pct: number; measuredOn: string } | null;
  goal: GoalInput | null;
  activities: ActivityInput[];
  strengthSessions: StrengthSessionInput[];
  plannedSessions?: PlannedSessionInput[];
  adaptive: AdaptiveStats;
};

export type MissingInput = "weight" | "sex" | "birth_date" | "height";
export type DayClass = "rest" | "run" | "long_run";
export type Targets = { kcal: number; protein_g: number; carb_g: number; fat_g: number; fiber_g: number };
export type Component = { key: string; label: string; kcal: number };
export type WarningCode = "bmr_floor" | "energy_availability_floor" | "carb_floor" | "rate_capped";
export type TargetWarning = { code: WarningCode; message: string };

export type TargetInfo = {
  bmr: number;
  bmrMethod: "Katch-McArdle" | "Mifflin-St Jeor";
  bmrNote: string | null;
  neatFactor: number;
  lifestyleLabel: string;
  formulaBaseline: number;
  expenditureMethod: "formula" | "adaptive";
  expenditureLabel: string;
  expenditureNote: string | null;
  observedTdee: number | null;
  exerciseKcal: number;
  maintenance: number;
  phase: GoalPhase;
  promptToSetGoal: boolean;
  refWeightKg: number;
  refWeightIsGoal: boolean;
  proteinPerKg: number;
  dayClass: DayClass;
  carbFloorGPerKg: number;
  ffmKg: number | null;
};

export type TargetsResult =
  | { ok: true; targets: Targets; components: Component[]; info: TargetInfo; warnings: TargetWarning[] }
  | { ok: false; missing: MissingInput[] };

const KCAL_PER_KG = 7700;
const BODY_FAT_MAX_AGE_DAYS = 90;
const MET_STRENGTH = 5;
const MAX_SESSION_HOURS = 3;
const ENERGY_AVAILABILITY_MIN = 30;
const ADAPTIVE_WINDOW_DAYS = 28;
const ADAPTIVE_MIN_COMPLETE_DAYS = 14;
const ADAPTIVE_MIN_WEIGH_INS = 10;
const CARB_FLOOR: Record<DayClass, number> = { rest: 3, run: 5, long_run: 6 };
const DAY_CLASS_LABELS: Record<DayClass, string> = { rest: "rest/easy day", run: "run day", long_run: "long-run day" };

// BMR ---------------------------------------------------------------------------

export type BmrResult =
  | { ok: true; bmr: number; method: TargetInfo["bmrMethod"]; note: string | null; leanMassKg: number | null; weightKg: number }
  | { ok: false; missing: MissingInput[] };

export function bmrFor(inputs: Pick<TargetInputs, "date" | "profile" | "trendWeightKg" | "bodyFat">): BmrResult {
  const { profile, trendWeightKg: w } = inputs;
  const missing: MissingInput[] = [];
  if (w === null) missing.push("weight");
  if (!profile.sex) missing.push("sex");
  if (!profile.birthDate) missing.push("birth_date");
  if (profile.heightCm === null) missing.push("height");
  if (missing.length > 0 || w === null) return { ok: false, missing };

  const bf = inputs.bodyFat;
  const bfAge = bf ? daysBetween(bf.measuredOn, inputs.date) : null;
  if (bf && bfAge !== null && bfAge <= BODY_FAT_MAX_AGE_DAYS) {
    const leanMassKg = w * (1 - bf.pct / 100);
    return { ok: true, bmr: 370 + 21.6 * leanMassKg, method: "Katch-McArdle", note: null, leanMassKg, weightKg: w };
  }
  const age = ageOn(profile.birthDate!, inputs.date);
  const bmr = 10 * w + 6.25 * profile.heightCm! - 5 * age + (profile.sex === "male" ? 5 : -161);
  const note = bf ? "Your latest body fat measurement is older than 90 days, so height, weight and age are used." : null;
  return { ok: true, bmr, method: "Mifflin-St Jeor", note, leanMassKg: null, weightKg: w };
}

// Exercise energy -----------------------------------------------------------------

export type ExerciseItem = { id: string; label: string; kcal: number; kind: "activity" | "strength_estimate" };

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd;

/** Watch active kcal, plus a 5-MET estimate for logged strength sessions no kcal-bearing activity overlaps. */
export function exerciseEnergy(activities: ActivityInput[], sessions: StrengthSessionInput[], weightKg: number) {
  const items: ExerciseItem[] = activities
    .filter((a) => a.activeKcal !== null && a.activeKcal > 0)
    .map((a) => ({ id: a.id, label: a.label, kcal: a.activeKcal!, kind: "activity" as const }));

  const measured = activities
    .filter((a) => a.activeKcal !== null && a.activeKcal > 0)
    .map((a) => {
      const start = Date.parse(a.startedAt);
      return [start, start + a.durationS * 1000] as const;
    });
  for (const s of sessions) {
    const start = Date.parse(s.startedAt);
    const end = Date.parse(s.endedAt);
    if (measured.some(([aStart, aEnd]) => overlaps(start, end, aStart, aEnd))) continue;
    const hours = Math.min(MAX_SESSION_HOURS, Math.max(0, end - start) / 3_600_000);
    if (hours === 0) continue;
    const minutes = Math.round(hours * 60);
    items.push({
      id: s.id,
      label: `Strength ${minutes} min (estimate: 5 MET × ${round1(weightKg)} kg × ${round2(hours)} h)`,
      kcal: MET_STRENGTH * weightKg * hours,
      kind: "strength_estimate",
    });
  }
  return { totalKcal: items.reduce((sum, i) => sum + i.kcal, 0), items };
}

// Adaptive expenditure ------------------------------------------------------------

export function adaptiveBaseline(stats: AdaptiveStats, formulaBaseline: number) {
  const completeDaysNeeded = Math.max(0, ADAPTIVE_MIN_COMPLETE_DAYS - stats.completeDays);
  const weighInsNeeded = Math.max(0, ADAPTIVE_MIN_WEIGH_INS - stats.weighIns);
  const eligible = completeDaysNeeded === 0 && weighInsNeeded === 0 && stats.meanIntakeKcal !== null && stats.trendChangeKgPerDay !== null;
  if (!eligible) {
    return { method: "formula" as const, baseline: formulaBaseline, weight: 0, observedTdee: null, completeDaysNeeded, weighInsNeeded };
  }
  const observedTdee = stats.meanIntakeKcal! - stats.trendChangeKgPerDay! * KCAL_PER_KG;
  const observedBaseline = observedTdee - stats.meanExerciseKcal;
  const weight = Math.min(1, stats.completeDays / ADAPTIVE_WINDOW_DAYS);
  return {
    method: "adaptive" as const,
    baseline: weight * observedBaseline + (1 - weight) * formulaBaseline,
    weight,
    observedTdee,
    completeDaysNeeded: 0,
    weighInsNeeded: 0,
  };
}

// Goal adjustment -----------------------------------------------------------------

export function goalAdjustment(maintenance: number, goal: GoalInput | null, weightKg: number) {
  if (!goal) return { kcal: 0, phase: "maintain" as GoalPhase, capped: false, promptToSetGoal: true };
  switch (goal.phase) {
    case "cut": {
      const rate = goal.rateKgPerWeek ? Math.abs(goal.rateKgPerWeek) : 0.005 * weightKg;
      const deficit = (rate * KCAL_PER_KG) / 7;
      const cap = 0.25 * maintenance;
      return { kcal: -Math.min(deficit, cap), phase: goal.phase, capped: deficit > cap, promptToSetGoal: false };
    }
    case "lean_gain":
      return { kcal: 250, phase: goal.phase, capped: false, promptToSetGoal: false };
    case "recomposition":
      return { kcal: -0.05 * maintenance, phase: goal.phase, capped: false, promptToSetGoal: false };
    case "maintain":
      return { kcal: 0, phase: goal.phase, capped: false, promptToSetGoal: false };
  }
}

// Safety floors -------------------------------------------------------------------

export function applyEnergyFloors(input: { targetKcal: number; bmr: number; exerciseKcal: number; ffmKg: number | null }) {
  const raises: { code: "bmr_floor" | "energy_availability_floor"; kcal: number }[] = [];
  let target = input.targetKcal;
  if (target < input.bmr) {
    raises.push({ code: "bmr_floor", kcal: input.bmr - target });
    target = input.bmr;
  }
  if (input.ffmKg !== null) {
    const minimum = input.exerciseKcal + ENERGY_AVAILABILITY_MIN * input.ffmKg;
    if (target < minimum) {
      raises.push({ code: "energy_availability_floor", kcal: minimum - target });
      target = minimum;
    }
  }
  return { targetKcal: target, raises };
}

// Macros --------------------------------------------------------------------------

export function dayClassFor(activities: ActivityInput[], plannedRunMinutes: number[] = []): DayClass {
  const longestRunMin = Math.max(0, ...activities.filter((a) => a.sport === "running").map((a) => a.durationS / 60), ...plannedRunMinutes);
  if (longestRunMin >= 90) return "long_run";
  if (longestRunMin >= 60) return "run";
  return "rest";
}

export function macroTargets(input: { targetKcal: number; weightKg: number; refWeightKg: number; phase: GoalPhase; dayClass: DayClass }) {
  const proteinPerKg = input.phase === "cut" || input.phase === "recomposition" ? 2.0 : 1.8;
  const protein_g = proteinPerKg * input.refWeightKg;
  const fat_g = Math.max((0.25 * input.targetKcal) / 9, 0.6 * input.weightKg);
  let carb_g = (input.targetKcal - 4 * protein_g - 9 * fat_g) / 4;
  let kcal = input.targetKcal;
  let carbFloorRaiseKcal = 0;
  const floor = CARB_FLOOR[input.dayClass] * input.weightKg;
  if (carb_g < floor) {
    carbFloorRaiseKcal = 4 * (floor - carb_g);
    kcal += carbFloorRaiseKcal;
    carb_g = floor;
  }
  return { protein_g, fat_g, carb_g, fiber_g: (14 * kcal) / 1000, kcal, carbFloorRaiseKcal, proteinPerKg };
}

// Composition ---------------------------------------------------------------------

export function computeDailyTargets(inputs: TargetInputs): TargetsResult {
  const bmr = bmrFor(inputs);
  if (!bmr.ok) return bmr;
  const w = bmr.weightKg;
  const warnings: TargetWarning[] = [];

  const neatFactor = NEAT_FACTORS[inputs.profile.lifestyle];
  const formulaBaseline = bmr.bmr * neatFactor;
  const adaptive = adaptiveBaseline(inputs.adaptive, formulaBaseline);
  const recorded = exerciseEnergy(inputs.activities, inputs.strengthSessions, w);
  const planned = inputs.plannedSessions ?? [];
  const exercise = {
    totalKcal: recorded.totalKcal + planned.reduce((sum, p) => sum + p.kcal, 0),
    items: [...recorded.items, ...planned.map((p) => ({ id: p.id, label: p.label, kcal: p.kcal, kind: "planned" as const }))],
  };
  const maintenance = adaptive.baseline + exercise.totalKcal;

  const goal = goalAdjustment(maintenance, inputs.goal, w);
  if (goal.capped) warnings.push({ code: "rate_capped", message: "Your goal rate was capped at a 25% deficit to protect muscle and training." });

  const floors = applyEnergyFloors({
    targetKcal: maintenance + goal.kcal,
    bmr: bmr.bmr,
    exerciseKcal: exercise.totalKcal,
    ffmKg: bmr.leanMassKg,
  });
  for (const raise of floors.raises) {
    warnings.push(
      raise.code === "bmr_floor"
        ? { code: raise.code, message: "Your target was raised to your BMR: eating below it isn't recommended." }
        : { code: raise.code, message: "Your target was raised to keep energy availability at 30 kcal per kg of lean mass (protects hormones, bones and recovery)." },
    );
  }

  const bodyFatPct = bmr.method === "Katch-McArdle" ? inputs.bodyFat!.pct : null;
  const highBodyFat = bodyFatPct !== null && bodyFatPct > (inputs.profile.sex === "male" ? 25 : 32);
  const refWeightIsGoal = highBodyFat && inputs.goal?.goalWeightKg != null;
  const refWeightKg = refWeightIsGoal ? inputs.goal!.goalWeightKg! : w;
  const dayClass = dayClassFor(inputs.activities, planned.map((p) => p.runMinutes));
  const macros = macroTargets({ targetKcal: floors.targetKcal, weightKg: w, refWeightKg, phase: goal.phase, dayClass });
  if (macros.carbFloorRaiseKcal > 0) {
    warnings.push({
      code: "carb_floor",
      message: `Carbs were raised to ${CARB_FLOOR[dayClass]} g/kg for a ${DAY_CLASS_LABELS[dayClass]}, adding ${Math.round(macros.carbFloorRaiseKcal)} kcal. Fuelling the session comes first; your weekly average stays on track.`,
    });
  }

  const targets: Targets = {
    kcal: Math.round(macros.kcal / 10) * 10,
    protein_g: Math.round(macros.protein_g),
    carb_g: Math.round(macros.carb_g),
    fat_g: Math.round(macros.fat_g),
    fiber_g: Math.round(macros.fiber_g),
  };

  // Every non-baseline component is rounded to whole kcal; the baseline absorbs the
  // rounding residue so the list always sums exactly to the displayed target.
  const others: Component[] = [
    ...exercise.items.map((i) => ({ key: `${i.kind === "planned" ? "planned" : "exercise"}:${i.id}`, label: i.label, kcal: Math.round(i.kcal) })),
    { key: "goal", label: goalLabel(goal.phase, goal.capped, inputs.goal === null), kcal: Math.round(goal.kcal) },
    ...floors.raises.map((r) => ({
      key: r.code,
      label: r.code === "bmr_floor" ? "Raised to BMR (floor)" : "Raised for energy availability (≥ 30 kcal/kg lean mass)",
      kcal: Math.round(r.kcal),
    })),
    ...(macros.carbFloorRaiseKcal > 0
      ? [{ key: "carb_floor", label: `${capitalize(DAY_CLASS_LABELS[dayClass])} carb floor (${CARB_FLOOR[dayClass]} g/kg)`, kcal: Math.round(macros.carbFloorRaiseKcal) }]
      : []),
  ];
  const baselineLabel =
    adaptive.method === "adaptive"
      ? "Everyday expenditure (adaptive, from your intake and weight trend)"
      : `Everyday expenditure (BMR × ${LIFESTYLE_LABELS[inputs.profile.lifestyle]} ${neatFactor})`;
  const components: Component[] = [
    { key: "baseline", label: baselineLabel, kcal: targets.kcal - others.reduce((s, c) => s + c.kcal, 0) },
    ...others,
  ];

  return {
    ok: true,
    targets,
    components,
    warnings,
    info: {
      bmr: Math.round(bmr.bmr),
      bmrMethod: bmr.method,
      bmrNote: bmr.note,
      neatFactor,
      lifestyleLabel: `${LIFESTYLE_LABELS[inputs.profile.lifestyle]} (${neatFactor})`,
      formulaBaseline: Math.round(formulaBaseline),
      expenditureMethod: adaptive.method,
      expenditureLabel: adaptive.method === "adaptive" ? "Adaptive (based on your data)" : "Formula",
      expenditureNote:
        adaptive.method === "adaptive"
          ? `Blended ${Math.round(adaptive.weight * 100)}% from your last 28 days of logs and weigh-ins.`
          : adaptiveNeeds(adaptive.completeDaysNeeded, adaptive.weighInsNeeded),
      observedTdee: adaptive.observedTdee === null ? null : Math.round(adaptive.observedTdee),
      exerciseKcal: Math.round(exercise.totalKcal),
      maintenance: Math.round(maintenance),
      phase: goal.phase,
      promptToSetGoal: goal.promptToSetGoal,
      refWeightKg: round1(refWeightKg),
      refWeightIsGoal,
      proteinPerKg: macros.proteinPerKg,
      dayClass,
      carbFloorGPerKg: CARB_FLOOR[dayClass],
      ffmKg: bmr.leanMassKg === null ? null : round1(bmr.leanMassKg),
    },
  };
}

function goalLabel(phase: GoalPhase, capped: boolean, noGoal: boolean): string {
  if (noGoal) return "Goal adjustment (no goal set: maintenance)";
  switch (phase) {
    case "cut":
      return capped ? "Cut deficit (capped at 25% of maintenance)" : "Cut deficit";
    case "lean_gain":
      return "Lean gain surplus";
    case "recomposition":
      return "Recomposition (−5%)";
    case "maintain":
      return "Maintain";
  }
}

function adaptiveNeeds(days: number, weighIns: number): string {
  const parts = [days > 0 ? `${days} more complete food-log day${days === 1 ? "" : "s"}` : null, weighIns > 0 ? `${weighIns} more weigh-in${weighIns === 1 ? "" : "s"}` : null].filter(Boolean);
  return parts.length > 0
    ? `Your expenditure will adapt to your real data after ${parts.join(" and ")} in the last 28 days.`
    : "Waiting for a weight trend to estimate your real expenditure.";
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const capitalize = (s: string) => s[0]!.toUpperCase() + s.slice(1);

import type { PlanSession, RunType, WeekPlan } from "./plan-schema";

/** Fallback when the user has no recent runs to derive an easy pace from (design D8). */
export const DEFAULT_EASY_PACE_MIN_PER_KM = 6.5;
export const MAJOR_MUSCLES = ["chest", "back", "shoulders", "quads", "hamstrings", "glutes", "core"] as const;

export type GuardrailContext = {
  prevAvgWeeklyKm: number;
  easyPaceMinPerKm: number;
  experience: { strength: string; running: string };
  maxSessionMin: number;
  daysPerWeek: number;
  /** exercise id → primary muscle groups */
  exerciseMuscles: Record<string, string[]>;
};

export type RuleId =
  | "volume"
  | "rest_day"
  | "easy_share"
  | "long_run_share"
  | "legs_before_quality"
  | "muscle_frequency"
  | "beginner_streak"
  | "session_length"
  | "training_days";

export type Violation = { rule: RuleId; message: string; dayIndexes: number[]; sessionIds: string[] };

export const RULE_TITLES: Record<RuleId, string> = {
  volume: "Weekly running volume",
  rest_day: "Rest day",
  easy_share: "80/20 intensity",
  long_run_share: "Long-run share",
  legs_before_quality: "Hard days hard, easy days easy",
  muscle_frequency: "Muscle-group frequency",
  beginner_streak: "Consecutive hard days",
  session_length: "Session length",
  training_days: "Training days",
};

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const EASY_RUNS: RunType[] = ["easy", "long", "recovery"];
const QUALITY_OR_LONG: RunType[] = ["long", "tempo", "intervals"];
const LOWER_FOCUS = ["lower", "legs", "full"];
const TRAINING_TYPES = ["strength", "run", "core"];

type Run = Extract<PlanSession, { type: "run" }>;
type Indexed = { session: PlanSession; day: number; id: string };

const round1 = (n: number) => Math.round(n * 10) / 10;
const sessionsOf = (plan: WeekPlan): Indexed[] =>
  plan.days.flatMap((d, day) => d.sessions.map((session, i) => ({ session, day, id: session.id ?? `${day}-${i}` })));

export const runKm = (r: Run, pace: number) => r.distance_km ?? (r.duration_min ?? 0) / pace;
export const runMinutes = (r: Run, pace: number) => r.duration_min ?? (r.distance_km ?? 0) * pace;
const isEasy = (r: Run) => EASY_RUNS.includes(r.run_type) || (r.hr_zone != null && r.hr_zone <= 2);
const isHardDay = (sessions: PlanSession[]) =>
  sessions.some((s) => s.type === "strength" || (s.type === "run" && QUALITY_OR_LONG.includes(s.run_type)));

export function planRunKm(plan: WeekPlan, ctx: Pick<GuardrailContext, "easyPaceMinPerKm">): number {
  return sessionsOf(plan)
    .filter((x): x is Indexed & { session: Run } => x.session.type === "run")
    .reduce((sum, x) => sum + runKm(x.session, ctx.easyPaceMinPerKm), 0);
}

export function volumeLimitKm(prevAvgWeeklyKm: number): number {
  return Math.max(prevAvgWeeklyKm * 1.1, prevAvgWeeklyKm + 3);
}

/** Deterministic safety rules (spec "Deterministic plan guardrails"); runs after generation, repair and every edit. */
export function validatePlan(plan: WeekPlan, ctx: GuardrailContext): Violation[] {
  const all = sessionsOf(plan);
  const runs = all.filter((x): x is Indexed & { session: Run } => x.session.type === "run");
  const pace = ctx.easyPaceMinPerKm;
  const violations: Violation[] = [];

  // 1. Volume ramp
  const totalKm = runs.reduce((s, x) => s + runKm(x.session, pace), 0);
  const limit = volumeLimitKm(ctx.prevAvgWeeklyKm);
  if (totalKm > limit + 1e-9) {
    violations.push({
      rule: "volume",
      message: `Rule 1: ${round1(totalKm)} km planned; your recent average is ${round1(ctx.prevAvgWeeklyKm)} km/week, so the limit is ${round1(limit)} km.`,
      dayIndexes: [...new Set(runs.map((x) => x.day))],
      sessionIds: runs.map((x) => x.id),
    });
  }

  // 2. At least one full rest day
  if (!plan.days.some((d) => d.sessions.every((s) => s.type === "rest"))) {
    violations.push({ rule: "rest_day", message: "Rule 2: the week has no full rest day.", dayIndexes: [], sessionIds: [] });
  }

  // 3. ≥ 80% of run time easy
  const runMin = runs.reduce((s, x) => s + runMinutes(x.session, pace), 0);
  const easyMin = runs.filter((x) => isEasy(x.session)).reduce((s, x) => s + runMinutes(x.session, pace), 0);
  if (runMin > 0 && easyMin / runMin < 0.8 - 1e-9) {
    const hard = runs.filter((x) => !isEasy(x.session));
    violations.push({
      rule: "easy_share",
      message: `Rule 3: only ${Math.round((easyMin / runMin) * 100)}% of run time is easy; at least 80% should be.`,
      dayIndexes: hard.map((x) => x.day),
      sessionIds: hard.map((x) => x.id),
    });
  }

  // 4. Long run ≤ 35% of weekly run distance
  for (const x of runs.filter((r) => r.session.run_type === "long")) {
    const km = runKm(x.session, pace);
    if (totalKm > 0 && km / totalKm > 0.35 + 1e-9) {
      violations.push({
        rule: "long_run_share",
        message: `Rule 4: long run ${round1(km)} km is ${Math.round((km / totalKm) * 100)}% of ${round1(totalKm)} km; max 35%.`,
        dayIndexes: [x.day],
        sessionIds: [x.id],
      });
    }
  }

  // 5. No lower-body lifting the day before a long, tempo or interval run
  for (const lift of all) {
    const s = lift.session;
    if (s.type !== "strength" || !LOWER_FOCUS.includes(s.focus) || lift.day === 6) continue;
    for (const next of runs.filter((r) => r.day === lift.day + 1 && QUALITY_OR_LONG.includes(r.session.run_type))) {
      violations.push({
        rule: "legs_before_quality",
        message: `Rule 5: "${s.title}" on ${DAY_NAMES[lift.day]} is the day before the ${next.session.run_type} run "${next.session.title}" on ${DAY_NAMES[next.day]}. Move the lifting after the run or make it upper-body.`,
        dayIndexes: [lift.day, next.day],
        sessionIds: [lift.id, next.id],
      });
    }
  }

  // 6. Each major muscle group on ≥ 2 days
  const daysByMuscle = new Map<string, Set<number>>(MAJOR_MUSCLES.map((m) => [m, new Set()]));
  for (const x of all) {
    const s = x.session;
    if (s.type === "core") daysByMuscle.get("core")!.add(x.day);
    if (s.type !== "strength" && s.type !== "core") continue;
    for (const e of s.exercises) for (const m of ctx.exerciseMuscles[e.exercise_id] ?? []) daysByMuscle.get(m)?.add(x.day);
  }
  const under = MAJOR_MUSCLES.filter((m) => daysByMuscle.get(m)!.size < 2);
  if (under.length > 0) {
    violations.push({
      rule: "muscle_frequency",
      message: `Rule 6: ${under.join(", ")} ${under.length === 1 ? "is" : "are"} trained on fewer than 2 days.`,
      dayIndexes: [],
      sessionIds: [],
    });
  }

  // 7. Beginners: at most 3 consecutive hard days
  if (ctx.experience.strength === "beginner" || ctx.experience.running === "beginner") {
    let streakStart = 0;
    let streak = 0;
    plan.days.forEach((d, i) => {
      if (isHardDay(d.sessions)) {
        if (streak === 0) streakStart = i;
        streak++;
        if (streak === 4) {
          const days = [streakStart, streakStart + 1, streakStart + 2, streakStart + 3];
          violations.push({
            rule: "beginner_streak",
            message: `Rule 7: ${DAY_NAMES[streakStart]}–${DAY_NAMES[i]} are 4+ hard days in a row; beginners should cap it at 3.`,
            dayIndexes: days,
            sessionIds: all.filter((x) => days.includes(x.day)).map((x) => x.id),
          });
        }
      } else {
        streak = 0;
      }
    });
  }

  // Generation requirements: session length and available days
  const tooLong = all.filter((x) => "duration_min" in x.session && x.session.duration_min != null && x.session.duration_min > ctx.maxSessionMin);
  if (tooLong.length > 0) {
    violations.push({
      rule: "session_length",
      message: `Sessions must fit your ${ctx.maxSessionMin}-minute maximum.`,
      dayIndexes: tooLong.map((x) => x.day),
      sessionIds: tooLong.map((x) => x.id),
    });
  }
  const trainingDays = plan.days.filter((d) => d.sessions.some((s) => TRAINING_TYPES.includes(s.type))).length;
  if (trainingDays > ctx.daysPerWeek) {
    violations.push({
      rule: "training_days",
      message: `${trainingDays} training days planned; you have ${ctx.daysPerWeek} available.`,
      dayIndexes: [],
      sessionIds: [],
    });
  }

  return violations;
}

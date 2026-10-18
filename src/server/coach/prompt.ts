import "server-only";
import { addDays } from "@/lib/activities/dates";
import type { PlanContext } from "@/lib/coach/context";
import { DEFAULT_EASY_PACE_MIN_PER_KM, volumeLimitKm } from "@/lib/coach/guardrails";
import { PHASE_INFO } from "@/lib/coach/phase";
import { WEEKDAYS } from "@/lib/coach/preferences";

export const PLAN_SYSTEM_PROMPT = `You are an experienced hybrid-athlete coach. Your athlete combines strength training with endurance running and is building toward a marathon. Write one training week as structured data.

Principles:
- Running: most running is easy (HR zone 1–2). At least 80% of run time easy; at most one or two quality sessions (tempo or intervals), and none for novice runners in the base phase. Keep the long run on the athlete's preferred day and at most 35% of the week's run distance. Never plan more weekly run distance than the stated limit.
- Hard days hard, easy days easy: never schedule lower-body or full-body lifting on the day before a long, tempo or interval run. Lower-body lifting fits best on the same day as, or the day after, a quality run.
- Strength: train every major muscle group (chest, back, shoulders, quads, hamstrings, glutes, core) on at least 2 days, mostly compound lifts, 2–4 working sets per exercise with rep ranges suited to the experience level. Include core work 2–3 times per week (a strength session's core exercises or a short core session).
- Recovery: at least one full rest day. Beginners get no more than 3 hard days in a row.
- Only schedule training on as many days as the athlete has available, and keep every session within their maximum session length.
- Pick strength and core exercises only from the provided list, using their refs (e.g. "e12"). Never invent exercises.
- Days are Monday first. A day with no training contains a single rest session. Give each session a short, specific title. Notes are optional, one sentence, practical.
- Runs need a distance (km) or a duration (minutes) and an HR zone (1–5) or a pace (m:ss per km).`;

export function planUserPrompt(ctx: PlanContext, exerciseLines: string[]): string {
  const days = WEEKDAYS.map((name, i) => `${name} ${addDays(ctx.weekStart, i)}`).join(", ");
  const limit = Math.round(volumeLimitKm(ctx.history.avgWeeklyRunKm) * 10) / 10;
  const pace = ctx.history.easyPaceMinPerKm ?? DEFAULT_EASY_PACE_MIN_PER_KM;
  return [
    `Plan week: ${days}.`,
    `Phase: ${PHASE_INFO[ctx.phase].label}: ${PHASE_INFO[ctx.phase].intent}`,
    ctx.race
      ? `Target race: ${ctx.race.distanceKm} km on ${ctx.race.date} (${ctx.weeksToRace} weeks away)${ctx.race.goalTime ? `, goal time ${ctx.race.goalTime}` : ""}.`
      : "No target race yet: build the aerobic base.",
    `Availability: ${ctx.preferences.daysPerWeek} training days, sessions at most ${ctx.preferences.maxSessionMin} minutes, long run on ${WEEKDAYS[ctx.preferences.longRunWeekday - 1]}, equipment: ${ctx.preferences.equipment}.`,
    `Experience: strength ${ctx.experience.strength}, running ${ctx.experience.running}. Body goal: ${ctx.goalPhase ?? "not set"}.`,
    `Last 4 weeks of running (oldest first, km): ${ctx.history.weeklyRunKm.join(", ")}; average ${ctx.history.avgWeeklyRunKm} km/week; longest run ${ctx.history.longestRunKm} km; ${ctx.history.runsPerWeek} runs/week; typical easy pace ${pace} min/km.`,
    `Maximum total run distance this week: ${limit} km.`,
    `Strength over the last 4 weeks: ${ctx.history.strengthSessionsPerWeek} sessions/week; working sets per muscle group per week: ${
      Object.entries(ctx.history.workingSetsPerMuscleWeek)
        .map(([m, n]) => `${m} ${n}`)
        .join(", ") || "none"
    }.`,
    "",
    "Exercises you may use (ref: name (primary muscles; equipment)):",
    ...exerciseLines,
  ].join("\n");
}

export function repairPrompt(previous: unknown, problems: string[]): string {
  return [
    "Your previous plan breaks these rules. Return a corrected, complete 7-day plan that fixes every problem while keeping the rest of the plan as similar as possible.",
    ...problems.map((p) => `- ${p}`),
    "",
    previous === null ? "The previous response could not be read as a plan." : `Previous plan:\n${JSON.stringify(previous)}`,
  ].join("\n");
}

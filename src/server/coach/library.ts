import "server-only";
import { MAJOR_MUSCLES } from "@/lib/coach/guardrails";
import type { ExerciseRefs } from "@/lib/coach/plan-schema";
import type { Db } from "@/server/body/weights";

const HOME_EQUIPMENT = new Set(["body only", "dumbbell", "kettlebells", "bands", "exercise ball", "medicine ball", "foam roll", "other"]);
const PLAN_CATEGORIES = new Set(["strength", "powerlifting"]);
const PER_MUSCLE = 8;
const EXTRA_GROUPS = ["biceps", "triceps", "calves"];

export type OfferedExercises = {
  refs: ExerciseRefs;
  /** exercise id → primary muscle groups (for the guardrails) */
  muscles: Record<string, string[]>;
  /** "e3: Goblet Squat (quads, glutes)" lines grouped by muscle, for the prompt */
  promptLines: string[];
};

type Row = {
  id: string;
  name: string;
  user_id: string | null;
  equipment: string | null;
  level: string | null;
  mechanic: string | null;
  category: string | null;
  exercise_muscles: { muscle_group: string; role: string }[];
};

/**
 * The closed exercise set the model may pick from (design D2): filtered by equipment,
 * ranked recent → custom → compound → level, capped per muscle group. Refs ("e1") keep
 * ids out of the prompt and make unknown picks detectable.
 */
export async function loadOfferedExercises(
  db: Db,
  opts: { equipment: "gym" | "home"; beginner: boolean; recentIds: Set<string> },
): Promise<OfferedExercises> {
  const { data, error } = await db
    .from("exercises")
    .select("id, name, user_id, equipment, level, mechanic, category, exercise_muscles(muscle_group, role)")
    .is("archived_at", null);
  if (error) throw error;

  const eligible = (data as Row[]).filter((r) => {
    if (r.user_id !== null) return true;
    if (!PLAN_CATEGORIES.has(r.category ?? "")) return false;
    if (opts.beginner && r.level === "expert") return false;
    return opts.equipment === "gym" || HOME_EQUIPMENT.has(r.equipment ?? "other");
  });
  const rank = (r: Row) => [
    opts.recentIds.has(r.id) ? 0 : 1,
    r.user_id !== null ? 0 : 1,
    r.mechanic === "compound" ? 0 : 1,
    r.level === "beginner" ? 0 : r.level === "intermediate" ? 1 : 2,
  ];
  const sorted = [...eligible].sort((a, b) => {
    const [ra, rb] = [rank(a), rank(b)];
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i]! - rb[i]!;
    return a.name.localeCompare(b.name);
  });
  const primaries = (r: Row) => r.exercise_muscles.filter((m) => m.role === "primary").map((m) => m.muscle_group);

  const chosen: Row[] = [];
  const seen = new Set<string>();
  for (const group of [...MAJOR_MUSCLES, ...EXTRA_GROUPS]) {
    const forGroup = sorted.filter((r) => primaries(r).includes(group) && (r.user_id !== null || !seen.has(r.id)));
    const picked = [...forGroup.filter((r) => r.user_id !== null), ...forGroup.filter((r) => r.user_id === null).slice(0, PER_MUSCLE)];
    for (const r of picked) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      chosen.push(r);
    }
  }

  const refs: ExerciseRefs = {};
  const muscles: Record<string, string[]> = {};
  const promptLines: string[] = [];
  chosen.forEach((r, i) => {
    const ref = `e${i + 1}`;
    refs[ref] = { id: r.id, name: r.name };
    muscles[r.id] = primaries(r);
    promptLines.push(`${ref}: ${r.name} (${primaries(r).join(", ")}${r.equipment ? `; ${r.equipment}` : ""})`);
  });
  return { refs, muscles, promptLines };
}

import "server-only";
import { formatSetsSummary } from "@/lib/workouts/history";
import { normaliseExerciseText } from "@/lib/workouts/normalise";
import { validateSetForMode } from "@/lib/workouts/set-schema";
import type { SetSource, TrackingMode } from "@/lib/workouts/types";
import { parseUtterance, type ParsedSet } from "@/lib/voice/parse";
import { isConfidentMatch } from "@/lib/voice/resolve";
import { MissingAiKeyError, withUserAnthropic } from "@/server/ai/client";
import type { Profile } from "@/server/auth";
import { aiParseUtterance, type AiCandidate, type AiParseInput, type DraftSet } from "./ai-parse";
import type { Db, SetRow } from "./db";
import { WorkoutError } from "./errors";
import { searchExercises } from "./exercises";
import { addSet, repeatLastSet } from "./sessions";

export type VoiceInput = { transcript: string; source: Extract<SetSource, "voice" | "text">; activeExerciseId?: string | null };
export type AiFallback = (input: AiParseInput) => Promise<{ exerciseId: string; sets: DraftSet[] } | null>;

export type SavedSet = Pick<SetRow, "id" | "exercise_id" | "set_number" | "weight_kg" | "reps" | "duration_s" | "distance_m"> & {
  exerciseName: string;
  trackingMode: TrackingMode;
  summary: string;
};
export type Draft = {
  /** Normalised exercise phrase; becomes a personal alias when the user confirms. */
  phrase: string | null;
  exerciseId: string | null;
  sets: DraftSet[];
  candidates: AiCandidate[];
  parsedBy: "grammar" | "ai";
  aiUnavailable: boolean;
};
export type VoiceOutcome = { status: "saved"; sets: SavedSet[] } | { status: "needs_confirmation"; draft: Draft } | { status: "nothing_to_repeat" };

/** The real fallback: Claude Haiku with the user's own key. */
export const userAiFallback =
  (userId: string): AiFallback =>
  (input) =>
    withUserAnthropic(userId, (client) => aiParseUtterance(client, input));

const toDraftSet = (s: ParsedSet): DraftSet => ({ weight_kg: s.weightKg, reps: s.reps, duration_s: s.durationS, distance_m: s.distanceM });

async function exerciseById(db: Db, id: string) {
  const { data } = await db.from("exercises").select("id, name, tracking_mode").eq("id", id).is("archived_at", null).maybeSingle();
  return data;
}

async function summarise(db: Db, sets: SetRow[], profile: Profile): Promise<SavedSet[]> {
  const ids = [...new Set(sets.map((s) => s.exercise_id))];
  const { data } = await db.from("exercises").select("id, name, tracking_mode").in("id", ids);
  return sets.map((s) => {
    const ex = data?.find((e) => e.id === s.exercise_id);
    return {
      id: s.id,
      exercise_id: s.exercise_id,
      set_number: s.set_number,
      weight_kg: s.weight_kg,
      reps: s.reps,
      duration_s: s.duration_s,
      distance_m: s.distance_m,
      exerciseName: ex?.name ?? "Exercise",
      trackingMode: ex?.tracking_mode ?? "weight_reps",
      summary: formatSetsSummary([s], profile.unit_system as "metric" | "imperial", ex?.tracking_mode),
    };
  });
}

async function saveSets(db: Db, profile: Profile, exerciseId: string, sets: DraftSet[], source: SetSource, transcript: string) {
  const saved: SetRow[] = [];
  for (const set of sets) saved.push(await addSet(db, profile, { exercise_id: exerciseId, ...set, source, transcript }));
  return summarise(db, saved, profile);
}

async function recentExercises(db: Db): Promise<AiCandidate[]> {
  const { data } = await db.from("workout_sets").select("exercises(id, name, tracking_mode)").order("occurred_at", { ascending: false }).limit(50);
  const seen = new Map<string, AiCandidate>();
  for (const row of data ?? []) if (row.exercises && !seen.has(row.exercises.id)) seen.set(row.exercises.id, row.exercises);
  return [...seen.values()].slice(0, 10);
}

const valuesValid = (mode: TrackingMode, sets: DraftSet[]) => sets.length > 0 && sets.every((s) => validateSetForMode(mode, s).success);

/**
 * One pipeline for spoken, dictated and typed phrases: grammar → alias → fuzzy match →
 * (optional) AI. Saves immediately only when the exercise and values are unambiguous.
 */
export async function processUtterance(db: Db, profile: Profile, input: VoiceInput, ai: AiFallback): Promise<VoiceOutcome> {
  const transcript = input.transcript.trim().slice(0, 500);
  const unit = profile.unit_system === "imperial" ? "lb" : "kg";
  const parsed = parseUtterance(transcript, { defaultUnit: unit });

  if (parsed.kind === "repeat") {
    try {
      const set = await repeatLastSet(db, profile, null, input.source, transcript);
      return { status: "saved", sets: await summarise(db, [set], profile) };
    } catch (e) {
      if (e instanceof WorkoutError && e.code === "nothing_to_repeat") return { status: "nothing_to_repeat" };
      throw e;
    }
  }

  const phrase = parsed.exerciseText ? normaliseExerciseText(parsed.exerciseText) : null;
  const sets = parsed.sets.map(toDraftSet);
  let exercise: AiCandidate | null = null;
  let confident = false;
  let candidates: AiCandidate[] = [];

  if (phrase) {
    const { data: alias } = await db.from("exercise_aliases").select("exercise_id").eq("phrase_normalised", phrase).maybeSingle();
    exercise = alias ? await exerciseById(db, alias.exercise_id) : null;
    confident = !!exercise;
    if (!exercise) {
      const matches = await searchExercises(db, { q: phrase, limit: 10 });
      candidates = matches.map(({ id, name, tracking_mode }) => ({ id, name, tracking_mode }));
      confident = isConfidentMatch(matches);
      exercise = confident ? candidates[0]! : null;
    }
  } else if (input.activeExerciseId) {
    exercise = await exerciseById(db, input.activeExerciseId);
    confident = !!exercise;
  }

  if (exercise && confident && parsed.complete && valuesValid(exercise.tracking_mode, sets)) {
    return { status: "saved", sets: await saveSets(db, profile, exercise.id, sets, input.source, transcript) };
  }

  const draft: Draft = {
    phrase,
    exerciseId: exercise?.id ?? null,
    sets,
    candidates: (exercise ? [exercise, ...candidates.filter((c) => c.id !== exercise!.id)] : candidates).slice(0, 3),
    parsedBy: "grammar",
    aiUnavailable: false,
  };

  const aiCandidates = [...candidates, ...(await recentExercises(db))].filter((c, i, all) => all.findIndex((x) => x.id === c.id) === i);
  if (aiCandidates.length > 0) {
    try {
      const active = input.activeExerciseId ? await exerciseById(db, input.activeExerciseId) : null;
      const result = await ai({ transcript, candidates: aiCandidates, activeExerciseName: active?.name ?? null, unit });
      if (result) {
        const chosen = aiCandidates.find((c) => c.id === result.exerciseId)!;
        draft.parsedBy = "ai";
        draft.exerciseId = chosen.id;
        draft.sets = result.sets;
        draft.candidates = [chosen, ...draft.candidates.filter((c) => c.id !== chosen.id)].slice(0, 3);
      }
    } catch (e) {
      if (!(e instanceof MissingAiKeyError)) draft.aiUnavailable = true;
    }
  }
  return { status: "needs_confirmation", draft };
}

export type Confirmation = {
  phrase: string | null;
  exerciseId: string;
  sets: DraftSet[];
  source: SetSource;
  transcript: string;
};

/** Saves a confirmed draft and learns the phrase as a personal alias for the chosen exercise. */
export async function confirmUtterance(db: Db, profile: Profile, c: Confirmation): Promise<VoiceOutcome> {
  const exercise = await exerciseById(db, c.exerciseId);
  if (!exercise) throw new WorkoutError("not_found", "Exercise not found");
  const errors = c.sets.map((s) => validateSetForMode(exercise.tracking_mode, s));
  const firstInvalid = errors.find((v) => !v.success);
  if (c.sets.length === 0 || firstInvalid) {
    throw new WorkoutError("invalid", "Check the set values.", firstInvalid && !firstInvalid.success ? firstInvalid.errors : undefined);
  }
  const saved = await saveSets(db, profile, exercise.id, c.sets, c.source, c.transcript);
  const phrase = c.phrase ? normaliseExerciseText(c.phrase) : "";
  if (phrase) {
    await db.from("exercise_aliases").upsert({ phrase_normalised: phrase, exercise_id: exercise.id }, { onConflict: "user_id,phrase_normalised" });
  }
  return { status: "saved", sets: saved };
}

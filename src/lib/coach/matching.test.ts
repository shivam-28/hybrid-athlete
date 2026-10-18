import { describe, expect, it } from "vitest";
import { matchCompletions, type CompletionItem, type OpenSession } from "./matching";

const session = (id: string, local_date: string, type: OpenSession["type"], day_index = 0, position = 0): OpenSession => ({ id, local_date, type, day_index, position });
const item = (id: string, kind: CompletionItem["kind"], local_date: string, occurred_at = `${local_date}T08:00:00Z`): CompletionItem => ({ id, kind, local_date, occurred_at });

describe("matchCompletions", () => {
  it("Given a synced Tuesday run and a planned Tuesday easy run, Then the run completes it", () => {
    expect(matchCompletions([session("p1", "2026-10-20", "run")], [item("a1", "run", "2026-10-20")])).toEqual([{ sessionId: "p1", item: item("a1", "run", "2026-10-20") }]);
  });

  it("Given a workout on the same date, Then a strength or core session completes", () => {
    expect(matchCompletions([session("s", "2026-10-21", "strength")], [item("w", "workout", "2026-10-21")])[0]?.sessionId).toBe("s");
    expect(matchCompletions([session("c", "2026-10-21", "core")], [item("w", "workout", "2026-10-21")])[0]?.sessionId).toBe("c");
  });

  it("Given a planned Wednesday strength session and a Thursday workout, Then nothing matches", () => {
    expect(matchCompletions([session("s", "2026-10-21", "strength")], [item("w", "workout", "2026-10-22")])).toEqual([]);
  });

  it("Given incompatible kinds, Then nothing matches (a workout never completes a run)", () => {
    expect(matchCompletions([session("r", "2026-10-21", "run")], [item("w", "workout", "2026-10-21")])).toEqual([]);
    expect(matchCompletions([session("m", "2026-10-21", "mobility")], [item("a", "run", "2026-10-21")])).toEqual([]);
  });

  it("Given two compatible sessions, Then the earliest incomplete one wins and each item completes only one", () => {
    const sessions = [session("late", "2026-10-21", "core", 2, 1), session("early", "2026-10-21", "strength", 2, 0)];
    expect(matchCompletions(sessions, [item("w", "workout", "2026-10-21")])).toEqual([{ sessionId: "early", item: item("w", "workout", "2026-10-21") }]);
  });

  it("Given two workouts on a day with two compatible sessions, Then each completes one, in time order", () => {
    const sessions = [session("a", "2026-10-21", "strength", 2, 0), session("b", "2026-10-21", "core", 2, 1)];
    const items = [item("w2", "workout", "2026-10-21", "2026-10-21T18:00:00Z"), item("w1", "workout", "2026-10-21", "2026-10-21T07:00:00Z")];
    expect(matchCompletions(sessions, items).map((m) => [m.sessionId, m.item.id])).toEqual([
      ["a", "w1"],
      ["b", "w2"],
    ]);
  });
});

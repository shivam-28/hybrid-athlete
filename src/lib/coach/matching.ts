export type OpenSession = { id: string; local_date: string; type: "strength" | "run" | "core" | "mobility" | "rest"; day_index: number; position: number };
export type CompletionItem = { id: string; kind: "workout" | "run"; local_date: string; occurred_at: string };
export type Completion = { sessionId: string; item: CompletionItem };

const COMPATIBLE: Record<CompletionItem["kind"], OpenSession["type"][]> = {
  workout: ["strength", "core"],
  run: ["run"],
};

/**
 * Design D6: each logged workout or recorded run completes the earliest incomplete
 * compatible planned session on the same local date; one item completes at most one session.
 */
export function matchCompletions(open: OpenSession[], items: CompletionItem[]): Completion[] {
  const remaining = [...open].sort((a, b) => a.local_date.localeCompare(b.local_date) || a.day_index - b.day_index || a.position - b.position);
  const matches: Completion[] = [];
  for (const item of [...items].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))) {
    const idx = remaining.findIndex((s) => s.local_date === item.local_date && COMPATIBLE[item.kind].includes(s.type));
    if (idx === -1) continue;
    matches.push({ sessionId: remaining[idx]!.id, item });
    remaining.splice(idx, 1);
  }
  return matches;
}

/** Starting values from design D3, checked against the fixture corpus and seeded library. */
export const MATCH_CONFIDENCE = { minScore: 0.55, minLead: 0.1 } as const;

export type ScoredCandidate = { id: string; name: string; score: number };

/** A fuzzy match is confident when the top candidate is good enough and clearly ahead of the runner-up. */
export function isConfidentMatch(candidates: ScoredCandidate[]): boolean {
  const [top, second] = candidates;
  if (!top || top.score < MATCH_CONFIDENCE.minScore) return false;
  return !second || top.score - second.score >= MATCH_CONFIDENCE.minLead - 1e-9;
}

/** Remaining amount, or a positive "over" amount once the target is exceeded. */
export function remainingOrOver(target: number, eaten: number): { kind: "remaining" | "over"; amount: number } {
  const diff = Math.round(target - eaten);
  return diff >= 0 ? { kind: "remaining", amount: diff } : { kind: "over", amount: -diff };
}

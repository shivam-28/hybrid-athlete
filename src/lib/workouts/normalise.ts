const SYNONYMS: Record<string, string> = {
  db: "dumbbell",
  bb: "barbell",
  kb: "kettlebell",
  ohp: "overhead press",
};

/** "pull ups" / "pull-up" / "Pullups" all become "pullup"; "press ups" is the British "push-up". */
const COMPOUNDS: [RegExp, string][] = [
  [/\b(pull|chin|push|sit) ?ups?\b/g, "$1up"],
  [/\bpress ?ups?\b/g, "pushup"],
];

function singular(word: string): string {
  return word.length > 3 && word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us") ? word.slice(0, -1) : word;
}

/**
 * Canonical form of an exercise name or spoken phrase, used for both stored
 * search names and queries so trigram matching compares like with like.
 */
export function normaliseExerciseText(text: string): string {
  let s = text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  for (const [pattern, replacement] of COMPOUNDS) s = s.replace(pattern, replacement);
  return s
    .split(" ")
    .filter(Boolean)
    .flatMap((word) => (SYNONYMS[word] ?? singular(word)).split(" "))
    .join(" ");
}

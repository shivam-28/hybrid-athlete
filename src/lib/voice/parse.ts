import { lbToKg } from "@/lib/units";

export type ParsedSet = { weightKg: number | null; reps: number | null; durationS: number | null; distanceM: number | null };

export type ParseResult =
  | { kind: "repeat" }
  | {
      kind: "sets";
      /** Words left after removing numbers, units and filler; null when none. */
      exerciseText: string | null;
      sets: ParsedSet[];
      bodyweight: boolean;
      /** Some value was found and every number was explained by the grammar. */
      complete: boolean;
    };

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const ORDINAL_WORDS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
};
/** Speech-to-text confusions, only trusted right before a unit or "reps". */
const HOMOPHONES: Record<string, number> = { for: 4, to: 2, too: 2, ate: 8, won: 1 };

const KG = new Set(["kg", "kgs", "kilo", "kilos", "kilogram", "kilograms"]);
const LB = new Set(["lb", "lbs", "pound", "pounds"]);
const REPS = new Set(["rep", "reps", "repetition", "repetitions", "times"]);
const SECONDS = new Set(["s", "sec", "secs", "second", "seconds"]);
const MINUTES = new Set(["min", "mins", "minute", "minutes"]);
const METERS = new Set(["m", "meter", "meters", "metre", "metres"]);
const KILOMETERS = new Set(["km", "kms", "kilometer", "kilometers", "kilometre", "kilometres"]);
const UNIT_WORDS = new Set([...KG, ...LB, ...REPS, ...SECONDS, ...MINUTES, ...METERS, ...KILOMETERS]);

const FILLER = new Set([
  "done", "at", "with", "and", "of", "please", "the", "a", "an", "i", "did", "just", "ok", "okay", "so", "then", "now",
  "for", "on", "my", "set", "sets", "last", "next", "another", "um", "uh", "like", "plus", "x", "that", "this", "is", "it", "them",
]);

const REPEAT_PHRASES = new Set([
  "same again", "same", "again", "repeat", "repeat last", "repeat again", "one more", "one more time", "same as before",
  "same as last", "ditto",
]);
const REPEAT_IGNORED = new Set(["please", "done", "that", "the", "set", "ok", "okay"]);

type Token = { word: string; num?: number; ordinal?: boolean };

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/(\d+)\s*(st|nd|rd|th)\b/g, " #$1 ")
    .replace(/(\d)\s*x\s*(\d)/g, "$1 x $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(?<!\d)\.|\.(?!\d)/g, " ")
    .replace(/[^a-z0-9.#]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

const isNumberWord = (w: string) => w in ONES || w in TENS || w === "hundred";

/** Folds digits and spoken numbers ("one hundred and twenty", "twelve point five", "sixty two and a half") into numeric tokens. */
function foldNumbers(words: string[]): Token[] {
  const out: Token[] = [];
  let i = 0;
  const at = (k: number) => words[k] ?? "";
  while (i < words.length) {
    const w = at(i);
    if (w.startsWith("#")) {
      out.push({ word: w, num: Number(w.slice(1)), ordinal: true });
      i++;
      continue;
    }
    const startsNumber = /^\d+(\.\d+)?$/.test(w) || isNumberWord(w) || (w === "a" && at(i + 1) === "hundred");
    if (!startsNumber) {
      out.push({ word: w });
      i++;
      continue;
    }
    let value = 0;
    let current = 0;
    let consumed = false;
    while (i < words.length) {
      const t = at(i);
      if (/^\d+(\.\d+)?$/.test(t) && !consumed) current = Number(t);
      else if (t === "a" && at(i + 1) === "hundred" && !consumed) current = 1;
      else if (t in ONES && (current % 10 === 0 || !consumed) && current < 100) current += ONES[t]!;
      else if (t in TENS && current % 100 === 0) current += TENS[t]!;
      else if (t === "hundred") current = (current || 1) * 100;
      else if (t === "and" && at(i - 1) === "hundred" && (at(i + 1) in ONES || at(i + 1) in TENS)) {
        i++;
        continue;
      } else if (t === "point" && (/^\d+$/.test(at(i + 1)) || at(i + 1) in ONES)) {
        const d = /^\d+$/.test(at(i + 1)) ? at(i + 1) : String(ONES[at(i + 1)]);
        current = Number(`${current}.${d}`);
        i += 2;
        consumed = true;
        continue;
      } else if (t === "and" && at(i + 1) === "a" && at(i + 2) === "half") {
        current += 0.5;
        i += 3;
        continue;
      } else break;
      // digits are a complete number on their own; words keep combining
      consumed = /^\d/.test(t) || consumed;
      i++;
      if (/^\d/.test(t)) break;
    }
    value += current;
    out.push({ word: String(value), num: value });
  }
  return out;
}

function detectRepeat(words: string[]): boolean {
  const core = words.filter((w) => !REPEAT_IGNORED.has(w)).join(" ");
  return REPEAT_PHRASES.has(core);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function parseUtterance(transcript: string, options: { defaultUnit: "kg" | "lb" }): ParseResult {
  const words = tokenize(transcript);
  if (detectRepeat(words)) return { kind: "repeat" };

  const tokens = foldNumbers(words);
  const toKg = (n: number, unit: "kg" | "lb") => (unit === "kg" ? n : lbToKg(n));
  const hasWeightUnit = tokens.some((t) => KG.has(t.word) || LB.has(t.word));

  let weightKg: number | null = null;
  let reps: number | null = null;
  let durationS: number | null = null;
  let distanceM: number | null = null;
  let setCount = 1;
  let bodyweight = false;
  let conflicts = 0;
  const setWeight = (kg: number) => {
    if (weightKg !== null) conflicts++;
    weightKg = kg;
  };
  const setReps = (n: number) => {
    if (reps !== null) conflicts++;
    reps = n;
  };
  const bare: number[] = [];
  const exerciseWords: string[] = [];

  const numberAt = (k: number): number | undefined => {
    const t = tokens[k];
    if (!t || t.ordinal) return undefined;
    if (t.num !== undefined) return t.num;
    const next = tokens[k + 1]?.word ?? "";
    return t.word in HOMOPHONES && UNIT_WORDS.has(next) ? HOMOPHONES[t.word] : undefined;
  };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    const next = tokens[i + 1]?.word ?? "";

    if (t.word === "bodyweight" || (t.word === "body" && next === "weight")) {
      bodyweight = true;
      if (t.word === "body") i++;
      continue;
    }
    // Ordinals and set numbers carry no value: "1st set", "second set", "set two"
    if ((t.ordinal || t.word in ORDINAL_WORDS) && next === "set") {
      i++;
      continue;
    }
    if (t.ordinal) continue;
    if (t.word === "set" && numberAt(i + 1) !== undefined && !UNIT_WORDS.has(tokens[i + 2]?.word ?? "")) {
      i++;
      continue;
    }

    const n = numberAt(i);
    if (n === undefined) {
      if (!FILLER.has(t.word) && !UNIT_WORDS.has(t.word)) exerciseWords.push(t.word);
      continue;
    }

    // "3 sets of 10", "three sets of eight"
    if ((next === "sets" || next === "set") && tokens[i + 2]?.word === "of") {
      setCount = n;
      i += 2;
      continue;
    }
    // "60 x 8" (weight × reps) or "3x8" (sets × reps when a weight unit is said elsewhere)
    if (next === "x" && numberAt(i + 2) !== undefined && !UNIT_WORDS.has(tokens[i + 3]?.word ?? "-")) {
      const m = numberAt(i + 2)!;
      if (hasWeightUnit) {
        setCount = n;
        setReps(m);
      } else {
        setWeight(toKg(n, options.defaultUnit));
        setReps(m);
      }
      i += 2;
      continue;
    }
    if (KG.has(next) || LB.has(next)) {
      setWeight(toKg(n, KG.has(next) ? "kg" : "lb"));
      i++;
      continue;
    }
    if (REPS.has(next)) {
      setReps(n);
      i++;
      continue;
    }
    if (SECONDS.has(next)) {
      durationS = (durationS ?? 0) + n;
      i++;
      continue;
    }
    if (MINUTES.has(next)) {
      durationS = (durationS ?? 0) + n * 60;
      i++;
      // "1 minute 30": a trailing bare number is seconds
      const after = numberAt(i + 1);
      if (after !== undefined && after < 60 && !UNIT_WORDS.has(tokens[i + 2]?.word ?? "")) {
        durationS += after;
        i++;
      }
      continue;
    }
    if (METERS.has(next) || KILOMETERS.has(next)) {
      distanceM = KILOMETERS.has(next) ? n * 1000 : n;
      i++;
      continue;
    }
    // "12 kg x 15": x then number after a unit
    if (tokens[i - 1]?.word === "x" && reps === null) {
      reps = n;
      continue;
    }
    bare.push(n);
  }

  // Bare numbers: "60 kg 8" → reps; "60 8" → weight then reps; "pull ups 10" → reps.
  let unexplained = conflicts;
  if (bare.length === 2 && weightKg === null && reps === null && !bodyweight) {
    weightKg = toKg(bare[0]!, options.defaultUnit);
    reps = bare[1]!;
  } else if (bare.length === 1 && reps === null) {
    reps = bare[0]!;
    if (weightKg === null && !bodyweight && durationS === null && distanceM === null) unexplained += 1;
  } else {
    unexplained += bare.length;
  }

  const anyValue = weightKg !== null || reps !== null || durationS !== null || distanceM !== null;
  const set: ParsedSet = {
    weightKg: weightKg === null ? null : round2(weightKg),
    reps,
    durationS,
    distanceM,
  };
  return {
    kind: "sets",
    exerciseText: exerciseWords.length > 0 ? exerciseWords.join(" ") : null,
    sets: anyValue ? Array.from({ length: Math.max(1, Math.min(setCount, 10)) }, () => ({ ...set })) : [],
    bodyweight,
    complete: anyValue && unexplained === 0,
  };
}

import type { ParsedSet } from "./parse";

export type Fixture = {
  say: string;
  defaultUnit?: "kg" | "lb";
  expect:
    | { repeat: true }
    | { exercise: string | null; sets: ParsedSet[]; bodyweight?: boolean; complete?: boolean };
  /** Phrases the grammar is not expected to fully handle (the AI fallback's job). */
  gap?: boolean;
};

const s = (weightKg: number | null, reps: number | null, durationS: number | null = null, distanceM: number | null = null): ParsedSet => ({
  weightKg,
  reps,
  durationS,
  distanceM,
});
const times = (n: number, set: ParsedSet) => Array.from({ length: n }, () => set);

export const FIXTURES: Fixture[] = [
  // Spec scenarios
  { say: "shoulder bench press 1st set 12 kg 15 reps done", expect: { exercise: "shoulder bench press", sets: [s(12, 15)] } },
  { say: "15 reps at 12 kilos", expect: { exercise: null, sets: [s(12, 15)] } },
  { say: "curls 35 pounds 12 reps", expect: { exercise: "curls", sets: [s(15.88, 12)] } },
  { say: "plank 60 seconds", expect: { exercise: "plank", sets: [s(null, null, 60)] } },
  { say: "bodyweight pull ups 8 reps", expect: { exercise: "pull ups", sets: [s(null, 8)], bodyweight: true } },
  { say: "3 sets of 10 at 20 kg lunges", expect: { exercise: "lunges", sets: times(3, s(20, 10)) } },
  { say: "same again", expect: { repeat: true } },
  { say: "squat 60 kg 8 reps", expect: { exercise: "squat", sets: [s(60, 8)] } },
  { say: "shoulder bench press 14 kg 10 reps", expect: { exercise: "shoulder bench press", sets: [s(14, 10)] } },
  {
    say: "did twelve on the overhead dumbbell thing with the twelves, fifteen of them",
    expect: { exercise: "overhead dumbbell thing twelves them", sets: [s(12, 15)] },
    gap: true,
  },

  // Unit synonyms
  { say: "bench press 50 kilograms 8 reps", expect: { exercise: "bench press", sets: [s(50, 8)] } },
  { say: "bench press 50 kgs 8 reps", expect: { exercise: "bench press", sets: [s(50, 8)] } },
  { say: "bench press 50 kilo 8 reps", expect: { exercise: "bench press", sets: [s(50, 8)] } },
  { say: "deadlift 100kg 5 reps", expect: { exercise: "deadlift", sets: [s(100, 5)] } },
  { say: "deadlift 225 lbs 5 reps", expect: { exercise: "deadlift", sets: [s(102.06, 5)] } },
  { say: "deadlift 225 lb 5 reps", expect: { exercise: "deadlift", sets: [s(102.06, 5)] } },
  { say: "row 45 pound 10 reps", expect: { exercise: "row", sets: [s(20.41, 10)] } },
  { say: "lateral raise 7.5 kg 12 reps", expect: { exercise: "lateral raise", sets: [s(7.5, 12)] } },
  { say: "lateral raise twelve point five kilos 10 reps", expect: { exercise: "lateral raise", sets: [s(12.5, 10)] } },
  { say: "squat sixty two and a half kilos five reps", expect: { exercise: "squat", sets: [s(62.5, 5)] } },

  // Number words and ordinals
  { say: "squat sixty kilos eight reps", expect: { exercise: "squat", sets: [s(60, 8)] } },
  { say: "bench twenty five kg twelve reps", expect: { exercise: "bench", sets: [s(25, 12)] } },
  { say: "leg press one hundred and twenty kilos ten reps", expect: { exercise: "leg press", sets: [s(120, 10)] } },
  { say: "leg press a hundred kilos ten reps", expect: { exercise: "leg press", sets: [s(100, 10)] } },
  { say: "second set squat 60 kg 8 reps", expect: { exercise: "squat", sets: [s(60, 8)] } },
  { say: "set two squat 60 kg 8 reps", expect: { exercise: "squat", sets: [s(60, 8)] } },
  { say: "squat set 3 60 kg 8 reps", expect: { exercise: "squat", sets: [s(60, 8)] } },
  { say: "third set 62.5 kg 6 reps", expect: { exercise: null, sets: [s(62.5, 6)] } },
  { say: "Squat, 60 kg, 8 reps.", expect: { exercise: "squat", sets: [s(60, 8)] } },

  // Homophones in numeric slots
  { say: "squat 60 kg for reps", expect: { exercise: "squat", sets: [s(60, 4)] } },
  { say: "squat 60 kg to reps", expect: { exercise: "squat", sets: [s(60, 2)] } },
  { say: "squat 60 kg ate reps", expect: { exercise: "squat", sets: [s(60, 8)] } },
  { say: "row for 10 reps at 40 kg", expect: { exercise: "row", sets: [s(40, 10)] } },

  // Shorthand
  { say: "squat 60 kg x 8", expect: { exercise: "squat", sets: [s(60, 8)] } },
  { say: "squat 60 x 8", expect: { exercise: "squat", sets: [s(60, 8)] } },
  { say: "squat 60 x 8", defaultUnit: "lb", expect: { exercise: "squat", sets: [s(27.22, 8)] } },
  { say: "squat 60 kg 8", expect: { exercise: "squat", sets: [s(60, 8)] } },
  { say: "squat 3x8 at 60 kg", expect: { exercise: "squat", sets: times(3, s(60, 8)) } },
  { say: "squat three sets of eight at sixty kilos", expect: { exercise: "squat", sets: times(3, s(60, 8)) } },
  { say: "2 sets of 12 reps 10 kg curls", expect: { exercise: "curls", sets: times(2, s(10, 12)) } },
  { say: "3 sets of 30 seconds plank", expect: { exercise: "plank", sets: times(3, s(null, null, 30)) } },

  // Durations and distances
  { say: "plank 1 minute 30", expect: { exercise: "plank", sets: [s(null, null, 90)] } },
  { say: "plank one minute thirty seconds", expect: { exercise: "plank", sets: [s(null, null, 90)] } },
  { say: "plank 2 minutes", expect: { exercise: "plank", sets: [s(null, null, 120)] } },
  { say: "side plank 45 secs", expect: { exercise: "side plank", sets: [s(null, null, 45)] } },
  { say: "wall sit ninety seconds done", expect: { exercise: "wall sit", sets: [s(null, null, 90)] } },
  { say: "farmers walk 40 meters 32 kg", expect: { exercise: "farmers walk", sets: [s(32, null, null, 40)] } },
  { say: "rowing 2 km 8 minutes", expect: { exercise: "rowing", sets: [s(null, null, 480, 2000)] } },
  { say: "weighted plank 20 kg 45 seconds", expect: { exercise: "weighted plank", sets: [s(20, null, 45)] } },

  // Bodyweight
  { say: "push ups 20 reps", expect: { exercise: "push ups", sets: [s(null, 20)] } },
  { say: "body weight dips 12 reps", expect: { exercise: "dips", sets: [s(null, 12)], bodyweight: true } },
  { say: "pull ups bodyweight 10", expect: { exercise: "pull ups", sets: [s(null, 10)], bodyweight: true } },
  { say: "pull ups plus 5 kg 6 reps", expect: { exercise: "pull ups", sets: [s(5, 6)] } },

  // Repeat phrases
  { say: "same again please", expect: { repeat: true } },
  { say: "repeat", expect: { repeat: true } },
  { say: "Same again, done.", expect: { repeat: true } },
  { say: "one more", expect: { repeat: true } },
  { say: "repeat last set", expect: { repeat: true } },

  // Fillers
  { say: "ok so I did squat 60 kg 8 reps done", expect: { exercise: "squat", sets: [s(60, 8)] } },
  { say: "just did 10 reps at 40 kilos", expect: { exercise: null, sets: [s(40, 10)] } },
  { say: "next set 42.5 kg 8 reps", expect: { exercise: null, sets: [s(42.5, 8)] } },

  // Incomplete
  { say: "squat", expect: { exercise: "squat", sets: [], complete: false } },
  { say: "squat 60", expect: { exercise: "squat", sets: [s(null, 60)], complete: false } },
  { say: "bench 50 kg", expect: { exercise: "bench", sets: [s(50, null)] } },
];

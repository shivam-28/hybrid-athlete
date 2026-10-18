## Why

Logging sets is the most frequent action in the app, and it happens mid-workout with sweaty hands and short rests. Tap-through forms are slow enough that people stop logging. Users need to say "shoulder press 1st set 12 kg 15 reps done" and have it recorded, with manual entry as the fallback. They also need a credible exercise library and a clear "what should I lift today" target so training keeps progressing.

## What Changes

- Exercise library seeded from the public-domain free-exercise-db (~870 exercises with muscles, equipment, instructions, images). The seed is idempotent, and the library has fuzzy search, muscle-group and equipment filters, and private custom exercises.
- Each exercise has a tracking mode (weight × reps, bodyweight reps, duration, distance/duration), so core holds like planks and loaded carries can be logged properly.
- Workout sessions tied to the user's local day, with sets (weight, reps, duration, distance, RPE, set type). Includes "repeat last set", editing and deleting sets, last-session numbers shown inline, session history, and per-exercise history.
- Weekly working-set volume per muscle group (secondary muscles count as half). `add-coach` uses it later.
- Voice and text logging. A deterministic grammar parses speech first, exercise names resolve through personal aliases then fuzzy matching, and Claude Haiku is used only when those fail. Unambiguous sets auto-save with undo; ambiguous ones show a confirmation card. Confirmed phrases become personal aliases.
- Rule-based progressive-overload suggestions (double progression, deload detection, baseline for new exercises). They are shown when an exercise is opened and never applied automatically.

## Non-goals

- Rest timer.
- Superset / circuit grouping UI.
- Offline logging queue.
- Sharing workouts with other users.
- Workout templates or planned sessions (arrive with `add-coach`).
- Importing strength sets recorded on a Garmin watch.
- Calorie estimation for strength sessions (owned by `add-nutrition`; this change only stores session duration).

## Capabilities

### New Capabilities

- `exercise-library`: Seeded and custom exercises, muscle-group mapping, tracking modes, search, filtering, exercise detail.
- `workout-logging`: Sessions, sets, validation, unit conversion, quick actions, history, weekly muscle-group volume.
- `voice-logging`: Speech/text capture, deterministic parsing, exercise resolution, AI fallback, auto-save vs confirmation, personal aliases.
- `progressive-overload`: Per-exercise rep ranges and increments, next-session target suggestions, deload detection.

### Modified Capabilities

_None._

## Impact

- New tables: `exercises`, `exercise_aliases`, `workout_sessions`, `workout_sets`, `exercise_settings`. RLS is on for all of them. Seeded exercises are readable by everyone, and custom rows are visible only to their owner.
- New seed script (`supabase/seed/exercises`) pulling free-exercise-db JSON pinned to a commit; images referenced from that repo, not re-hosted.
- New server routes for session/set CRUD and voice parsing. The voice route uses the user's BYO key via the `ai-key` capability from `add-foundation`.
- Depends on `add-foundation` (auth, profile units/timezone, ai-key, app shell Train tab).
- New dependency: a fuzzy-matching library (e.g. `fuse.js`) or Postgres `pg_trgm`, decided in design.md.

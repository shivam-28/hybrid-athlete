## 1. Schema and RLS

- [x] 1.1 Write RLS integration tests (Given two users / When each queries / Then isolation holds) for `exercises` (shared vs custom), `exercise_muscles`, `exercise_aliases`, `exercise_settings`, `workout_sessions`, `workout_sets`; plus an unauthenticated request to each workout route returns 401 via `requireUser()`; verify they fail before the migration exists
- [x] 1.2 Write migration enabling `pg_trgm` and creating the D1 tables following foundation D4 conventions (`user_id default auth.uid()` FK cascade, `occurred_at` + `local_date`, `(select auth.uid())` owner policies, `no action` FKs to `exercises`), enums, CHECK constraints (spec validation ranges), partial unique active-session index, deferred `(session_id, exercise_id, set_number)` unique constraint and RLS policies; verify 1.1 passes against local Supabase
- [x] 1.3 Write integration tests for `delete_set()` renumbering and `weekly_muscle_volume()` (primary 1.0, secondary 0.5, warm-ups excluded, ISO week in user timezone); verify they fail
- [x] 1.4 Implement `delete_set()` and `weekly_muscle_volume()` SQL functions (security invoker); verify 1.3 passes
- [x] 1.5 Append `exercises` (export filtered to own custom rows, nested `exercise_muscles`), `exercise_aliases`, `exercise_settings`, `workout_sessions`, `workout_sets` to `src/server/account/registry.ts`; verify the registry completeness test passes and an account-deletion integration test removes a user's custom exercises, sessions and sets while seeded exercises remain

## 2. Exercise library seed

- [x] 2.1 Write unit tests for the seed transform: source muscle → app group mapping table, `full body`/`cardio` rules, tracking-mode derivation order (override map, hold regex, cardio, body only, default); verify they fail
- [x] 2.2 Implement the pure transform module; verify 2.1 passes
- [x] 2.3 Write an integration test that runs the seed twice against a fixture dataset and asserts identical counts, stable ids, updated instructions and untouched user rows; verify it fails
- [x] 2.4 Implement `pnpm seed:exercises` (pinned free-exercise-db SHA, service-role upsert on `source_id`, muscles replaced in-transaction); verify 2.3 passes and a real run yields ≥ 800 exercises each with a primary group
- [x] 2.5 Add `images.remotePatterns` for the pinned raw GitHub path; verify an exercise image renders in `next build && next start`

## 3. Exercise search, detail and custom exercises

- [x] 3.1 Write unit tests for name normalisation (case, punctuation, singularisation, synonym expansion `db/bb/kb/ohp/pull ups/press ups`); verify they fail
- [x] 3.2 Implement normalisation; verify 3.1 passes
- [x] 3.3 Write integration tests for `match_exercises()` ("dumbel shoulder pres" returns Dumbbell Shoulder Press in top 5; custom exercises only visible to owner; archived hidden) and for muscle/equipment filters; verify they fail
- [x] 3.4 Implement `match_exercises()` SQL function plus trigram index and the search/filter route; verify 3.3 passes
- [x] 3.5 Write tests for custom exercise create/edit, delete-without-history (hard delete) and delete-with-history (archives); verify they fail
- [x] 3.6 Implement custom exercise routes and form; verify 3.5 passes
- [x] 3.7 Build library UI (search box, muscle/equipment filters, empty state offering "create custom", detail view with instructions, images, muscles, tracking mode); verify with a Playwright test searching, filtering and opening detail

## 4. Workout logging

- [x] 4.1 Write unit tests for set validation per tracking mode (required fields, ranges, RPE 0.5 steps) and unit conversion (35 lb → 15.88 kg; 15.88 kg displays 16 kg / 35 lb); verify they fail
- [x] 4.2 Implement shared Zod set schema and unit helpers; verify 4.1 passes
- [x] 4.3 Write integration tests for sessions: local-day assignment (00:30 Copenhagen → next day), single active session, auto-start on first set, finish, per-exercise set numbering, repeat-last-set, edit, cross-user not-found; verify they fail
- [x] 4.4 Implement session and set route handlers; verify 4.3 passes
- [x] 4.5 Write unit tests for previous-performance lookup and Epley best-set selection (50×10 beats 55×6); verify they fail
- [x] 4.6 Implement previous-performance and exercise-history queries; verify 4.5 passes
- [x] 4.7 Build Train UI: active session view, exercise picker, tracking-mode-aware set form, "last time" panel, repeat/edit/delete, finish session, session history list and detail, exercise history; verify with a Playwright test logging a 3-exercise session including a plank and a pull-up
- [x] 4.8 Show weekly muscle-group volume on Train; verify a component test renders values from `weekly_muscle_volume()` fixture data

## 5. Voice and text logging

- [x] 5.1 Create the fixture corpus (≥ 50 utterances including every voice-logging spec scenario, number words, homophones, lb/kg synonyms, durations, multi-set shorthand, "same again") with expected parses; write the parser test that also asserts the deterministic coverage baseline; verify it fails
- [x] 5.2 Implement the table-driven grammar parser; verify 5.1 passes and record the coverage baseline
- [x] 5.3 Write unit tests for the confidence rule (alias hit, score/lead thresholds) and the auto-save decision; verify they fail
- [x] 5.4 Implement resolution (alias lookup → `match_exercises()` → confidence); verify 5.3 passes
- [x] 5.5 Before writing AI code, consult the claude-api reference for current structured-output usage; write tests for the AI fallback with a mocked Anthropic client covering valid output, id-not-in-candidates, reps 0, timeout, provider error and no-key (no call made); verify they fail
- [x] 5.6 Implement the Haiku fallback (structured output, Zod validation, candidate check, 8 s timeout) using `getAnthropicClient(userId)` and the model-constants module, mapping `MissingAiKeyError` to the confirmation-card path; verify 5.5 passes
- [x] 5.7 Write route integration tests for `POST /api/workouts/voice` (saved / needs_confirmation / nothing_to_repeat, session auto-start, transcript + source stored) and `POST /api/workouts/voice/confirm` (saves, upserts alias, subsequent phrase auto-saves); verify they fail
- [x] 5.8 Implement both routes; verify 5.7 passes
- [x] 5.9 Build voice UI: mic control with runtime `SpeechRecognition` feature detection, always-visible text input, saved toast with Undo/Edit for ≥ 8 s, confirmation card with editable values and top-3 candidates, transcript shown on set detail; verify with a Playwright test using the text input path (ambiguous → confirm → alias → auto-save on repeat → undo)
- [x] 5.10 Build alias management in Settings (list + delete); verify a test that deleting an alias returns resolution to fuzzy matching

## 6. Progressive overload

- [x] 6.1 Write unit tests for `suggestNext()` covering every progressive-overload spec scenario (defaults by mechanic/equipment, user override, baseline, top-of-range increase, +1 rep, bodyweight → added weight, plank +5 s, two-drop deload, single drop no deload); verify they fail
- [x] 6.2 Implement `suggestNext()` as a pure function; verify 6.1 passes
- [x] 6.3 Write tests for `exercise_settings` override CRUD; verify they fail, then implement routes and settings UI and verify they pass
- [x] 6.4 Show the suggestion when an exercise is opened in a session without pre-filling values; verify with a component test that no set is created until the user logs one

## 7. Verification

- [x] 7.1 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`; verify all pass
- [ ] 7.2 Manually verify on an iPhone home-screen install: mic path (or graceful fallback), keyboard-dictation text path, auto-save toast, confirmation card; record findings in the PR description
- [x] 7.3 Run `openspec validate add-workout-logging --strict`; verify it passes

## 1. Data model

- [x] 1.1 Write RLS tests for `training_preferences`, `training_plans`, `planned_sessions` and `readiness_checkins` (user A cannot select, insert, update or delete user B's rows). Verify they fail before the migration exists
- [x] 1.2 Add a migration creating the four tables using the foundation D4 template (`id` PK, `user_id default auth.uid()` FK to `auth.users` on delete cascade, `occurred_at` + `local_date` on event tables, `created_at`/`updated_at`, `<table>_owner` policy with `(select auth.uid())`, `(user_id, local_date)` index), `unique (user_id)` on preferences, the partial unique index for one active plan per `(user_id, week_start)`, unique partial indexes on `planned_sessions.workout_session_id` and `activity_id`, and `unique (user_id, local_date)` on check-ins. Verify `supabase db reset` succeeds and the 1.1 tests pass
- [x] 1.3 Append `training_preferences`, `training_plans`, `planned_sessions` and `readiness_checkins` to `src/server/account/registry.ts`. Verify the foundation registry-completeness test passes, a user's export JSON contains the four tables, and account deletion leaves zero rows in them (cascade)
- [x] 1.4 Write an integration test for `accept_training_plan(plan_id)`: accepting a second plan for the same week supersedes the first, both remain queryable, and only one is active. Verify it fails first
- [x] 1.5 Implement the `accept_training_plan` SQL function (security invoker, single transaction) and verify the 1.3 test passes
- [x] 1.6 Regenerate Supabase TypeScript types and verify `pnpm typecheck` passes

## 2. Training preferences and phase

- [x] 2.1 Write unit tests for the preferences Zod schema (days 1–7, session length bounds, race distance enum/custom km, race date not in the past in the user's timezone). Verify they fail first
- [x] 2.2 Implement the preferences schema and verify the 2.1 tests pass
- [x] 2.3 Write unit tests for `derivePhase(raceDate, weekStart)` covering no race, >16, 16, 7, 6, 3, 2 and 0 weeks. Verify they fail first
- [x] 2.4 Implement `derivePhase` and verify the 2.3 tests pass
- [x] 2.5 Build the Coach → Preferences screen with save, edit and validation errors. Verify via a Playwright test that saving enables the generate action and that a past race date shows an error

## 3. Plan schema and guardrails (pure)

- [x] 3.1 Write unit tests for `WeekPlanSchema` (7 days; discriminated session types; strength focus and exercise ids with sets × rep range; run type with distance or duration and HR zone or pace; session length ≤ max). Verify they fail first
- [x] 3.2 Implement `WeekPlanSchema` and its JSON-schema export for the tool definition, and verify the 3.1 tests pass
- [x] 3.3 Write unit tests for each guardrail rule 1–7 with a passing and a failing fixture each, including the volume rule at 0, 5 and 20 km bases, duration-only runs converted at the recent or default easy pace, the long run on Sunday with legs on Saturday, and the beginner consecutive-days rule. Verify they fail first
- [x] 3.4 Implement `validatePlan(plan, context)` returning `Violation[]` (rule, message, day indexes, session ids) and verify the 3.3 tests pass
- [x] 3.5 Write unit tests for the structural check that rejects exercise ids not in the user's library or custom exercises. Verify they fail first, then implement it and verify they pass

## 4. Plan generation

- [x] 4.1 Write unit tests for `buildPlanContext` using fixture workouts and activities: weekly km for 4 weeks and their average, longest run, easy pace, sets per muscle group per week, phase, experience; no raw rows in the output. Verify they fail first
- [x] 4.2 Implement `buildPlanContext` and verify the 4.1 tests pass
- [x] 4.3 Consult the `claude-api` skill for current tool-use and structured-output usage, then write route tests for `POST /api/coach/plan` with `getAnthropicClient` mocked: compliant first response (1 call, no warnings); violating then compliant (2 calls, no warnings); violating twice (2 calls, draft saved with warnings); invalid twice (error, nothing saved); `MissingAiKeyError` (no-key response pointing to Settings, 0 calls); Anthropic 401 (maps to "key no longer valid"); no preferences (rejected). Verify they fail first
- [x] 4.4 Implement the route: auth, `getAnthropicClient(userId)` and `AI_MODELS.main` (no literal model strings), fetch context, filter the library by equipment, call `messages.parse` with structured output (`WeekPlanSchema` via `zodOutputFormat`), validate, make one repair call, and persist the draft and planned sessions with `local_date` derived from `week_start` + day index. Verify the 4.3 tests pass
- [ ] 4.5 Write the coach system prompt (hybrid principles, phase intent, 80/20, hard-days-hard, core 2–3×/week, closed exercise list) and verify with one manual generation against a real key that the output parses

## 5. Review, edit, accept

- [x] 5.1 Write a Playwright test for the plan review: draft shown with per-session warnings, an edit that creates a violation shows a warning immediately, accept is blocked until warnings are acknowledged, and accept makes the plan active. Verify it fails first
- [x] 5.2 Build the Coach → Plan screen (week view, session cards, edit and delete session, regenerate, accept with acknowledgement) using the shared client-side `validatePlan`, plus `POST /api/coach/plan/:id/accept` with server-side re-validation. Verify the 5.1 test passes
- [x] 5.3 Build the plan history list (active, superseded and draft by week) and verify it shows superseded plans after a re-accept

## 6. Today integration and auto-completion

- [x] 6.1 Write unit and integration tests for `matchPlannedSession`: a strength or core session completed by a workout on the same local date; a run completed by a running activity; no match across dates; one item completes at most one session; the earliest incomplete session wins; manual skip and undo. Verify they fail first
- [x] 6.2 Implement `matchPlannedSession` and call it after inserts in the workout-session save path, the Apple Health ingest route and FIT import. Verify the 6.1 tests pass and the existing ingest and FIT tests still pass
- [x] 6.3 Add today's planned sessions (with mark-complete, skip and undo) to the Today view and verify via Playwright that syncing a fixture run marks the planned run complete

## 7. Daily readiness

- [x] 7.1 Write unit tests for the check-in Zod schema (1–5 bounds, optional pain note). Verify they fail first, then implement it and verify they pass
- [x] 7.2 Write unit tests for `computeBaseline` (28-day window ending yesterday, mean and population SD, unavailable below 14 values) and for each signal threshold (sleep < 85% or < 6 h, RHR +5, HRV −1 SD, ACWR > 1.5 and < 0.8 note, ACWR unavailable when activity-history has no ratio). Verify they fail first
- [x] 7.3 Implement baselines and signals, reading ACWR from the activity-history module, and verify the 7.2 tests pass
- [x] 7.4 Write unit tests for `scoreReadiness` covering every scenario in the daily-readiness spec (subjective-only green, one signal makes amber, pain forces red, mean 2.75 with 2 signals is red, any item = 1 is amber, mean ≤ 2.0 is red) and reasons text. Verify they fail first
- [x] 7.5 Implement `scoreReadiness` and verify the 7.4 tests pass
- [x] 7.6 Write unit tests for `adjustSession` (green unchanged; amber: tempo or intervals → easy with the same duration, long −25%, strength −1 set with RPE cap 8, core and mobility unchanged; red → rest, mobility or walk ≤ 30 min). Verify they fail first, then implement and verify they pass
- [x] 7.7 Write a test that readiness scoring, session adjustment and check-in submission succeed for a user with no AI key (no call to `getAnthropicClient`). Verify it passes
- [x] 7.8 Build the Today readiness card (5-tap check-in, score with reasons, proposed adjustment beside the original, accept or override, pain → professional-referral message) with an upsert route. Verify via Playwright that resubmitting replaces the score and that override keeps the original session

## 8. Nutrition link

- [x] 8.1 Write unit tests for `estimatePlannedEnergy` (run by distance and by duration with the pace fallback, strength 5 MET, core and mobility 3 MET, rest 0, uses adjusted details when accepted). Verify they fail first, then implement and verify they pass
- [x] 8.2 Write tests on the nutrition-targets pipeline: an incomplete planned 18 km long run raises morning kcal and carbs and triggers the ≥ 90-min carb floor; a completed run replaces the estimate with recorded active kcal; a skipped run contributes 0; existing nutrition-targets tests remain green. Verify the new tests fail first
- [x] 8.3 Add the `plannedSessionEnergy[]` input to the nutrition target computation and target explanation (labelled "planned") and verify the 8.2 tests pass

## 9. Weekly review

- [x] 9.1 Write unit tests for `buildWeeklyReview` (adherence = completed ÷ planned non-rest, e.g. 7/9 → 78%; run km vs planned; working sets per muscle group; 7-day weight trend vs goal direction; skipped and incomplete sessions handled). Verify they fail first
- [x] 9.2 Implement `buildWeeklyReview` and verify the 9.1 tests pass
- [x] 9.3 Write route tests for `POST /api/coach/review/summary` with `getAnthropicClient` mocked (only computed figures are sent; `MissingAiKeyError` → explanatory response with 0 calls). Verify they fail first, then implement it with `AI_MODELS.main` and verify they pass
- [x] 9.4 Build the weekly review screen and a Sunday highlight on Today. Verify via Playwright that the figures render without a key and that the summary section explains the key requirement

## 10. Verification

- [x] 10.1 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` and verify everything passes
- [ ] 10.2 Manual end-to-end check on iPhone PWA: set preferences, generate and accept a plan, submit an amber check-in, accept the adjustment, sync a run, and confirm the planned run completes and the nutrition targets update
- [x] 10.3 Update `docs/architecture.md` with the plan-generation sequence and readiness flow diagrams, and verify they render in a Markdown preview

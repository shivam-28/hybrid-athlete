## 1. Schema and configuration

- [x] 1.1 Write RLS tests (Given two users / When user B selects, inserts, updates or deletes user A's `meals`, `meal_items`, `food_log_days`, `daily_nutrition_targets`, `planned_meals` and `meal-photos` objects / Then all are denied) and verify they fail before the migration exists
- [x] 1.2 Add migration for `meals`, `meal_items`, `food_log_days`, `daily_nutrition_targets`, `planned_meals` following the foundation D4 table shape (user_id FK on delete cascade, `occurred_at`/`local_date` where applicable, owner policy with `(select auth.uid())`, `(user_id, local_date)` index), `food_lookup_cache` (no user_id, RLS on, no policies), new `profiles` columns with defaults, and private `meal-photos` bucket with the `<user_id>/...` folder-owner policy; verify `supabase db reset` succeeds and the 1.1 RLS tests pass
- [x] 1.3 Append `meals`, `meal_items`, `food_log_days`, `daily_nutrition_targets`, `planned_meals` and the `meal-photos` bucket to the account export/delete registry (`src/server/account/registry.ts`); verify the foundation registry test passes and an export/delete integration test for a seeded user with a meal photo returns the new rows and then leaves zero rows and zero objects
- [x] 1.4 Add the instance-level `USDA_FDC_API_KEY` to `.env.example`, the env Zod schema (optional) and the README self-hosting section (how to get a free data.gov key); verify the app boots with and without it

## 2. Target engine (pure, deterministic)

- [x] 2.1 Write table-driven Vitest tests for BMR selection (Katch-McArdle at 30 days, Mifflin-St Jeor at 120 days, male and female, missing-input error) using the spec scenario numbers, and verify they fail
- [x] 2.2 Write tests for exercise energy: synced activities summed, MET estimate for non-overlapping strength sessions, no estimate when a watch activity overlaps, multiple activities across the local day boundary in Europe/Copenhagen; verify they fail
- [x] 2.3 Write tests for adaptive expenditure: below threshold (9 days), eligible example (2600 kcal, −1.0 kg/28 d → 2875), incomplete days excluded, blend weight w = complete_days/28; verify they fail
- [x] 2.4 Write tests for goal adjustment (default cut 440 kcal at 80 kg, 25% cap, lean gain +250, recomposition −5%, no goal → maintain) and floors (BMR floor, RED-S floor 3000 kcal example, each emitting a warning); verify they fail
- [x] 2.5 Write tests for macros (80 kg / 18% / 2800 kcal → 144/78/381/39), high-BF goal-weight protein (170 g), fat minimum 0.6 g/kg, carb floors per day class including the long-run example (+720 kcal), and that explanation components sum exactly to the rounded target; verify they fail
- [x] 2.6 Implement `src/lib/nutrition/targets.ts` `computeDailyTargets` per design D2 and verify all tests in 2.1–2.5 pass
- [x] 2.7 Implement the server loader assembling inputs from profile, trend weight, body fat, goal, activities, strength sessions and the 28-day window. Integration-test it against the local Supabase seed and verify it returns the expected targets for a seeded user

## 3. Target persistence, completeness and UI

- [x] 3.1 Write integration tests: today's targets recompute after a new activity insert; yesterday's row is unchanged after a goal change; a missing past day is computed once and then frozen; marking a day complete toggles `food_log_days`. Verify they fail
- [x] 3.2 Implement `GET /api/nutrition/targets?date=` with live-today / frozen-past semantics (design D3) and `PUT /api/nutrition/log-days/:date` for completeness, with Zod validation, and verify 3.1 passes
- [x] 3.3 Add the lifestyle activity level to profile settings and verify that changing it updates today's targets in the UI
- [x] 3.4 Build the "Why this number" sheet listing components, methods and warnings, and verify with a component test that it renders every component and the sum matches the target

## 4. Nutrient matching

- [x] 4.1 Write tests with recorded fixtures for the USDA and Open Food Facts clients (nutrient ID mapping to columns, missing micros → null, 3 s timeout → fallback `estimated`, cache hit skips network) and verify they fail
- [x] 4.2 Implement `src/lib/nutrition/nutrients.ts` (ID map, per-100 g scaling), the USDA and OFF clients and the matcher with 30-day `food_lookup_cache`, and verify 4.1 passes
- [x] 4.3 Implement `GET /api/foods/search?q=` for manual search (no AI key needed) and verify an integration test returns USDA and OFF results with source labels

## 5. Meal recognition and description

- [x] 5.1 Write a unit test that the client image processor outputs ≤1568 px long edge and a JPEG with no EXIF/APP1 segment from a fixture with GPS EXIF, and verify it fails
- [x] 5.2 Implement client-side resize and EXIF strip (design D9) and the upload to `meal-photos/<user_id>/`, with display via short-lived signed URLs only, and verify 5.1 passes
- [x] 5.3 Write tests for the recognition route with a mocked Anthropic client: valid tool output → MealDraft with matches; invalid output → one retry, then error; "no food" → empty draft message; `getAnthropicClient` throws `MissingAiKeyError` → 409 `missing_ai_key` and the UI falls back to manual search/text-search entry; description with "200 g" → quantity_source `user`. Verify they fail
- [x] 5.4 Load the `claude-api` skill, then implement `POST /api/meals/recognize` (photo or description) using structured output (`messages.parse` + `zodOutputFormat`, schema `MealItems`) via `getAnthropicClient(userId)` and `AI_MODELS.main` (photo read through a short-lived signed URL), Zod validation, and parallel matching, and verify 5.3 passes

## 6. Confirm, save, edit, re-log

- [x] 6.1 Write tests: meal type inference at boundary times (10:29, 10:30, 15:00, 17:00, 21:30) in the user's timezone; the server recomputes nutrients ignoring client totals; delete removes items and photo; re-log creates a new meal for today with identical items. Verify they fail
- [x] 6.2 Implement `POST /api/meals`, `PATCH /api/meals/:id`, `DELETE /api/meals/:id`, favourite toggle and `GET /api/meals/recent` (20 most recent distinct meals plus favourites), and verify 6.1 passes
- [x] 6.3 Build the confirmation screen (grams slider plus input, swap from alternatives/search, add/remove item, confidence highlight, accuracy notice, live recompute), and verify with a component test that changing grams updates totals
- [x] 6.4 Build the Eat tab day view (meals by type, totals vs targets, remaining/over display, micros with incomplete indicator, mark day complete) and verify with a component test for the 900 kcal / 44 g remaining scenario and the over-target scenario
- [x] 6.5 Add the nutrition card with "snap meal" quick action to the Today view and verify it renders progress for the seeded user

## 7. Recommendations

- [x] 7.1 Write tests for the allergen filter (peanut → satay dropped, milk → whey/skyr dropped, free-text allergy substring match, clean option kept) and verify they fail
- [x] 7.2 Implement `src/lib/nutrition/allergens.ts` with the EU 14 groups plus synonyms, and verify 7.1 passes
- [x] 7.3 Write route tests with a mocked Anthropic client: remaining slots by local time (15:30 → snack + dinner); zero remaining → no AI call; option >15% off is dropped; all dropped → one regeneration then a graceful message; vegetarian profile passed into the prompt; pre-long-run meal flagged carb-focused in the prompt context. Verify they fail
- [x] 7.4 Implement `POST /api/nutrition/recommendations` (`getAnthropicClient(userId)` + `AI_MODELS.main`, `MissingAiKeyError` → 409, structured output (`messages.parse` + `zodOutputFormat`, schema `MealOptions`), Zod, macro recompute via matcher, kcal tolerance, allergen filter, single regeneration) and verify 7.3 passes
- [x] 7.5 Add dietary preference fields (diet type, allergies, dislikes, cuisines) to profile settings and verify they persist and appear in the recommendation request
- [x] 7.6 Write a test that planned meals are excluded from intake totals and "Ate this" produces a prefilled draft, verify it fails, then implement `planned_meals` save/list/log and verify it passes

## 8. End-to-end and docs

- [x] 8.1 Write a Playwright E2E test with the Anthropic and nutrient APIs mocked at the network layer: snap photo → confirm with gram edit → totals update → request recommendations → save plan → log planned dinner. Verify it passes on mobile Safari (WebKit) viewport
- [x] 8.2 Update `docs/architecture.md` with this change's meal-draft sequence diagram (design D4) and target graph (design D8), and verify Mermaid renders on GitHub preview

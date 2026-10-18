## 1. Database and storage

- [x] 1.1 Write RLS tests (Given user A and user B, When B selects/inserts/updates/deletes A's rows in each new table and reads `daily_body_weight`, Then zero rows / permission denied); verify they fail before the migration exists
- [x] 1.2 Write storage policy tests for `body-comp-docs` and `progress-photos` (owner can upload/read/delete under `<user_id>/`, other users and anon cannot, upload outside own folder is rejected); verify they fail before the migration exists
- [x] 1.3 Create `supabase/migrations/<ts>_body_tracking.sql` with the six tables in foundation D4 shape, enums (`body_comp_method`, `photo_pose`, `goal_status`), CHECK constraints, partial unique active-goal index, `profiles.progress_photo_ai_consent_at`, and the `daily_body_weight` view (`security_invoker = true`); verify 1.1 passes and `supabase db reset` succeeds
- [x] 1.4 Add private buckets and storage policies on `(storage.foldername(name))[1] = auth.uid()::text`; verify 1.2 passes
- [x] 1.5 Write view tests: earliest manual entry per `local_date` wins, manual beats `daily_metrics.weight_kg`, Apple-Health-only date falls back, deleting the only manual entry falls back; then verify they pass against the migration
- [x] 1.6 Append the six tables and two buckets to `src/server/account/registry.ts`; verify foundation's registry guard test passes and an export/delete integration test covers a user with body data, photos and documents
- [x] 1.7 Regenerate DB types (`pnpm db:types`); verify `pnpm typecheck` passes

## 2. Pure body maths (`src/lib/body`)

- [x] 2.1 Write `trend.test.ts` (seed with first weight, 78.0 → 80.0 gives 78.2, gap days carry forward, empty input) and `rate.test.ts` (80.0 → 79.2 over 14 days = −0.40 kg/wk and −0.50 %/wk, fewer than 7 weights → not enough data); verify they fail
- [x] 2.2 Implement `trend.ts` and `rate.ts`; verify 2.1 passes
- [x] 2.3 Write `composition.test.ts` (derive lean/fat mass/BF%, mark derived fields, consistency warnings for BF% outside 3–60, fat + lean vs weight > 2 %, BF% vs fat/weight > 1 pt, consistent test → no warnings); verify it fails
- [x] 2.4 Implement `composition.ts`; verify 2.3 passes
- [x] 2.5 Write `goals.test.ts` covering every body-goals spec scenario: phase derivation (cut, lean gain, recomposition, maintain, ±2 kg band edges, BF-only without measurement), projections (implied goal weight 75.3 kg, projected BF 13.5 %, goal below lean mass), default rates and timelines (10 weeks; ~4 months), target-date validation (warn + earliest safe date at 10 weeks; required −0.57 kg/wk), unrealistic warnings (male 6 %, BMI 17.9), progress direction/ETA (4 weeks; not converging); verify it fails
- [x] 2.6 Implement `goals.ts`; verify 2.5 passes

## 3. Weight and measurements

- [x] 3.1 Write route/server-action tests for weight entries (metric and imperial input stored canonically, 172.8 lb → 78.38 kg, < 20 / > 400 kg rejected, `local_date` from profile tz incl. 23:30 UTC → next day in Copenhagen, edit/delete own manual entries only); verify they fail
- [x] 3.2 Implement weight create/edit/delete with Zod validation and `localDate()`; verify 3.1 passes
- [x] 3.3 Write tests for measurements (subset of fields, none-provided rejected, out-of-range rejected); verify they fail
- [x] 3.4 Implement measurement entry; verify 3.3 passes
- [x] 3.5 Build Body → Weight page: quick-entry form, history list with source badges, weight + trend chart with 4w/12w/1y switch, rate card, waist change card; verify with a Playwright test that logs a weight and sees it on the chart and in the trend

## 4. Images and uploads

- [x] 4.1 Write `normalize.test.ts` for the server normaliser (fixture JPEG with GPS EXIF → output has no EXIF/GPS segment; rotated fixture displays upright; > 4 MB rejected; non-image rejected); verify it fails
- [x] 4.2 Add `sharp` and implement `src/server/images/normalize.ts`; verify 4.1 passes
- [x] 4.3 Implement `src/lib/images/normalize-client.ts` (original size/type check, canvas re-encode to JPEG long edge ≤ 2048 px); verify with a Playwright test uploading an EXIF-tagged fixture that the stored object has no EXIF
- [x] 4.4 Write tests for lazy orphan cleanup (unreferenced files > 24 h old are removed on next upload; referenced or recent files kept); verify they fail, then implement `src/server/body/uploads.ts` and verify they pass

## 5. Body composition

- [x] 5.1 Write tests for manual test entry (method required, any subset of fields, derived values stored and flagged, works with no AI key); verify they fail
- [x] 5.2 Implement manual entry route + form; verify 5.1 passes
- [x] 5.3 Write extraction route tests with a mocked Anthropic client: valid tool output → draft with nulls as "not found" and lb converted to kg; Zod-invalid output → error with manual fallback; empty extraction → "no values found"; `MissingAiKeyError` → 409 `no_ai_key`; nothing persisted in any case; unsupported type / > 10 MB rejected; verify they fail
- [x] 5.4 Implement upload (images via normaliser, PDFs via signed upload URL to `<user_id>/`), `extract` route via `getAnthropicClient(userId)` + vision model constant, confirm and discard routes (discard deletes file); verify 5.3 passes
- [x] 5.5 Build the confirmation form (editable fields, "not found" state, highlighted consistency warnings, confirm/discard); verify a Playwright test with the mocked AI corrects 81.5 → 18.5 and the saved test shows 18.5 %
- [x] 5.6 Write tests for edit/delete (delete removes the document file) and for method-aware trend series (lines only within one method, mixed-method notice for last two tests); verify they fail, then implement and verify they pass
- [x] 5.7 Write tests for `getLatestBodyComposition` (latest confirmed test with BF% wins, none → null, photo analyses never considered); verify they fail, then implement in `src/server/body/read.ts` and verify they pass

## 6. Progress photos

- [x] 6.1 Write tests for photo upload (pose required, date defaults to today in user tz, > 15 MB original rejected client-side, stored file has no EXIF) and delete (file removed, analyses cascade); verify they fail
- [x] 6.2 Implement upload/delete routes and the gallery grouped by date and pose using 600 s signed URLs; verify 6.1 passes and an expired-URL test returns no image
- [x] 6.3 Build the comparison view (two dates, same pose, "N days apart", daily weight per date); verify with a Playwright test that comparing 2026-08-01 and 2026-10-01 shows "61 days apart"
- [x] 6.4 Write tests for AI consent (no consent → 403 and no AI call; consent sets timestamp; withdraw clears it) and analysis (mixed poses or another user's photo rejected; mocked AI output saved with observations; `visual_impression` rendered only with the "visual impression, not a measurement" label); verify they fail
- [x] 6.5 Implement the consent screen in Settings, the analysis route via `getAnthropicClient(userId)`, and the analysis display; verify 6.4 passes

## 7. Body goals

- [x] 7.1 Write tests for goal persistence (weight and/or BF% required, target date must be ≥ tomorrow, new goal archives the previous one, only one active goal enforced by the DB); verify they fail
- [x] 7.2 Implement goal create/replace and goal history; verify 7.1 passes
- [x] 7.3 Write tests for `getGoalState` (phase + signed target rate from trend weight, latest body composition and profile; no weight → null with reason; no active goal → null); verify they fail, then implement in `src/server/body/read.ts` and verify they pass
- [x] 7.4 Build the goal page (form, phase badge, projections, timeline, warnings with "use earliest safe date" action, progress card with direction and ETA); verify with a Playwright test that an 80 → 72 kg goal in 6 weeks shows the warning and the 10-week safe date

## 8. Integration

- [x] 8.1 Add a Body section summary on the Today view (trend weight, weekly rate, goal progress); verify with a Playwright test for a seeded user
- [x] 8.2 Run `pnpm lint`, `pnpm typecheck`, `pnpm test` and the Playwright suite; verify all pass
- [x] 8.3 Run `openspec validate add-body-tracking --strict`; verify it passes

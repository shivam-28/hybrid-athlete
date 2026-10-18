## 1. Schema, security and storage

- [x] 1.1 Write RLS tests with two real users (Given A and B with rows in `daily_metrics`, `activities`, `activity_splits`; When B selects/updates/deletes A's rows or reads `activity-files/<A>/…`; Then nothing is returned or changed) and verify they fail before the migration
- [x] 1.2 Write RLS tests for secrets (Given A has an ingest token; When A or B selects `ingest_tokens`/`ingest_rate` with the anon or authenticated client; Then zero rows are returned, so the hash is never readable; and When `authenticated` calls `ingest_health` via RPC; Then a permission error is raised) and verify they fail
- [x] 1.3 Add migration following foundation D4 (`user_id … default auth.uid() references auth.users on delete cascade`, `occurred_at`, `local_date`, owner policy with `(select auth.uid())`, `(user_id, local_date)` index): `daily_metrics` (unique user+local_date, nullable metrics with CHECK ranges), `activities` (unique user+external_id where not null, index user+sport+occurred_at), `activity_splits`; `ingest_tokens` and `ingest_rate` with RLS enabled and **no policies**; `profiles.max_hr_bpm` with CHECK 100–230; verify `supabase db reset` succeeds and 1.1 passes
- [x] 1.4 Create private `activity-files` bucket with policies on `(storage.foldername(name))[1] = auth.uid()::text`; verify the storage cases in 1.1 pass
- [x] 1.5 Register `daily_metrics`, `activities`, `activity_splits`, `ingest_tokens` and the `activity-files` bucket in `src/server/account/registry.ts`; verify the registry-completeness test passes, export contains A's activities but no token hash, and delete removes A's `activity-files/<A>/` objects and all rows (extend the foundation export/delete tests)

## 2. Domain logic (pure functions)

- [x] 2.1 Write unit tests for max HR resolution (profile value vs Tanaka with age on activity date) and 5-zone boundaries (190 bpm → Z2 114–133; age 30 → 187) and verify they fail
- [x] 2.2 Implement max HR and zone functions and verify 2.1 passes
- [x] 2.3 Write unit tests for training load (60 min Z2 → 120; 30 min walk no HR → 30), acute/chronic/ratio (600/2000 → 500, 1.2) and the 21-day baseline rule; verify they fail
- [x] 2.4 Implement load functions and verify 2.3 passes
- [x] 2.5 Write unit tests for weekly summary (Mon–Sun in user timezone, 5+8+16 km → 29 km/3 runs/16 km longest, Sunday 23:30 Copenhagen boundary) and 7-day averages (missing days excluded, < 3 values → not available); verify they fail
- [x] 2.6 Implement weekly summary and trend functions and verify 2.5 passes

## 3. Health ingest

- [x] 3.1 Write tests for the ingest Zod schema (partial daily accepted; end < start rejected; negative steps and resting HR outside 20–250 rejected; unknown sport rejected with allowed values) and verify they fail
- [x] 3.2 Implement the ingest payload schema and the generated JSON schema at `GET /api/ingest/health/schema`; verify 3.1 passes
- [x] 3.3 Write DB integration tests for `ingest_health` (called as `service_role`) (repost → 0 inserted and stable row count; higher steps → updated; partial daily keeps other columns; workout start +90 s matches; external_id exact match; fit_locked activity only gets null fields filled) and verify they fail
- [x] 3.4 Implement `match_activity(...)` and `ingest_health(p_user_id, p_payload)` Postgres functions (`security invoker`; single transaction; per-user advisory lock; presence-aware upsert; workout `local_date` from `profiles.timezone`; inserted/updated/unchanged counts) with `execute` revoked from `public`/`anon`/`authenticated` and granted to `service_role` only; verify 3.3 and the grant case in 1.2 pass
- [x] 3.5 Write tests for token lifecycle (generate shows full token once, stores SHA-256 only, rotation revokes old, revoke → 401) and verify they fail
- [x] 3.6 Implement `src/server/ingest/tokens.ts` (`import "server-only"`, service-role client, every query scoped to `user_id` from `requireUser()` or token lookup; generate/rotate/revoke/masked status/verify with constant-time hash compare) and Settings server actions calling it; add the module to the service-role import-allowlist guard test; verify 3.5 and the guard test pass
- [x] 3.7 Write route tests for `POST /api/ingest/health` (no/unknown/revoked token → 401; session cookie only → 401 and no proxy redirect; payload containing a `user_id` field → 400; > 1 MB → 413; 31st request/hour → 429 with Retry-After; invalid payload → 400 with nothing stored; valid → 200 with counts and data owned by token user) and verify they fail
- [x] 3.8 Exclude `/api/ingest/health` and `/api/ingest/health/schema` from the `src/proxy.ts` matcher; verify with a test that an anonymous request to them is not redirected to `/sign-in`
- [x] 3.9 Implement `src/server/ingest/ingest.ts` (`import "server-only"`; size guard, token verify, `ingest_rate` window, strict Zod, service-role call to `ingest_health` with `user_id` from the token only, record `last_used_at`/`last_result`) and the thin Route Handler adapter; add the module to the service-role import-allowlist guard test; verify 3.7 and the guard test pass

## 4. FIT import

- [x] 4.1 Add FIT fixtures to `tests/fixtures/fit/` (run with HR ~10 km, 5.4 km run, run without HR, strength activity, corrupt/truncated file, Garmin export zip, zip without .fit) and verify each file is present and under 3 MB
- [x] 4.2 Write parser tests (summary fields and 5:15 /km pace; 5 full + 1 partial split with normalised pace; no-HR file → HR fields unknown; corrupt → typed error; zip extraction; non-FIT zip and GPX rejected; zip-bomb size cap) and verify they fail
- [x] 4.3 Add `@garmin/fitsdk` and `fflate`, implement the FIT parse module (unzip, decode, sport mapping, splits interpolation, time-weighted zones) and verify 4.2 passes
- [x] 4.4 Write upload route integration tests (valid upload → activity + splits + stored file; corrupt → no rows and no stored object; same file twice → no duplicate and link to existing; AH workout then FIT → one merged activity with both sources; DB failure → stored object removed) and verify they fail
- [x] 4.5 Implement `import_fit_activity(p_activity, p_splits)` (`security invoker`, uses `auth.uid()`, reuses `match_activity`, computes `local_date` from profile tz, granted to `authenticated`) and the session-authenticated upload Route Handler (`requireUser()`, 25 MB cap, parse before writes, storage put to `<user_id>/<activity_id>.fit` and RPC both via the user's RLS client, compensating delete; no service role); verify 4.4 passes
- [x] 4.6 Write a test that changing `profiles.max_hr_bpm` recomputes zones and load for all of the user's activities; implement the recompute in the profile update action; verify the test passes

## 5. UI

- [x] 5.1 Build Settings → Integrations: token generate/rotate/revoke with show-once dialog and masked display, last sync time (user timezone) with counts, "Never synced" state, stale (> 36 h) warning; verify with a component test for each state
- [x] 5.2 Build the Shortcut setup guide page (instance ingest URL, step-by-step build, daily Personal Automation with "Run Immediately", copyable curl test command using the published schema, token-missing prompt, warning about sharing Shortcuts); verify the curl example payload validates against the ingest schema in a unit test
- [x] 5.3 Build the FIT upload UI (file picker accepting `.fit,.zip`, progress, error messages, duplicate link); verify with a Playwright test uploading a fixture and landing on the detail page
- [x] 5.4 Build the activity list (newest first, sport filter, local date/time) and activity detail (sources badge, splits table, HR zone bar with max HR source label, AH-only notice, delete with confirm); verify with Playwright: list shows merged activity once, delete removes it from list and weekly summary
- [x] 5.5 Build the weekly summary (current + 8 previous weeks) and training load panel ("building baseline" vs ratio); verify with a component test using seeded data
- [x] 5.6 Build daily metric trends with 7-day averages and "not available" rendering (never 0); verify with a component test where HRV is missing
- [x] 5.7 Add the optional max heart rate field (100–230 bpm) to the profile form; verify validation errors and the recompute path from 4.6 via Playwright

## 6. End-to-end verification

- [x] 6.1 Run an end-to-end script (Playwright `e2e/activities.spec.ts`): generate token → curl the guide's test payload twice → assert counts (inserted then unchanged) → upload matching FIT → assert one merged activity; verify it passes against local Supabase
- [ ] 6.2 Manually verify on a real iPhone (iOS 26) with a Garmin-paired Apple Health: build the Shortcut from the guide, run it, confirm which metrics and workout fields arrive; record findings and update the guide and sport mapping
- [x] 6.3 Run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `openspec validate add-activity-sync --strict`; verify all pass

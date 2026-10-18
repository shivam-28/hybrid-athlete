## Why

A hybrid athlete's runs, daily activity and recovery signals live on their Garmin watch, but the coach and the nutrition engine (later changes) need that data inside the app. Garmin's official Connect Developer Program has paused new applications and rejects personal use, unofficial Garmin login libraries broke in March 2026, and Strava now requires a paid subscription for API apps and forbids using its data in AI prompts. That leaves two dependable routes: Garmin Connect already copies data into Apple Health, which an iOS Shortcut can forward to us, and Garmin Connect lets users export each activity's original `.FIT` file, which has full detail.

## What Changes

- Per-user **ingest token**, managed in Settings: generate, rotate and revoke. The token is shown once and stored hashed.
- Token-authenticated **health ingest endpoint** that accepts daily metrics (steps, active energy, resting HR, HRV, sleep, VO2max, weight) and workouts from an iOS Shortcut. Requests are schema-validated, size-limited and rate-limited. Re-posting the same data is safe (no duplicates), and the response reports inserted/updated/skipped counts.
- In-app **Shortcut setup guide** (build the Shortcut, schedule a daily Personal Automation, send a test request) and a last-successful-sync indicator.
- **FIT import**: upload a `.fit` file or a Garmin Connect export `.zip`. It is parsed into an activity with distance, pace, heart rate, elevation, per-km splits and time in each of 5 heart-rate zones. Re-uploading the same file creates no duplicate, and a matching Apple Health workout is merged into one activity rather than duplicated.
- **Activity history**: an activity list and activity detail (splits, HR zones), weekly running summary, 7-day vs 28-day training load (consumed later by `add-coach`), and daily metric trends with 7-day averages. All dates are shown in the user's timezone.
- Profile gains an optional **max heart rate** field. When it is not set, max HR is estimated from age.

## Non-goals

- GPS map/route rendering.
- Garmin Connect, Strava, Polar, or any other vendor API, and any write-back to Garmin.
- Android Health Connect.
- Real-time or background sync beyond what the user's Shortcut automation schedules.
- Importing strength sets/reps from FIT files (strength is logged in `add-workout-logging`).
- Using weight samples for body-composition analysis (stored here; consumed by `add-body-tracking`).

## Capabilities

### New Capabilities

- `health-ingest`: Ingest token lifecycle, token-authenticated ingest endpoint, payload contract, idempotent upserts, sync status and the Shortcut setup guide.
- `fit-import`: Upload and parse `.fit`/`.zip` activity files, derived metrics (splits, HR zones), duplicate prevention, merging with Apple Health workouts, private storage of originals.
- `activity-history`: Activity list/detail, weekly running summary, training load (acute vs chronic), daily metric trends.

### Modified Capabilities

_None. The optional max-HR profile field is introduced in this change's `fit-import` spec, so the `user-profile` requirements are unchanged._

## Impact

- New dependencies: `@garmin/fitsdk` (official FIT SDK) and a zip reader (e.g. `fflate`).
- New tables (RLS on all): `ingest_tokens`, `daily_metrics`, `activities`, `activity_splits` (or JSONB on `activities`). New private storage bucket `activity-files`.
- New routes: `POST /api/ingest/health` (bearer token, no session), FIT upload route, Settings → Integrations page, Activity pages.
- Account export/delete (`account-data`, from `add-foundation`) must cover the new tables and bucket.
- Later consumers: `add-body-tracking` (weight samples), `add-nutrition` (exercise energy per day), `add-coach` (training load, resting HR/HRV/sleep baselines).

## Why

Nutrition targets (Katch-McArdle needs lean mass) and coaching decisions both depend on reliable body data, and a recomposition journey is judged by trends, not single weigh-ins. Daily scale weight swings 1–2 kg with water, glycogen and sodium — especially for someone adding running volume — so users need smoothed trends, measured body composition, visual progress and explicit goals before `add-nutrition` can compute anything meaningful.

## What Changes

- Body weight logging (manual, multiple entries per day) merged with Apple Health weights already ingested by `add-activity-sync`; one canonical daily weight per day.
- Smoothed trend weight (exponentially weighted moving average), weekly rate of change in kg and % body weight, and charts over 4 weeks / 12 weeks / 1 year.
- Optional circumference measurements (waist at navel, hips, chest, arm, thigh), with waist trend highlighted as a recomposition signal.
- Body composition tests: manual entry, or upload of a report photo/PDF (InBody, Tanita, DEXA, Withings) from which Claude vision extracts values into an editable confirmation form. Consistency checks flag suspicious values; the original file is kept privately. Trends are grouped by measurement method.
- Progress photos (front/side/back) with metadata stripping, private storage, owner-only short-lived links, side-by-side comparison, and opt-in qualitative AI analysis that never produces a body-fat measurement.
- Body goals: goal weight and/or goal body-fat %, optional target date; deterministic goal-phase derivation (cut, lean gain, recomposition, maintain), goal projections, safe-rate timeline with warnings, and a progress view with ETA from the current trend.
- Exposes "latest confirmed body fat % / lean mass" and "current goal phase + target weekly rate" for `add-nutrition` to consume.

## Non-goals

- Computing calorie or macro targets (owned by `add-nutrition`).
- Direct integrations with smart scales or bioimpedance device APIs (Apple Health ingest already covers smart-scale weight).
- Social sharing, public links or coach access to progress photos.
- 3D body scans or automated pose detection.
- Treating any AI visual impression of body fat as a measurement.

## Capabilities

### New Capabilities

- `body-metrics`: Weight entries, canonical daily weight, Apple Health merge, trend weight, rate of change, circumference measurements and charts.
- `body-composition`: Manual and AI-extracted body composition tests, confirmation flow, consistency checks, method-aware trends, latest-value source for nutrition.
- `progress-photos`: Private progress photo upload, metadata stripping, comparison view, opt-in qualitative AI analysis, deletion.
- `body-goals`: Goal setting, goal-phase derivation, projections, safe-rate validation, progress and ETA.

### Modified Capabilities

_None._

## Impact

- New tables (all RLS, owner-only): `body_weights`, `body_measurements`, `body_composition_tests`, `progress_photos`, `progress_photo_analyses`, `body_goals`, plus a `daily_body_weight` view; profile gains a progress-photo AI consent flag.
- New private storage buckets: `body-comp-docs`, `progress-photos` (path prefix `<user_id>/`).
- Reads Apple Health daily weights (`daily_metrics.weight_kg`) stored by `add-activity-sync`.
- Uses the user's Anthropic key (`ai-key` from `add-foundation`) with `claude-opus-5-5` for document extraction and photo analysis.
- New dependency: `sharp` for server-side image re-encoding/metadata stripping. PDFs are sent to Claude as native documents; charts reuse the library from `add-activity-sync`.
- All new tables and buckets are appended to the foundation export/delete registry so `account-data` covers them.

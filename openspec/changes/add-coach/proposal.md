## Why

By this stage the app records everything (lifting sets, Garmin runs, sleep and heart rate, body composition, intake) but leaves the user to decide what to do next. A hybrid athlete has to balance two kinds of training that interfere with each other. Heavy leg days before long runs, ramping run mileage too fast, and ignoring poor recovery are the classic ways people new to concurrent training get hurt or stall. This change turns the logged data into a safe weekly plan and a daily go/adjust/rest decision, with an aerobic base aimed at an eventual marathon.

## What Changes

- Training preferences: days available per week, max session length, preferred long-run day, equipment access (gym or home), optional target race (distance, date, goal time).
- AI-generated 7-day hybrid plan (strength, run, core, mobility and rest sessions), built from the last 4 weeks of actual training and the current race phase (base, build, peak or taper; base building when no race is set).
- Deterministic safety guardrails checked server-side on every generated plan: run volume ramp, rest days, 80/20 intensity, long-run share, lower-body lifting placed away from long and quality runs, muscle-group frequency, and a consecutive-load limit for beginners. On violation, one automatic repair attempt; plans that still violate are shown with explicit warnings.
- Review flow: regenerate the plan, edit any session, accept. Accepted sessions appear on Today. Logged workouts and synced activities auto-complete the matching planned session.
- Daily readiness: a ≤ 15-second check-in (sleep quality, soreness, energy, stress) plus objective signals when present (sleep, resting HR and HRV vs baseline, acute:chronic load). Produces a deterministic green, amber or red score with the reasons shown.
- Readiness adjusts today's planned session (as planned, reduced, or swapped to recovery). The user can override.
- Planned sessions feed the day's nutrition targets before they happen; actual recorded activity replaces the estimate once it exists.
- Sunday weekly review: planned vs completed, adherence, running km, strength sets per muscle group, weight trend vs goal, and an optional AI coach summary.

## Non-goals

- Medical advice or injury diagnosis. Pain reports only produce a "see a qualified professional" message and a rest recommendation.
- Exporting a full 16–20 week marathon program; plans are generated one week at a time.
- Race-time or pace prediction models.
- Push notifications (deferred until PWA push is added).
- Group training, coach–athlete sharing, or plan sharing between users.
- Training-load metrics beyond acute:chronic ratio (no TSS/CTL/ATL modelling).

## Capabilities

### New Capabilities

- `training-plan`: Training preferences, race phase derivation, AI weekly plan generation, deterministic guardrails with repair, review/edit/accept, plan history, and auto-completion of planned sessions from logged or synced activity.
- `daily-readiness`: Daily subjective check-in, objective recovery signals vs personal baselines, deterministic readiness scoring, session adjustment and override, the planned-session link to daily nutrition targets, and the Sunday weekly review.

### Modified Capabilities

_None._ This change consumes the `workout-logging`, `progressive-overload`, `activity-history`, `body-goals` and `nutrition-targets` capabilities from earlier changes without changing their requirements. The planned-session energy rule is specified in `daily-readiness` so `nutrition-targets` keeps a single owner.

## Impact

- Depends on `add-workout-logging`, `add-activity-sync`, `add-body-tracking` and `add-nutrition` being applied and archived first.
- New tables: `training_preferences`, `training_plans`, `planned_sessions`, `readiness_checkins` (all RLS user-owned).
- New server routes for plan generation and weekly review using the user's BYO Anthropic key (`claude-opus-5-5`, structured output, Zod-validated).
- New pure-TypeScript modules for guardrail validation, race phase derivation, baseline statistics and readiness scoring (unit-tested, no I/O).
- Today view gains a readiness card and today's planned sessions. The Coach tab gains the plan, preferences and weekly review screens.
- The nutrition target computation gains an input for planned-but-not-yet-recorded session energy.

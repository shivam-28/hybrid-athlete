## Why

Every later feature (voice workout logging, meal photos, Garmin sync, coaching) needs the same base: per-user accounts with isolated health data, a profile with the physiological inputs the formulas need (sex, age, height), a safe place for each user's own Claude API key, and an app shell that installs to an iPhone home screen. The app will be hosted for friends and published as open source, so data isolation, EU-grade privacy and self-hostability have to be in place from day one, not bolted on later.

## What Changes

- Passwordless email sign-in (magic link **or** 6-digit code — the code is required because an iOS home-screen app does not share Safari's session) with an optional database-enforced signup allowlist, so the maintainer's hosted instance stays friends-only while self-hosters can leave it open.
- Onboarding flow and editable profile: display name, sex (for BMR formulas), date of birth, height, unit system (metric default), timezone (browser-detected, falls back to Europe/Copenhagen), strength and running experience levels.
- Bring-your-own Anthropic API key: validated on save, stored encrypted server-side, never returned to the browser (only the last 4 characters shown), removable. AI-backed features degrade gracefully without a key.
- Installable PWA shell: manifest, icons, iOS standalone support, bottom tab navigation (Today, Train, Eat, Body, Coach) and an empty Today view that later changes fill in.
- Personal data controls: export all of a user's data as JSON and permanently delete the account with all rows and stored files.
- Project scaffolding for open source: Supabase migrations, seed and RLS test harness, environment template, README with self-hosting guide, MIT license.

## Non-goals

- Offline logging / background sync (revisit once workout logging is in daily use).
- OAuth social logins (Apple/Google); magic link is enough for a friends-scale instance.
- Admin dashboard, teams or sharing data between users.
- Paid tiers, billing or usage metering — users bring their own AI key.
- Native iOS app or HealthKit access (handled via Shortcuts in `add-activity-sync`).

## Capabilities

### New Capabilities

- `auth`: Passwordless sign-in/out, session handling, route protection, signup allowlist, per-user data isolation guarantee.
- `user-profile`: Onboarding, profile fields, unit and timezone preferences, derived age, day-boundary semantics.
- `ai-key`: Storing, validating, masking, using and deleting a user's own Anthropic API key; behaviour when absent.
- `app-shell`: PWA installability, navigation, Today view container, unit-aware display.
- `account-data`: Full data export and irreversible account deletion.

### Modified Capabilities

_None — greenfield._

## Impact

- New dependencies: `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `@anthropic-ai/sdk`, `vitest`, `@playwright/test`, Supabase CLI (dev).
- New infrastructure: Supabase project (EU region recommended), Vercel project, env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ENCRYPTION_KEY`. Signup allowlist lives in a database table managed by the instance owner.
- Establishes conventions every later change follows: RLS on every user table, `supabase/migrations/`, Zod at route boundaries, canonical metric storage, UTC timestamps with user-timezone day boundaries.

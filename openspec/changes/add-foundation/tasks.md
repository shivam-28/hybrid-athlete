## 1. Tooling and project setup

- [x] 1.1 Add runtime deps (`@supabase/supabase-js`, `@supabase/ssr`, `zod`, `@anthropic-ai/sdk`, `server-only`, `lucide-react`) and dev deps (`vitest`, `@vitest/coverage-v8`, `@playwright/test`, `supabase`); verify `pnpm install` succeeds and `pnpm exec supabase --version` prints a version
- [x] 1.2 Configure Vitest (unit + `db` project for tests needing local Supabase) and Playwright; add `test`, `test:db`, `test:e2e`, `typecheck` scripts; verify `pnpm test` runs a placeholder test green
- [x] 1.3 Enable `strict` + `noUncheckedIndexedAccess` in tsconfig; verify `pnpm typecheck` passes
- [x] 1.4 `supabase init`, configure `config.toml` (email OTP length 6, auth hook entry, Mailpit), add `.env.example` with all env vars documented; verify `supabase start` boots locally (requires Docker running)
- [x] 1.5 Initialise shadcn/ui (Tailwind 4) with button, input, label, card, dialog, form primitives; verify the app builds with `pnpm build`
- [x] 1.6 Add MIT `LICENSE` and replace scaffold README with project overview + self-hosting guide (Supabase EU region, auth hook, email template, env vars, Vercel `fra1`); verify every env var in `.env.example` appears in the README

## 2. Time and units (pure logic)

- [x] 2.1 Write Vitest tests for `localDate` (23:30 Copenhagen → same day, DST spring/autumn transitions, fallback tz) and `ageOn` (before/after birthday, leap-day birthday); verify they fail (red)
- [x] 2.2 Implement `src/lib/time.ts`; verify 2.1 tests pass
- [x] 2.3 Write tests for unit conversions and formatting (5 ft 10 in ⇄ 177.8 cm, kg⇄lb round trip, switching unit system does not mutate stored values); verify red
- [x] 2.4 Implement `src/lib/units.ts`; verify 2.3 tests pass

## 3. Database schema, RLS and auth hook

- [x] 3.1 Write DB tests (Vitest `db` project, two real local users): user B cannot select/update/insert-as A on `profiles`; anon gets nothing; `user_ai_keys` and `signup_allowlist` return zero rows to any client role; verify red
- [x] 3.2 Write DB tests for the allowlist hook: empty list allows any email; exact email match allows; `@domain` match allows; non-match rejects with invite-only message; existing user can still sign in after removal; verify red
- [x] 3.3 Migration: `profiles` (CHECK ranges, RLS owner policy), `user_ai_keys` (RLS on, no policies), `signup_allowlist` (RLS on, no policies), `updated_at` trigger helper; verify 3.1 passes
- [x] 3.4 Migration: `auth_hooks.before_user_created` security-definer function + grants to `supabase_auth_admin`; wire in `config.toml`; verify 3.2 passes
- [x] 3.5 Generate typed DB client (`supabase gen types typescript --local > src/lib/database.types.ts`) and add a `db:types` script; verify `pnpm typecheck` passes

## 4. Authentication flow

- [x] 4.1 Write Playwright E2E: request code → read 6-digit code from Mailpit → verify → lands on `/onboarding`; wrong code shows error; anonymous visit to `/today` redirects to `/sign-in?next=/today` and returns there after sign-in; sign-out returns to `/sign-in`; verify red
- [x] 4.2 Supabase clients: browser client, server client (cookies), service-role client in `src/server/supabase-admin.ts` with `server-only`; verify the admin-import guard test (see 7.3) lists every importer
- [x] 4.3 Implement `src/proxy.ts` (session refresh + optimistic redirect, matcher excluding static assets and token-auth APIs) and `requireUser()` (verified `getUser`, 401 for `/api/*`, onboarding gate); add Vitest tests for the access-decision branching (`src/lib/access.ts`); verify they pass
- [x] 4.4 Build `/sign-in` (email → "check your email" → code input, plus link callback route `/auth/confirm`) and sign-out action; custom email template containing link and code; verify 4.1 passes

## 5. Profile and onboarding

- [x] 5.1 Write Zod schema tests: age < 13 rejected, height 300 cm rejected, imperial height converted to cm before validation, timezone must be a valid IANA zone; verify red
- [x] 5.2 Implement profile schema + server actions (create on onboarding, update from Settings) storing metric values (profile row existence = onboarding complete); verify 5.1 passes
- [x] 5.3 Build `/onboarding` (browser-detected timezone prefilled, Europe/Copenhagen fallback, sex-field explanation copy) and Settings → Profile editor with unit-aware inputs; extend E2E: completing onboarding unlocks `/today`, editing height persists; verify E2E passes

## 6. Bring-your-own AI key

- [x] 6.1 Write tests for AES-256-GCM helper: round trip, tampered ciphertext/tag throws, different IV per encryption, wrong `key_version` fails clearly; verify red
- [x] 6.2 Implement `src/server/crypto.ts`; verify 6.1 passes
- [x] 6.3 Write tests (mocked fetch) for key validation: 200 → valid, 401/403 → rejected, network error/5xx → retry-later, and nothing stored on non-success; plus `getAnthropicClient` throws `MissingAiKeyError` with no key and marks `invalid_at` on a 401; assert no test log output contains the key; verify red
- [x] 6.4 Implement `src/server/ai/keys.ts` (save/replace/delete/status → `{ last4, addedAt, invalid }`), `src/server/ai/client.ts` (`getAnthropicClient`, model constants); verify 6.3 passes
- [x] 6.5 Build Settings → AI key UI (masked display, replace, delete, invalid-key banner) and a reusable `<RequiresAiKey>` wrapper that disables AI actions with a link to Settings; E2E: a rejected key stores nothing; a stored key (seeded through the app's encryption) shows `••••last4` and the page HTML never contains the full key; verify passes

## 7. Account data export and deletion

- [x] 7.1 Write DB tests: export as user A contains only A's rows, includes `schema_version` + `exported_at`, contains no `user_ai_keys` material; delete A removes A's rows and storage objects and leaves B intact; running delete twice is safe; verify red
- [x] 7.2 Implement the table/bucket registry, export route (`GET /api/account/export`, RLS client) and delete action (Storage prefix removal → `auth.admin.deleteUser`); verify 7.1 passes
- [x] 7.3 Add guard tests: every `public` table with a `user_id` column is in the registry; `supabase-admin` is imported only from the allowed `src/server/**` modules; verify both pass
- [x] 7.4 Build Settings → Data (export download, delete dialog requiring typed `DELETE`); E2E: cancel deletes nothing, confirmed delete signs out and re-sign-in creates an empty account; verify passes

## 8. App shell and PWA

- [x] 8.1 Add `manifest.ts`, icons (192, 512, maskable, apple-touch-icon), `appleWebApp` metadata, `viewportFit: cover` and safe-area padding; verify `/manifest.webmanifest` serves `display: standalone` and every icon URL resolves (Playwright `shell.spec.ts`)
- [x] 8.2 Build the `(app)` layout: bottom tab bar (< md) / sidebar (≥ md) for Today, Train, Eat, Body, Coach, Settings entry, dark-mode via `prefers-color-scheme`, 44 pt minimum targets; Playwright at iPhone and desktop viewports confirms the right nav renders and the active tab is highlighted
- [x] 8.3 Build the Today view for the user's local date with getting-started empty states and empty placeholder pages for Train/Eat/Body/Coach; verify E2E new-user flow lands on Today
- [ ] 8.4 Manual check on a real iPhone: add to home screen, launch standalone, sign in with code inside the installed app, content clears notch/home indicator; record result in the change notes

## 9. Final verification

- [x] 9.1 `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm test:e2e && pnpm build` all green
- [ ] 9.2 `openspec validate add-foundation --strict` passes and every spec scenario maps to at least one test (checklist in PR description)

## 1. Data and dependency

- [x] 1.1 Add `@anthropic-ai/foundry-sdk` and verify it dedupes to the app's `@anthropic-ai/sdk` (single install path)
- [x] 1.2 Write DB tests: foundry row without endpoint rejected; anthropic row with endpoint rejected; provider outside the enum rejected; clients still read nothing from `user_ai_keys`; verify red
- [x] 1.3 Migration adding `provider`, `endpoint`, `main_deployment`, `fast_deployment` + checks; apply locally, regenerate types; verify 1.2 passes

## 2. Endpoint and verification

- [x] 2.1 Write unit tests for `parseFoundryEndpoint` (valid with/without trailing slash, uppercase host normalised, http, other host, look-alike suffix, IP literal, port, userinfo, query, fragment, extra path) and deployment-name validation; verify red
- [x] 2.2 Implement `src/lib/ai/foundry-endpoint.ts`; verify 2.1 passes
- [x] 2.3 Write unit tests (injected fetch) for Foundry verification: 200 valid, 401/403 rejected, 404 deployment_not_found, 500/network unavailable, malformed endpoint never calls fetch; Anthropic path unchanged; verify red
- [x] 2.4 Implement provider-aware verification in `src/server/ai/verify-key.ts`; verify 2.3 passes

## 3. Storage, client and structured helper

- [x] 3.1 Extend DB tests for keys: save/read/replace across providers, status shows provider + endpoint host + last4, Anthropic→Foundry switch replaces the row, export contains no key or endpoint; verify red
- [x] 3.2 Generalise `src/server/ai/keys.ts` (save/status/read by provider) and `client.ts` (`getAnthropicClient` builds `AnthropicFoundry` for Foundry, `aiMetaOf` with resolved models, 401 → invalid for both); verify 3.1 and existing key tests pass
- [x] 3.3 Write unit tests for `parseStructured`: Anthropic sends fallbacks + main model; Foundry omits `betas`/`fallbacks` and uses the main deployment; refusal throws `AiRefusalError`; unparsable output returns null; verify red, then implement and verify green
- [x] 3.4 Replace `AI_MODELS.*` at call sites (voice parse, photo analysis record) with `aiMetaOf(client).models.*`; verify a grep shows model literals only in `src/server/ai/client.ts`

## 4. Refusal handling in features

- [x] 4.1 Write tests: meal recognition, meal suggestions, body-scan extraction, photo comparison, plan generation and weekly summary map `AiRefusalError` to an `ai_declined` error with the "Claude declined this request" message and save nothing; verify red
- [x] 4.2 Add `ai_declined` (422) to nutrition/body/coach error codes, map it in each feature, re-throw it from the two retry loops; verify 4.1 passes and existing feature tests stay green

## 5. Settings UI and docs

- [x] 5.1 Update the AI key card: provider select, Foundry fields (endpoint, key, optional main/fast deployment with defaults as placeholders), Azure billing/employer notice, masked status with provider + endpoint host, error messages per verdict; server action validates and maps verdicts
- [x] 5.2 E2E: selecting Foundry reveals the fields and the notice; a disallowed endpoint shows an error and stores nothing (row absent via admin query)
- [x] 5.3 Update README (AI row, Settings mention) and `docs/architecture.md` AI path; verify links render

## 6. Verification

- [x] 6.1 `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm build` and `pnpm test:e2e` all green
- [x] 6.2 `openspec validate --all --strict` passes

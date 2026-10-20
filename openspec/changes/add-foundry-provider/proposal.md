## Why

Some users already pay for Claude through Microsoft Foundry on their own Azure subscription and want to use that instead of a separate Anthropic key. Today the AI key field only accepts Anthropic keys (`sk-ant-…`), always calls `api.anthropic.com`, validates through Anthropic's Models API (absent on Foundry) and sends server-side refusal `fallbacks` (unsupported on Foundry), so a Foundry key cannot work.

## What Changes

- Settings → AI key offers a provider choice: **Anthropic** (default, unchanged) or **Microsoft Foundry**.
- Foundry credentials: endpoint (`https://<resource>.services.ai.azure.com/anthropic`), API key, and optional deployment names for the main and fast models (default `claude-opus-5-5` / `claude-haiku-4-5`).
- Strict endpoint allowlist enforced before any network call (SSRF protection).
- Foundry keys are validated with a free token-count call against the main deployment; failures store nothing and say why (rejected key, deployment not found, provider unreachable).
- Every AI feature (voice-log fallback, meal recognition, meal suggestions, body-scan extraction, photo comparison, weekly plan, weekly summary) runs on whichever provider the user chose, using that user's model/deployment names.
- On Foundry no server-side refusal fallback is requested; when Claude declines a request on either provider, the user sees a clear "Claude declined this request" message and nothing is saved.
- Settings help text warns that Foundry usage bills the user's own Azure subscription and that employer subscriptions should not be used.

## Non-goals

- Amazon Bedrock, Google Vertex AI or Claude Platform on AWS.
- Microsoft Entra ID (token) authentication — API keys only.
- Mixing providers per feature or per model.
- Client-side refusal-fallback middleware on Foundry.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `ai-key`: adds provider choice, Foundry credentials and validation, endpoint allowlist, per-user model resolution, and refusal handling. (The capability is introduced by the not-yet-archived `add-foundation` change; requirements here are added on top of it.)

## Impact

- Dependency: `@anthropic-ai/foundry-sdk` (shares the installed `@anthropic-ai/sdk`).
- Migration: `user_ai_keys` gains `provider`, `endpoint`, `main_deployment`, `fast_deployment` with consistency checks; RLS stays "no client access".
- Code: `src/server/ai/*` (keys, verification, client factory, structured helper), feature error mapping (nutrition, body, coach) for refusals, Settings AI key card.
- No change for existing Anthropic users: existing rows default to provider `anthropic`.

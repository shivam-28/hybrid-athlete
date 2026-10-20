## Purpose

Lets each user power the app's AI features with their own Claude access — an Anthropic API key or a Microsoft Foundry deployment — keeping credentials secret and costs their own.

## ADDED Requirements

### Requirement: AI provider choice
The system SHALL let a user choose Anthropic or Microsoft Foundry as their AI provider when saving credentials, with Anthropic preselected, and SHALL keep exactly one active set of AI credentials per user.

#### Scenario: Existing Anthropic user
- **WHEN** a user who saved an Anthropic key before this change opens Settings
- **THEN** the key is shown as an Anthropic key and every AI feature keeps working unchanged

#### Scenario: Switching provider
- **WHEN** a user with a stored Anthropic key successfully saves Foundry credentials
- **THEN** the Anthropic key is replaced and subsequent AI requests use Foundry

### Requirement: Foundry credentials
The system SHALL accept Foundry credentials consisting of an endpoint, an API key, and optional deployment names for the main and fast models, defaulting to `claude-opus-5-5` and `claude-haiku-4-5` when left blank.

#### Scenario: Default deployment names
- **WHEN** a user saves Foundry credentials without deployment names
- **THEN** AI requests use the deployments `claude-opus-5-5` for photos, documents and plans and `claude-haiku-4-5` for voice-log parsing

#### Scenario: Custom deployment names
- **WHEN** a user saves Foundry credentials with main deployment `opus-prod`
- **THEN** photo, document and plan requests use the deployment `opus-prod`

#### Scenario: Invalid deployment name
- **WHEN** a deployment name contains characters other than letters, digits, `.`, `_` or `-`, or is longer than 64 characters
- **THEN** nothing is stored and the field shows a validation error

### Requirement: Foundry endpoint allowlist
The system MUST reject, before making any network request, any Foundry endpoint that is not exactly `https://<resource>.services.ai.azure.com/anthropic` (optionally with a trailing slash), where `<resource>` contains only lowercase letters, digits and hyphens, and the URL has no credentials, port, query or fragment.

#### Scenario: Valid endpoint
- **WHEN** the user enters `https://my-res.services.ai.azure.com/anthropic/`
- **THEN** the endpoint is accepted and normalised without the trailing slash

#### Scenario: Look-alike host
- **WHEN** the user enters `https://my-res.services.ai.azure.com.evil.com/anthropic`
- **THEN** it is rejected without any network request and nothing is stored

#### Scenario: Non-HTTPS, IP, port or credentials
- **WHEN** the endpoint uses `http://`, an IP address, an explicit port, embedded `user@` credentials, a query string or a different path
- **THEN** it is rejected without any network request and nothing is stored

### Requirement: Foundry credential validation
The system SHALL verify Foundry credentials with a token-count request against the main deployment, which costs no generation tokens, and SHALL store nothing unless it succeeds.

#### Scenario: Valid credentials
- **WHEN** Foundry accepts the key and the main deployment exists
- **THEN** the credentials are stored and Settings shows the provider, the endpoint host and `••••` plus the key's last 4 characters

#### Scenario: Rejected key
- **WHEN** Foundry answers 401 or 403
- **THEN** nothing is stored and the user is told the key was rejected

#### Scenario: Missing deployment
- **WHEN** Foundry answers 404 for the main deployment
- **THEN** nothing is stored and the user is told that deployment, by name, was not found in their Foundry resource

#### Scenario: Provider unreachable
- **WHEN** the request fails with a network error or a 5xx status
- **THEN** nothing is stored and the user is asked to try again later

### Requirement: Credential secrecy across providers
The system MUST encrypt the Foundry API key exactly as Anthropic keys are encrypted and MUST never return the key or endpoint in API responses other than the masked status, in logs, or in data exports.

#### Scenario: Export with Foundry credentials
- **WHEN** a user with stored Foundry credentials exports their data
- **THEN** the export contains no key material and no endpoint

### Requirement: Provider-transparent AI features
The system SHALL run every AI feature on the user's chosen provider and resolved models, and MUST NOT request server-side refusal fallbacks when the provider is Foundry.

#### Scenario: Meal photo on Foundry
- **WHEN** a Foundry user recognises a meal photo
- **THEN** the request goes to their Foundry endpoint using their main deployment, without a fallback request, and the result is shown for confirmation as on Anthropic

#### Scenario: Invalid Foundry key at use time
- **WHEN** Foundry rejects a stored key with 401 during an AI feature
- **THEN** the credentials are marked invalid and the user is prompted to replace them, as for Anthropic keys

### Requirement: Declined requests
The system SHALL tell the user "Claude declined this request" with a suggestion to try different input whenever Claude refuses a structured request (after any provider-side fallback), and MUST NOT save any partial result.

#### Scenario: Declined meal photo
- **WHEN** Claude declines to analyse a meal photo
- **THEN** the user sees that Claude declined the request and no meal draft or item is created

#### Scenario: Declined voice-log parse
- **WHEN** Claude declines the fallback parse of a spoken set
- **THEN** the app falls back to the manual exercise confirmation card and saves nothing automatically

### Requirement: Azure billing notice
The system SHALL show, next to the Foundry option, that usage is billed to the user's own Azure subscription and that employer-owned subscriptions should not be used.

#### Scenario: Choosing Foundry
- **WHEN** the user selects Microsoft Foundry in Settings
- **THEN** the billing and employer-subscription notice is visible before saving

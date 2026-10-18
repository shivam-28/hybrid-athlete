## Purpose

Lets each user power the app's AI features with their own Anthropic API key, keeping that key secret and making costs their own.

## ADDED Requirements

### Requirement: Save and validate key
The system SHALL let a user save an Anthropic API key in Settings and SHALL verify with Anthropic, at no token cost, that the key is accepted before storing it.

#### Scenario: Valid key
- **WHEN** the user submits a key that Anthropic accepts
- **THEN** the key is stored and Settings shows it as active with only its last 4 characters visible

#### Scenario: Invalid key
- **WHEN** the user submits a key that Anthropic rejects
- **THEN** nothing is stored and the user sees that the key was rejected

#### Scenario: Anthropic unreachable
- **WHEN** Anthropic cannot be reached during validation
- **THEN** nothing is stored and the user is asked to retry later

### Requirement: Key secrecy
The system MUST encrypt the stored key at rest with an instance secret that is not stored in the database, and MUST never send the full key back to any browser, log, or error message.

#### Scenario: Viewing settings
- **WHEN** the user opens Settings after saving a key
- **THEN** the response contains only the masked key and when it was added

#### Scenario: Database-only exposure
- **WHEN** someone obtains a copy of the database without the instance secret
- **THEN** the stored key cannot be recovered from it

#### Scenario: Direct table access from a client
- **WHEN** any client, including the key's owner, queries the stored key directly through the database API
- **THEN** no ciphertext or key material is returned

### Requirement: Replace and delete key
The system SHALL let the user replace their key or delete it at any time.

#### Scenario: Delete key
- **WHEN** the user deletes their key
- **THEN** the stored key is erased and AI features become unavailable for that user

### Requirement: AI requests use the owner's key
The system MUST make every AI request on behalf of a user with that user's own key, and never with another user's key or an instance-wide key.

#### Scenario: Two users use AI features
- **WHEN** user A and user B each trigger an AI feature
- **THEN** user A's request is billed to user A's key and user B's request to user B's key

### Requirement: Graceful behaviour without a key
The system SHALL keep all non-AI functionality working for users without a key and SHALL show AI-only actions as unavailable, with a link to add a key.

#### Scenario: No key configured
- **WHEN** a user without a key opens a screen with an AI-only action
- **THEN** that action is disabled with an explanation and a link to Settings, and the rest of the screen works normally

#### Scenario: Key revoked at Anthropic
- **WHEN** an AI request fails because Anthropic rejects the stored key
- **THEN** the user sees that their key is no longer valid and is prompted to replace it, and no partial results are saved

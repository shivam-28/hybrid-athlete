## Purpose

Lets a user push daily health metrics and workouts from Apple Health (where Garmin Connect writes them) into the app via an iOS Shortcut, using a personal token instead of a browser session.

## ADDED Requirements

### Requirement: Ingest token generation
The system SHALL let a signed-in user generate a personal ingest token from Settings, display the full token exactly once at creation, and persist only a one-way hash of it.

#### Scenario: Token shown once
- **WHEN** the user generates an ingest token
- **THEN** the full token is displayed with a copy action
- **AND** after leaving or reloading the page only a masked form (prefix plus last 4 characters) and the creation date are shown

#### Scenario: Token not recoverable from storage
- **WHEN** the stored token record is read from the database
- **THEN** it contains no value from which the original token can be reconstructed

### Requirement: Single active token with rotation and revocation
The system SHALL allow at most one active ingest token per user; generating a new token MUST revoke the previous one, and the user SHALL be able to revoke the active token without replacing it.

#### Scenario: Rotation invalidates old token
- **WHEN** the user generates a new token while one is active
- **THEN** requests authenticated with the old token are rejected with HTTP 401
- **AND** requests with the new token are accepted

#### Scenario: Revocation
- **WHEN** the user revokes the active token
- **THEN** requests authenticated with that token are rejected with HTTP 401
- **AND** Settings shows that no ingest token is active

### Requirement: Token-authenticated ingest endpoint
The system SHALL expose an HTTPS ingest endpoint that authenticates requests solely by a bearer ingest token, attributes all ingested data to the token's owner, and MUST NOT accept browser session cookies as authentication.

#### Scenario: Missing or invalid token
- **WHEN** a request has no `Authorization: Bearer` header or an unknown token
- **THEN** the system responds with HTTP 401 and stores nothing

#### Scenario: Data attributed to token owner
- **WHEN** user A's valid token posts a payload
- **THEN** the data is stored for user A only and is not visible to any other user

#### Scenario: Session cookie alone is rejected
- **WHEN** a request carries a valid signed-in session cookie but no ingest token
- **THEN** the system responds with HTTP 401

### Requirement: Ingest payload contract
The system SHALL accept a JSON payload containing an optional `daily` array and an optional `workouts` array, validate it against a published schema, and reject invalid payloads atomically with HTTP 400 and a field-level error description.

Each `daily` entry SHALL contain a local calendar `date` (YYYY-MM-DD) and MAY contain `steps`, `active_energy_kcal`, `resting_hr_bpm`, `hrv_sdnn_ms`, `sleep_minutes`, `sleep_start`, `sleep_end`, `vo2max`, `weight_kg`. Each `workouts` entry SHALL contain `sport` (one of running, walking, cycling, strength, swimming, other), `start` and `end` (ISO 8601 with offset) and `duration_s`, and MAY contain `external_id`, `distance_m`, `active_energy_kcal`, `avg_hr`, `max_hr`, `source_name`.

#### Scenario: Partial daily metrics accepted
- **WHEN** a daily entry contains only `date` and `steps`
- **THEN** the system stores the steps value and leaves all other metrics for that date unchanged

#### Scenario: Invalid payload rejected atomically
- **WHEN** a payload contains three valid workouts and one workout with `end` earlier than `start`
- **THEN** the system responds with HTTP 400 identifying the invalid entry
- **AND** none of the four workouts are stored

#### Scenario: Out-of-range values rejected
- **WHEN** a daily entry contains a negative `steps` value or a `resting_hr_bpm` outside 20–250
- **THEN** the system responds with HTTP 400

#### Scenario: Unknown sport rejected
- **WHEN** a workout is sent with a sport value not in the allowed list
- **THEN** the system responds with HTTP 400 naming the allowed values

### Requirement: Request limits
The ingest endpoint SHALL reject request bodies larger than 1 MB with HTTP 413 and SHALL reject more than 30 requests per token per hour with HTTP 429.

#### Scenario: Oversized body
- **WHEN** a request body exceeds 1 MB
- **THEN** the system responds with HTTP 413 and stores nothing

#### Scenario: Rate limit exceeded
- **WHEN** a token sends its 31st request within one hour
- **THEN** the system responds with HTTP 429 including a retry-after indication

### Requirement: Idempotent ingestion
The system SHALL make ingestion idempotent: daily metrics MUST be keyed by user and local date, and workouts MUST be keyed by `external_id` when present, otherwise by user, sport and a start time within ±2 minutes. Re-posting identical data MUST NOT create duplicates, and the response SHALL report counts of inserted, updated and unchanged records.

#### Scenario: Repost produces no duplicates
- **WHEN** the same payload is posted twice
- **THEN** the second response reports zero inserted records
- **AND** the stored record count is the same as after the first post

#### Scenario: Updated value overwrites
- **WHEN** a daily entry for a date already stored is posted with a higher `steps` value
- **THEN** the stored steps value for that date is replaced and the response counts it as updated

#### Scenario: Workout matched by start-time window
- **WHEN** a workout without `external_id` is posted with the same sport and a start time 90 seconds later than a stored workout
- **THEN** the system updates the stored workout instead of creating a new one

### Requirement: Missing metrics are not zero
The system SHALL store metrics absent from a payload as unknown, never as zero, and every view SHALL display unknown metrics as "not available".

#### Scenario: HRV not provided by the watch
- **WHEN** daily entries never include `hrv_sdnn_ms`
- **THEN** the HRV value is shown as "not available" rather than 0 and is excluded from averages

### Requirement: Sync status visibility
The system SHALL show in Settings the timestamp of the last successful ingest request (in the user's timezone) and the record counts from that request.

#### Scenario: Last sync shown
- **WHEN** an ingest request succeeds
- **THEN** Settings shows its time in the user's timezone and its inserted/updated/unchanged counts

#### Scenario: Never synced
- **WHEN** no ingest request has ever succeeded for the user
- **THEN** Settings shows "Never synced" with a link to the setup guide

### Requirement: Shortcut setup guide
The system SHALL provide an in-app setup guide that explains, step by step, how to build an iOS Shortcut that reads Apple Health samples and posts them to the ingest endpoint, how to schedule it as a daily Personal Automation, and how to send a test request. It SHALL pre-fill the user's endpoint URL and show the payload format.

#### Scenario: Guide includes user-specific endpoint
- **WHEN** the user opens the setup guide
- **THEN** the guide shows the full ingest URL for this instance and a copyable test command whose payload matches the documented schema

#### Scenario: Guide without an active token
- **WHEN** the user opens the setup guide without an active ingest token
- **THEN** the guide prompts the user to generate one before continuing

## Purpose

Generates and manages a safe, personalised 7-day hybrid training plan (strength, running, core, mobility, rest) from each user's recent training. The plan builds an aerobic base toward a marathon, and deterministic guardrails check every AI-generated plan before the user sees it.

## ADDED Requirements

### Requirement: Training preferences
The system SHALL let each user set and edit training preferences: days available per week (1–7), maximum session length in minutes, preferred long-run weekday, equipment access (`gym` or `home`), and an optional target race made of distance (5 km, 10 km, half marathon, marathon, or a custom distance in km), race date and optional goal finish time. Plan generation MUST be unavailable until preferences exist.

#### Scenario: Save preferences
- **WHEN** a user saves 5 available days, 75-minute max sessions, Sunday long run, gym access and no race
- **THEN** the preferences are stored for that user and plan generation becomes available

#### Scenario: Race date in the past is rejected
- **WHEN** a user saves a target race whose date is before today in their timezone
- **THEN** the save is rejected with a validation message and existing preferences are unchanged

#### Scenario: Generation blocked without preferences
- **WHEN** a user without saved preferences opens the plan screen
- **THEN** they are prompted to complete preferences and no generate action is offered

### Requirement: Race phase derivation
The system SHALL derive the current training phase deterministically from weeks remaining to the target race. With no race, or with the race more than 16 weeks away, the phase MUST be `base`. Between 16 and 7 weeks inclusive it MUST be `build`. Between 6 and 3 weeks inclusive it MUST be `peak`. At 2 weeks or fewer it MUST be `taper`.

#### Scenario: No race set
- **WHEN** a user has no target race
- **THEN** the derived phase is `base`

#### Scenario: Race 10 weeks out
- **WHEN** the target race date is 10 weeks after the plan week's start
- **THEN** the derived phase is `build`

#### Scenario: Race 2 weeks out
- **WHEN** the target race date is 2 weeks after the plan week's start
- **THEN** the derived phase is `taper`

### Requirement: Weekly plan generation
The system SHALL generate a 7-day plan for a chosen week (Monday–Sunday in the user's timezone) using the user's own Anthropic API key. Inputs MUST be the user's preferences, derived phase, the last 4 completed weeks of logged strength training and recorded activities, strength and running experience levels, and body goal phase. The output MUST be structured and contain, for each day, zero or more sessions of type `strength`, `run`, `core`, `mobility`, or a `rest` marker. Strength sessions MUST include a focus (`upper`, `lower`, `full`, `push`, `pull` or `legs`) and exercises from the exercise library with sets and a rep range. Run sessions MUST include a run type (`easy`, `long`, `tempo`, `intervals` or `recovery`), a target distance or duration, and a target HR zone or pace. No session MUST exceed the user's maximum session length, and training sessions MUST only be scheduled on as many days as the user has available.

#### Scenario: Plan generated from recent training
- **WHEN** a user with preferences, an API key and 4 weeks of history requests a plan for next week
- **THEN** a draft plan for that Monday–Sunday is created and shown, and every session conforms to the structure above

#### Scenario: Exercise not in library
- **WHEN** the AI output references an exercise that does not exist in the exercise library or the user's custom exercises
- **THEN** that output is treated as invalid, and the plan is not shown until it passes validation or the repair attempt

#### Scenario: No API key
- **WHEN** a user without a stored Anthropic key requests a plan
- **THEN** generation does not run and the user is directed to add a key in Settings

#### Scenario: New user with no history
- **WHEN** a user with no logged training requests a plan
- **THEN** a plan is generated treating the previous weekly run volume as 0 km, and the volume guardrail uses the minimum allowance

### Requirement: Deterministic plan guardrails
The system SHALL validate every generated plan server-side against these rules, independent of the AI:
(1) total planned run distance MUST NOT exceed the greater of 110% of the previous 4-week average weekly run distance and that average plus 3 km;
(2) at least one day MUST be a full rest day;
(3) at least 80% of planned run time MUST be easy intensity (HR zone 1–2, or `easy`, `long` or `recovery` run types);
(4) the long run MUST NOT exceed 35% of the week's planned run distance;
(5) no lower-body-focused strength session (`lower`, `legs` or `full`) MUST be scheduled on the day before a long, tempo or interval run;
(6) every major muscle group (chest, back, shoulders, quads, hamstrings, glutes, core) MUST be targeted on at least 2 days of the week;
(7) for users whose strength or running experience is `beginner`, no more than 3 consecutive days MUST contain a strength, tempo, interval or long-run session.
Run-volume rules (1), (3) and (4) are evaluated on distance when present, and otherwise on duration converted at the user's recent average easy pace.

#### Scenario: Volume ramp exceeded
- **WHEN** a plan proposes 30 km for a user whose previous 4-week average is 20 km/week
- **THEN** validation reports a volume violation (limit 23 km)

#### Scenario: Low base allowance
- **WHEN** a plan proposes 8 km for a user whose previous 4-week average is 5 km/week
- **THEN** no volume violation is reported (limit is 5 + 3 = 8 km)

#### Scenario: Heavy legs before long run
- **WHEN** a `lower` strength session is on Saturday and the long run is on Sunday
- **THEN** validation reports a scheduling violation naming both sessions

#### Scenario: Compliant plan
- **WHEN** a plan satisfies all seven rules
- **THEN** validation reports no violations

### Requirement: Single repair attempt and warnings
When a generated plan has structural or guardrail violations, the system SHALL make exactly one repair request to the AI that lists every violation. If the repaired plan still violates any rule, the system MUST still show the plan, mark each violating session or day with a warning explaining the rule, and require explicit acknowledgement before acceptance. Structurally invalid output that still fails after repair MUST NOT be shown; an error with a retry option is shown instead.

#### Scenario: Repair succeeds
- **WHEN** the first plan violates the long-run share rule and the repaired plan is compliant
- **THEN** only the compliant plan is shown and it carries no warnings

#### Scenario: Repair still violates
- **WHEN** the repaired plan still has no rest day
- **THEN** the plan is shown with a "no rest day" warning and the accept action requires acknowledging it

#### Scenario: Unparseable output twice
- **WHEN** both the initial and repair responses fail structural validation
- **THEN** no plan is saved and the user sees an error with a retry action

### Requirement: Review, edit and accept
The system SHALL show a draft plan for review and let the user regenerate it, edit any session (type, details, day) or delete it, and accept it. Guardrails MUST be re-evaluated after every edit. Accepting MUST make the plan the single active plan for that week; a previously active plan for the same week MUST be superseded but kept in history.

#### Scenario: Edit triggers revalidation
- **WHEN** the user moves the long run from Sunday to Saturday where Friday has a `legs` session
- **THEN** the scheduling warning appears immediately

#### Scenario: Accept supersedes previous plan
- **WHEN** a user accepts a new plan for a week that already has an active plan
- **THEN** the new plan is active, the old one is marked superseded, and both appear in plan history

### Requirement: Planned sessions on Today and auto-completion
The system SHALL show the active plan's sessions for the current day on the Today view. A planned session MUST be marked complete automatically when, on the same local date, a workout session is logged (for `strength` or `core` planned sessions) or a run activity is recorded (for `run` planned sessions). Each logged or recorded item MUST complete at most one planned session. The user MUST be able to mark a session complete or skipped manually, or undo an automatic completion.

#### Scenario: Synced run completes planned run
- **WHEN** a run activity on Tuesday is synced and Tuesday has a planned easy run
- **THEN** the planned easy run is marked complete and linked to that activity

#### Scenario: Different date does not match
- **WHEN** a planned Wednesday strength session exists and the user logs a strength workout on Thursday
- **THEN** the Wednesday session stays incomplete

#### Scenario: Manual skip
- **WHEN** the user marks today's tempo run as skipped
- **THEN** it is recorded as skipped and excluded from adherence as completed

### Requirement: Plan data isolation
Training preferences, plans and planned sessions SHALL be readable and writable only by their owning user.

#### Scenario: Cross-user access denied
- **WHEN** user A requests user B's training plan by id
- **THEN** no data is returned

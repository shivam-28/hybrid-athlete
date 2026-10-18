## Purpose

Lets users record strength and conditioning work as sessions made up of sets, edit that record, and review history and weekly muscle-group volume.

## ADDED Requirements

### Requirement: Workout sessions on the user's local day
A workout session SHALL belong to one user and to one calendar day, computed in the user's profile timezone at the moment the session starts. A session SHALL have a start time and an optional finish time, both stored in UTC.

#### Scenario: Late-night session in Copenhagen
- **WHEN** a user with timezone Europe/Copenhagen starts a session at 00:30 local time on 2026-10-19 (22:30 UTC on 2026-10-18)
- **THEN** the session's day is 2026-10-19

#### Scenario: Finish a session
- **WHEN** the user finishes an active session
- **THEN** the finish time is recorded, the session duration is shown, and the session no longer accepts sets until reopened

#### Scenario: Session isolation
- **WHEN** user B requests user A's session by identifier
- **THEN** the system returns not found and discloses no data

### Requirement: Active session
A user SHALL have at most one active (unfinished) session at a time. Logging a set when no session is active SHALL start a new session for today.

#### Scenario: Set logged with no active session
- **WHEN** a user logs a set and has no active session
- **THEN** a session is started for today and the set is attached to it

#### Scenario: Starting a second session
- **WHEN** a user with an active session starts another session
- **THEN** the system asks whether to finish the active session first and does not create two active sessions

### Requirement: Logging sets
Users SHALL be able to add a set to a session by choosing an exercise and entering the fields its tracking mode requires. Set fields are weight, reps, duration in seconds, distance in meters, optional RPE (1–10), and set type (`warmup`, `working`, `drop`, `failure`; default `working`). The set number SHALL auto-increment per exercise within the session.

#### Scenario: Log weight and reps
- **WHEN** the user logs Dumbbell Shoulder Press at 12 kg for 15 reps as the first set of that exercise in the session
- **THEN** a working set numbered 1 is saved with weight 12 kg and 15 reps

#### Scenario: Set numbering per exercise
- **WHEN** the user logs two sets of Squat and then one set of Plank
- **THEN** the Squat sets are numbered 1 and 2 and the Plank set is numbered 1

#### Scenario: Required fields by tracking mode
- **WHEN** the user submits a set for a `duration` exercise without a duration
- **THEN** the set is rejected with a message that duration is required

### Requirement: Value validation
The system MUST reject sets with impossible values. Reps SHALL be an integer from 1 to 100, weight 0 to 500 kg, duration 1 to 7200 seconds, distance 1 to 50000 meters, and RPE 1 to 10 in 0.5 steps.

#### Scenario: Reject negative weight
- **WHEN** a set is submitted with weight −5 kg
- **THEN** it is rejected with a validation message and nothing is saved

#### Scenario: Reject excessive reps
- **WHEN** a set is submitted with 250 reps
- **THEN** it is rejected with a validation message and nothing is saved

### Requirement: Unit handling
Weights SHALL be stored in kilograms. Users SHALL enter and see weights in their preferred unit system. Values entered in pounds SHALL be converted to kilograms on save (1 lb = 0.45359237 kg) and displayed rounded to 0.5 kg or 1 lb.

#### Scenario: Imperial user logs pounds
- **WHEN** a user with imperial preference logs 35 lb
- **THEN** the stored weight is 15.88 kg (to 2 decimals) and the user sees 35 lb

#### Scenario: Metric user sees kilograms
- **WHEN** a metric user views a set stored as 15.88 kg
- **THEN** the display shows 16 kg

### Requirement: Quick actions and editing
Users SHALL be able to repeat the last set of the current exercise in one action, and to edit or delete any set they own. Deleting a set SHALL renumber the remaining sets of that exercise in the session to stay contiguous.

#### Scenario: Repeat last set
- **WHEN** the user's last Squat set was 60 kg × 8 and they choose "repeat last set"
- **THEN** a new Squat set numbered one higher is saved at 60 kg × 8

#### Scenario: Delete middle set
- **WHEN** the user deletes set 2 of 3 for Squat
- **THEN** the remaining Squat sets are numbered 1 and 2

### Requirement: Previous performance shown while logging
When an exercise is opened in a session, the system SHALL show the sets logged for that exercise in the user's most recent previous session that included it.

#### Scenario: Previous session exists
- **WHEN** the user opens Bench Press and last benched 3 days ago for 3 × 8 at 50 kg
- **THEN** the system shows "Last time: 50 kg × 8, 8, 8" with that session's date

#### Scenario: Never performed
- **WHEN** the user opens an exercise they have never logged
- **THEN** the system shows no previous performance and does not error

### Requirement: Workout history
Users SHALL be able to list past sessions newest first, open a session to see all sets grouped by exercise, and view an exercise's full history across sessions with its best set by estimated one-rep max (Epley) for weight × reps exercises.

#### Scenario: Session history list
- **WHEN** the user opens workout history
- **THEN** sessions are listed newest first with day, duration, exercise count and working-set count

#### Scenario: Exercise history with best set
- **WHEN** the user opens history for Bench Press with sets 50 kg × 10 and 55 kg × 6
- **THEN** both are listed and 50 kg × 10 is marked as the best set (estimated 1RM 66.7 kg vs 66.0 kg)

### Requirement: Weekly muscle-group volume
The system SHALL compute, per user and per ISO week in the user's timezone, the number of working sets per muscle group. A set counts 1 for each primary group and 0.5 for each secondary group of its exercise. Warm-up sets MUST NOT count.

#### Scenario: Primary and secondary credit
- **WHEN** a user logs 3 working sets of Bench Press (primary chest, secondary triceps and shoulders) in a week
- **THEN** that week's volume is chest 3, triceps 1.5, shoulders 1.5

#### Scenario: Warm-ups excluded
- **WHEN** a user logs 2 warm-up sets and 3 working sets of Squat
- **THEN** only the 3 working sets contribute to that week's volume

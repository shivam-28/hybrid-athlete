## Purpose

Turns a quick daily check-in and any available recovery signals into a transparent green, amber or red readiness decision. That decision adjusts the day's planned training, keeps the day's nutrition targets in step with planned training, and feeds a Sunday weekly review of the plan against what was actually done.

## ADDED Requirements

### Requirement: Daily check-in
The system SHALL offer one check-in per user per local date with four items scored 1–5, where 5 is always best: sleep quality, muscle soreness (5 = none), energy, and stress (5 = lowest). It MUST also offer an optional "pain or injury" flag with a free-text note. The check-in MUST be completable in at most 5 taps plus submit. Resubmitting on the same date MUST replace that date's check-in.

#### Scenario: Submit check-in
- **WHEN** a user submits sleep 4, soreness 3, energy 4, stress 3 on 2026-10-18
- **THEN** one check-in is stored for that user and date and readiness is computed

#### Scenario: Resubmit same day
- **WHEN** the user submits a second check-in on the same local date
- **THEN** it replaces the first and readiness is recomputed

#### Scenario: Out of range value
- **WHEN** a check-in item is submitted with value 0 or 6
- **THEN** the submission is rejected with a validation error

### Requirement: Objective recovery signals
When data is available, the system SHALL evaluate these signals against the user's personal 28-day baseline, ending the day before:
- last night's sleep is negative when it is below 85% of the baseline mean or below 6 hours;
- resting heart rate is negative when it is at least 5 bpm above the baseline mean;
- HRV is negative when it is more than 1 standard deviation below the baseline mean;
- the acute:chronic load ratio, as computed by `activity-history` (acute load ÷ chronic load), is negative above 1.5, and produces a non-negative "detraining" note below 0.8.
A baseline signal MUST be reported as unavailable when its 28-day window has fewer than 14 days of data. The load signal MUST be reported as unavailable whenever `activity-history` does not yet show a ratio. Unavailable signals MUST NOT affect the score.

#### Scenario: Elevated resting HR
- **WHEN** the baseline resting HR is 52 bpm and today's is 58 bpm
- **THEN** the resting-HR signal is negative

#### Scenario: Insufficient baseline
- **WHEN** a user has only 9 days of HRV data in the last 28 days
- **THEN** the HRV signal is shown as unavailable and does not affect the score

#### Scenario: Load spike
- **WHEN** the 7-day load is 1.6 times the 28-day average weekly load
- **THEN** the load signal is negative

### Requirement: Deterministic readiness score
The system SHALL compute readiness deterministically from the check-in and available objective signals, without the AI:
- `red` when the pain flag is set, or the mean of the four check-in items is ≤ 2.0, or there are 3 or more negative signals, or there are 2 or more negative signals and the check-in mean is below 3.0;
- otherwise `amber` when the check-in mean is below 3.0, or any check-in item is 1, or there is at least 1 negative signal;
- otherwise `green`.
The result MUST list each contributing reason (for example "Resting HR +6 bpm vs baseline"). Readiness MUST be computable from the check-in alone, with no wearable data.

#### Scenario: Subjective-only green
- **WHEN** a user with no wearable data submits 4, 4, 4, 4
- **THEN** readiness is `green` and the objective signals are shown as unavailable

#### Scenario: One negative signal makes amber
- **WHEN** the check-in mean is 3.5 and resting HR is negative
- **THEN** readiness is `amber` with the reason "Resting HR above baseline"

#### Scenario: Pain flag forces red
- **WHEN** the user sets the pain flag with any item scores
- **THEN** readiness is `red`, the user is told to consult a qualified professional for pain or injury, and no diagnosis is offered

#### Scenario: Two signals with low mood
- **WHEN** the check-in mean is 2.75 and sleep and HRV are negative
- **THEN** readiness is `red`

### Requirement: Session adjustment by readiness
The system SHALL propose an adjustment to today's planned sessions based on readiness. For `green`, sessions remain as planned. For `amber`, tempo and interval runs become easy runs of the same duration, long runs are shortened by 25% at easy intensity, strength sessions drop one set per exercise with effort capped at RPE 8, and core and mobility are unchanged. For `red`, every session is replaced by rest, mobility, or an easy walk of at most 30 minutes. The original session MUST be kept and shown alongside the adjustment, and the user MUST be able to accept the adjustment or override it and keep the original.

#### Scenario: Amber downgrades intervals
- **WHEN** readiness is `amber` and today has a 45-minute interval run
- **THEN** the proposed session is a 45-minute easy run, with the original intervals shown for reference

#### Scenario: Red replaces lifting
- **WHEN** readiness is `red` and today has a lower-body strength session
- **THEN** the proposed session is rest or mobility

#### Scenario: User override
- **WHEN** readiness is `amber` and the user chooses "keep original"
- **THEN** the original session stays active and the override is recorded on that day's readiness

#### Scenario: No plan
- **WHEN** a user has no active plan for today
- **THEN** readiness and its reasons are shown with general guidance and no session adjustment is proposed

### Requirement: Planned session energy in daily nutrition targets
The system SHALL include planned training in the day's nutrition targets (owned by `nutrition-targets`) before the training is recorded. For each of today's active planned sessions that is not completed or skipped, an estimated session energy (based on readiness-adjusted session parameters and the user's trend weight) MUST be added to the day's exercise energy. The planned run duration MUST count toward the training-day carbohydrate floor classification. Once a planned session is completed by a logged workout or recorded activity, the estimate MUST be replaced by that item's recorded energy, as defined by `nutrition-targets`. A skipped session MUST contribute zero.

#### Scenario: Long run raises morning targets
- **WHEN** at 07:00 a user has an incomplete planned 18 km long run and no activity recorded yet
- **THEN** today's calorie and carbohydrate targets already include the run's estimated energy, and the day is classified for the ≥ 90-minute carbohydrate floor when the planned duration is at least 90 minutes

#### Scenario: Actual replaces estimate
- **WHEN** the long run syncs with 1,150 kcal of recorded active energy
- **THEN** the estimate is removed and today's targets use 1,150 kcal for that session

#### Scenario: Skip removes energy
- **WHEN** the user marks today's planned run as skipped
- **THEN** that run contributes no exercise energy to today's targets

### Requirement: Sunday weekly review
The system SHALL provide a weekly review for any completed or current plan week. It is highlighted on the Today view on Sunday in the user's timezone. The review MUST show: planned vs completed sessions and adherence percentage (completed ÷ planned non-rest sessions), total running distance vs planned, strength working sets per major muscle group, and the 7-day weight trend vs the user's goal direction. When the user has an Anthropic key, the review MUST also offer a one-paragraph AI coach summary grounded only in these figures. Without a key, every figure MUST still be shown.

#### Scenario: Review figures
- **WHEN** a week had 9 planned non-rest sessions and 7 were completed
- **THEN** adherence shows 78%

#### Scenario: Review without key
- **WHEN** a user without an Anthropic key opens the weekly review
- **THEN** all figures are shown and the AI summary section explains that a key enables it

### Requirement: Readiness data isolation
Check-ins, readiness results and weekly reviews SHALL be readable and writable only by their owning user.

#### Scenario: Cross-user access denied
- **WHEN** user A requests user B's check-in for a date
- **THEN** no data is returned

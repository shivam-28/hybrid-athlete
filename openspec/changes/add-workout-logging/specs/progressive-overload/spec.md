## Purpose

Gives users a concrete, rule-based target for each exercise's next session using double progression. This keeps strength training progressing without AI cost and without changing anything automatically.

## ADDED Requirements

### Requirement: Per-exercise progression settings
Each exercise SHALL have a target rep range and a weight increment that the user can override per exercise. Defaults SHALL be: compound weight × reps exercises 6–10 reps, isolation weight × reps exercises 10–15 reps, bodyweight reps exercises 8–15 reps, duration exercises +5 s per session. Default increments SHALL be: barbell 2.5 kg, dumbbell 2 kg, machine and cable 2.5 kg, kettlebell 4 kg, all others 2.5 kg.

#### Scenario: Defaults applied
- **WHEN** a user opens progression settings for Barbell Squat, a compound barbell exercise, without overrides
- **THEN** the rep range is 6–10 and the increment is 2.5 kg

#### Scenario: User override
- **WHEN** the user sets the increment for Dumbbell Lateral Raise to 1 kg
- **THEN** future suggestions for that exercise use 1 kg steps and other exercises are unaffected

### Requirement: Baseline for new exercises
When a user has no completed previous session containing working sets of an exercise, the system SHALL show "establish a baseline" guidance instead of a numeric target.

#### Scenario: First time
- **WHEN** the user opens an exercise they have never logged
- **THEN** the suggestion reads as baseline guidance with the target rep range and no weight target

### Requirement: Double progression suggestion
For weight × reps exercises, the system SHALL base its suggestion on the working sets of the most recent previous session for that exercise. If every working set reached the top of the rep range at the same weight, it SHALL suggest that weight plus the increment at the bottom of the rep range. Otherwise it SHALL suggest the same top working weight and one more rep on the lowest-rep working set.

#### Scenario: Top of range hit
- **WHEN** last session's Dumbbell Shoulder Press working sets were 12 kg × 15, 15, 15 with range 10–15 and increment 2 kg
- **THEN** the suggestion is 14 kg for 10 reps per set

#### Scenario: Top of range not yet reached
- **WHEN** last session's Bench Press working sets were 50 kg × 10, 9, 8 with range 6–10
- **THEN** the suggestion is 50 kg, aiming for 10, 9, 9 (one more rep on the lowest set)

### Requirement: Bodyweight and duration progression
For bodyweight reps exercises, the system SHALL suggest one more rep until every working set reaches the top of the range, then suggest adding the increment as added weight at the bottom of the range. For duration exercises, it SHALL suggest the longest working hold from the previous session plus the duration increment.

#### Scenario: Bodyweight to weighted
- **WHEN** last session's Pull-up working sets were bodyweight × 15, 15, 15 with range 8–15
- **THEN** the suggestion is +2.5 kg added weight for 8 reps

#### Scenario: Plank progression
- **WHEN** last session's longest working Plank hold was 60 s
- **THEN** the suggestion is a 65 s hold

### Requirement: Stall and regression handling
When the user's performance on an exercise has dropped in each of the last 2 sessions compared with the session before, the system SHALL suggest a deload of 10% of the top working weight (rounded to the increment) instead of a progression target. Performance means best estimated 1RM for weight × reps, best reps for bodyweight, and longest hold for duration.

#### Scenario: Two consecutive drops
- **WHEN** Squat's best estimated 1RM went 90 → 87 → 84 kg over the last three sessions
- **THEN** the suggestion is a deload at 10% less than the latest top working weight, labelled as a deload

#### Scenario: Single drop
- **WHEN** performance dropped in only the most recent session
- **THEN** the normal double-progression suggestion is shown

### Requirement: Suggestions are advisory only
The suggestion SHALL be shown when the exercise is opened in a session. It MUST NOT pre-fill saved values or alter any logged set without explicit user action.

#### Scenario: Suggestion shown, not applied
- **WHEN** the user opens Bench Press and sees "Today: 52.5 kg × 6"
- **THEN** no set is created until the user logs one, and logging different values is accepted without warning

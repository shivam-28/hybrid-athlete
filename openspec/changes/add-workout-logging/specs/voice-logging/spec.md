## Purpose

Lets users log sets hands-free by speaking or typing natural phrases such as "shoulder press 1st set 12 kg 15 reps done". The phrase is turned into structured sets, and the system decides whether to save immediately or ask for confirmation.

## ADDED Requirements

### Requirement: Speech and text capture
The system SHALL offer a microphone control that transcribes speech using the browser's speech recognition. It SHALL also offer a text input that accepts typed or keyboard-dictated phrases. Both inputs SHALL go through the same parsing pipeline. Audio MUST NOT be uploaded to or stored by the application.

#### Scenario: Speech recognition available
- **WHEN** the user taps the microphone and says "squat 60 kg 8 reps"
- **THEN** the transcript is shown and submitted for parsing

#### Scenario: Speech recognition unavailable
- **WHEN** the browser does not support speech recognition or permission is denied
- **THEN** the microphone control is hidden or disabled with an explanation and the text input remains usable

### Requirement: Deterministic phrase parsing
The system SHALL parse common logging phrases without calling an AI model. These include weight with unit (kg, kilo(s), kilogram(s), lb, lbs, pound(s)), reps, set ordinals ("1st set", "set two"), durations ("60 seconds", "1 minute 30"), "bodyweight", multi-set shorthand ("3 sets of 10 at 20 kg"), and "same again" / "repeat". Filler words such as "done" SHALL be ignored. Number words SHALL be accepted as well as digits.

#### Scenario: Full phrase
- **WHEN** the phrase is "shoulder bench press 1st set 12 kg 15 reps done"
- **THEN** the parse yields exercise phrase "shoulder bench press", weight 12 kg, reps 15

#### Scenario: Reordered phrase with unit synonym
- **WHEN** the phrase is "15 reps at 12 kilos"
- **THEN** the parse yields weight 12 kg, reps 15, and the exercise is taken from the exercise currently open in the session

#### Scenario: Pounds converted
- **WHEN** the phrase is "curls 35 pounds 12 reps"
- **THEN** the parse yields weight 15.88 kg and reps 12

#### Scenario: Duration hold
- **WHEN** the phrase is "plank 60 seconds"
- **THEN** the parse yields exercise phrase "plank" and duration 60 s

#### Scenario: Bodyweight reps
- **WHEN** the phrase is "bodyweight pull ups 8 reps"
- **THEN** the parse yields exercise phrase "pull ups", no added weight, reps 8

#### Scenario: Multi-set shorthand
- **WHEN** the phrase is "3 sets of 10 at 20 kg lunges"
- **THEN** the parse yields three sets of lunges at 20 kg × 10

#### Scenario: Same again
- **WHEN** the phrase is "same again" and the user's last set in the active session was Squat 60 kg × 8
- **THEN** the parse yields one more Squat set at 60 kg × 8

#### Scenario: Same again with nothing to repeat
- **WHEN** the phrase is "same again" and there is no prior set in the active session
- **THEN** nothing is saved and the user is told there is no previous set to repeat

### Requirement: Exercise resolution
The exercise phrase SHALL be resolved to an exercise in this order: (1) an exact match on the user's personal aliases, (2) fuzzy matching against the names of seeded and the user's custom exercises. When the phrase contains no exercise, the exercise currently open in the active session SHALL be used. A match SHALL count as confident only when it is an alias match, or when the top fuzzy candidate clears the confidence threshold and leads the runner-up by the configured margin.

#### Scenario: Alias wins
- **WHEN** the user has an alias "shoulder bench press" → Dumbbell Shoulder Press and says "shoulder bench press 12 kg 15 reps"
- **THEN** the set resolves to Dumbbell Shoulder Press with confident status and no AI call is made

#### Scenario: Ambiguous fuzzy match
- **WHEN** the phrase "shoulder press" closely matches both Dumbbell Shoulder Press and Barbell Shoulder Press
- **THEN** the resolution is not confident and the top 3 candidates are returned

### Requirement: AI fallback
When deterministic parsing fails to produce valid set values, or the exercise is not resolved, the system SHALL send the transcript, plus a shortlist of candidate exercises, to the AI model using the user's own API key. The model's output MUST be validated against the set schema before use. Its exercise choice MUST be one of the supplied candidates or the user's exercises. AI output SHALL never be auto-saved unless it is unambiguous under the same rules as deterministic output.

#### Scenario: Messy phrase recovered by AI
- **WHEN** the phrase is "did twelve on the overhead dumbbell thing with the twelves, fifteen of them"
- **THEN** the AI fallback returns Dumbbell Shoulder Press, 12 kg, 15 reps, and the result is shown on the confirmation card

#### Scenario: Invalid AI output
- **WHEN** the AI returns reps of 0 or an exercise not in the candidate list
- **THEN** the output is discarded and the user sees the confirmation card with the deterministic candidates and editable fields

#### Scenario: No AI key configured
- **WHEN** a user without an AI key says a phrase that deterministic parsing cannot fully resolve
- **THEN** no AI call is made and the confirmation card is shown with fuzzy candidates and whatever values were parsed

#### Scenario: AI provider error
- **WHEN** the AI request fails or times out
- **THEN** the user sees the confirmation card with the deterministic result and a non-blocking notice that AI parsing was unavailable

### Requirement: Auto-save with undo for unambiguous sets
When the exercise is resolved confidently and all values required by its tracking mode are present and valid, the system SHALL save the set(s) immediately to the active session, starting one for today if none is active. It SHALL then show a notice summarising what was saved, with undo and edit actions available for at least 8 seconds.

#### Scenario: Unambiguous voice set saved
- **WHEN** the user says "squat 60 kg 8 reps" and Squat resolves confidently
- **THEN** the set is saved and a notice "Squat — set 3: 60 kg × 8" with Undo and Edit is shown

#### Scenario: Undo
- **WHEN** the user taps Undo on that notice
- **THEN** the set is deleted and the exercise's set numbering is restored

### Requirement: Confirmation card for ambiguous input
When the result is not unambiguous, the system SHALL show a confirmation card with the parsed values (editable) and up to 3 exercise candidates. Nothing SHALL be saved until the user confirms.

#### Scenario: User confirms candidate
- **WHEN** the card shows Dumbbell Shoulder Press, Barbell Shoulder Press and Arnold Press and the user picks Dumbbell Shoulder Press
- **THEN** the set is saved with the chosen exercise and edited values

#### Scenario: User dismisses card
- **WHEN** the user dismisses the confirmation card
- **THEN** nothing is saved

### Requirement: Personal aliases learned from confirmations
When a user confirms an exercise for a spoken phrase that did not already resolve by alias, the system SHALL store the normalised phrase as a personal alias for that exercise. Aliases MUST be private to the user, and users SHALL be able to view and delete their aliases.

#### Scenario: Alias learned
- **WHEN** the user confirms Dumbbell Shoulder Press for the phrase "shoulder bench press"
- **THEN** the next time they say "shoulder bench press 14 kg 10 reps" the set auto-saves as Dumbbell Shoulder Press

#### Scenario: Alias deleted
- **WHEN** the user deletes the alias "shoulder bench press"
- **THEN** that phrase is resolved by fuzzy matching again

### Requirement: Transcript retained with the set
Each set created from voice or text input SHALL store the original transcript text and its input source (`voice`, `text`, or `manual`) so the user can see what was heard.

#### Scenario: View transcript
- **WHEN** the user opens a set that was logged by voice
- **THEN** the original transcript is shown alongside the set values

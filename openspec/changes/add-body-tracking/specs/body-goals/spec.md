## Purpose

Lets users set body weight and body-fat goals and turns them into a deterministic goal phase, safe target rate and realistic timeline that nutrition and coaching can rely on.

## ADDED Requirements

### Requirement: Set a body goal
The system SHALL let a user set one active goal consisting of a goal weight, a goal body fat %, or both, plus an optional target date in the future; setting a new goal SHALL archive the previous active goal with its creation and archive dates.

#### Scenario: Weight and body fat goal
- **WHEN** a user sets goal weight 76 kg and goal body fat 14 % with no target date
- **THEN** that goal becomes the active goal

#### Scenario: Empty goal rejected
- **WHEN** a user submits a goal with neither weight nor body fat %
- **THEN** it is rejected with a validation message

#### Scenario: Replacing a goal
- **WHEN** a user with an active goal saves a new goal
- **THEN** the new goal is active and the previous one is listed in goal history as archived

#### Scenario: Past target date rejected
- **WHEN** a user enters a target date earlier than tomorrow
- **THEN** it is rejected with a validation message

### Requirement: Current baseline
The system SHALL evaluate goals against the current trend weight and the latest body composition (body fat % and lean mass); when no trend weight exists the system SHALL ask the user to log a weight before deriving a phase.

#### Scenario: No weight logged
- **WHEN** a user sets a goal but has no weight entries
- **THEN** the goal is saved and the goal view asks them to log a weight to see phase and timeline

### Requirement: Goal phase derivation
The system SHALL derive the goal phase deterministically from the weight change Δ = goal weight − current trend weight (using an implied goal weight when only a body fat goal is set): Δ < −2 kg is "cut"; Δ > +2 kg is "lean gain"; |Δ| ≤ 2 kg with a goal body fat % at least 1 percentage point below current is "recomposition"; otherwise "maintain".

#### Scenario: Cut
- **WHEN** current trend weight is 80 kg and goal weight is 74 kg
- **THEN** the phase is cut

#### Scenario: Lean gain
- **WHEN** current trend weight is 68 kg and goal weight is 72 kg
- **THEN** the phase is lean gain

#### Scenario: Recomposition
- **WHEN** current trend weight is 78 kg at 22 % body fat and the goal is 78 kg at 16 %
- **THEN** the phase is recomposition

#### Scenario: Maintain
- **WHEN** current trend weight is 78 kg and goal weight is 79 kg with no body fat goal
- **THEN** the phase is maintain

#### Scenario: Body fat goal without measurement
- **WHEN** only a goal body fat % is set and the user has no body composition test
- **THEN** no phase is derived and the user is asked to add a body composition test or a goal weight

### Requirement: Goal projections
The system SHALL project goal composition: when both goal weight and goal body fat % are set, goal fat mass = goal weight × goal body fat % and goal lean mass = goal weight − goal fat mass; when only a body fat goal is set, the implied goal weight = current lean mass / (1 − goal body fat %), assuming lean mass is preserved; when only a goal weight is set in a cut, projected body fat % assumes current lean mass is preserved.

#### Scenario: Implied goal weight
- **WHEN** current lean mass is 64 kg and the goal is 15 % body fat with no goal weight
- **THEN** the implied goal weight is 75.3 kg

#### Scenario: Projected body fat for cut
- **WHEN** current lean mass is 64 kg and goal weight is 74 kg
- **THEN** the projected goal body fat is 13.5 %

#### Scenario: Goal below lean mass
- **WHEN** goal weight is lower than current lean mass
- **THEN** a warning states the goal would require losing lean mass

### Requirement: Safe target rate and timeline
The system SHALL assign a target weekly rate per phase — cut: 0.5 % of current trend weight per week by default, at most 1.0 %; lean gain: 0.5 kg/month for beginners, 0.25 kg/month for intermediate and 0.125 kg/month for advanced lifters (from the profile's strength experience), each being both the default and the maximum; maintain and recomposition: 0 kg/week — and SHALL estimate the weeks to goal from that rate for cut and lean gain.

#### Scenario: Default cut timeline
- **WHEN** a cut goes from 80 kg to 76 kg with no target date
- **THEN** the target rate is −0.40 kg/week and the estimated time to goal is 10 weeks

#### Scenario: Beginner lean gain
- **WHEN** a beginner lean-gain goal goes from 68 kg to 70 kg
- **THEN** the target rate is +0.5 kg/month and the estimated time to goal is about 4 months

### Requirement: Target date validation
The system SHALL, when a target date is set, compute the rate required to reach the goal by that date; if the required rate exceeds the phase's maximum safe rate the system SHALL warn and propose the earliest safe date; if it is between the default and the maximum the system SHALL use the required rate as the target rate.

#### Scenario: Aggressive cut date
- **WHEN** a cut from 80 kg to 72 kg has a target date 6 weeks away (requires 1.67 %/week)
- **THEN** a warning is shown and the earliest safe date at 1.0 %/week (10 weeks from today) is proposed

#### Scenario: Moderate cut date
- **WHEN** a cut from 80 kg to 76 kg has a target date 7 weeks away (requires 0.71 %/week)
- **THEN** no warning is shown and the target rate is −0.57 kg/week

### Requirement: Unrealistic goal warnings
The system SHALL warn, without blocking, when the goal body fat % (stated or projected) is below 8 % for male profiles or 15 % for female profiles, or when the goal weight implies a BMI below 18.5 given the profile height.

#### Scenario: Very low body fat goal
- **WHEN** a male user sets goal body fat 6 %
- **THEN** the goal is saved with a warning that this level is hard to sustain and may impair health and performance

#### Scenario: Low BMI
- **WHEN** a 180 cm user sets goal weight 58 kg
- **THEN** the goal is saved with a warning that it implies a BMI of 17.9

### Requirement: Goal progress view
The system SHALL show current versus goal weight and body fat %, the trend direction (toward goal, away from goal, or flat when |rate| < 0.1 kg/week), and an ETA computed from the current 14-day trend rate when moving toward the goal, or "not converging" otherwise.

#### Scenario: ETA from trend
- **WHEN** trend weight is 78.0 kg, goal weight is 76.0 kg and the current rate is −0.5 kg/week
- **THEN** the view shows "toward goal" with an ETA of 4 weeks

#### Scenario: Moving away
- **WHEN** a cut goal is active and the current rate is +0.3 kg/week
- **THEN** the view shows "away from goal" and "not converging"

### Requirement: Goal outputs for other features
The system SHALL expose, per user, the active goal phase and signed target weekly rate in kg/week (or none when no phase can be derived) for consumption by other features.

#### Scenario: Cut exposed
- **WHEN** an active cut has target rate −0.40 kg/week
- **THEN** other features read phase "cut" and rate −0.40 kg/week

#### Scenario: Nothing to expose
- **WHEN** no goal is active
- **THEN** other features read no phase and no rate

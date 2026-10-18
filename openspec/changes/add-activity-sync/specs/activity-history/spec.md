## Purpose

Gives the user one place to review synced and imported activities, weekly running volume, training load and daily recovery metrics. The training load it computes is also used by coaching features.

## ADDED Requirements

### Requirement: Activity list
The system SHALL list the user's activities newest first, showing date and start time in the user's timezone, sport, distance, moving duration, pace or speed, and average heart rate when available, and SHALL support filtering by sport.

#### Scenario: Mixed sources listed once
- **WHEN** the user has activities from Apple Health and from FIT uploads, including one merged activity
- **THEN** each activity appears exactly once, newest first

#### Scenario: Filter by sport
- **WHEN** the user filters the list to running
- **THEN** only running activities are shown

#### Scenario: Timezone-correct date
- **WHEN** an activity started at 23:30 UTC on 2026-06-14 and the user's timezone is Europe/Copenhagen
- **THEN** the list shows it on 2026-06-15 at 01:30

### Requirement: Activity detail
The system SHALL show for each activity its summary fields, its sources (Apple Health, FIT file or both), the per-kilometre splits table and the HR zone distribution when available, and SHALL let the user delete the activity.

#### Scenario: Detail of an imported run
- **WHEN** the user opens a run imported from a FIT file
- **THEN** the detail shows summary, splits table and a time-in-zone bar for zones 1–5

#### Scenario: Detail of an Apple Health-only workout
- **WHEN** the user opens a workout that only came from Apple Health
- **THEN** the detail shows the available summary fields and states that splits and zones require a FIT upload

#### Scenario: Delete activity
- **WHEN** the user deletes an activity and confirms
- **THEN** the activity disappears from the list and from weekly summaries and training load

### Requirement: Weekly running summary
The system SHALL summarise each calendar week (Monday–Sunday in the user's timezone) with total running distance, number of runs, longest run distance and total moving time across all sports, and SHALL show the current week alongside at least the previous 8 weeks.

#### Scenario: Weekly totals
- **WHEN** the user ran 5 km on Tuesday, 8 km on Thursday and 16 km on Sunday of the same week
- **THEN** that week shows 29 km, 3 runs and a longest run of 16 km

#### Scenario: Week boundary in user timezone
- **WHEN** a run starts at 23:30 Europe/Copenhagen time on a Sunday
- **THEN** it counts toward the week that ends on that Sunday

### Requirement: Training load
The system SHALL compute a load value for each activity as moving minutes × intensity factor. The intensity factor SHALL be the zone number (1–5) of the activity's average heart rate. When heart rate is unavailable, it SHALL be a sport default (walking 1, all other sports 2).

From these the system SHALL show acute load (sum over the last 7 days), chronic load (sum over the last 28 days ÷ 4), and their ratio. The ratio SHALL be shown only once at least 21 days have passed since the user's first activity.

#### Scenario: Load with heart rate
- **WHEN** a 60-minute run has an average heart rate in zone 2
- **THEN** its load is 120

#### Scenario: Load without heart rate
- **WHEN** a 30-minute walk has no heart rate data
- **THEN** its load is 30

#### Scenario: Ratio withheld while building baseline
- **WHEN** the user's first activity was 10 days ago
- **THEN** acute load is shown and the ratio area says "building baseline" instead of a number

#### Scenario: Ratio shown
- **WHEN** the user has 28 days of history with acute load 600 and 28-day load 2000
- **THEN** chronic load shows 500 and the ratio shows 1.2

### Requirement: Daily metric trends
The system SHALL show recent daily metrics (steps, active energy, resting heart rate, HRV, sleep duration, VO2max, weight) with a 7-day average per metric. The average SHALL use only days with a known value and SHALL display "not available" when fewer than 3 of the last 7 days have a value.

#### Scenario: Average excludes missing days
- **WHEN** resting heart rate is known on 5 of the last 7 days with values 50, 52, 51, 49, 53
- **THEN** the 7-day average shows 51 bpm

#### Scenario: Insufficient data
- **WHEN** HRV is known on only 2 of the last 7 days
- **THEN** the HRV 7-day average shows "not available"

### Requirement: Data isolation
The system MUST only ever return activities, daily metrics, splits and stored files to the user who owns them.

#### Scenario: Cross-user access denied
- **WHEN** user B requests user A's activity by its identifier
- **THEN** the system responds as if the activity does not exist

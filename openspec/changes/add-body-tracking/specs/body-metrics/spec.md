## Purpose

Lets users record body weight and circumference measurements and see noise-resistant trends, so day-to-day water and glycogen swings do not hide real progress.

## ADDED Requirements

### Requirement: Manual weight entry
The system SHALL let a signed-in user record a body weight with a timestamp, accept input in the user's display unit, store it canonically in kilograms, and allow multiple entries on the same day.

#### Scenario: Log weight in metric
- **WHEN** a user with metric units enters 78.4 kg at 07:10 local time
- **THEN** an entry of 78.4 kg with that timestamp is stored and appears in the weight history

#### Scenario: Log weight in imperial
- **WHEN** a user with imperial units enters 172.8 lb
- **THEN** the entry is stored as 78.38 kg (rounded to 0.01 kg) and displayed back as 172.8 lb

#### Scenario: Reject implausible weight
- **WHEN** a user enters a weight below 20 kg or above 400 kg
- **THEN** the entry is rejected with a validation message and nothing is stored

### Requirement: Canonical daily weight
The system SHALL derive exactly one daily weight per user per local calendar day (in the user's timezone): the earliest manual entry of that day when one exists, otherwise the Apple Health daily weight ingested for that date.

#### Scenario: Multiple manual entries in a day
- **WHEN** a user logs 78.4 kg at 07:10 and 79.6 kg at 21:00 on the same local day
- **THEN** the daily weight for that day is 78.4 kg

#### Scenario: Manual entry beats Apple Health
- **WHEN** Apple Health supplies 78.9 kg for a date and the user manually logs 78.4 kg on that same local day
- **THEN** the daily weight for that day is 78.4 kg

#### Scenario: Apple Health only
- **WHEN** only an Apple Health weight of 78.9 kg exists for a date
- **THEN** the daily weight for that date is 78.9 kg

#### Scenario: Day boundary uses user timezone
- **WHEN** a Europe/Copenhagen user logs a weight at 23:30 UTC on 14 March (00:30 local on 15 March)
- **THEN** the entry counts toward 15 March

### Requirement: Weight entry editing and deletion
The system SHALL let a user edit or delete their own manual weight entries, SHALL NOT allow editing Apple Health entries, and SHALL recompute daily weight and trend after any change.

#### Scenario: Delete a mistaken entry
- **WHEN** a user deletes the only manual entry for a day that also has an Apple Health weight
- **THEN** the daily weight falls back to the Apple Health value and the trend is recomputed

### Requirement: Trend weight
The system SHALL compute a trend weight series as an exponentially weighted moving average of daily weights with smoothing factor 0.1, seeded with the first daily weight, carrying the previous trend value forward across days without a weight.

#### Scenario: Trend smooths a spike
- **WHEN** the trend is 78.0 kg and the next daily weight is 80.0 kg
- **THEN** the new trend weight is 78.2 kg

#### Scenario: Missing days
- **WHEN** a user has no weight for three consecutive days
- **THEN** the trend value for those days equals the last computed trend and the series has no gaps

### Requirement: Rate of change
The system SHALL report the weekly rate of change of trend weight as both kilograms per week and percent per week (relative to the trend weight at the start of the window), computed over the most recent 14 days, and SHALL show "not enough data" when fewer than 7 daily weights exist in that window.

#### Scenario: Losing weight
- **WHEN** the trend weight moved from 80.0 kg to 79.2 kg over the last 14 days
- **THEN** the rate shows -0.40 kg/week and -0.50 %/week

#### Scenario: Sparse data
- **WHEN** only 5 daily weights exist in the last 14 days
- **THEN** the rate is shown as "not enough data"

### Requirement: Circumference measurements
The system SHALL let a user record optional circumference measurements (waist at navel, hips, chest, upper arm, thigh) for a date, stored in centimetres, where any subset of fields may be provided.

#### Scenario: Waist only
- **WHEN** a user records only a waist measurement of 86.5 cm for today
- **THEN** a measurement entry with waist 86.5 cm and the other fields empty is stored

#### Scenario: Reject implausible measurement
- **WHEN** a user enters a waist of 5 cm or 300 cm
- **THEN** the entry is rejected with a validation message

### Requirement: Body metrics charts
The system SHALL display charts of daily weight with trend weight overlaid and of each circumference measurement over selectable ranges of 4 weeks, 12 weeks and 1 year, in the user's display units.

#### Scenario: Range switch
- **WHEN** a user switches the weight chart from 4 weeks to 12 weeks
- **THEN** the chart shows daily weights and the trend line for the last 12 weeks

#### Scenario: Waist highlighted
- **WHEN** a user has at least two waist measurements
- **THEN** the body overview shows the waist change since the first measurement in the selected range

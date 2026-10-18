## Purpose

Lets a user upload the original activity files exported from Garmin Connect so runs and other workouts are recorded with full detail: splits, heart rate zones and elevation.

## ADDED Requirements

### Requirement: Accepted file types
The system SHALL accept uploads of a single `.fit` file or a `.zip` archive containing exactly one `.fit` file (the Garmin Connect "Export Original" format), up to 25 MB, and MUST reject any other input with a clear error message.

#### Scenario: FIT file uploaded
- **WHEN** the user uploads a valid `.fit` file of a run
- **THEN** a running activity is created and the user is taken to its detail view

#### Scenario: Garmin export zip uploaded
- **WHEN** the user uploads a `.zip` containing one `.fit` file
- **THEN** the system extracts and imports that file as one activity

#### Scenario: Unsupported file
- **WHEN** the user uploads a `.gpx`, an image, or a zip without a `.fit` file
- **THEN** the system shows an error that only `.fit` or Garmin export `.zip` files are supported and stores nothing

### Requirement: Corrupt files leave no trace
The system SHALL treat an upload as all-or-nothing: if the file cannot be decoded or lacks a session record, it MUST show a readable error and MUST NOT store the file, an activity, or any partial data.

#### Scenario: Corrupt FIT file
- **WHEN** the user uploads a truncated or corrupt `.fit` file
- **THEN** the system shows "This file could not be read as a FIT activity" and no activity or stored file exists afterwards

### Requirement: Extracted activity fields
The system SHALL extract from each imported file: sport and sub-sport, start time, elapsed duration and moving (timer) duration, distance, average and maximum heart rate, average pace (running/walking) or average speed (other sports), total elevation gain, and calories, storing any field absent from the file as unknown.

#### Scenario: Run summary extracted
- **WHEN** a 10.0 km run with 52:30 timer time is imported
- **THEN** the activity shows 10.00 km, 52:30 moving time and an average pace of 5:15 /km

#### Scenario: Activity without heart rate
- **WHEN** the file has no heart rate data
- **THEN** heart rate fields and HR zones show "not available" and the import still succeeds

### Requirement: Per-kilometre splits
For running and walking activities with distance data, the system SHALL compute splits for each full kilometre plus a final partial split, each with duration, pace, average heart rate (when available) and elevation change.

#### Scenario: Splits for a 5.4 km run
- **WHEN** a 5.4 km run is imported
- **THEN** the activity shows five 1 km splits and one 0.4 km split, with the partial split's pace normalised to per-km

### Requirement: Heart rate zone distribution
The system SHALL compute time spent in each of 5 heart-rate zones, defined as 50–60%, 60–70%, 70–80%, 80–90% and 90–100% of the user's max heart rate. It SHALL use the optional max heart rate from the user's profile, otherwise an estimate of 208 − 0.7 × age, and SHALL show which source was used.

#### Scenario: Profile max HR used
- **WHEN** the user's profile max heart rate is 190 and an activity is imported
- **THEN** zone 2 is 114–133 bpm and the detail view labels the max HR as "from your profile"

#### Scenario: Estimated max HR
- **WHEN** the user has no profile max heart rate and is 30 years old
- **THEN** the system uses 187 bpm and labels it "estimated from age"

#### Scenario: Max HR field edited
- **WHEN** the user sets or changes the max heart rate field in their profile
- **THEN** HR zones of all activities are recomputed with the new value

### Requirement: Duplicate upload prevention
The system SHALL detect when an uploaded file describes an activity already imported from a file (same sport and start time within ±2 minutes) and MUST NOT create a second activity.

#### Scenario: Same file uploaded twice
- **WHEN** the user uploads a file already imported
- **THEN** no new activity is created and the user is told the activity already exists, with a link to it

### Requirement: Merge with Apple Health workouts
When an uploaded file matches an activity that came from Apple Health (same sport, start time within ±2 minutes), the system SHALL merge both into one activity. Detailed fields from the file (splits, HR zones, elevation, distance, durations, heart rate) MUST take precedence over the Apple Health values, and later Apple Health posts of that workout MUST NOT overwrite the file-derived fields.

#### Scenario: Apple Health workout then FIT upload
- **WHEN** a run arrived via Apple Health and the user then uploads its `.fit` file
- **THEN** exactly one activity exists, showing the file's splits and HR zones, and it is marked as having both sources

#### Scenario: Apple Health repost after merge
- **WHEN** the Shortcut posts the same workout again after the file was merged
- **THEN** the activity keeps the file-derived distance, duration and heart rate values

### Requirement: Private storage of original files
The system SHALL keep each successfully imported original file in private storage readable only by its owner, so activities can be re-derived, and SHALL delete the file when the activity or the account is deleted.

#### Scenario: Owner-only access
- **WHEN** another user or an unauthenticated request tries to read a stored activity file
- **THEN** access is denied

#### Scenario: Activity deletion removes file
- **WHEN** the user deletes an imported activity
- **THEN** its stored original file is deleted as well
